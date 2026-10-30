import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage } from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { processWhatsAppInboundMessage } from './whatsapp.js';
import { isPortugalBusinessHours } from './sdr_business_hours.js';
import { restoreSessionFromSupabase, backupSessionToSupabase, publishWhatsAppHeartbeat } from './whatsapp_session_sync.js';

const AUTH_DIR = path.join(process.cwd(), 'data', 'whatsapp_web_auth');

// Estado em memória da sessão WhatsApp Web
let sock = null;
let currentQR = null;
let currentQRDataUrl = null;
let connectionStatus = 'DISCONNECTED'; // 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED'
let connectedUser = null;
let reconnectTimer = null;
let isInitializing = false;
let reconnectAttempts = 0;
let lastEmailAlertSentAt = 0;
let heartbeatInterval = null;
let cloudHeartbeatTimer = null;

function startCloudHeartbeat() {
    if (cloudHeartbeatTimer) clearInterval(cloudHeartbeatTimer);
    const phone = connectedUser?.phone || '351964094865';
    publishWhatsAppHeartbeat({ status: 'CONNECTED', phone, isConnected: true }).catch(() => {});
    cloudHeartbeatTimer = setInterval(() => {
        if (connectionStatus === 'CONNECTED') {
            const p = connectedUser?.phone || '351964094865';
            publishWhatsAppHeartbeat({ status: 'CONNECTED', phone: p, isConnected: true }).catch(() => {});
        }
    }, 30 * 1000);
}

function stopCloudHeartbeat() {
    if (cloudHeartbeatTimer) {
        clearInterval(cloudHeartbeatTimer);
        cloudHeartbeatTimer = null;
    }
    const phone = connectedUser?.phone || '351964094865';
    publishWhatsAppHeartbeat({ status: 'DISCONNECTED', phone, isConnected: false }).catch(() => {});
}

/**
 * Transcreve um buffer de áudio (OGG/MP3/M4A) usando o modelo Whisper-1 da OpenAI em pt
 */
export async function transcribeAudioBuffer(buffer, mimeType = 'audio/ogg') {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY não configurada para transcrição Whisper');
    }

    const form = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    form.append('file', blob, 'audio.ogg');
    form.append('model', 'whisper-1');
    form.append('language', 'pt');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: form
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Erro na API Whisper (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.text ? data.text.trim() : '';
}

/**
 * Envia um e-mail crítico de alerta para o Philipe caso o WhatsApp caia
 */
export async function sendEmailAlertToOperator({ subject, body }) {
    try {
        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME } = process.env;
        if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
            console.warn('⚠️ [WhatsApp Web Monitor] Configurações de SMTP ausentes. E-mail de alerta não enviado.');
            return false;
        }
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT || '465'),
            secure: parseInt(SMTP_PORT || '465') === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            tls: { rejectUnauthorized: false }
        });

        const targetEmail = process.env.SDR_OPERATOR_EMAIL || 'contato@euphilipecoelho.com';
        await transporter.sendMail({
            from: `"${SMTP_FROM_NAME || 'Vamuss SDR Monitor'}" <${SMTP_USER}>`,
            to: targetEmail,
            subject: subject,
            text: body
        });
        console.log(`📧 [WhatsApp Web Monitor] E-mail de alerta enviado para ${targetEmail}`);
        return true;
    } catch (e) {
        console.error('❌ [WhatsApp Web Monitor] Falha ao enviar e-mail de alerta:', e.message);
        return false;
    }
}

/**
 * Notifica o operador quando uma nota de voz não pôde ser transcrita
 */
