/**
 * ============================================================================
 * VAMUSS SDR — ADAPTADOR OFICIAL WHATSAPP BUSINESS CLOUD API (FASE B.12.8)
 * ============================================================================
 * Implementação do adaptador oficial da Meta (Graph API v20.0).
 * 
 * Responsabilidades:
 * 1. Verificação segura de webhook da Meta (hub.challenge e hub.verify_token).
 * 2. Validação criptográfica de autenticidade (HMAC SHA-256 com app secret).
 * 3. Deduplicação e idempotência de eventos (LRU cache de wamid).
 * 4. Tratamento de mensagens recebidas, associação ao CRM e registo de inbound.
 * 5. Deteção imediata de recusa/opt-out (STOP, PARAR) e supressão fail-closed.
 * 6. Envio seguro com respeito a horários (09h00-17h00 Europe/Lisbon) e supressão.
 * 7. Consulta de estado sem exposição de credenciais.
 * ============================================================================
 */

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { addLocalSuppression, isPhoneSuppressedLocally } from './suppression_store.js';
import { enqueueTask, TASK_TYPES } from './sdr_task_queue.js';
import { defaultSDRWorker } from './sdr_worker.js';
import { readLocalOutcomes, writeLocalOutcomes } from './sdr_engine.js';
import { isWithinBusinessHours, validateDispatchTiming } from './sdr_business_hours.js';
import { getWhatsAppWebStatus, sendWhatsAppWebMessage } from './whatsapp_web.js';

// Cache em memória para idempotência de mensagens recebidas (máx 1000 IDs)
const processedMessageIds = new Set();
function recordMessageId(id) {
    if (!id) return;
    if (processedMessageIds.size > 1000) {
        const first = processedMessageIds.values().next().value;
        processedMessageIds.delete(first);
    }
    processedMessageIds.add(id);
}

// Cache em memória para prevenção de disparos duplicados recentes (TTL 10 min)
const recentDispatches = new Map();
function cleanRecentDispatches() {
    const now = Date.now();
    for (const [key, timestamp] of recentDispatches.entries()) {
        if (now - timestamp > 10 * 60 * 1000) {
            recentDispatches.delete(key);
        }
    }
}

// Inicializar cliente Supabase para o adaptador
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Validação de HMAC SHA256 do webhook da Meta
 */
function verifyMetaSignature(req, appSecret) {
    if (!appSecret) return true; // Se não configurado, não bloqueia em desenvolvimento local
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return false;

    const rawBody = req.rawBody || JSON.stringify(req.body);
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
        return false;
    }
}

/**
 * Normaliza número de telefone para busca no CRM
 */
function cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

/**
 * B.14.2.1: Centralizado via api/sdr_business_hours.js (09h00-17h00 Seg-Sex, feriados excluídos)
 */
export const isWithinPortugalBusinessHours = isWithinBusinessHours;

/**
 * B.14.2: Processa atualização de estado de entrega de mensagem WhatsApp (delivered, read, failed)
 */
export async function processWhatsAppDeliveryStatus(st) {
    const wamid = st.id;
    const status = st.status;
    console.log(`📊 [WhatsApp Status] Mensagem ${wamid} transitou para status: ${status}`);

    let outcomeUpdated = false;
    if (status === 'delivered' || status === 'read') {
        const local = readLocalOutcomes();
        let changed = false;
        for (const o of local) {
            if (o.channel === 'WHATSAPP' && (o.outcome === 'EXECUTADA' || o.outcome === 'ENTREGUE') && (!o.delivery_status || o.delivery_status === 'sent' || o.delivery_status === 'delivered')) {
                o.delivery_status = status;
                o.outcome = 'ENTREGUE';
                o.updated_at = new Date().toISOString();
                changed = true;
                outcomeUpdated = true;
                break;
            }
        }
        if (changed) writeLocalOutcomes(local);
    }
    return { success: true, wamid, status, outcomeUpdated };
}

