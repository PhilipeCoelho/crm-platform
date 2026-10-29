import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { decrypt, hashSHA256, formatPhoneForHash } from './crypto.js';

/**
 * Saves a CAPI debug file for audit purposes
 */
function saveDebugLog(debugData) {
    try {
        const filePath = path.join(process.cwd(), 'meta-capi-debug.json');
        fs.writeFileSync(filePath, JSON.stringify(debugData, null, 2), 'utf8');
        console.log(`[DEBUG] meta-capi-debug.json salvo com sucesso no diretório raiz: ${filePath}`);
    } catch (err) {
        console.error('⚠️ [CAPI DEBUG] Erro ao gravar meta-capi-debug.json:', err);
    }
}

/**
 * Sends a CAPI event to Meta Graph API for a specific CRM Deal/Lead
 */
export async function sendMetaCAPIEvent(supabase, userId, dealId, stageName, eventTime = Math.floor(Date.now() / 1000), testEventCode = null) {
    try {
        // 1. Get user's CAPI settings
        const { data: settings } = await supabase
            .from('meta_lead_ads_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (!settings || !settings.capi_enabled || !settings.capi_pixel_id || !settings.capi_access_token) {
            return { success: false, reason: 'Meta CAPI desativada ou não configurada' };
        }
        
        const pixelId = settings.capi_pixel_id;
        const accessToken = decrypt(settings.capi_access_token);
        if (!accessToken) {
            return { success: false, reason: 'Falha ao descriptografar token CAPI' };
        }
        
        // 2. Fetch Deal and Contact details
        const { data: deal, error: dealError } = await supabase
            .from('deals')
            .select('*, contacts(*)')
            .eq('id', dealId)
            .single();
            
        if (dealError) {
            console.error('⚠️ [CAPI] Error querying deal:', dealError);
            return { success: false, reason: `Erro ao buscar negócio: ${dealError.message}` };
        }
            
        if (!deal) {
            return { success: false, reason: 'Negócio não encontrado no banco de dados' };
        }
        
        const contact = deal.contact || (Array.isArray(deal.contacts) ? deal.contacts[0] : deal.contacts);
        if (!contact) {
            return { success: false, reason: 'Contato não localizado no negócio' };
        }
        
        // 3. Find if there is a leadgen_id in meta_webhook_events
        const { data: webhookEvent } = await supabase
            .from('meta_webhook_events')
            .select('leadgen_id')
            .eq('contact_id', contact.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
        const leadId = webhookEvent?.leadgen_id;
        
        // 4. Construct user_data with hashes
        const userData = {};
        if (leadId && !isNaN(Number(leadId))) {
            userData.lead_id = Number(leadId);
        }
        
        if (contact.email) {
            userData.em = [hashSHA256(contact.email)];
        }
        
        if (contact.phone) {
            const formattedPhone = formatPhoneForHash(contact.phone);
            if (formattedPhone) {
                userData.ph = [hashSHA256(formattedPhone)];
            }
        }
        
        if (contact.name) {
            const nameParts = contact.name.trim().split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');
            if (firstName) userData.fn = [hashSHA256(firstName)];
            if (lastName) userData.ln = [hashSHA256(lastName)];
        }
        
        // 5. Build CAPI Payload (Standardized to 'Lead' per request checklist 5)
        const payload = {
            data: [
                {
                    event_name: 'Lead',
                    event_time: Number(eventTime),
                    action_source: 'system_generated',
                    user_data: userData,
                    custom_data: {
                        event_source: 'crm',
                        lead_event_source: 'crm-platform'
                    }
                }
            ]
        };
        
        // Checklist 9: Ensure test_event_code is on the root level of the JSON
        if (testEventCode) {
            payload.test_event_code = testEventCode;
        }
        
        // 6. Send to Meta Graph API (Using v22.0 per checklist 6)
        const url = `https://graph.facebook.com/v22.0/${pixelId}/events?access_token=${accessToken}`;
        
        console.log("=== INÍCIO AUDITORIA CAPI (DISPARO PADRÃO) ===");
        console.log("Pixel/Dataset ID:", pixelId);
        console.log("URL completa:", url);
        console.log("Versão da Graph API: v22.0");
        
        // Mask Token (Checklist 7)
        const maskedToken = accessToken 
            ? `${accessToken.substring(0, 8)}...${accessToken.substring(accessToken.length - 8)}` 
            : 'N/A';
        console.log("Access Token utilizado:", maskedToken);
        console.log("test_event_code enviado:", testEventCode || 'Vazio/Nenhum');
        console.log("Payload enviado:", JSON.stringify(payload, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const resBody = await response.json();
        
        console.log("HTTP Status da Resposta:", response.status);
        console.log("Headers da Resposta:", JSON.stringify([...response.headers.entries()]));
        console.log("Corpo da Resposta completo:", JSON.stringify(resBody, null, 2));
        console.log("=== FIM AUDITORIA CAPI (DISPARO PADRÃO) ===");

        // Log in database
        await supabase.from('meta_integration_logs').insert({
            id: randomUUID(),
            user_id: userId,
            event_type: 'webhook',
            status: response.ok ? 'success' : 'error',
            message: response.ok 
                ? `CAPI: Evento 'Lead' enviado para pixel ${pixelId}`
                : `CAPI: Erro ao enviar: ${JSON.stringify(resBody)}`,
            payload: { payload, response: resBody },
            created_at: new Date().toISOString()
        });
        
        return { success: response.ok, data: resBody };
    } catch (err) {
        console.error('Error in sendMetaCAPIEvent:', err);
        try {
            await supabase.from('meta_integration_logs').insert({
                id: randomUUID(),
                user_id: userId,
                event_type: 'error',
                status: 'error',
                message: `CAPI: Exceção ao enviar: ${err.message}`,
                payload: { error: err.message, stack: err.stack },
                created_at: new Date().toISOString()
            });
        } catch (dbErr) {
            console.error('Failed to log CAPI exception to database:', dbErr);
        }
        return { success: false, error: err.message };
    }
}

/**
 * Runs an isolated check of the CAPI credentials by sending a minimal test event
 * and saving a debug file 'meta-capi-debug.json' in the workspace root.
 */
export async function testMetaConnection(supabase, userId, testEventCode = null) {
    try {
        // 1. Get user's CAPI settings
        const { data: settings } = await supabase
            .from('meta_lead_ads_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        console.log("[2] Leu configurações");

        if (!settings || !settings.capi_enabled || !settings.capi_pixel_id || !settings.capi_access_token) {
            return { success: false, reason: 'Meta CAPI desativada ou não configurada' };
        }
        
        const pixelId = settings.capi_pixel_id;
        const accessToken = decrypt(settings.capi_access_token);
        if (!accessToken) {
            return { success: false, reason: 'Não foi possível descriptografar o token da Meta' };
        }

        // Checklist 6: Use v22.0
        const url = `https://graph.facebook.com/v22.0/${pixelId}/events?access_token=${accessToken}`;
        
        // Checklist 9: Minimal test payload
        const payload = {
            data: [
                {
                    event_name: 'Lead',
                    event_time: Math.floor(Date.now() / 1000),
                    action_source: 'system_generated',
                    user_data: {
                        em: [hashSHA256('test@example.com')]
                    },
                    custom_data: {
                        event_source: 'crm',
                        lead_event_source: 'crm-platform'
                    }
                }
            ]
        };
        
        // Checklist 9: Ensure test_event_code is on the root level of the JSON
        if (testEventCode) {
            payload.test_event_code = testEventCode;
        }

        console.log("[3] Montou payload");

        console.log("=== INÍCIO AUDITORIA CAPI (CONEXÃO DIRETA) ===");
        console.log("Pixel/Dataset ID:", pixelId);
        console.log("URL completa:", url);
        console.log("Versão da Graph API: v22.0");
        
        // Mask Token (Checklist 7)
        const maskedToken = accessToken 
            ? `${accessToken.substring(0, 8)}...${accessToken.substring(accessToken.length - 8)}` 
            : 'N/A';
        console.log("Access Token utilizado:", maskedToken);
        console.log("test_event_code enviado:", testEventCode || 'Vazio/Nenhum');
        console.log("Payload enviado:", JSON.stringify(payload, null, 2));

        console.log("[4] Enviou para Meta");

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const resBody = await response.json();

        console.log("[5] Meta respondeu");

        console.log("HTTP Status da Resposta:", response.status);
        console.log("Headers da Resposta:", JSON.stringify([...response.headers.entries()]));
        console.log("Corpo da Resposta completo:", JSON.stringify(resBody, null, 2));
        console.log("=== FIM AUDITORIA CAPI (CONEXÃO DIRETA) ===");

        console.log("[6] Gravando log");

        // Checklist 11: Save to meta-capi-debug.json (DEBUG mode)
        const debugData = {
            horario: new Date().toISOString(),
            versao_graph_api: "v22.0",
            url: url,
            payload_enviado: payload,
            resposta_meta: resBody,
            fbtrace_id: resBody.fbtrace_id || null,
            events_received: resBody.events_received || 0,
            messages: resBody.messages || []
        };
        saveDebugLog(debugData);

        // Insert log in database
        await supabase.from('meta_integration_logs').insert({
            id: randomUUID(),
            user_id: userId,
            event_type: 'test',
            status: response.ok ? 'success' : 'error',
            message: response.ok 
                ? `CAPI (Teste Direto): Conexão bem-sucedida! fbtrace_id: ${resBody.fbtrace_id || 'N/A'}`
                : `CAPI (Teste Direto): Erro ao enviar: ${JSON.stringify(resBody)}`,
            payload: { payload, response: resBody },
            created_at: new Date().toISOString()
        });

        return { 
            success: response.ok && (resBody.events_received > 0), 
            status: response.status,
            data: resBody,
            reason: response.ok && (resBody.events_received === 0) 
                ? 'events_received foi 0. Verifique se os dados do usuário não são inválidos.' 
                : null
        };
    } catch (err) {
        console.error('Error in testMetaConnection:', err);
        return { success: false, error: err.message };
    }
}