async function notifyOperatorOnFailedAudio(fromPhone, errorMsg = '') {
    try {
        const operatorPhone = process.env.SDR_OPERATOR_PHONE || '351964094865';
        const msg = `⚠️ *[VAMUSS SDR - ÁUDIO NÃO TRANSCRITO]*\n\nA clínica com o telemóvel +${fromPhone} enviou uma nota de voz no WhatsApp que não foi possível transcrever automaticamente.\n${errorMsg ? `• Detalhe: ${errorMsg}\n` : ''}\n👉 Por favor, acede ao teu telemóvel para ouvir a mensagem e dar seguimento direto.`;
        if (connectionStatus === 'CONNECTED' && sock) {
            await sendWhatsAppWebMessage(operatorPhone, msg);
        }
    } catch (e) {
        console.warn('Aviso ao notificar áudio falhado:', e.message);
    }
}

/**
 * Notifica o operador quando a clínica enviou imagem/documento/sticker sem legenda
 */
async function notifyOperatorOnUncaptionedMedia(fromPhone, mediaType = 'mídia') {
    try {
        const operatorPhone = process.env.SDR_OPERATOR_PHONE || '351964094865';
        const msg = `ℹ️ *[VAMUSS SDR - MÍDIA RECEBIDA]*\n\nA clínica com o telemóvel +${fromPhone} enviou um(a) *${mediaType}* sem texto no WhatsApp.\nUma resposta de cortesia foi enviada a solicitar esclarecimento em texto.`;
        if (connectionStatus === 'CONNECTED' && sock) {
            await sendWhatsAppWebMessage(operatorPhone, msg);
        }
    } catch (e) {
        console.warn('Aviso ao notificar mídia:', e.message);
    }
}

/**
 * Heartbeat que monitoriza a sessão do WhatsApp a cada 2 minutos
 */
export function startWhatsAppWebMonitor() {
    if (heartbeatInterval) return;
    heartbeatInterval = setInterval(async () => {
        // Apenas atua durante a janela de expediente de Portugal
        if (!isPortugalBusinessHours()) {
            return;
        }

        const isConnected = connectionStatus === 'CONNECTED' && sock?.ws?.isOpen;
        if (!isConnected) {
            reconnectAttempts++;
            console.warn(`⚠️ [WhatsApp Web Monitor] Sessão desconectada durante o expediente! Tentativa ${reconnectAttempts}/3 de reconexão...`);
            
            try {
                await initWhatsAppWeb({ force: true });
            } catch (err) {
                console.error('❌ [WhatsApp Web Monitor] Erro ao tentar reconectar:', err.message);
            }

            if (reconnectAttempts >= 3) {
                const now = Date.now();
                // Apenas 1 e-mail a cada 30 minutos
                if (now - lastEmailAlertSentAt > 30 * 60 * 1000) {
                    lastEmailAlertSentAt = now;
                    await sendEmailAlertToOperator({
                        subject: '🚨 [ALERTA CRÍTICO VAMUSS] Sessão do WhatsApp Web Desconectada',
                        body: `Olá Philipe,\n\nA sessão do WhatsApp Web (+351 964 094 865) caiu durante o expediente e 3 tentativas de reconexão automática falharam.\n\nO envio e receção de mensagens do SDR/Closer está em pausa até restabelecer a ligação.\n\nPor favor, confirma o teu telemóvel ou acede ao CRM para ler o QR Code:\n👉 http://localhost:3001/api/whatsapp-web/qr\n\nCumprimentos,\nSistema Autónomo Vamuss SDR`
                    });
                }
            }
        } else {
            reconnectAttempts = 0;
        }
    }, 2 * 60 * 1000);
}

/**
 * Garante que a pasta de autenticação existe
 */
function ensureAuthDir() {
    if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
}

/**
 * Inicializa a conexão com o WhatsApp Web via Baileys
 */