/**
 * B.14.2: Processa mensagem inbound recebida via WhatsApp, associando ao CRM e enfileirando avaliação
 */
export async function processWhatsAppInboundMessage(msg, metadata = {}) {
    const wamid = msg.id;

    // Idempotência
    if (processedMessageIds.has(wamid)) {
        console.log(`🔁 [WhatsApp Webhook] Mensagem ${wamid} já processada. Ignorando duplicação.`);
        return { success: true, duplicated: true };
    }
    recordMessageId(wamid);

    const fromPhone = cleanPhone(msg.from);
    const msgType = msg.type;
    let textContent = '';
    if (msgType === 'text') {
        textContent = msg.text?.body || '';
    } else if (msgType === 'button') {
        textContent = msg.button?.text || '';
    } else if (msgType === 'interactive') {
        textContent = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
    } else {
        textContent = `[Mensagem recebida do tipo ${msgType}]`;
    }

    console.log(`📥 [WhatsApp Inbound] Recebido de +${fromPhone}: "${textContent}"`);

    let contact = null;
    let dealId = null;
    let dealUserId = null;
    let isDealDisqualified = false;

    if (supabase) {
        try {
            // 1. Procurar contacto pelo número de telefone no CRM
            const { data: contacts } = await supabase
                .from('contacts')
                .select('id, name, user_id')
                .or(`phone.ilike.%${fromPhone.slice(-9)}%`);

            contact = (contacts && contacts.length > 0) ? contacts[0] : null;

            // 2. Procurar negócio ativo ou mais recente associado
            if (contact) {
                const { data: deals } = await supabase
                    .from('deals')
                    .select('id, user_id, status, stage_id, lost_reason')
                    .eq('contact_id', contact.id)
                    .order('created_at', { ascending: false })
                    .limit(1);
                if (deals && deals.length > 0) {
                    dealId = deals[0].id;
                    dealUserId = deals[0].user_id || dealUserId;
                    isDealDisqualified = (deals[0].lost_reason || '').toLowerCase().includes('desqualificad') || deals[0].stage_id === 'disqualified';
                }
            }
        } catch (e) {
            console.warn('⚠️ [WhatsApp Inbound] Erro ao consultar Supabase:', e.message);
        }
    }

    // 3. Detetar se é pedido de oposição / opt-out
    const normalizedText = textContent.trim().toUpperCase();
    const isOptOut = /^(STOP|PARAR|CANCELAR|SAIR|NÃO|NAO|NÃO QUERO|REMOVER|NÃO CONTACTAR)/i.test(normalizedText);

    if (isOptOut) {
        console.log(`🛑 [WhatsApp Opt-Out] Pedido explícito de supressão de +${fromPhone}!`);
        addLocalSuppression({
            deal_id: dealId,
            contact_id: contact?.id || null,
            telefone_normalizado: fromPhone,
            motivo_bloqueio: 'OPTOUT_EXPLICITO',
            canal_bloqueado: 'TODOS'
        });
        if (supabase) {
            try {
                await supabase.from('sdr_suppression_list').insert({
                    deal_id: dealId,
                    contact_id: contact?.id || null,
                    telefone_normalizado: fromPhone,
                    motivo_bloqueio: 'OPTOUT_EXPLICITO',
                    origem_bloqueio: 'RESPOSTA_INBOUND',
                    canal_bloqueado: 'TODOS',
                    evidencia: `Mensagem inbound WhatsApp: "${textContent}"`,
                    estado: 'ativo'
                });
            } catch (err) {
                console.warn('⚠️ [WhatsApp Opt-Out] Erro ao persistir supressão no Supabase:', err.message);
            }
        }
    }

    // 4. Registar atividade factual na timeline se deal existir
    if (supabase && dealId && dealUserId) {
        try {
            await supabase.from('activities').insert({
                user_id: dealUserId,
                deal_id: dealId,
                type: 'whatsapp',
                title: isOptOut ? 'Oposição Recebida via WhatsApp (Opt-Out)' : 'Resposta Inbound Recebida via WhatsApp',
                notes: textContent,
                date: new Date().toISOString(),
                completed: true
            });
        } catch (err) {
            console.warn('⚠️ [WhatsApp Inbound] Erro ao gravar atividade no Supabase:', err.message);
        }
    }

    // 5. B.14.2 & B.14.3.2: Encaminhar para o pipeline autónomo via Fila de Tarefas (se não for desqualificado)
    let queueRes = { success: false };
    if (!isDealDisqualified) {
        const targetDealId = dealId || `deal_inbound_${fromPhone}`;
        queueRes = enqueueTask({
            dealId: targetDealId,
            contactId: contact?.id || null,
            taskType: TASK_TYPES.EVALUATE_INBOUND,
            channel: 'WHATSAPP',
            priority: 'ALTA',
            payload: {
                fromPhone,
                textContent,
                wamid,
                receivedAt: new Date().toISOString()
            }
        });
    } else {
        console.log(`🛑 [WhatsApp Inbound] Lead desqualificado +${fromPhone}. Automação de resposta não será enfileirada.`);
    }

    return {
        success: true,
        dealId,
        contactId: contact?.id || null,
        isDealDisqualified,
        wamid,
        fromPhone,
        isOptOut,
        enqueuedTask: queueRes.success,
        taskId: queueRes.taskId,
        task: queueRes.task
    };
}

export function setupWhatsApp(app) {
    console.log('📱 [SDR WhatsApp Cloud API] Inicializando módulo de integração oficial da Meta...');

    /**
     * 1. GET /api/whatsapp/status
     * Informa o estado da integração com a Cloud API sem revelar segredos.
     */
    app.get('/api/whatsapp/status', (req, res) => {
        const hasToken = !!process.env.WHATSAPP_ACCESS_TOKEN;
        const hasPhoneId = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
        const hasWabaId = !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        const hasVerifyToken = !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
        const hasSecret = !!process.env.WHATSAPP_APP_SECRET;

        const isFullyConfigured = hasToken && hasPhoneId && hasWabaId && hasVerifyToken;
        const webStatus = getWhatsAppWebStatus();

        return res.json({
            provider: webStatus.isConnected ? 'WhatsApp Web (Baileys Multi-Device)' : 'Meta WhatsApp Business Cloud API (Graph API v20.0)',
            configured: isFullyConfigured || webStatus.isConnected,
            mode: webStatus.isConnected ? 'whatsapp_web_live' : (isFullyConfigured ? 'cloud_api_live' : 'manual_shadow_ready'),
            status: (webStatus.isConnected || isFullyConfigured) ? 'OPERATIONAL' : 'PENDING_CONFIGURATION',
            whatsappWeb: webStatus,
            checks: {
                whatsappWebConnected: webStatus.isConnected,
                hasAccessToken: hasToken,
                hasPhoneNumberId: hasPhoneId,
                hasBusinessAccountId: hasWabaId,
                hasWebhookVerifyToken: hasVerifyToken,
                hasAppSecret: hasSecret
            },
            operationalGuide: '/docs/GUIA_CONFIGURACAO_WHATSAPP_META.md',
            notice: webStatus.isConnected
                ? `WhatsApp Web conectado com sucesso (+${webStatus.connectedUser?.phone || 'telemóvel do operador'}). Histórico no telemóvel preservado.`
                : (isFullyConfigured
                    ? 'Integração oficial Meta ativa e pronta para envios autorizados.'
                    : 'Aponte a câmara do WhatsApp no seu telemóvel para o QR Code em /api/whatsapp-web/qr para ativar a conexão.')
        });
    });

    /**
     * 2. GET /api/webhooks/whatsapp
     * Verificação obrigatória de Webhook pela Meta (Challenge Handshake).
     */
    app.get('/api/webhooks/whatsapp', (req, res) => {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'vamuss_sdr_webhook_verify_2026';

        if (mode && token) {
            if (mode === 'subscribe' && token === expectedToken) {
                console.log('✅ [WhatsApp Webhook] Desafio de verificação Meta validado com sucesso!');
                return res.status(200).send(challenge);
            } else {
                console.warn('⚠️ [WhatsApp Webhook] Token de verificação inválido fornecido pela Meta.');
                return res.sendStatus(403);
            }
        }

        return res.status(400).json({ error: 'Parâmetros de handshake ausentes' });
    });

    /**
     * 3. POST /api/webhooks/whatsapp
     * Receção de mensagens e notificações de entrega enviadas pela Cloud API.
     */
    app.post('/api/webhooks/whatsapp', async (req, res) => {
        // Responder 200 imediatamente à Meta para evitar retentativas indesejadas
        res.status(200).send('EVENT_RECEIVED');

        try {
            // Validar assinatura HMAC se configurada
            if (process.env.WHATSAPP_APP_SECRET && !verifyMetaSignature(req, process.env.WHATSAPP_APP_SECRET)) {
                console.warn('🚨 [WhatsApp Webhook] Assinatura X-Hub-Signature-256 inválida! Evento descartado.');
                return;
            }

            const body = req.body;
            if (!body || body.object !== 'whatsapp_business_account') {
                return;
            }

            const entries = body.entry || [];
            for (const entry of entries) {
                const changes = entry.changes || [];
                for (const change of changes) {
                    if (change.field !== 'messages') continue;
                    const value = change.value;
                    if (!value) continue;

                    // A. Tratar atualizações de estado (sent, delivered, read, failed)
                    const statuses = value.statuses || [];
                    for (const st of statuses) {
                        const wamid = st.id;
                        const status = st.status;
                        console.log(`📊 [WhatsApp Status] Mensagem ${wamid} transitou para status: ${status}`);

                        // B.14.2: Atualizar entrega no repositório de outcomes
                        if (status === 'delivered' || status === 'read') {
                            const local = readLocalOutcomes();
                            let changed = false;
                            for (const o of local) {
                                if (o.channel === 'WHATSAPP' && o.outcome === 'EXECUTADA' && (!o.delivery_status || o.delivery_status === 'sent')) {
                                    o.delivery_status = status;
                                    o.outcome = 'ENTREGUE';
                                    o.updated_at = new Date().toISOString();
                                    changed = true;
                                    break;
                                }
                            }
                            if (changed) writeLocalOutcomes(local);
                        }
                    }

                    // B. Tratar mensagens recebidas (Inbound)
                    const messages = value.messages || [];
                    for (const msg of messages) {
                        const wamid = msg.id;

                        // Idempotência
                        if (processedMessageIds.has(wamid)) {
                            console.log(`🔁 [WhatsApp Webhook] Mensagem ${wamid} já processada. Ignorando duplicação.`);
                            continue;
                        }
                        recordMessageId(wamid);

                        const fromPhone = cleanPhone(msg.from);
                        const msgType = msg.type;
                        let textContent = '';
                        if (msgType === 'text') {
                            textContent = msg.text?.body || '';
                        } else if (msgType === 'button') {
                            textContent = msg.button?.text || '';
                        } else if (msgType === 'interactive') {
                            textContent = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
                        } else {
                            textContent = `[Mensagem recebida do tipo ${msgType}]`;
                        }

                        console.log(`📥 [WhatsApp Inbound] Recebido de +${fromPhone}: "${textContent}"`);

                        if (!supabase) {
                            console.warn('⚠️ [WhatsApp Webhook] Supabase não configurado para persistência.');
                            continue;
                        }

                        // 1. Procurar contacto pelo número de telefone no CRM
                        const { data: contacts } = await supabase
                            .from('contacts')
                            .select('id, name, user_id')
                            .or(`phone.ilike.%${fromPhone.slice(-9)}%`);

                        const contact = (contacts && contacts.length > 0) ? contacts[0] : null;

                        // 2. Procurar negócio ativo ou mais recente associado
                        let dealId = null;
                        let dealUserId = contact?.user_id || null;
                        let isDealDisqualified = false;
                        if (contact) {
                            const { data: deals } = await supabase
                                .from('deals')
                                .select('id, user_id, status, stage_id, lost_reason')
                                .eq('contact_id', contact.id)
                                .order('created_at', { ascending: false })
                                .limit(1);
                            if (deals && deals.length > 0) {
                                dealId = deals[0].id;
                                dealUserId = deals[0].user_id || dealUserId;
                                isDealDisqualified = (deals[0].lost_reason || '').toLowerCase().includes('desqualificad') || deals[0].stage_id === 'disqualified';
                            }
                        }

                        // 3. Detetar se é pedido de oposição / opt-out
                        const normalizedText = textContent.trim().toUpperCase();
                        const isOptOut = /^(STOP|PARAR|CANCELAR|SAIR|NÃO|NAO|NÃO QUERO|REMOVER|NÃO CONTACTAR)/i.test(normalizedText);

                        if (isOptOut) {
                            console.log(`🛑 [WhatsApp Opt-Out] Pedido explícito de supressão de +${fromPhone}!`);
                            addLocalSuppression({
                                deal_id: dealId,
                                contact_id: contact?.id || null,
                                telefone_normalizado: fromPhone,
                                motivo_bloqueio: 'OPTOUT_EXPLICITO',
                                canal_bloqueado: 'TODOS'
                            });
                            await supabase.from('sdr_suppression_list').insert({
                                deal_id: dealId,
                                contact_id: contact?.id || null,
                                telefone_normalizado: fromPhone,
                                motivo_bloqueio: 'OPTOUT_EXPLICITO',
                                origem_bloqueio: 'RESPOSTA_INBOUND',
                                canal_bloqueado: 'TODOS',
                                evidencia: `Mensagem inbound WhatsApp: "${textContent}"`,
                                estado: 'ativo'
                            });
                        }

                        // 4. Registar atividade factual na timeline
                        if (dealId && dealUserId) {
                            await supabase.from('activities').insert({
                                user_id: dealUserId,
                                deal_id: dealId,
                                type: 'whatsapp',
                                title: isOptOut ? 'Oposição Recebida via WhatsApp (Opt-Out)' : 'Resposta Inbound Recebida via WhatsApp',
                                notes: textContent,
                                date: new Date().toISOString(),
                                completed: true
                            });
                        }

                        // 5. B.14.2 & B.14.3.2: Encaminhar para o pipeline autónomo via Fila de Tarefas (se não for desqualificado)
                        if (dealId && !isDealDisqualified) {
                            const queueRes = enqueueTask({
                                dealId,
                                contactId: contact?.id || null,
                                taskType: TASK_TYPES.EVALUATE_INBOUND,
                                channel: 'WHATSAPP',
                                priority: 'ALTA',
                                payload: {
                                    fromPhone,
                                    textContent,
                                    wamid,
                                    receivedAt: new Date().toISOString()
                                }
                            });

                            if (queueRes.success && queueRes.task) {
                                // Disparo assíncrono imediato para não bloquear resposta 200 à Meta
                                setImmediate(() => {
                                    defaultSDRWorker.processTask(queueRes.task).catch(err => {
                                        console.error('❌ [WhatsApp Inbound] Erro ao processar tarefa inbound:', err.message);
                                    });
                                });
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('❌ [WhatsApp Webhook] Erro ao processar payload:', err.message);
        }
    });

    /**
     * 4. POST /api/whatsapp/send
     * Envio controlado pela Cloud API com cadeia estrita de salvaguardas no backend (Fase B.13.4):
     * 1. Validação de parâmetros mínimos
     * 2. Elegibilidade do Canal (telemóvel móvel português: 9 dígitos a iniciar por 9)
     * 3. Aprovação Humana Explícita (isApproved: true)
     * 4. Verificação Fail-Closed de Supressão (Local + Supabase)
     * 5. Horário Comercial em Portugal Continental (Europe/Lisbon 09h00-17h00 Seg-Sex)
     * 6. Respiro Comercial de 30 dias para negócios encerrados/perdidos
     * 7. Idempotência temporal de envio (10 min contra disparos duplos acidentais)
     * 8. Gate Legal Fail-Closed (proibição categórica de disparos reais a leads)
     * 9. Verificação de credenciais e disparo oficial Meta Graph API v20.0
     */
    app.post('/api/whatsapp/send', async (req, res) => {
        const { dealId, contactId, phone, messageText, templateName, templateLanguage, isApproved, approved, forceSimulateHour } = req.body;

        // 1. Validação básica de parâmetros
        if (!phone || (!messageText && !templateName)) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_PARAMETERS',
                message: 'Telefone e conteúdo da mensagem são obrigatórios.'
            });
        }

        const normalizedPhone = cleanPhone(phone);

        // 2. Elegibilidade do Canal: WhatsApp só para telemóveis móveis portugueses válidos (9 dígitos a iniciar por 9)
        const nationalPhone = normalizedPhone.startsWith('351') ? normalizedPhone.substring(3) : normalizedPhone;
        const isValidMobile = nationalPhone.startsWith('9') && nationalPhone.length === 9;
        if (!isValidMobile) {
            return res.status(422).json({
                success: false,
                error: 'INELIGIBLE_CHANNEL',
                message: 'Canal WhatsApp inelegível: O número indicado não é um telemóvel móvel português válido (deve conter 9 dígitos a começar por 9).'
            });
        }

        // 3. Aprovação Humana Explícita Obrigatória
        const hasApproval = (isApproved === true || approved === true);
        if (!hasApproval) {
            return res.status(403).json({
                success: false,
                error: 'APPROVAL_REQUIRED',
                message: 'Aprovação humana obrigatória: O envio só pode ser processado após autorização explícita do operador (isApproved: true).'
            });
        }

        // 4. Verificação Fail-Closed da Lista de Supressão (Local + Supabase)
        const locallySuppressed = isPhoneSuppressedLocally(normalizedPhone, dealId, contactId);
        if (locallySuppressed) {
            return res.status(403).json({
                success: false,
                error: 'CONTACT_SUPPRESSED',
                message: `Envio bloqueado: Este contacto/negócio consta da lista de supressão ativa (${locallySuppressed.motivo || locallySuppressed.motivo_bloqueio || 'OPTOUT'}).`
            });
        }

        if (supabase) {
            const orQuery = [`telefone_normalizado.eq.${normalizedPhone}`];
            if (contactId) orQuery.push(`contact_id.eq.${contactId}`);
            if (dealId) orQuery.push(`deal_id.eq.${dealId}`);

            const { data: suppressed, error: suppErr } = await supabase
                .from('sdr_suppression_list')
                .select('id, motivo_bloqueio')
                .or(orQuery.join(','))
                .eq('estado', 'ativo');

            if (suppErr) {
                return res.status(500).json({
                    success: false,
                    error: 'SUPPRESSION_CHECK_FAILED',
                    message: 'Erro ao verificar supressão. Operação abortada em modo fail-closed.'
                });
            }

            if (suppressed && suppressed.length > 0) {
                return res.status(403).json({
                    success: false,
                    error: 'CONTACT_SUPPRESSED',
                    message: `Envio bloqueado: Este contacto/negócio consta da lista de supressão ativa (${suppressed[0].motivo_bloqueio || suppressed[0].motivo || 'OPTOUT'}).`
                });
            }

            // 4.1. Regra B.14.3.4: Verificação de status de marketing no contacto (em Staging/Simulação)
            const isLegalGateLive = process.env.SDR_LEGAL_GATE === 'LIVE_AUTHORIZED';
            if (!isLegalGateLive && (contactId || dealId)) {
                let targetContactId = contactId;
                if (!targetContactId && dealId) {
                    const { data: d } = await supabase.from('deals').select('contact_id').eq('id', dealId).single();
                    targetContactId = d?.contact_id;
                }
                if (targetContactId) {
                    const { data: c } = await supabase.from('contacts').select('marketing_status').eq('id', targetContactId).single();
                    if (c && c.marketing_status === 'unsubscribed') {
                        return res.status(403).json({
                            success: false,
                            error: 'CONTACT_UNSUBSCRIBED',
                            message: 'Envio bloqueado: Contacto possui status de marketing "unsubscribed" no CRM. Envio proibido por regra de supressão preventiva em modo de simulação.'
                        });
                    }
                }
            }
        }

        // 5. Verificação de Horário Comercial em Portugal Continental (Europe/Lisbon 09h00-17h00 Seg-Sex, exceto feriados)
        const timing = validateDispatchTiming(new Date());
        if (!timing.permitido && !forceSimulateHour) {
            return res.status(403).json({
                success: false,
                error: 'OUTSIDE_BUSINESS_HOURS',
                message: `Bloqueio legal: Envios comerciais para Portugal só são permitidos nos dias úteis, entre as 09h00 e as 17h00 (Europe/Lisbon). ${timing.detalhe}`,
                timing
            });
        }

        // 6. Verificação de Respiro Comercial (Mínimo de 30 dias de encerramento)
        if (supabase && dealId) {
            const { data: d } = await supabase.from('deals').select('status, updated_at, created_at').eq('id', dealId).single();
            if (d && d.status === 'lost') {
                const lostDate = new Date(d.updated_at || d.created_at);
                const daysSinceLost = Math.floor((Date.now() - lostDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceLost >= 0 && daysSinceLost < 30) {
                    return res.status(422).json({
                        success: false,
                        error: 'COOLDOWN_VIOLATION',
                        message: `Bloqueio de respiro comercial: O negócio foi encerrado há apenas ${daysSinceLost} dias. É obrigatório aguardar 30 dias de respiro comercial.`
                    });
                }
            }
        }

        // 7. Idempotência de Envio contra Duplicados (10 minutos)
        cleanRecentDispatches();
        const sendHash = crypto.createHash('md5').update((messageText || templateName || '') + normalizedPhone).digest('hex');
        const sendKey = `${normalizedPhone}_${sendHash}`;
        if (recentDispatches.has(sendKey)) {
            return res.status(409).json({
                success: false,
                error: 'DUPLICATE_SEND_PREVENTED',
                message: 'Envio duplicado prevenido: Uma mensagem idêntica para este destinatário já foi disparada nos últimos 10 minutos.'
            });
        }

        // 8. Gate Legal Fail-Closed: Proibição de disparos automáticos a leads reais na fase operacional
        const legalGateFailClosed = process.env.SDR_LEGAL_GATE !== 'LIVE_AUTHORIZED';
        if (legalGateFailClosed) {
            return res.status(403).json({
                success: false,
                error: 'LEGAL_GATE_FAIL_CLOSED',
                message: 'Bloqueio de proteção: O Gate Legal está em modo FAIL-CLOSED. Envios automáticos reais para a Meta Graph API estão proibidos no backend durante a validação operacional.'
            });
        }

        const webStatus = getWhatsAppWebStatus();

        if (webStatus.isConnected) {
            console.log(`📤 [POST /api/whatsapp/send] Disparando via WhatsApp Web para +${normalizedPhone}...`);
            try {
                const webResult = await sendWhatsAppWebMessage(normalizedPhone, messageText);
                recentDispatches.set(sendKey, Date.now());

                if (supabase && dealId) {
                    const { data: deal } = await supabase.from('deals').select('user_id').eq('id', dealId).single();
                    if (deal?.user_id) {
                        await supabase.from('activities').insert({
                            user_id: deal.user_id,
                            deal_id: dealId,
                            type: 'whatsapp',
                            title: 'Mensagem Enviada via WhatsApp Web',
                            notes: messageText || 'Mensagem enviada com sucesso',
                            date: new Date().toISOString(),
                            completed: true
                        });
                    }
                }

                return res.json({
                    success: true,
                    provider: 'whatsapp_web',
                    messageId: webResult.messageId,
                    recipient: normalizedPhone,
                    dispatchedAt: new Date().toISOString()
                });
            } catch (webErr) {
                return res.status(500).json({
                    success: false,
                    error: 'WHATSAPP_WEB_SEND_FAILED',
                    message: webErr.message
                });
            }
        }

        // 9. Configuração e Credenciais da Meta Graph API (Fallback)
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (!accessToken || !phoneNumberId) {
            return res.status(400).json({
                success: false,
                error: 'WHATSAPP_API_NOT_CONFIGURED',
                message: 'Nem o WhatsApp Web está conectado nem a Meta Cloud API está configurada. Conecte o WhatsApp Web em /api/whatsapp-web/qr.',
                manualFallback: {
                    allowed: true,
                    phone: normalizedPhone,
                    messageText: messageText
                }
            });
        }

        // 10. Montar payload oficial para a Meta Graph API
        const metaPayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: normalizedPhone,
            type: templateName ? 'template' : 'text'
        };

        if (templateName) {
            metaPayload.template = {
                name: templateName,
                language: { code: templateLanguage || (templateName === 'hello_world' ? 'en_US' : 'pt_PT') }
            };
        } else {
            metaPayload.text = {
                preview_url: false,
                body: messageText
            };
        }

        try {
            const metaResponse = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metaPayload)
            });

            const metaData = await metaResponse.json();

            if (!metaResponse.ok) {
                return res.status(metaResponse.status).json({
                    success: false,
                    error: 'META_API_ERROR',
                    details: metaData
                });
            }

            // Registar na cache de idempotência
            recentDispatches.set(sendKey, Date.now());

            // Registo no CRM apenas em caso de sucesso real na Meta
            if (supabase && dealId) {
                const { data: deal } = await supabase.from('deals').select('user_id').eq('id', dealId).single();
                if (deal?.user_id) {
                    await supabase.from('activities').insert({
                        user_id: deal.user_id,
                        deal_id: dealId,
                        type: 'whatsapp',
                        title: 'Mensagem Enviada via WhatsApp Cloud API',
                        notes: messageText || `Template: ${templateName}`,
                        date: new Date().toISOString(),
                        completed: true
                    });
                }
            }

            return res.json({
                success: true,
                messageId: metaData.messages?.[0]?.id,
                status: 'dispatched'
            });

        } catch (err) {
            return res.status(500).json({ success: false, error: 'DISPATCH_EXCEPTION', message: err.message });
        }
    });

    /**
     * 5. GET /api/email/status
     * Estado da integração SMTP / Brevo sem expor senhas.
     */
    app.get('/api/email/status', (req, res) => {
        const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
        const user = process.env.SMTP_USER || '';
        const port = process.env.SMTP_PORT || '587';
        const hasAuth = !!user && !!process.env.SMTP_PASS;

        return res.json({
            provider: 'SMTP / Brevo Integration',
            configured: hasAuth,
            host: host,
            port: port,
            userConfigured: !!user,
            status: hasAuth ? 'READY' : 'PENDING_SMTP_CREDENTIALS'
        });
    });
}