export async function initWhatsAppWeb(options = {}) {
    if (isInitializing || connectionStatus === 'CONNECTED') {
        console.log(`📱 [WhatsApp Web] Sessão já em andamento (Status: ${connectionStatus})`);
        return { success: true, status: connectionStatus };
    }

    isInitializing = true;
    ensureAuthDir();

    try {
        // Restaura credenciais remotas caso estejamos num servidor cloud (Render/Koyeb) sem disco persistente
        await restoreSessionFromSupabase().catch((err) => console.warn('⚠️ [WhatsApp Web] Restore sync aviso:', err.message));

        console.log('🔄 [WhatsApp Web] Inicializando motor de WhatsApp Web (Baileys)...');
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: true }));

        console.log(`📱 [WhatsApp Web] Versão WA Web: ${version.join('.')}, isLatest: ${isLatest}`);

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false, // Nós tratamos com qrcodeTerminal para formatar limpo
            syncFullHistory: false,
            markOnlineOnConnect: true,
            browser: ['Vamuss CRM SDR', 'Chrome', '124.0.0.0']
        });

        // 1. Atualizações de conexão e QR Code
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                currentQR = qr;
                connectionStatus = 'SCAN_QR';
                console.log('\n============================================================');
                console.log('📲 [WhatsApp Web] NOVO QR CODE GERADO PARA PHIPE!');
                console.log('   Abre o WhatsApp no teu telemóvel -> Aparelhos Conectados -> Conectar Aparelho');
                console.log('   Podes ler direto no terminal abaixo ou abrir no navegador:');
                console.log('   👉 http://localhost:3001/api/whatsapp-web/qr');
                console.log('============================================================\n');

                qrcodeTerminal.generate(qr, { small: true });

                try {
                    currentQRDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
                } catch (e) {
                    currentQRDataUrl = null;
                }
            }

            if (connection === 'connecting') {
                connectionStatus = 'CONNECTING';
                console.log('🔄 [WhatsApp Web] Conectando aos servidores do WhatsApp...');
            }

            if (connection === 'open') {
                connectionStatus = 'CONNECTED';
                currentQR = null;
                currentQRDataUrl = null;
                isInitializing = false;

                const user = sock.user;
                const phone = user?.id ? user.id.split(':')[0].replace(/\D/g, '') : '';
                connectedUser = {
                    id: user?.id,
                    name: user?.name || 'Philipe Coelho (Vamuss)',
                    phone: phone
                };

                console.log('\n🎉 ============================================================');
                console.log(`✅ [WhatsApp Web] CONECTADO COM SUCESSO!`);
                console.log(`   Número: +${phone}`);
                console.log(`   Nome: ${connectedUser.name}`);
                console.log(`   O SDR agora pode enviar mensagens personalizadas e ler respostas`);
                console.log(`   mantendo todo o teu histórico original no teu telemóvel!`);
                console.log('============================================================\n');

                // Sincroniza sessão conectada para a nuvem (Supabase) para persistência entre deploys
                backupSessionToSupabase().catch((err) => console.warn('⚠️ [WhatsApp Web] Backup sync aviso:', err.message));
                // Publica heartbeat do worker para o Supabase (permite ao Vercel saber que o WhatsApp está conectado)
                startCloudHeartbeat();
            }

            if (connection === 'close') {
                isInitializing = false;
                stopCloudHeartbeat();
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(`⚠️ [WhatsApp Web] Conexão encerrada (Status Code: ${statusCode}). Reconnect: ${shouldReconnect}`);

                if (statusCode === DisconnectReason.loggedOut) {
                    connectionStatus = 'DISCONNECTED';
                    connectedUser = null;
                    currentQR = null;
                    currentQRDataUrl = null;
                    console.log('🚪 [WhatsApp Web] Sessão deslogada pelo usuário. Limpando credenciais...');
                    try {
                        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                        ensureAuthDir();
                    } catch (e) {
                        console.warn('Erro ao limpar pasta de auth:', e.message);
                    }
                } else {
                    connectionStatus = 'CONNECTING';
                    if (!reconnectTimer) {
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            initWhatsAppWeb();
                        }, 4000);
                    }
                }
            }
        });

        // 2. Persistência de credenciais (Local + Nuvem)
        sock.ev.on('creds.update', async () => {
            await saveCreds();
            backupSessionToSupabase().catch(() => {});
        });

        // 3. Receção de mensagens inbound (Respostas de clínicas)
        sock.ev.on('messages.upsert', async (m) => {
            try {
                if (m.type !== 'notify') return;

                for (const msg of m.messages) {
                    // Ignora mensagens enviadas por nós mesmos
                    if (msg.key.fromMe) continue;

                    const remoteJid = msg.key.remoteJid || '';
                    // Ignora mensagens de grupos (@g.us) ou status
                    if (remoteJid.endsWith('@g.us') || remoteJid.includes('status@broadcast')) continue;

                    let fromPhone = '';
                    if (remoteJid.endsWith('@s.whatsapp.net')) {
                        fromPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
                    } else if (remoteJid.endsWith('@lid')) {
                        const lid = remoteJid.replace('@lid', '').replace(/\D/g, '');
                        const reversePath = path.join(AUTH_DIR, `lid-mapping-${lid}_reverse.json`);
                        if (fs.existsSync(reversePath)) {
                            try {
                                fromPhone = JSON.parse(fs.readFileSync(reversePath, 'utf8')).replace(/\D/g, '');
                            } catch (_) {}
                        }
                        if (!fromPhone && msg.key.participant) {
                            fromPhone = msg.key.participant.replace('@s.whatsapp.net', '').replace(/\D/g, '');
                        }
                    }

                    if (!fromPhone) continue;

                    // TRAVA DE SEGURANÇA E PRIVACIDADE DO PHILIPE:
                    // Apenas processa se for um negócio 'lost' do CRM que foi abordado pelo Agente Comercial Autónomo.
                    // Qualquer contacto pessoal, amigo, família, grupo ou número fora do escopo é 100% ignorado!
                    try {
                        const { isEligibleSdrInboundTarget } = await import('./vamuss_commercial_agent.js');
                        const isTarget = await isEligibleSdrInboundTarget(fromPhone);
                        if (!isTarget) {
                            continue;
                        }
                    } catch (_) {
                        continue;
                    }
                    
                    // Detetar tipo de mensagem
                    const isAudio = Boolean(msg.message?.audioMessage);
                    const isImageWithoutCaption = Boolean(msg.message?.imageMessage && !msg.message?.imageMessage?.caption);
                    const isDocumentWithoutCaption = Boolean(msg.message?.documentMessage && !msg.message?.documentMessage?.caption);
                    const isSticker = Boolean(msg.message?.stickerMessage);
                    const isVideoWithoutCaption = Boolean(msg.message?.videoMessage && !msg.message?.videoMessage?.caption);

                    let text = msg.message?.conversation ||
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption ||
                        msg.message?.videoMessage?.caption ||
                        '';

                    let isAudioTranscribed = false;

                    // Caso 1: Nota de voz / Áudio recebido -> Transcrição com Whisper
                    if (isAudio) {
                        try {
                            console.log(`🎙️ [WhatsApp Web Inbound] Áudio recebido de +${fromPhone}. Descarregando e transcrevendo com Whisper...`);
                            const audioBuffer = await downloadMediaMessage(
                                msg,
                                'buffer',
                                {},
                                { logger: console, reuploadRequest: sock?.updateMediaMessage }
                            );
                            const mimeType = msg.message.audioMessage?.mimetype || 'audio/ogg';
                            const transcription = await transcribeAudioBuffer(audioBuffer, mimeType);
                            
                            if (transcription && transcription.trim() !== '') {
                                text = transcription.trim();
                                isAudioTranscribed = true;
                                console.log(`✅ [Whisper Transcrição Concluída] +${fromPhone}: "${text}"`);
                            } else {
                                console.warn(`⚠️ [Whisper] Áudio vazio ou inaudível de +${fromPhone}`);
                                await notifyOperatorOnFailedAudio(fromPhone);
                                continue;
                            }
                        } catch (audioErr) {
                            console.error(`❌ [Whisper Falha na Transcrição] +${fromPhone}:`, audioErr.message);
                            await notifyOperatorOnFailedAudio(fromPhone, audioErr.message);
                            continue;
                        }
                    } 
                    // Caso 2: Mídia sem legenda (imagem, documento, sticker) -> Cortesia ao lead + Alerta ao Philipe
                    else if ((isImageWithoutCaption || isDocumentWithoutCaption || isSticker || isVideoWithoutCaption) && !text.trim()) {
                        console.log(`🖼️ [WhatsApp Web Inbound] Mídia sem legenda recebida de +${fromPhone}. Enviando resposta de cortesia...`);
                        try {
                            await sendWhatsAppWebMessage(
                                fromPhone,
                                'Boa tarde à equipa da clínica. Recebemos o vosso ficheiro/imagem, contudo o nosso canal no WhatsApp apenas processa mensagens de texto. Poderia por favor partilhar a vossa mensagem por escrito? Agradecemos a atenção.'
                            );
                            await notifyOperatorOnUncaptionedMedia(fromPhone, isSticker ? 'sticker' : isDocumentWithoutCaption ? 'documento' : 'imagem');
                        } catch (mediaErr) {
                            console.error('Erro ao responder a mídia sem legenda:', mediaErr.message);
                        }
                        continue;
                    }

                    if (!text || text.trim() === '') continue;

                    // Ignorar mensagens de tipo não suportado que chegam como placeholder
                    if (text.includes('[Mensagem recebida do tipo') || text.trim() === '[object Object]') {
                        console.log(`ℹ️ [WhatsApp Web Inbound] Mensagem de tipo não suportado de +${fromPhone} ignorada.`);
                        continue;
                    }

                    const wamid = msg.key.id || `web_${Date.now()}`;
                    const timestamp = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000).toISOString() : new Date().toISOString();

                    console.log(`📥 [WhatsApp Web Inbound] Mensagem de +${fromPhone}: "${text}" ${isAudioTranscribed ? '(Transcrita de Áudio)' : ''}`);

                    // Encaminha para o motor autónomo do SDR / Closer
                    await processWhatsAppInboundMessage({
                        object: 'whatsapp_web',
                        entry: [{
                            changes: [{
                                value: {
                                    messages: [{
                                        from: fromPhone,
                                        id: wamid,
                                        timestamp: timestamp,
                                        text: { body: text },
                                        type: isAudioTranscribed ? 'audio_transcribed' : 'text',
                                        isAudioTranscribed: isAudioTranscribed
                                    }]
                                }
                            }]
                        }]
                    });

                    // Acionar o Agente Comercial Autónomo Dedicado (Closer)
                    import('./vamuss_commercial_agent.js').then(({ processInboundLeadTurn }) => {
                        processInboundLeadTurn({ phone: fromPhone, text, isAudio: isAudioTranscribed }).catch(agentErr => {
                            console.warn('⚠️ [Vamuss Commercial Agent] Erro ao tratar inbound:', agentErr.message);
                        });
                    }).catch(() => {});
                }
            } catch (inboundErr) {
                console.error('❌ [WhatsApp Web Inbound] Erro ao processar mensagem recebida:', inboundErr.message);
            }
        });

        // Inicia o monitor de heartbeat da sessão
        startWhatsAppWebMonitor();

        return { success: true, status: connectionStatus };
    } catch (err) {
        isInitializing = false;
        connectionStatus = 'DISCONNECTED';
        console.error('❌ [WhatsApp Web] Erro ao inicializar Baileys:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Envia uma mensagem via WhatsApp Web para um número de telemóvel
 */
export async function sendWhatsAppWebMessage(phone, messageText) {
    if (!sock || connectionStatus !== 'CONNECTED') {
        throw new Error('WHATSAPP_WEB_NOT_CONNECTED: A sessão do WhatsApp Web não está conectada');
    }

    if (!messageText || typeof messageText !== 'string' || messageText.trim() === '') {
        throw new Error('INVALID_MESSAGE: O texto da mensagem não pode ser vazio');
    }

    // Normalização do número de telefone (Portugal: se tiver 9 dígitos a começar por 9, adiciona 351)
    let clean = (phone || '').replace(/\D/g, '');
    if (clean.length === 9 && clean.startsWith('9')) {
        clean = `351${clean}`;
    }

    const jid = `${clean}@s.whatsapp.net`;
    console.log(`📤 [WhatsApp Web] Enviando mensagem para +${clean}...`);

    try {
        const result = await sock.sendMessage(jid, {
            text: messageText.trim()
        });

        const messageId = result?.key?.id || `web_wamid_${Date.now()}`;
        console.log(`✅ [WhatsApp Web] Mensagem enviada com sucesso para +${clean} (ID: ${messageId})`);

        return {
            success: true,
            messageId,
            to: clean,
            timestamp: new Date().toISOString()
        };
    } catch (sendErr) {
        console.error(`❌ [WhatsApp Web] Falha ao enviar para +${clean}:`, sendErr.message);
        throw sendErr;
    }
}

/**
 * Retorna o status atual da conexão
 */
export function getWhatsAppWebStatus() {
    return {
        provider: 'WhatsApp Web (Baileys Multi-Device)',
        status: connectionStatus,
        isConnected: connectionStatus === 'CONNECTED',
        hasQr: !!currentQR,
        qrCodeDataUrl: currentQRDataUrl,
        connectedUser: connectedUser,
        authDirectory: AUTH_DIR
    };
}

/**
 * Desconecta a sessão
 */
export async function disconnectWhatsAppWeb() {
    try {
        stopCloudHeartbeat();
        if (sock) {
            await sock.logout();
        }
        connectionStatus = 'DISCONNECTED';
        connectedUser = null;
        currentQR = null;
        currentQRDataUrl = null;
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Registra rotas Express para exibir o QR Code no navegador e consultar status
 */
export function setupWhatsAppWebRoutes(app) {
    console.log('🌐 [WhatsApp Web] Registrando rotas /api/whatsapp-web...');

    // Status da conexão
    app.get('/api/whatsapp-web/status', (req, res) => {
        return res.json(getWhatsAppWebStatus());
    });

    // Desconectar sessão
    app.post('/api/whatsapp-web/disconnect', async (req, res) => {
        const result = await disconnectWhatsAppWeb();
        return res.json(result);
    });

    // Reconectar / Forçar reinício do motor
    app.post('/api/whatsapp-web/reconnect', async (req, res) => {
        connectionStatus = 'DISCONNECTED';
        const result = await initWhatsAppWeb();
        return res.json(result);
    });

    // Backup manual da sessão para a nuvem (Supabase Vault)
    app.post('/api/whatsapp-web/sync-backup', async (req, res) => {
        try {
            const backedUp = await backupSessionToSupabase(true);
            return res.json({ success: backedUp, message: backedUp ? 'Sessão enviada com sucesso para o Supabase Vault.' : 'Nenhuma sessão ativa para enviar.' });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    // Restauração manual da sessão a partir da nuvem
    app.post('/api/whatsapp-web/sync-restore', async (req, res) => {
        try {
            const restored = await restoreSessionFromSupabase(true);
            return res.json({ success: restored, message: restored ? 'Sessão restaurada com sucesso do Supabase Vault.' : 'Falha ao restaurar sessão.' });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    });

    // Página HTML do QR Code com auto-refresh a cada 4 segundos até conectar
    app.get('/api/whatsapp-web/qr', (req, res) => {
        const status = getWhatsAppWebStatus();

        if (status.isConnected) {
            return res.send(`
                <!DOCTYPE html>
                <html lang="pt">
                <head>
                    <meta charset="UTF-8">
                    <title>WhatsApp Web Conectado - Vamuss CRM</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        .card { background: #1e293b; border-radius: 16px; padding: 40px; text-align: center; max-width: 460px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155; }
                        .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 8px 16px; border-radius: 9999px; font-weight: 600; font-size: 14px; margin-bottom: 20px; }
                        h1 { font-size: 24px; margin: 0 0 12px; }
                        p { color: #94a3b8; font-size: 15px; line-height: 1.5; margin: 0 0 24px; }
                        .user-box { background: #0f172a; border-radius: 10px; padding: 16px; margin-bottom: 24px; text-align: left; border: 1px solid #334155; }
                        .user-box div { margin-bottom: 6px; font-size: 14px; }
                        .user-box strong { color: #e2e8f0; }
                        .btn { background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer; text-decoration: none; display: inline-block; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="badge">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: #4ade80;"></span>
                            WhatsApp Conectado
                        </div>
                        <h1>Pronto para Disparo!</h1>
                        <p>O teu WhatsApp está emparelhado com o SDR da Vamuss. Todo o teu histórico no telemóvel foi preservado.</p>
                        <div class="user-box">
                            <div><strong>Nome:</strong> ${status.connectedUser?.name || 'Philipe Coelho'}</div>
                            <div><strong>Telemóvel:</strong> +${status.connectedUser?.phone || 'Conectado'}</div>
                            <div><strong>Canal:</strong> WhatsApp Web Multi-Device</div>
                        </div>
                        <a href="http://localhost:5173/sdr" class="btn">Voltar ao Painel do SDR</a>
                    </div>
                </body>
                </html>
            `);
        }

        if (status.hasQr && status.qrCodeDataUrl) {
            return res.send(`
                <!DOCTYPE html>
                <html lang="pt">
                <head>
                    <meta charset="UTF-8">
                    <title>Conectar WhatsApp Web - Vamuss CRM</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <meta http-equiv="refresh" content="4">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                        .card { background: #1e293b; border-radius: 16px; padding: 36px; text-align: center; max-width: 440px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155; }
                        h1 { font-size: 22px; margin: 0 0 10px; }
                        p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
                        .qr-container { background: white; padding: 16px; border-radius: 12px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); }
                        .qr-container img { display: block; width: 260px; height: 260px; }
                        .steps { margin-top: 24px; text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.6; background: #0f172a; padding: 14px 18px; border-radius: 8px; border: 1px solid #334155; }
                        .steps ol { margin: 0; padding-left: 20px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Conectar WhatsApp do Philipe</h1>
                        <p>Aponta a câmara do WhatsApp no teu telemóvel para o código abaixo:</p>
                        <div class="qr-container">
                            <img src="${status.qrCodeDataUrl}" alt="WhatsApp QR Code" />
                        </div>
                        <div class="steps">
                            <ol>
                                <li>Abre o <strong>WhatsApp</strong> no teu telemóvel</li>
                                <li>Toca em <strong>Definições / Configurações</strong> &gt; <strong>Aparelhos Conectados</strong></li>
                                <li>Toca em <strong>Conectar Aparelho</strong> e aponta a câmara aqui</li>
                            </ol>
                        </div>
                    </div>
                </body>
                </html>
            `);
        }

        // Aguardando geração do QR Code
        return res.send(`
            <!DOCTYPE html>
            <html lang="pt">
            <head>
                <meta charset="UTF-8">
                <title>Gerando QR Code... - Vamuss CRM</title>
                <meta http-equiv="refresh" content="2">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: #1e293b; border-radius: 16px; padding: 40px; text-align: center; max-width: 400px; border: 1px solid #334155; }
                    .spinner { border: 4px solid rgba(255,255,255,0.1); border-left-color: #2563eb; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
                    @keyframes spin { to { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="spinner"></div>
                    <h2>A gerar QR Code...</h2>
                    <p style="color: #94a3b8; font-size: 14px;">Aguarde 2 segundos enquanto conectamos à rede do WhatsApp.</p>
                </div>
            </body>
            </html>
        `);
    });
}
