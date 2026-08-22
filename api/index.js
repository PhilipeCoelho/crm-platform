import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import bodyParser from 'body-parser';
import Imap from 'imap';
import jwt from 'jsonwebtoken';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import { LeadProcessor } from './utils/leadProcessor.js';
import { encrypt, decrypt } from './utils/crypto.js';
import { sendMetaCAPIEvent, testMetaConnection } from './utils/capiSender.js';

const LOG_FILE = '/tmp/crm_server.log';
function logToFile(msg) {
    const timestamp = new Date().toISOString();
    try {
        console.log(`[${timestamp}] ${msg}`);
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
    } catch (e) {
        console.error('Logging failed:', e);
    }
}

const app = express();
const PORT = process.env.PORT || 3001;
const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// Deal statuses that are NEVER eligible for marketing campaigns
const EXCLUDED_DEAL_STATUSES = ['lost', 'desqualificado'];

app.use(cors({
    origin: '*', // Allow all during debug
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    logToFile(`🌐 [REQ] ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        logToFile(`📦 [BODY] ${JSON.stringify(req.body)}`);
    }
    next();
});

logToFile('Server initialized');

// Configs
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET; // REQUIRED FOR VALIDATION
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME } = process.env;

app.use(cors());
app.use(bodyParser.json());

/**
 * AUTH MIDDLEWARE
 * Validates Supabase JWT and attaches user (sub) to request
 */
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.warn('Supabase Auth Failed:', error?.message);
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        req.user = { sub: user.id }; // Contains sub (uid)
        req.jwt = token;
        next();
    } catch (err) {
        console.warn('Auth Exception:', err.message);
        return res.status(401).json({ error: 'Unauthorized' });
    }
};

// Cron job endpoint to keep Supabase alive
app.get('/api/ping-db', async (req, res) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        await supabase.from('contacts').select('id').limit(1);
        logToFile('✅ [Ping] Supabase database pinged to keep alive');
        res.status(200).send('Ping OK');
    } catch (e) {
        logToFile(`❌ [Ping] Error pinging db: ${e.message}`);
        res.status(500).send('Ping Error');
    }
});

// Webhook público para receber interações de campanhas do Brevo
app.post('/api/webhooks/brevo', async (req, res) => {
    try {
        const payload = req.body;
        logToFile(`📥 [Webhook Brevo] Evento recebido: ${JSON.stringify(payload)}`);

        // Brevo envia o e-mail em payload.email ou payload.recipient
        const email = payload.email || payload.recipient;
        if (!email) {
            logToFile(`⚠️ [Webhook Brevo] E-mail não encontrado no payload`);
            return res.status(400).json({ error: "Missing email" });
        }

        // Brevo envia o ID da campanha em campaign-id, campaignId, camp_id ou id
        const campaignIdStr = payload['campaign-id'] || payload.campaignId || payload.camp_id || payload.id;
        const campaignId = campaignIdStr ? parseInt(campaignIdStr, 10) : null;
        if (!campaignId) {
            logToFile(`⚠️ [Webhook Brevo] ID da campanha não encontrado no payload`);
            return res.status(400).json({ error: "Missing campaign ID" });
        }

        // Brevo envia o nome da campanha ou assunto em campaign_name, subject, etc.
        const campaignName = payload['campaign-name'] || payload.campaign_name || payload.subject || `Campanha #${campaignId}`;

        // Evento (opened, click, bounce, unsubscribed, spam, etc.)
        const event = (payload.event || '').toLowerCase();

        // URL clicada (apenas para eventos de clique)
        const clickUrl = payload.url || '';

        // Data do evento
        const nowIso = new Date().toISOString();
        const eventDate = payload.date || payload.ts ? new Date((payload.ts ? payload.ts * 1000 : payload.date)).toISOString() : nowIso;

        // Executar processamento atômico no banco via RPC
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data, error } = await supabase.rpc('update_brevo_campaign_log', {
            p_email: email,
            p_campaign_id: campaignId,
            p_campaign_name: campaignName,
            p_event: event,
            p_url: clickUrl,
            p_event_date: eventDate
        });

        if (error) {
            logToFile(`❌ [Webhook Brevo] Falha ao processar RPC: ${error.message}`);
            return res.status(500).json({ error: error.message });
        }

        logToFile(`✅ [Webhook Brevo] RPC Executado com sucesso: ${JSON.stringify(data)}`);
        return res.json(data);
    } catch (err) {
        logToFile(`🔥 [Webhook Brevo] Erro interno: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

// --- Public Tracking Endpoints ---

// Tracking de Abertura (Pixel)
app.get('/api/email/open/:log_id', async (req, res) => {
    const { log_id } = req.params;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    logToFile(`📥 [Tracking] Open requested for ID: ${log_id} | IP: ${ip} | UA: ${userAgent}`);

    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(PIXEL_GIF);

    // Async Update
    (async () => {
        try {
            const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            logToFile(`   🔍 [Tracking] Fetching log for ID: ${log_id}`);

            const { data: log, error: fetchErr } = await supabase.from('email_logs').select('*').eq('id', log_id).single();
            if (fetchErr) {
                logToFile(`   ❌ [Tracking] Fetch log error for ID ${log_id}: ${JSON.stringify(fetchErr)}`);
                return;
            }
            if (!log) {
                logToFile(`   ❌ [Tracking] Log not found for ID: ${log_id}`);
                return;
            }
            if (log.opened) {
                logToFile(`   ℹ️ [Tracking] Log ${log_id} already marked as opened.`);
                return;
            }

            logToFile(`   ✅ [Tracking] Marking log as opened in DB: ${log_id}`);

            // Update Log
            await supabase.from('email_logs').update({
                opened: true,
                opened_at: new Date().toISOString(),
                open_ip: ip,
                open_user_agent: userAgent
            }).eq('id', log_id);

            // Update Campaign Metric if applicable
            if (log.campaign_id) {
                await supabase.rpc('increment_campaign_metric', {
                    target_campaign_id: log.campaign_id,
                    metric_column: 'opened_count'
                });

                await supabase.from('campaign_recipients')
                    .update({ opened: true, opened_at: new Date().toISOString() })
                    .eq('campaign_id', log.campaign_id)
                    .eq('email', log.recipient_email);

                logToFile(`   📈 [Tracking] Campaign metrics updated for ${log_id}`);
            }
        } catch (e) {
            logToFile(`   ❌ [Tracking] Error in async open tracking: ${e.message}`);
        }
    })();
});

// Tracking de Cliques - Hardened against Open Redirect
app.get('/api/email/click/:log_id', async (req, res) => {
    const { log_id } = req.params;
    const { url } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const originalUrl = Array.isArray(url) ? url[0] : url;

    if (!originalUrl) {
        logToFile(`⚠️ [Tracking] Click without URL for ID: ${log_id}`);
        return res.redirect('/');
    }

    logToFile(`📥 [Tracking] Click requested for ID: ${log_id} to URL: ${originalUrl}`);

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        logToFile(`   🔍 [Tracking] Fetching log for click validation: ${log_id}`);

        const { data: log, error: fetchErr } = await supabase
            .from('email_logs')
            .select('*')
            .eq('id', log_id)
            .single();

        if (fetchErr || !log) {
            logToFile(`   ❌ [Tracking] Click validation failed: Log not found for ID ${log_id}`);
            return res.status(400).send('Invalid click tracking link.');
        }

        // Validate that the requested destination URL exists in the email content
        const emailContent = log.content || '';
        const normalizedTarget = originalUrl.trim().toLowerCase();
        const encodedTarget = encodeURIComponent(originalUrl);
        
        let isValid = emailContent.includes(originalUrl) || emailContent.includes(encodedTarget);

        if (!isValid) {
            // Extract from tracked links pattern: /api/email/click/log_id?url=...
            const escapedLogId = log_id.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(?:/api/email/click/|/click/)${escapedLogId}\\?url=([^"\\s>]+)`, 'gi');
            let match;
            while ((match = regex.exec(emailContent)) !== null) {
                let matchedUrl = match[1];
                matchedUrl = matchedUrl.replace(/&amp;/gi, '&');
                try {
                    const decodedUrl = decodeURIComponent(matchedUrl);
                    if (decodedUrl.trim().toLowerCase() === normalizedTarget) {
                        isValid = true;
                        break;
                    }
                } catch (e) {
                    if (matchedUrl.trim().toLowerCase() === normalizedTarget) {
                        isValid = true;
                        break;
                    }
                }
            }
        }

        if (!isValid) {
            logToFile(`   ❌ [Tracking] Click validation failed: URL "${originalUrl}" not found in email content of log ${log_id}`);
            return res.status(400).send('Redirection blocked: Destination URL is not authorized.');
        }

        // Redirect immediately after successful validation
        res.redirect(originalUrl);

        // Perform updates asynchronously in the background
        (async () => {
            try {
                logToFile(`   ✅ [Tracking] Processing click log updates for: ${log_id}`);
                const isFirstClick = !log.clicked;

                // 1. Update Log
                await supabase.from('email_logs').update({
                    clicked: true,
                    clicked_at: new Date().toISOString(),
                    click_ip: ip,
                    click_user_agent: userAgent,
                    clicked_url: originalUrl,
                    opened: true,
                    opened_at: log.opened ? log.opened_at : new Date().toISOString()
                }).eq('id', log_id);

                // 2. Metrics (only if first click)
                if (isFirstClick && log.campaign_id) {
                    await supabase.rpc('increment_campaign_metric', {
                        target_campaign_id: log.campaign_id,
                        metric_column: 'clicked_count'
                    });

                    await supabase.from('campaign_recipients')
                        .update({ clicked: true, clicked_at: new Date().toISOString() })
                        .eq('campaign_id', log.campaign_id)
                        .eq('email', log.recipient_email);

                    logToFile(`   📈 [Tracking] Click campaign metrics updated for ${log_id}`);
                }
            } catch (e) {
                logToFile(`   ❌ [Tracking] Error in async log update: ${e.message}`);
            }
        })();

    } catch (e) {
        logToFile(`   ❌ [Tracking] Server error during click handling: ${e.message}`);
        res.status(500).send('Internal server error.');
    }
});

// Unsubscribe Endpoint
app.get('/api/email/unsubscribe/:log_id', async (req, res) => {
    const { log_id } = req.params;
    logToFile(`📥 [Unsubscribe] Requested for log ID: ${log_id}`);

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: log, error: fetchErr } = await supabase.from('email_logs').select('recipient_email').eq('id', log_id).single();
        
        if (fetchErr || !log) {
            logToFile(`❌ [Unsubscribe] Log not found for ID: ${log_id}`);
            return res.status(404).send('Link de descadastro inválido ou expirado.');
        }

        const { error: insertErr } = await supabase.from('unsubscribed_emails').insert([{ email: log.recipient_email }]);
        
        if (insertErr && insertErr.code !== '23505') { // ignore duplicate warnings
            logToFile(`❌ [Unsubscribe] Erro ao salvar email (${log.recipient_email}): ${insertErr.message}`);
        } else {
            logToFile(`✅ [Unsubscribe] Email ${log.recipient_email} descadastrado com sucesso.`);
        }

        res.send(`
            <html>
                <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 80px; color: #333; background-color: #f9fafb;">
                    <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <h2 style="color: #ef4444;">Inscrição Cancelada</h2>
                        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">O e-mail <strong>${log.recipient_email}</strong> foi removido da nossa lista e você não receberá mais campanhas ou mensagens promocionais.</p>
                    </div>
                </body>
            </html>
        `);
    } catch (e) {
        logToFile(`❌ [Unsubscribe] Error: ${e.message}`);
        res.status(500).send('Erro interno do servidor ao processar o cancelamento.');
    }
});


// Helper for Tracking Injection & Variable Replacement
function injectTracking(body, baseUrl, logId, variables = {}) {
    let html = body;

    // 1. Replace variables {{name}}, [nome], etc. (case insensitive, supporting spaces inside brackets)
    Object.keys(variables).forEach(key => {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex1 = new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'gi');
        const regex2 = new RegExp(`\\[\\s*${escapedKey}\\s*\\]`, 'gi');
        html = html.replace(regex1, variables[key] || '');
        html = html.replace(regex2, variables[key] || '');
    });

    // 2. Inject Tracking Pixel
    const pixel = `<img src="${baseUrl}/api/email/open/${logId}" width="1" height="1" style="display:none;" />`;
    html = html.includes('</body>')
        ? html.replace('</body>', `${pixel}</body>`)
        : html + pixel;

    // 3. Track Links
    html = html.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi, (match, url) => {
        if (!url || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#') || url.includes('/api/email/')) return match;
        const trackUrl = `${baseUrl}/api/email/click/${logId}?url=${encodeURIComponent(url)}`;
        return match.replace(`href="${url}"`, `href="${trackUrl}"`);
    });

    // 4. Force discreet Unsubscribe link if missing
    if (!html.includes('/api/email/unsubscribe/')) {
        const unsubscribeHtml = `<div style="margin-top: 50px; padding-top: 20px; font-size: 11px; color: #94a3b8; font-family: sans-serif;">Para não receber mais e-mails como este, <a href="${baseUrl}/api/email/unsubscribe/${logId}" style="color: inherit; text-decoration: underline;">cancele sua inscrição aqui</a>.</div>`;
        html = html.includes('</body>')
            ? html.replace('</body>', `${unsubscribeHtml}</body>`)
            : html + unsubscribeHtml;
    }

    return html;
}

// --- Protected Endpoints ---

// Test SMTP Endpoint
app.post('/api/test-smtp', authenticate, async (req, res) => {
    console.log('🧪 Starting SMTP Diagnostic Test...');
    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT || '587'),
            secure: parseInt(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            debug: true,
            logger: true
        });

        console.log('🔗 [Log] SMTP Configuration:', {
            host: SMTP_HOST,
            port: SMTP_PORT,
            user: SMTP_USER,
            secure: parseInt(SMTP_PORT) === 465
        });

        // Verify connection
        console.log('⏳ [Log] Verifying connection...');
        await transporter.verify();
        console.log('✅ [Log] SMTP Authentication Success');

        // Send test email
        const sender = `"${SMTP_FROM_NAME || 'CRM Test'}" <${SMTP_USER}>`;
        const info = await transporter.sendMail({
            from: sender,
            to: SMTP_USER, // Send to self
            subject: 'Teste SMTP CRM',
            html: '<b>Este é um teste de envio SMTP do sistema.</b><br>Se você recebeu isso, a autenticação e o envio básico estão funcionando.',
        });

        console.log('📧 [Log] Message Sent Success');
        console.log('🆔 [Log] Message ID:', info.messageId);

        res.status(200).json({
            success: true,
            message: 'SMTP Diagnostic test passed',
            messageId: info.messageId,
            details: 'Authentication and self-send successful'
        });
    } catch (error) {
        console.error('❌ [Log] SMTP Diagnostic Failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// Generic Email Sending Endpoint
app.post('/api/send-email', authenticate, async (req, res) => {
    const { to, subject, body, deal_id, person_id } = req.body;

    if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Missing to, subject, or body' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT || '587'),
            secure: parseInt(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            tls: { rejectUnauthorized: false }
        });

        const baseUrl = process.env.TRACKING_BASE_URL || `${req.protocol}://${req.get('host')}`;
        const tempLogId = randomUUID();
        
        // Fetch variables for single email if needed
        let variables = {
            unsubscribe_url: `${baseUrl}/api/email/unsubscribe/${tempLogId}`
        };
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        if (person_id) {
            const { data: person } = await supabase.from('contacts').select('name').eq('id', person_id).single();
            if (person) {
                variables.name = person.name;
                variables.nome = person.name; // Suporte para [Nome]
                variables['nome da clinica'] = 'sua clínica'; // Fallback
            }
        }

        const finalHtml = injectTracking(body, baseUrl, tempLogId, variables);

        const info = await transporter.sendMail({
            from: `"${SMTP_FROM_NAME || 'CRM System'}" <${SMTP_USER}>`,
            to,
            subject,
            html: finalHtml,
        });

        // Log to email_logs
        await supabase.from('email_logs').insert({
            id: tempLogId,
            user_id: req.user.sub,
            deal_id: deal_id || null,
            person_id: person_id || null,
            recipient_email: to,
            subject: subject,
            content: body,
            status: 'sent',
            smtp_message_id: info.messageId,
            sent_at: new Date().toISOString()
        });

        res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('[SMTP Error]:', error.message);
        res.status(500).json({ error: 'Email service unavailable' });
    }
});

app.post('/api/send-campaign', authenticate, async (req, res) => {
    const { campaignId, subject: reqSubject, body: reqBody, fromName: reqFromName, recipients: reqRecipients } = req.body;
    logToFile(`📩 Received /api/send-campaign. campaignId: ${campaignId}`);

    if (!campaignId && (!reqSubject || !reqBody || !reqRecipients)) {
        logToFile('❌ Missing required fields in request body');
        return res.status(400).json({ error: 'Missing campaignId or full campaign data for sending' });
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        let campaign = null;
        let recipients = [];

        if (campaignId) {
            logToFile(`🔍 [DB] Fetching campaign ${campaignId}...`);
            const { data: campaignData, error: campaignError } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
            if (campaignError || !campaignData) {
                logToFile(`❌ [DB] Campaign not found or error: ${JSON.stringify(campaignError)}`);
                return res.status(404).json({ error: 'Campaign not found in database', details: campaignError });
            }
            campaign = campaignData;
            logToFile(`✅ [DB] Campaign ${campaignId} fetched.`);

            logToFile(`🔍 [DB] Fetching recipients for campaign ${campaignId}...`);
            const { data: recData, error: recError } = await supabase.from('campaign_recipients').select('*').eq('campaign_id', campaignId);
            if (recError || !recData || recData.length === 0) {
                logToFile(`❌ [DB] No recipients found or error: ${JSON.stringify(recError)}`);
                return res.status(404).json({ error: 'No recipients found for this campaign' });
            }

            // --- SERVER-SIDE SAFETY FILTER ---
            // 1. Drop recipients with missing/invalid email
            let filteredRecipients = recData.filter(r => r.email && r.email.trim() !== '' && r.email.includes('@'));
            const invalidEmailCount = recData.length - filteredRecipients.length;
            if (invalidEmailCount > 0) {
                logToFile(`⚠️ [Filter] Removed ${invalidEmailCount} recipient(s) with invalid/missing email.`);
            }

            // 2. Drop recipients whose linked deal is lost or disqualified
            const dealIds = [...new Set(filteredRecipients.filter(r => r.deal_id).map(r => r.deal_id))];
            if (dealIds.length > 0) {
                const { data: dealsData } = await supabase
                    .from('deals')
                    .select('id, status')
                    .in('id', dealIds);

                if (dealsData && dealsData.length > 0) {
                    const excludedDealIds = new Set(
                        dealsData
                            .filter(d => EXCLUDED_DEAL_STATUSES.includes(d.status))
                            .map(d => d.id)
                    );

                    const beforeCount = filteredRecipients.length;
                    filteredRecipients = filteredRecipients.filter(r => !r.deal_id || !excludedDealIds.has(r.deal_id));
                    const removedCount = beforeCount - filteredRecipients.length;
                    if (removedCount > 0) {
                        logToFile(`🛡️ [Filter] Removed ${removedCount} recipient(s) linked to lost/disqualified deals.`);
                    }
                }
            }

            if (filteredRecipients.length === 0) {
                logToFile(`❌ [Filter] No eligible recipients remain after filtering. Aborting send.`);
                return res.status(422).json({ error: 'No eligible recipients after filtering lost/disqualified deals.' });
            }

            recipients = filteredRecipients;
            logToFile(`✅ [DB] Found ${recipients.length} eligible recipients for campaign ${campaignId} (after filtering).`);
        } else {
            campaign = { subject: reqSubject, content: reqBody, from_name: reqFromName };
            recipients = reqRecipients;
            logToFile(`✅ [Campaign] Using ad-hoc campaign data with ${recipients.length} recipients.`);
        }

        // 3. Drop unsubscribed emails
        const { data: unsubData, error: unsubErr } = await supabase.from('unsubscribed_emails').select('email');
        if (!unsubErr && unsubData && unsubData.length > 0) {
            const unsubSet = new Set(unsubData.map(u => u.email));
            const beforeUnsub = recipients.length;
            recipients = recipients.filter(r => !unsubSet.has(r.email));
            if (recipients.length < beforeUnsub) {
                logToFile(`🛡️ [Filter] Removed ${beforeUnsub - recipients.length} recipient(s) who unsubscribed.`);
            }
        } else if (unsubErr) {
            logToFile(`⚠️ [Filter] Could not fetch unsubscribed emails (table might not exist yet): ${unsubErr.message}`);
        }

        if (recipients.length === 0) {
            logToFile(`❌ [Filter] No eligible recipients remain after unsubscribed filter. Aborting send.`);
            return res.status(422).json({ error: 'No eligible recipients after filtering out unsubscribed contacts.' });
        }

        // Fetch Names/Companies for all recipients to enable variables
        const personIds = recipients.map(r => r.person_id).filter(Boolean);
        const { data: peopleData } = personIds.length > 0 
            ? await supabase.from('contacts').select('id, name').in('id', personIds)
            : { data: [] };
        
        const peopleMap = new Map(peopleData?.map(p => [p.id, p.name]) || []);

        const subject = campaign.subject;
        const body = campaign.content || '';
        const fromName = campaign.from_name || '';

        logToFile(`📡 [SMTP] Preparing transporter for ${SMTP_HOST}:${SMTP_PORT}...`);
        const isSSL = parseInt(SMTP_PORT) === 465;
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT || '587'),
            secure: isSSL,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            debug: true,
            logger: true,
            timeout: 15000
        });
        logToFile(`✅ [SMTP] Transporter created. Secure: ${isSSL}`);

        const sender = `"${fromName || SMTP_FROM_NAME || 'CRM System'}" <${SMTP_USER}>`;
        logToFile(`🚀 [Campaign] Starting send: "${subject}" to ${recipients.length} recipients. From: ${sender}`);

        const allResults = [];
        const batchSize = 10;

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            logToFile(`📦 [Campaign] Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} recipients)...`);

            const batchResults = await Promise.allSettled(batch.map(async (recipient) => {
                logToFile(`   📧 Processing individual recipient: ${recipient.email}...`);
                const baseUrl = process.env.TRACKING_BASE_URL || `${req.protocol}://${req.get('host')}`;

                // UUID for tracking
                const tempLogId = randomUUID();
                logToFile(`   🔑 Generated log ID: ${tempLogId}`);

                // Variable logic
                const personName = peopleMap.get(recipient.person_id) || 'Cliente';
                const variables = {
                    'name': personName,
                    'nome': personName,
                    'client_name': personName,
                    'nome da clinica': 'sua clínica', // Placeholder caso não haja
                    'saudacao': `Olá, ${personName}`,
                    'unsubscribe_url': `${baseUrl}/api/email/unsubscribe/${tempLogId}`
                };

                // Inject Tracking & Variables
                const finalHtml = injectTracking(body, baseUrl, tempLogId, variables);
                logToFile(`   🔗 Tracking and Variables injected for ${recipient.email}.`);

                const mailOptions = {
                    from: sender,
                    to: recipient.email,
                    subject,
                    html: finalHtml,
                };

                try {
                    logToFile(`   📨 Attempting SMTP send to ${recipient.email}...`);
                    const info = await transporter.sendMail(mailOptions);
                    const msgId = info.messageId || null;
                    logToFile(`   ✅ SMTP success for ${recipient.email}. MsgID: ${msgId}`);

                    // 1. Log to email_logs
                    const logPayload = {
                        id: tempLogId,
                        user_id: req.user.sub,
                        campaign_id: campaignId || null,
                        deal_id: recipient.deal_id || null,
                        person_id: recipient.person_id || null,
                        recipient_email: recipient.email,
                        subject: subject,
                        content: body,
                        status: 'sent',
                        smtp_message_id: msgId,
                        sent_at: new Date().toISOString()
                    };

                    logToFile(`   💾 Inserting email_log for ${recipient.email}...`);
                    const { error: logErr } = await supabase.from('email_logs').insert(logPayload);
                    if (logErr) logToFile(`   ⚠️ [Log] email_logs insertion failed for ${recipient.email}: ${JSON.stringify(logErr)}`);
                    else logToFile(`   ✅ email_log inserted for ${recipient.email}.`);

                    // 2. Create activity if associated with a deal
                    if (recipient.deal_id) {
                        const activityPayload = {
                            user_id: req.user.sub,
                            deal_id: recipient.deal_id,
                            title: `📧 E-mail Enviado: ${subject.substring(0, 50)}`,
                            type: 'email',
                            notes: `Campanha: ${campaign.name || 'Envio Direto'}\nAssunto: ${subject}`,
                            date: new Date().toISOString(),
                            completed: true,
                            status: 'completed'
                        };
                        const { error: actErr } = await supabase.from('activities').insert(activityPayload);
                        if (actErr) logToFile(`   ⚠️ [Log] Activity registration failed: ${JSON.stringify(actErr)}`);
                    }

                    return info;
                } catch (sendErr) {
                    logToFile(`   ❌ Failed to send to ${recipient.email}: ${sendErr.message}`);
                    throw sendErr;
                }
            }));

            allResults.push(...batchResults);

            if (i + batchSize < recipients.length) {
                logToFile('⏳ [Campaign] Rate limit sleep 1s...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        const successCount = allResults.filter(r => r.status === 'fulfilled').length;
        logToFile(`📊 [Campaign] Done. Success: ${successCount}, Failed: ${allResults.length - successCount}`);

        if (campaignId) {
            logToFile('💾 [DB] Updating delivery statuses...');
            for (let idx = 0; idx < allResults.length; idx++) {
                const res = allResults[idx];
                const recipient = recipients[idx];

                const { error: updErr } = await supabase.from('campaign_recipients')
                    .update({
                        status: res.status === 'fulfilled' ? 'sent' : 'failed',
                        message_id: res.status === 'fulfilled' ? res.value.messageId : null,
                        error_log: res.status === 'rejected' ? res.reason.message : null,
                        sent_at: new Date().toISOString()
                    })
                    .eq('id', recipient.id);

                if (updErr) logToFile(`   ⚠️ [DB] Recipient update failed: ${JSON.stringify(updErr)}`);
            }

            const { error: campUpdErr } = await supabase.from('campaigns')
                .update({
                    status: successCount > 0 ? 'sent' : 'failed',
                    sent_count: successCount,
                    sent_at: new Date().toISOString()
                })
                .eq('id', campaignId);

            if (campUpdErr) logToFile(`   ⚠️ [DB] Campaign status update failed: ${JSON.stringify(campUpdErr)}`);
        }

        res.status(200).json({
            success: successCount > 0,
            sentCount: successCount,
            total: recipients.length,
            details: allResults.filter(r => r.status === 'rejected').map(r => r.reason.message)
        });

    } catch (error) {
        logToFile(`🔥 [FATAL] ${error.message}\n${error.stack}`);
        res.status(500).json({ error: 'Critical failure during campaign sending', details: error.message });
    }
});

/**
 * IMAP Sync - Hardened
 */
app.post('/api/imap/sync', authenticate, async (req, res) => {
    const { accountId } = req.body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${req.jwt}` } }
    });

    try {
        // 1. Check account and LOCK it for sync
        const { data: account, error: accError } = await supabase
            .from('email_accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (accError || !account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Implicit Auth Check: Verify current user owns the account
        if (account.user_id !== req.user.sub) {
            return res.status(403).json({ error: 'Forbidden: UID mismatch' });
        }

        if (account.status === 'syncing') {
            return res.status(429).json({ error: 'Sync already in progress' });
        }

        // Lock account
        await supabase.from('email_accounts').update({ status: 'syncing' }).eq('id', accountId);

        const { connection_config } = account;
        const password = decrypt(connection_config.password_encrypted);

        const imap = new Imap({
            user: connection_config.user,
            password,
            host: connection_config.host,
            port: connection_config.port,
            tls: connection_config.tls !== false,
            tlsOptions: { rejectUnauthorized: false },
            connTimeout: 30000,
        });

        const cleanup = async (status = 'active') => {
            imap.end();
            await supabase.from('email_accounts').update({ status, last_sync_at: new Date().toISOString() }).eq('id', accountId);
        };

        imap.once('ready', () => {
            imap.openBox('INBOX', true, (err, box) => {
                if (err) {
                    console.error(`[IMAP Sync Error] Account ${accountId}: Failed to open INBOX`); // Sanitized log
                    cleanup('error');
                    return res.status(500).json({ error: 'INBOX error' });
                }

                const fetchRange = box.messages.total > 50 ? `${box.messages.total - 49}:*` : '1:*';
                const f = imap.fetch(fetchRange, { bodies: '', struct: true });
                const messagesToInsert = [];

                f.on('message', (msg) => {
                    let buffer = '';
                    let attrs;
                    msg.on('body', (stream) => stream.on('data', c => buffer += c.toString('utf8')));
                    msg.once('attributes', a => attrs = a);
                    msg.once('end', async () => {
                        try {
                            const parsed = await simpleParser(buffer);
                            messagesToInsert.push({
                                account_id: accountId,
                                user_id: req.user.sub,
                                remote_id: attrs.uid.toString(),
                                message_id: parsed.messageId,
                                subject: parsed.subject,
                                from_address: parsed.from?.value[0] || { name: 'Unknown', address: 'unknown' },
                                to_addresses: parsed.to?.value || [],
                                received_at: parsed.date || new Date().toISOString(),
                                is_read: attrs.flags.includes('\\Seen'),
                                folder: 'inbox'
                                // NOTE: body_text and body_html removed from bulk sync for privacy/performance
                                // They should be fetched on-demand by ID
                            });
                        } catch (e) { /* ignore */ }
                    });
                });

                f.once('end', async () => {
                    if (messagesToInsert.length > 0) {
                        const { error: insError } = await supabase
                            .from('emails')
                            .upsert(messagesToInsert, { onConflict: 'account_id,remote_id' });

                        if (insError) {
                            console.error(`[IMAP Sync Error] Account ${accountId}: Storage error during upsert`); // Sanitized log
                            await cleanup('error');
                            return res.status(500).json({ error: 'Storage error' });
                        }
                    }
                    await cleanup('active');
                    res.status(200).json({ success: true, count: messagesToInsert.length });
                });
            });
        });

        imap.once('error', (err) => {
            console.error(`[IMAP Sync Error] Account ${accountId}: Connection failed`); // Sanitized log
            cleanup('error');
            res.status(500).json({ error: 'Connection failed' });
        });

        imap.connect();

    } catch (err) {
        console.error(`[IMAP Sync Error] Account ${accountId}: Internal sync error`); // Sanitized log
        // Ensure account status is reset even if an error occurs before IMAP connection
        await supabase.from('email_accounts').update({ status: 'error' }).eq('id', accountId);
        res.status(500).json({ error: 'Sync error' });
    }
});

/**
 * Add Email Account - Securely encrypts password on server
 */
app.post('/api/imap/add-account', authenticate, async (req, res) => {
    const { name, email, host, port, password, tls } = req.body;

    if (!email || !password || !host || !port) {
        return res.status(400).json({ error: 'Missing required configuration' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${req.jwt}` } }
    });

    try {
        const password_encrypted = encrypt(password);

        const { data, error } = await supabase
            .from('email_accounts')
            .insert({
                user_id: req.user.sub,
                email,
                name: name || email,
                connection_config: {
                    host,
                    port: parseInt(port),
                    user: email,
                    password_encrypted,
                    tls: tls !== false
                },
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('[Add Account Error]:', err.message);
        res.status(500).json({ error: 'Failed to create account securely' });
    }
});

/**
 * Verify IMAP Credentials - Hardened
 */
app.post('/api/imap/verify', authenticate, (req, res) => {
    const { user, password, host, port, tls } = req.body;

    if (!user || !password || !host || !port) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    const imap = new Imap({
        user,
        password,
        host,
        port: parseInt(port),
        tls: tls !== false,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 10000,
    });

    imap.once('ready', () => {
        imap.end();
        res.status(200).json({ success: true });
    });

    imap.once('error', (err) => {
        res.status(401).json({ error: 'Authentication failed', details: err.message });
    });

    imap.connect();
});

/**
 * Helper: Send daily summary of today's activities to a specific user
 */
async function sendDailySummaryForUser(supabase, userId, userEmail, userName) {
    logToFile(`📧 [Daily Cron] Generating daily summary for ${userName} (${userEmail})`);

    // Fetch all pending activities
    const { data: activities, error: actError } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', false);

    if (actError) {
        logToFile(`❌ [Daily Cron] Error fetching activities for ${userId}: ${actError.message}`);
        return { success: false, error: actError.message };
    }

    if (!activities || activities.length === 0) {
        logToFile(`ℹ️ [Daily Cron] No pending activities found for ${userName}`);
        return { success: true, count: 0, reason: 'No pending activities' };
    }

    // Filter for today in Lisbon/Server local time format (YYYY-MM-DD)
    const todayStr = new Date().toLocaleDateString('sv'); // SV-SE formats YYYY-MM-DD
    const todayActivities = activities.filter(a => {
        if (!a.date) return false;
        return a.date.substring(0, 10) === todayStr;
    });

    if (todayActivities.length === 0) {
        logToFile(`ℹ️ [Daily Cron] No activities scheduled for today (${todayStr}) for ${userName}`);
        return { success: true, count: 0, reason: `No activities scheduled for ${todayStr}` };
    }

    // Fetch deals to map titles
    const { data: deals } = await supabase
        .from('deals')
        .select('id, title')
        .eq('user_id', userId);
    
    const dealsMap = new Map(deals?.map(d => [d.id, d.title]) || []);

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || '587'),
        secure: parseInt(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        tls: { rejectUnauthorized: false }
    });

    const itemsHtml = todayActivities.map(a => {
        const typeLabels = {
            call: '📞 Ligação',
            meeting: '📅 Reunião',
            email: '📧 E-mail',
            message: '💬 Mensagem',
            instagram: '📸 Instagram',
            analysis: '📊 Análise',
            audit: '🎥 Auditoria',
            task: '✅ Tarefa'
        };
        const typeColors = {
            call: '#2563eb',
            meeting: '#16a34a',
            email: '#d97706',
            message: '#0d9488',
            instagram: '#db2777',
            analysis: '#4f46e5',
            audit: '#e11d48',
            task: '#4b5563'
        };

        const typeLabel = typeLabels[a.type] || '✅ Tarefa';
        const typeColor = typeColors[a.type] || '#4b5563';
        const dealTitle = a.deal_id ? dealsMap.get(a.deal_id) || 'Negócio associado' : 'Sem negócio associado';

        return `
            <div style="margin-bottom: 16px; padding: 16px; background-color: #ffffff; border-radius: 8px; border-left: 4px solid ${typeColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                    <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: ${typeColor}; background-color: ${typeColor}15; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.05em;">
                        ${typeLabel}
                    </span>
                    <span style="font-size: 11px; color: #94a3b8; font-weight: 500;">
                        ${dealTitle}
                    </span>
                </div>
                <h4 style="margin: 6px 0; font-size: 14px; font-weight: 700; color: #1e293b;">
                    ${a.title}
                </h4>
                ${a.notes ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.5; font-style: italic;">Obs: ${a.notes}</p>` : ''}
            </div>
        `;
    }).join('');

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap');
            </style>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #334155;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center; color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">Bom dia, ${userName || 'Philippe'}!</h1>
                    <p style="margin: 8px 0 0 0; font-size: 14px; color: #bfdbfe; font-weight: 500;">
                        Aqui está o seu planejamento para hoje, dia <strong>${new Date().toLocaleDateString('pt-BR')}</strong>.
                    </p>
                </div>

                <!-- Summary Card -->
                <div style="background-color: #ffffff; padding: 20px; border-radius: 0 0 12px 12px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; border-top: 1px solid #f1f5f9;">
                    <div style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 28px; font-weight: 800; padding: 12px 24px; border-radius: 50%; margin-bottom: 12px;">
                        ${todayActivities.length}
                    </div>
                    <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">
                        Atividades agendadas para hoje
                    </h3>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">
                        Organize sua rotina e mantenha o foco para bater as metas!
                    </p>
                </div>

                <!-- Activities List -->
                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                        Lista de Tarefas
                    </h3>
                    ${itemsHtml}
                </div>

                <!-- Action Button -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <a href="${process.env.TRACKING_BASE_URL || 'https://crm.dentalcarelisboa.com'}/activities" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2);">
                        Abrir Fila de Atividades (Modo Foco)
                    </a>
                </div>

                <!-- Footer -->
                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                    <p style="margin: 0 0 4px 0;">Este é um resumo automático enviado pelo seu Dentalcare CRM.</p>
                    <p style="margin: 0;">&copy; ${new Date().getFullYear()} CRM Platform. Todos os direitos reservados.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    await transporter.sendMail({
        from: `"${SMTP_FROM_NAME || 'CRM System'}" <${SMTP_USER}>`,
        to: userEmail,
        subject: `📅 Resumo de Hoje: ${todayActivities.length} atividade(s) planejada(s)`,
        html: htmlBody
    });

    logToFile(`✅ [Daily Cron] Summary successfully sent to ${userEmail}`);
    return { success: true, count: todayActivities.length };
}

/**
 * Cron Job: Run daily at 07:00 Lisbon time
 */
cron.schedule('0 7 * * *', async () => {
    logToFile('⏰ [Daily Cron] Running scheduled daily activities summary...');
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: users, error: userError } = await supabase
            .from('profiles')
            .select('id, email, name');

        if (userError) {
            logToFile(`❌ [Daily Cron] Failed to fetch users: ${userError.message}`);
            return;
        }

        if (!users || users.length === 0) {
            logToFile('ℹ️ [Daily Cron] No users found in profiles to send summaries.');
            return;
        }

        for (const user of users) {
            if (user.email) {
                await sendDailySummaryForUser(supabase, user.id, user.email, user.name);
            }
        }
        logToFile('✅ [Daily Cron] All daily summary crons finished.');
    } catch (e) {
        logToFile(`🔥 [Daily Cron Exception]: ${e.message}`);
    }
}, {
    timezone: "Europe/Lisbon"
});

/**
 * POST /api/cron/daily-activities-test
 * Allows manual trigger of daily summaries for testing
 */
app.post('/api/cron/daily-activities-test', authenticate, async (req, res) => {
    logToFile(`🧪 [Cron Manual Trigger] Running summary for current user...`);
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        const { data: user, error: userError } = await supabase
            .from('profiles')
            .select('id, email, name')
            .eq('id', req.user.sub)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User profile not found in profiles table.' });
        }

        const result = await sendDailySummaryForUser(supabase, user.id, user.email, user.name);
        res.status(200).json({ success: true, message: 'Summary email trigger processed', result });
    } catch (error) {
        console.error('[Manual Cron Error]:', error.message);
        res.status(500).json({ error: 'Cron manual trigger failed', details: error.message });
    }
});

/**
 * COMMERCIAL INSIGHTS CLASSIFICATION SERVICE
 * Helper function for upserting insights with duplicate prevention
 */
const upsertInsight = async (supabase, payload) => {
    const {
        userId, negocioId, atividadeId, textoOrigem,
        categoria, tags_tematicas, subcategoria, resumo,
        confianca, revisarManualmente, classificacaoFalhou, erroClassificacao,
        contentSignal, direcao
    } = payload;

    // Try to find existing record by unique constraint components
    let query = supabase.from('insights_comerciais').select('id');
    if (atividadeId) {
        query = query.eq('atividade_id', atividadeId);
    } else {
        query = query.is('atividade_id', null);
    }
    if (negocioId) {
        query = query.eq('negocio_id', negocioId);
    } else {
        query = query.is('negocio_id', null);
    }
    query = query.eq('texto_origem', textoOrigem);

    const { data: existing, error: selectErr } = await query;
    if (selectErr) {
        logToFile(`❌ [Insights DB] Error checking existing insight: ${JSON.stringify(selectErr)}`);
    }

    if (existing && existing.length > 0) {
        // Perform UPDATE to prevent duplication
        const { error: updateErr } = await supabase
            .from('insights_comerciais')
            .update({
                categoria,
                tags_tematicas,
                subcategoria,
                resumo,
                confianca,
                revisar_manualmente: revisarManualmente,
                classificacao_falhou: classificacaoFalhou,
                erro_classificacao: erroClassificacao,
                content_signal: contentSignal || null,
                user_id: userId,
                direcao: direcao || 'recebido'
            })
            .eq('id', existing[0].id);

        if (updateErr) {
            logToFile(`❌ [Insights DB] Error updating insight ${existing[0].id}: ${JSON.stringify(updateErr)}`);
            throw updateErr;
        }
        logToFile(`✅ [Insights DB] Insight ${existing[0].id} updated successfully.`);
    } else {
        // Perform INSERT
        const { error: insertErr } = await supabase
            .from('insights_comerciais')
            .insert({
                user_id: userId,
                negocio_id: negocioId || null,
                atividade_id: atividadeId || null,
                texto_origem: textoOrigem,
                categoria,
                tags_tematicas: tags_tematicas || [],
                subcategoria,
                resumo,
                confianca,
                revisar_manualmente: revisarManualmente,
                classificacao_falhou: classificacaoFalhou,
                erro_classificacao: erroClassificacao,
                content_signal: contentSignal || null,
                direcao: direcao || 'recebido'
            });

        if (insertErr) {
            // If conflict code is returned (unique constraint violation), retry as update
            if (insertErr.code === '23505') {
                logToFile(`⚠️ [Insights DB] Conflict on insert. Retrying as update...`);
                return upsertInsight(supabase, payload);
            }
            logToFile(`❌ [Insights DB] Error inserting insight: ${JSON.stringify(insertErr)}`);
            throw insertErr;
        }
        logToFile(`✅ [Insights DB] Insight inserted successfully.`);
    }
};

/**
 * Helper to determine message direction ('enviado' or 'recebido') based on CRM activity context
 */
function getDirecao(activity, textoOrigem) {
    if (!activity) {
        return 'recebido';
    }
    const type = activity.type ? activity.type.toLowerCase() : '';
    const title = activity.title ? activity.title.toLowerCase() : '';
    
    // If it is a call or meeting, it is always from a conversation (received insights)
    if (type === 'call' || type === 'meeting') {
        return 'recebido';
    }

    // For emails, WhatsApp, Instagram or general messages, we need to inspect the text content.
    // Outbound messages/emails (pitches) typically start with greetings or are longer.
    // Salesperson reports/outcomes (e.g., "não atendeu", "relação disse...", "não atende") are received facts/barriers.
    if (type === 'email' || type === 'whats' || type === 'message' || type === 'instagram' ||
        title.includes('email') || title.includes('enviar') || title.includes('whats') || title.includes('mensagem') || title.includes('instagram')) {
        
        const cleanText = (textoOrigem || '').trim().toLowerCase();
        
        // If it starts with a common greeting and has some length, it's an outgoing pitch/message body
        const startsWithGreeting = cleanText.startsWith('olá') || 
                                   cleanText.startsWith('ola') || 
                                   cleanText.startsWith('boa tarde') || 
                                   cleanText.startsWith('bom dia') || 
                                   cleanText.startsWith('boa noite') || 
                                   cleanText.startsWith('caro') || 
                                   cleanText.startsWith('prezado');
                                   
        if (startsWithGreeting && cleanText.length > 50) {
            return 'enviado';
        }
        
        // If the text is short, it is almost certainly a salesperson's completion report/note, not the pitch itself
        if (cleanText.length < 150) {
            return 'recebido';
        }
        
        // Check for report keywords that indicate we are reporting a contact outcome or barrier
        const containsReportKeywords = cleanText.includes('não') || 
                                       cleanText.includes('sem') || 
                                       cleanText.includes('atendeu') || 
                                       cleanText.includes('respondeu') || 
                                       cleanText.includes('falar com') || 
                                       cleanText.includes('disse') || 
                                       cleanText.includes('falou') || 
                                       cleanText.includes('receção') || 
                                       cleanText.includes('recepção') || 
                                       cleanText.includes('secretária') || 
                                       cleanText.includes('decisor');
                                       
        if (containsReportKeywords || cleanText.length < 250) {
            return 'recebido';
        }
        
        return 'enviado';
    }
    
    return 'recebido';
}

/**
 * POST /api/insights/classify
 * Receives note details and triggers asynchronous classification via Anthropic Claude
 */
app.post('/api/insights/classify', authenticate, async (req, res) => {
    const { negocioId, atividadeId, textoOrigem, userId } = req.body;

    if (!textoOrigem || !userId) {
        return res.status(400).json({ error: 'textoOrigem and userId are required' });
    }

    logToFile(`🤖 [Insights AI] Starting classification for note: "${textoOrigem.substring(0, 50)}..."`);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${req.jwt}` } }
    });

    let activity = null;
    try {
        if (atividadeId) {
            const { data: act } = await supabase.from('activities').select('type, title').eq('id', atividadeId).maybeSingle();
            activity = act;
        }
    } catch (err) {
        logToFile(`⚠️ [Insights AI] Failed to fetch activity: ${err.message}`);
    }

    const direcao = getDirecao(activity, textoOrigem);

    if (direcao === 'enviado') {
        logToFile(`ℹ️ [Insights AI] Forcing categoria='neutro' for outgoing activity (direcao = enviado). Skipping Claude.`);
        const subcat = (activity?.type === 'email' || (activity?.title && activity.title.toLowerCase().includes('email'))) ? 'email_enviado' : 'mensagem_enviada';
        const resumoText = textoOrigem.length > 80 ? `${textoOrigem.substring(0, 80)}...` : textoOrigem;
        
        try {
            await upsertInsight(supabase, {
                userId,
                negocioId,
                atividadeId,
                textoOrigem,
                categoria: 'neutro',
                tags_tematicas: [],
                subcategoria: subcat,
                resumo: `Mensagem enviada: "${resumoText}"`,
                confianca: 1.0,
                revisarManualmente: false,
                classificacaoFalhou: false,
                erroClassificacao: null,
                contentSignal: null,
                direcao: 'enviado'
            });
            logToFile(`✅ [Insights AI] Outgoing activity processed: "${textoOrigem.substring(0, 40)}..." -> Categoria: neutro, Subcategoria: ${subcat}, Direcao: enviado`);
            return res.status(200).json({ success: true, message: 'Outgoing activity processed' });
        } catch (dbErr) {
            logToFile(`❌ [Insights DB] Failed to save outgoing activity: ${dbErr.message}`);
            return res.status(500).json({ error: dbErr.message });
        }
    }

    // MOCK AI CLASSIFICATION MODE FOR TESTING
    if (process.env.MOCK_AI_CLASSIFICATION === 'true') {
        logToFile(`🤖 [Insights AI] [MOCK MODE] Simulating classification for note: "${textoOrigem.substring(0, 50)}..."`);
        await new Promise(r => setTimeout(r, 500));

        let mockResult = {
            categoria: "neutro",
            tags_tematicas: [],
            subcategoria: "sem_classificacao_mock",
            resumo: "[MOCK] Nota sem padrão reconhecido no modo de teste",
            confianca: 0.5,
            contentSignal: null
        };

        const lowerText = textoOrigem.toLowerCase();
        if (lowerText.includes("recepcionista") || lowerText.includes("atendendo")) {
            mockResult = {
                categoria: "barreira_acesso",
                tags_tematicas: ["decisor"],
                subcategoria: "recepcionista_bloqueia_decisor",
                resumo: "[MOCK] Recepcionista impediu contacto direto com decisor",
                confianca: 0.85,
                contentSignal: "Decisores estão protegidos por filtros internos que impedem novas oportunidades"
            };
        } else if (lowerText.includes("agência") || lowerText.includes("agencia") || lowerText.includes("orçamento") || lowerText.includes("orcamento") || lowerText.includes("preço") || lowerText.includes("preco")) {
            const isLostReason = lowerText.includes("perda") || lowerText.includes("concorrência") || lowerText.includes("concorrencia") || lowerText.includes("preço") || lowerText.includes("preco");
            mockResult = {
                categoria: isLostReason ? "motivo_perda" : "objecao",
                tags_tematicas: ["concorrencia", "orcamento"],
                subcategoria: "preco_concorrencia_alto",
                resumo: "[MOCK] Negócio perdido devido a preço da concorrência mais atraente",
                confianca: 0.9,
                contentSignal: "Muitas clínicas confundem presença digital com estratégia de crescimento"
            };
        } else if (lowerText.includes("indicação") || lowerText.includes("indicacao")) {
            mockResult = {
                categoria: "dor",
                tags_tematicas: ["indicacao", "crescimento"],
                subcategoria: "dependencia_indicacao",
                resumo: "[MOCK] Clínica depende de indicação de pacientes",
                confianca: 0.88,
                contentSignal: "Clínicas confundem indicação espontânea com estratégia de crescimento"
            };
        }

        try {
            const confianca = mockResult.confianca;
            const revisarManualmente = confianca < 0.5;

            await upsertInsight(supabase, {
                userId,
                negocioId,
                atividadeId,
                textoOrigem,
                categoria: mockResult.categoria,
                tags_tematicas: mockResult.tags_tematicas,
                subcategoria: mockResult.subcategoria,
                resumo: mockResult.resumo,
                confianca,
                revisarManualmente,
                classificacaoFalhou: false,
                erroClassificacao: null,
                contentSignal: mockResult.contentSignal,
                direcao: 'recebido'
            });
            logToFile(`✅ [Insights AI] [MOCK MODE] Classified note: "${textoOrigem.substring(0, 40)}..." -> Categoria: ${mockResult.categoria}, Subcategoria: ${mockResult.subcategoria}, Direcao: recebido`);
            return res.status(200).json({ success: true, message: 'Note classified (mock)' });
        } catch (dbErr) {
            logToFile(`❌ [Insights DB] [MOCK MODE] Failed to save classified insight: ${dbErr.message}`);
            return res.status(500).json({ error: dbErr.message });
        }
    }

    if (!apiKey) {
        logToFile(`❌ [Insights AI] ANTHROPIC_API_KEY is not defined in environment variables.`);
        try {
            await upsertInsight(supabase, {
                userId,
                negocioId,
                atividadeId,
                textoOrigem,
                categoria: 'neutro',
                tags_tematicas: [],
                subcategoria: 'erro_configuracao',
                resumo: 'Erro de configuração: ANTHROPIC_API_KEY ausente',
                confianca: 0,
                revisarManualmente: true,
                classificacaoFalhou: true,
                erroClassificacao: 'ANTHROPIC_API_KEY is missing on backend server',
                contentSignal: null
            });
            return res.status(200).json({ success: false, error: 'API key missing, insight written as error' });
        } catch (dbErr) {
            logToFile(`❌ [Insights DB] Failed to write API key error to DB: ${dbErr.message}`);
            return res.status(500).json({ error: dbErr.message });
        }
    }

    const systemPrompt = `Você é um classificador de notas comerciais de uma agência de tráfego pago para clínicas odontológicas e profissionais de saúde em Portugal. Você vai receber o texto de uma nota registrada por um vendedor durante o processo de prospecção ou negociação.

Classifique a nota em DOIS EIXOS independentes:

EIXO 1 (categoria) — a forma/natureza da nota, escolha exatamente UMA:
- dor: o lead menciona um problema operacional ou de negócio (ex: poucos pacientes, falta de previsibilidade)
- objecao: o lead apresenta uma resistência à proposta
- barreira_acesso: dificuldade em chegar ao decisor
- motivo_perda: razão explícita pela qual o negócio foi perdido
- motivo_ganho: razão explícita pela qual o negócio foi ganho
- neutro: nota operacional sem informação estratégica relevante (ex: "reagendar para terça")

EIXO 2 (tags_tematicas) — os assuntos mencionados, escolha ZERO, UMA ou VÁRIAS das opções abaixo (array vazio se a nota for puramente operacional):
- decisor (menciona quem decide, dificuldade de acesso a essa pessoa, ou disponibilidade dela)
- concorrencia (menciona outra agência, outro fornecedor, ou comparação)
- orcamento (menciona dinheiro, preço, custo, investimento disponível)
- urgencia (menciona prazo, pressa, "preciso já", ou ao contrário "sem pressa")
- autoridade (menciona quem tem poder de decisão dentro da clínica, hierarquia, sócios)
- indicacao (menciona boca-a-boca, recomendação de pacientes)
- marketing_atual (menciona o que já fazem hoje em marketing/anúncios)
- expansao (menciona planos de crescer, abrir filial, contratar)
- crescimento (menciona aumento de pacientes, faturamento, demanda)
- operacional (menciona agenda, processos internos, equipa)

Para a subcategoria, use preferencialmente termos padronizados em snake_case. Especialmente para "barreira_acesso", use estritamente:
- "identificacao_decisor" (quando não se sabe quem decide ou como falar com ele)
- "recepcionista_bloqueia_decisor" (quando a recepcionista/secretária barra o contacto)
- "sem_resposta_contacto" (use este termo unificado para qualquer falta de resposta do contacto, mensagens lidas e não respondidas, ou silêncio pós-contacto, NÃO criando outras variações como "sem_resposta_mensagens" ou "sem_resposta_decisor")

Além dos dois eixos, gere também um campo content_signal: uma frase curta (até 15 palavras) que descreve a CRENÇA ou COMPORTAMENTO DE MERCADO revelado por essa nota — não o fato em si, mas a interpretação estratégica reutilizável como tese de conteúdo para Reels, carrosséis ou anúncios.

Exemplos do padrão esperado:
- Nota sobre recepcionista bloqueando contacto → content_signal: "Decisores estão protegidos por filtros internos que impedem novas oportunidades"
- Nota sobre "já tenho agência" → content_signal: "Muitas clínicas confundem presença digital com estratégia de crescimento"
- Nota sobre dependência de indicação → content_signal: "Clínicas confundem indicação espontânea com estratégia de crescimento"
- Nota neutra/operacional (ex: reagendamento) → content_signal: null

Mantenha o content_signal CONSISTENTE entre notas da mesma subcategoria: se duas notas diferentes geram a mesma subcategoria (ex: "recepcionista_bloqueia_decisor"), o content_signal deve expressar a mesma tese central, com redação muito semelhante, para que o sistema consiga agrupar e contar ocorrências do mesmo tema ao longo do tempo.

Retorne EXCLUSIVAMENTE neste formato JSON, sem nenhum texto antes ou depois:

{
  "categoria": "uma das opções do eixo 1",
  "tags_tematicas": ["zero ou mais opções do eixo 2"],
  "subcategoria": "string em snake_case descrevendo o tema específico dentro da categoria",
  "resumo": "uma frase curta resumindo o ocorrido, focada estritamente na categoria e subcategoria identificadas (ex: se categorizado como 'dor', descreva apenas a dor sem incluir barreiras de acesso ou objeções)",
  "confianca": número entre 0 e 1,
  "content_signal": "string ou null"
}`;

    let attempt = 0;
    let success = false;
    let lastError = null;
    let parsedResult = null;

    const maxAttempts = 5; // 1 initial + 4 retries
    const backoffTimes = [2000, 5000, 15000, 30000];

    while (attempt < maxAttempts && !success) {
        if (attempt > 0) {
            const waitTime = backoffTimes[attempt - 1] || 1000;
            logToFile(`🤖 [Insights AI] Retrying attempt ${attempt} in ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
        }

        attempt++;
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: textoOrigem }
                    ]
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Anthropic API error: Status ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const text = data?.content?.[0]?.text;
            if (!text) {
                throw new Error("Empty text returned from Anthropic API");
            }

            // Clean markdown JSON wrapper blocks
            let cleaned = text.trim();
            if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
            if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
            if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
            cleaned = cleaned.trim();

            parsedResult = JSON.parse(cleaned);

            // Basic validation
            if (!parsedResult.categoria || !Array.isArray(parsedResult.tags_tematicas) || !parsedResult.subcategoria || !parsedResult.resumo) {
                throw new Error("Response JSON lacks required fields or has invalid types");
            }

            success = true;
        } catch (err) {
            logToFile(`❌ [Insights AI] Attempt ${attempt} failed: ${err.message}`);
            lastError = err;
        }
    }

    if (success && parsedResult) {
        try {
            const confianca = parsedResult.confianca !== undefined ? Number(parsedResult.confianca) : 1.0;
            const revisarManualmente = confianca < 0.5;

            await upsertInsight(supabase, {
                userId,
                negocioId,
                atividadeId,
                textoOrigem,
                categoria: parsedResult.categoria,
                tags_tematicas: parsedResult.tags_tematicas,
                subcategoria: parsedResult.subcategoria,
                resumo: parsedResult.resumo,
                confianca,
                revisarManualmente,
                classificacaoFalhou: false,
                erroClassificacao: null,
                contentSignal: parsedResult.content_signal,
                direcao: 'recebido'
            });
            logToFile(`✅ [Insights AI] Classified note: "${textoOrigem.substring(0, 40)}..." -> Categoria: ${parsedResult.categoria}, Subcategoria: ${parsedResult.subcategoria}, Direcao: recebido`);
            return res.status(200).json({ success: true, classification: parsedResult });
        } catch (dbErr) {
            logToFile(`❌ [Insights DB] Failed to save classified insight to database: ${dbErr.message}`);
            return res.status(500).json({ error: dbErr.message });
        }
    } else {
        logToFile(`❌ [Insights AI] All classification attempts failed. Saving failure state in DB...`);
        try {
            await upsertInsight(supabase, {
                userId,
                negocioId,
                atividadeId,
                textoOrigem,
                categoria: 'neutro',
                tags_tematicas: [],
                subcategoria: 'erro_classificacao',
                resumo: 'Falha ao classificar via IA',
                confianca: 0,
                revisarManualmente: true,
                classificacaoFalhou: true,
                erroClassificacao: lastError ? lastError.message : 'Unknown classification error',
                contentSignal: null
            });
            return res.status(200).json({ success: false, error: 'Classification failed', details: lastError ? lastError.message : 'Unknown error' });
        } catch (dbErr) {
            logToFile(`❌ [Insights DB] Failed to save failure state to database: ${dbErr.message}`);
            return res.status(500).json({ error: dbErr.message });
        }
    }
});

/**
 * GET /api/knowledge-base/trends
 * Fetches natively aggregated trends using the PostgreSQL RPC function get_commercial_insights_trends
 */
app.get('/api/knowledge-base/trends', authenticate, async (req, res) => {
    try {
        const days = parseInt(req.query.days, 10) || 30;
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        logToFile(`📊 [Insights DB] Fetching trends for user ${req.user.sub} over last ${days} days...`);
        const { data, error } = await supabase.rpc('get_commercial_insights_trends', { p_days: days });

        if (error) {
            logToFile(`❌ [Insights DB] Error calling trends RPC: ${JSON.stringify(error)}`);
            return res.status(500).json({ error: 'Failed to fetch insights trends', details: error.message });
        }

        res.status(200).json(data);
    } catch (err) {
        logToFile(`❌ [Insights DB] Trends endpoint exception: ${err.message}`);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

/**
 * GET /api/knowledge-base/content-signals
 * Fetches natively aggregated content signal trends using get_content_signals_trends
 */
app.get('/api/knowledge-base/content-signals', authenticate, async (req, res) => {
    try {
        const days = parseInt(req.query.days, 10) || 30;
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        logToFile(`📊 [Insights DB] Fetching content signals for user ${req.user.sub} over last ${days} days...`);
        const { data, error } = await supabase.rpc('get_content_signals_trends', { p_days: days });

        if (error) {
            logToFile(`❌ [Insights DB] Error calling content signals RPC: ${JSON.stringify(error)}`);
            return res.status(500).json({ error: 'Failed to fetch content signals trends', details: error.message });
        }

        res.status(200).json(data);
    } catch (err) {
        logToFile(`❌ [Insights DB] Content signals endpoint exception: ${err.message}`);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

/**
 * POST /api/knowledge-base/backfill
 * Finds all unclassified notes and lost reasons, then triggers classification
 * in batches. This is the "Processar Histórico" feature.
 *
 * Body params:
 *   - dias: number (default 60) — how many days back to look
 *
 * Returns: { found, queued, skipped, errors, duration_ms }
 */
app.post('/api/knowledge-base/backfill', authenticate, async (req, res) => {
    const startTime = Date.now();
    const dias = parseInt(req.body?.dias, 10) || 60;
    const userId = req.user.sub;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${req.jwt}` } }
    });

    logToFile(`🔄 [Backfill] Starting for user ${userId}, last ${dias} days`);

    const cutoff = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

    // -----------------------------------------------------------------------
    // SOURCE 1: deal_logs of type manual_note or activity_note
    // that have NO corresponding insight (match by texto_origem + negocio_id)
    // -----------------------------------------------------------------------
    let allItems = [];

    const { data: logs, error: logsErr } = await supabaseAdmin
        .from('deal_logs')
        .select('id, content, deal_id, activity_id, created_at')
        .in('log_type', ['manual_note', 'activity_note'])
        .eq('created_by', userId)
        .gte('created_at', cutoff)
        .not('content', 'is', null)
        .neq('content', '');

    if (logsErr) {
        logToFile(`❌ [Backfill] Error fetching deal_logs: ${logsErr.message}`);
        return res.status(500).json({ error: 'Failed to fetch deal logs', details: logsErr.message });
    }

    logToFile(`📋 [Backfill] Found ${logs?.length || 0} candidate log entries`);

    for (const log of (logs || [])) {
        // Check if insight already exists for this texto_origem + negocio_id
        let existsQuery = supabaseAdmin
            .from('insights_comerciais')
            .select('id')
            .eq('texto_origem', log.content)
            .eq('user_id', userId);

        if (log.deal_id) existsQuery = existsQuery.eq('negocio_id', log.deal_id);
        else existsQuery = existsQuery.is('negocio_id', null);

        if (log.activity_id) existsQuery = existsQuery.eq('atividade_id', log.activity_id);
        else existsQuery = existsQuery.is('atividade_id', null);

        const { data: existingInsight } = await existsQuery.maybeSingle();

        if (!existingInsight) {
            allItems.push({
                source: 'log',
                textoOrigem: log.content,
                negocioId: log.deal_id || null,
                atividadeId: log.activity_id || null
            });
        }
    }

    // -----------------------------------------------------------------------
    // SOURCE 2: deals with status='lost' and lost_reason filled
    // that have NO corresponding insight classified as motivo_perda
    // -----------------------------------------------------------------------
    const { data: lostDeals, error: lostErr } = await supabaseAdmin
        .from('deals')
        .select('id, lost_reason, lost_at')
        .eq('user_id', userId)
        .eq('status', 'lost')
        .not('lost_reason', 'is', null)
        .neq('lost_reason', '')
        .gte('lost_at', cutoff);

    if (lostErr) {
        logToFile(`❌ [Backfill] Error fetching lost deals: ${lostErr.message}`);
        return res.status(500).json({ error: 'Failed to fetch lost deals', details: lostErr.message });
    }

    logToFile(`📋 [Backfill] Found ${lostDeals?.length || 0} candidate lost deals`);

    for (const deal of (lostDeals || [])) {
        // Check if an insight already exists for this lost_reason text + negocio_id
        const { data: existingInsight } = await supabaseAdmin
            .from('insights_comerciais')
            .select('id')
            .eq('texto_origem', deal.lost_reason)
            .eq('negocio_id', deal.id)
            .eq('user_id', userId)
            .maybeSingle();

        if (!existingInsight) {
            allItems.push({
                source: 'lost_reason',
                textoOrigem: deal.lost_reason,
                negocioId: deal.id,
                atividadeId: null
            });
        }
    }

    logToFile(`🎯 [Backfill] Total unclassified items to process: ${allItems.length}`);

    if (allItems.length === 0) {
        const duration = Date.now() - startTime;
        return res.status(200).json({
            found: 0,
            queued: 0,
            skipped: 0,
            errors: 0,
            duration_ms: duration,
            message: 'Nenhum item sem classificação encontrado no período.'
        });
    }

    // Acknowledge immediately and run in background
    try {
        const BATCH_SIZE = 10;
        const BATCH_DELAY_MS = 500;
        let processed = 0;
        let errors = 0;

        const apiKey = process.env.ANTHROPIC_API_KEY;
        const isMock = process.env.MOCK_AI_CLASSIFICATION === 'true';

        for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
            const batch = allItems.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (item) => {
                try {
                    // Fetch activity if activityId is present
                    let activity = null;
                    if (item.atividadeId) {
                        const { data: act } = await supabaseAdmin
                            .from('activities')
                            .select('type, title')
                            .eq('id', item.atividadeId)
                            .maybeSingle();
                        activity = act;
                    }
                    const direcao = getDirecao(activity, item.textoOrigem);

                    // Force category neutro if direcao === 'enviado'
                    if (direcao === 'enviado') {
                        const subcat = (activity?.type === 'email' || (activity?.title && activity.title.toLowerCase().includes('email'))) ? 'email_enviado' : 'mensagem_enviada';
                        const resumoText = item.textoOrigem.length > 80 ? `${item.textoOrigem.substring(0, 80)}...` : item.textoOrigem;
                        
                        await upsertInsight(supabaseAdmin, {
                            userId,
                            negocioId: item.negocioId,
                            atividadeId: item.atividadeId,
                            textoOrigem: item.textoOrigem,
                            categoria: 'neutro',
                            tags_tematicas: [],
                            subcategoria: subcat,
                            resumo: `Mensagem enviada: "${resumoText}"`,
                            confianca: 1.0,
                            revisarManualmente: false,
                            classificacaoFalhou: false,
                            erroClassificacao: null,
                            contentSignal: null,
                            direcao: 'enviado'
                        });
                        processed++;
                        return;
                    }

                    // Reuse the upsertInsight helper via a self-call to the classify endpoint logic
                    // We directly call the classification logic inline to avoid HTTP overhead
                    if (isMock) {
                        await upsertInsight(supabaseAdmin, {
                            userId,
                            negocioId: item.negocioId,
                            atividadeId: item.atividadeId,
                            textoOrigem: item.textoOrigem,
                            categoria: 'neutro',
                            tags_tematicas: [],
                            subcategoria: 'backfill_mock',
                            resumo: '[MOCK Backfill] Nota sem padrão reconhecido',
                            confianca: 0.5,
                            revisarManualmente: false,
                            classificacaoFalhou: false,
                            erroClassificacao: null,
                            contentSignal: null,
                            direcao: 'recebido'
                        });
                        processed++;
                        return;
                    }

                    if (!apiKey) {
                        logToFile(`❌ [Backfill] ANTHROPIC_API_KEY missing, skipping item`);
                        errors++;
                        return;
                    }

                    const systemPrompt = `Você é um classificador de notas comerciais de uma agência de tráfego pago para clínicas odontológicas e profissionais de saúde em Portugal. Você vai receber o texto de uma nota registrada por um vendedor durante o processo de prospecção ou negociação.

Classifique a nota em DOIS EIXOS independentes:

EIXO 1 (categoria) — a forma/natureza da nota, escolha exatamente UMA:
- dor: o lead menciona um problema operacional ou de negócio
- objecao: o lead apresenta uma resistência à proposta
- barreira_acesso: dificuldade em chegar ao decisor
- motivo_perda: razão explícita pela qual o negócio foi perdido
- motivo_ganho: razão explícita pela qual o negócio foi ganho
- neutro: nota operacional sem informação estratégica relevante

EIXO 2 (tags_tematicas) — os assuntos mencionados, escolha ZERO, UMA ou VÁRIAS:
- decisor, concorrencia, orcamento, urgencia, autoridade, indicacao, marketing_atual, expansao, crescimento, operacional

Para a subcategoria, use preferencialmente termos padronizados em snake_case. Especialmente para "barreira_acesso", use estritamente:
- "identificacao_decisor" (quando não se sabe quem decide ou como falar com ele)
- "recepcionista_bloqueia_decisor" (quando a recepcionista/secretária barra o contacto)
- "sem_resposta_contacto" (use este termo unificado para qualquer falta de resposta do contacto, mensagens lidas e não respondidas, ou silêncio pós-contacto, NÃO criando outras variações como "sem_resposta_mensagens" ou "sem_resposta_decisor")

Além dos dois eixos, gere também um campo content_signal: uma frase curta (até 15 palavras) que descreve a CRENÇA ou COMPORTAMENTO DE MERCADO revelado por essa nota. Para notas neutras/operacionais, retorne null.

Retorne EXCLUSIVAMENTE neste formato JSON, sem nenhum texto antes ou depois:
{
  "categoria": "uma das opções do eixo 1",
  "tags_tematicas": ["zero ou mais opções do eixo 2"],
  "subcategoria": "string em snake_case descrevendo o tema específico",
  "resumo": "uma frase curta resumindo o ocorrido, focada estritamente na categoria e subcategoria selecionadas (ex: se for 'dor', descreva apenas a dor sem incluir barreiras de acesso ou objeções)",
  "confianca": número entre 0 e 1,
  "content_signal": "string ou null"
}`;

                    const response = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: {
                            'x-api-key': apiKey,
                            'anthropic-version': '2023-06-01',
                            'content-type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: 'claude-sonnet-4-6',
                            max_tokens: 512,
                            system: systemPrompt,
                            messages: [{ role: 'user', content: item.textoOrigem }]
                        })
                    });

                    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);

                    const data = await response.json();
                    let text = data?.content?.[0]?.text?.trim() || '';
                    if (text.startsWith('```json')) text = text.substring(7);
                    if (text.startsWith('```')) text = text.substring(3);
                    if (text.endsWith('```')) text = text.substring(0, text.length - 3);

                    const parsed = JSON.parse(text.trim());
                    const confianca = parsed.confianca !== undefined ? Number(parsed.confianca) : 1.0;

                    await upsertInsight(supabaseAdmin, {
                        userId,
                        negocioId: item.negocioId,
                        atividadeId: item.atividadeId,
                        textoOrigem: item.textoOrigem,
                        categoria: parsed.categoria,
                        tags_tematicas: parsed.tags_tematicas || [],
                        subcategoria: parsed.subcategoria,
                        resumo: parsed.resumo,
                        confianca,
                        revisarManualmente: confianca < 0.5,
                        classificacaoFalhou: false,
                        erroClassificacao: null,
                        contentSignal: parsed.content_signal || null,
                        direcao: 'recebido'
                    });
                    processed++;
                    logToFile(`✅ [Backfill] Classified item ${processed}/${allItems.length}: "${item.textoOrigem.substring(0, 40)}..."`);
                } catch (err) {
                    errors++;
                    logToFile(`❌ [Backfill] Failed to classify item: ${err.message} | Text: "${item.textoOrigem.substring(0, 40)}..."`);
                }
            }));

            // Delay between batches to avoid rate-limiting
            if (i + BATCH_SIZE < allItems.length) {
                await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
            }
        }

        const totalDuration = Date.now() - startTime;
        logToFile(`🏁 [Backfill] Completed. Processed: ${processed}, Errors: ${errors}, Duration: ${totalDuration}ms`);
        return res.status(200).json({
            found: allItems.length,
            queued: allItems.length,
            skipped: 0,
            errors,
            duration_ms: totalDuration,
            message: `Classificação de histórico concluída. ${processed} de ${allItems.length} itens classificados com sucesso. Erros: ${errors}.`
        });
    } catch (e) {
        logToFile(`❌ [Backfill] Critical failure: ${e.message}`);
        return res.status(500).json({ error: e.message });
    }
});


// ==========================================
// BREVO INTEGRATION ENDPOINTS
// ==========================================

// 1. Get Brevo Config (API key presence and last sync)
app.get('/api/brevo/config', authenticate, async (req, res) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('brevo_api_key, brevo_last_sync_at')
            .eq('id', req.user.sub)
            .single();

        if (error) {
            console.error('Error fetching brevo config:', error);
            return res.status(500).json({ error: error.message });
        }

        const hasKey = !!profile?.brevo_api_key;
        const maskedKey = hasKey ? `${profile.brevo_api_key.substring(0, 8)}...` : '';

        return res.json({
            hasKey,
            apiKey: maskedKey,
            lastSyncAt: profile?.brevo_last_sync_at || null
        });
    } catch (err) {
        console.error('Error in GET /api/brevo/config:', err);
        return res.status(500).json({ error: err.message });
    }
});

// 2. Connect and Validate Brevo API Key
app.post('/api/brevo/config', authenticate, async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
    }

    try {
        // Validate API key with Brevo API
        const validateRes = await fetch('https://api.brevo.com/v3/contacts?limit=1', {
            headers: {
                'accept': 'application/json',
                'api-key': apiKey
            }
        });

        if (!validateRes.ok) {
            const errData = await validateRes.json().catch(() => ({}));
            return res.status(400).json({
                error: 'Chave de API do Brevo inválida.',
                details: errData.message || validateRes.statusText
            });
        }

        const valData = await validateRes.json();
        const totalContacts = valData.count || 0;

        // Save key to profiles table
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ brevo_api_key: apiKey })
            .eq('id', req.user.sub);

        if (updateError) {
            console.error('Error saving brevo API key:', updateError);
            return res.status(500).json({ error: updateError.message });
        }

        return res.json({
            success: true,
            totalContacts
        });
    } catch (err) {
        console.error('Error in POST /api/brevo/config:', err);
        return res.status(500).json({ error: err.message });
    }
});

// Helper function to sync Brevo contacts and marketing campaign stats
const runBrevoSyncForUser = async (userId, apiKey) => {
    const startTime = Date.now();
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 1. Fetch all contacts from Brevo paginated
    const brevoEmails = new Set();
    let offset = 0;
    let limit = 100;
    let hasMore = true;
    let totalBrevoContacts = 0;

    while (hasMore) {
        const response = await fetch(`https://api.brevo.com/v3/contacts?limit=${limit}&offset=${offset}`, {
            headers: {
                'accept': 'application/json',
                'api-key': apiKey
            }
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(`Brevo API error: ${errBody.message || response.statusText}`);
        }

        const data = await response.json();
        totalBrevoContacts = data.count || totalBrevoContacts;
        
        if (data && data.contacts && data.contacts.length > 0) {
            data.contacts.forEach(c => {
                if (c.email) {
                    const normEmail = c.email.trim().toLowerCase().replace(/\s+/g, '');
                    brevoEmails.add(normEmail);
                }
            });
            offset += data.contacts.length;
            if (data.contacts.length < limit) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }

    // 2. Fetch CRM contacts and active deals via SECURITY DEFINER function to bypass RLS
    const { data: dbData, error: dbDataErr } = await supabase.rpc('get_contacts_and_active_deals_for_sync', { p_user_id: userId });
    if (dbDataErr) throw dbDataErr;

    const crmContacts = dbData.contacts || [];
    const activeDeals = dbData.deals || [];
    const activeDealContactIds = new Set(activeDeals.filter(d => d.contact_id).map(d => d.contact_id));

    // 3. Compare and partition contacts
    const syncedIds = [];
    const notSyncedIds = [];
    const notEligibleIds = [];

    let totalCRM = crmContacts.length;
    let totalWithEmail = 0;
    let foundInBrevo = 0;
    let notFoundInBrevo = 0;
    let withoutEmail = 0;

    const cleanEmail = (email) => {
        if (!email) return '';
        const parts = email.split(/[\s,;|/]+/);
        const firstValid = parts.find(p => p.includes('@'));
        return firstValid ? firstValid.trim().toLowerCase() : '';
    };

    for (const contact of crmContacts) {
        const cleanedEmail = cleanEmail(contact.email);
        const hasEmail = cleanedEmail.length > 0;
        const isEligible = hasEmail;

        if (hasEmail) {
            totalWithEmail++;
            if (brevoEmails.has(cleanedEmail)) {
                foundInBrevo++;
            } else {
                notFoundInBrevo++;
            }
        } else {
            withoutEmail++;
        }

        if (!isEligible) {
            notEligibleIds.push(contact.id);
        } else {
            if (brevoEmails.has(cleanedEmail)) {
                syncedIds.push(contact.id);
            } else {
                notSyncedIds.push(contact.id);
            }
        }
    }

    // 4. Pull Campaign Stats and interaction events from Brevo API
    try {
        logToFile(`⚡ [Campaign Stats Sync] Starting active stats extraction via Brevo API for user ${userId}...`);
        
        const campaignMap = new Map();
        let campOffset = 0;
        let campLimit = 50;
        let campHasMore = true;
        
        while (campHasMore) {
            const campRes = await fetch(`https://api.brevo.com/v3/emailCampaigns?limit=${campLimit}&offset=${campOffset}`, {
                headers: { 'accept': 'application/json', 'api-key': apiKey }
            });
            if (campRes.ok) {
                const campData = await campRes.json();
                if (campData.campaigns && campData.campaigns.length > 0) {
                    campData.campaigns.forEach(c => {
                        campaignMap.set(c.id, c.name);
                    });
                    campOffset += campData.campaigns.length;
                    if (campData.campaigns.length < campLimit) {
                        campHasMore = false;
                    }
                } else {
                    campHasMore = false;
                }
            } else {
                campHasMore = false;
            }
        }

        const activeDealContacts = crmContacts.filter(c => {
            const cleaned = cleanEmail(c.email);
            return cleaned && activeDealContactIds.has(c.id);
        });

        for (let i = 0; i < activeDealContacts.length; i += 10) {
            const chunk = activeDealContacts.slice(i, i + 10);
            await Promise.all(chunk.map(async (contact) => {
                const email = cleanEmail(contact.email);
                try {
                    const statsRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}/campaignStats`, {
                        headers: { 'accept': 'application/json', 'api-key': apiKey }
                    });
                    
                    if (!statsRes.ok) return;

                    const stats = await statsRes.json();
                    const campaignEvents = {};

                    const addEvent = (campaignId, eventType, date, extra = {}) => {
                        if (!campaignId) return;
                        if (!campaignEvents[campaignId]) {
                            campaignEvents[campaignId] = {
                                delivered: false,
                                opens: [],
                                clicks: [],
                                bounce: false,
                                spam: false,
                                unsubscribed: false
                            };
                        }
                        if (eventType === 'delivered') campaignEvents[campaignId].delivered = true;
                        if (eventType === 'opened') campaignEvents[campaignId].opens.push(date);
                        if (eventType === 'click') campaignEvents[campaignId].clicks.push({ date, url: extra.url || '' });
                        if (eventType === 'bounce') campaignEvents[campaignId].bounce = true;
                        if (eventType === 'spam') campaignEvents[campaignId].spam = true;
                        if (eventType === 'unsubscribed') campaignEvents[campaignId].unsubscribed = true;
                    };

                    if (stats.delivered) stats.delivered.forEach(e => addEvent(e.campaignId, 'delivered', e.eventDate));
                    if (stats.opened) stats.opened.forEach(e => addEvent(e.campaignId, 'opened', e.eventDate));
                    if (stats.clicked) stats.clicked.forEach(e => addEvent(e.campaignId, 'click', e.eventDate, { url: e.url }));
                    if (stats.hardBounces) stats.hardBounces.forEach(e => addEvent(e.campaignId, 'bounce', e.eventDate));
                    if (stats.softBounces) stats.softBounces.forEach(e => addEvent(e.campaignId, 'bounce', e.eventDate));
                    if (stats.unsubscriptions && stats.unsubscriptions.userUnsubscribed) {
                        stats.unsubscriptions.userUnsubscribed.forEach(e => addEvent(e.campaignId, 'unsubscribed', e.eventDate));
                    }

                    for (const campaignIdStr of Object.keys(campaignEvents)) {
                        const campaignId = parseInt(campaignIdStr, 10);
                        const eventsObj = campaignEvents[campaignId];
                        const campaignName = campaignMap.get(campaignId) || `Campanha #${campaignId}`;

                        const deliveryStatus = eventsObj.bounce ? 'bounce' : 'delivered';
                        const sortedOpens = eventsObj.opens.sort();
                        const firstOpen = sortedOpens.length > 0 ? sortedOpens[0] : null;
                        const lastOpen = sortedOpens.length > 0 ? sortedOpens[sortedOpens.length - 1] : null;
                        const opensCount = sortedOpens.length;
                        const clicksCount = eventsObj.clicks.length;
                        
                        const clickedLinks = [];
                        eventsObj.clicks.forEach(c => {
                            const clickUrl = c.url || 'Link de Acesso';
                            let anchor = clickUrl;
                            try {
                                const parsedUrl = new URL(clickUrl);
                                anchor = parsedUrl.hostname + parsedUrl.pathname;
                                if (anchor.length > 30) {
                                    anchor = anchor.substring(0, 30) + '...';
                                }
                            } catch (err) {}

                            const existing = clickedLinks.find(l => l.url === clickUrl);
                            if (existing) {
                                existing.clicks++;
                                if (c.date > existing.lastClickedAt) {
                                    existing.lastClickedAt = c.date;
                                }
                            } else {
                                clickedLinks.push({
                                    url: clickUrl,
                                    anchor,
                                    clicks: 1,
                                    lastClickedAt: c.date
                                });
                            }
                        });

                        const campaignContent = {
                            type: "brevo_campaign",
                            campaignName,
                            campaignId,
                            sentAt: stats.delivered && stats.delivered.find(e => e.campaignId === campaignId)?.eventDate || lastOpen || new Date().toISOString(),
                            deliveryStatus,
                            opensCount,
                            firstOpenedAt: firstOpen,
                            lastOpenedAt: lastOpen,
                            clicksCount,
                            clickedLinks,
                            bounce: eventsObj.bounce,
                            spam: eventsObj.spam,
                            unsubscribed: eventsObj.unsubscribed,
                            updatedAt: new Date().toISOString()
                        };

                        await supabase.rpc('upsert_aggregated_brevo_campaign_log', {
                            p_email: email,
                            p_campaign_id: campaignId,
                            p_campaign_name: campaignName,
                            p_log_content: campaignContent,
                            p_event_date: campaignContent.sentAt
                        });
                    }
                } catch (contactErr) {
                    console.error(`Error syncing campaign stats for ${email}:`, contactErr);
                }
            }));
        }
    } catch (syncCampaignsErr) {
        console.error(`Error pulling Brevo campaign stats:`, syncCampaignsErr);
    }

    // 5. Save results to Database bypassing RLS in a single transaction-safe call
    const durationMs = Date.now() - startTime;
    const { error: saveErr } = await supabase.rpc('save_brevo_sync_results', {
        p_user_id: userId,
        p_synced_ids: syncedIds,
        p_not_synced_ids: notSyncedIds,
        p_not_eligible_ids: notEligibleIds,
        p_log_synced: syncedIds.length,
        p_log_not_synced: notSyncedIds.length,
        p_log_ignored: notEligibleIds.length,
        p_duration: durationMs
    });
    if (saveErr) throw saveErr;

    // Fetch the inserted log for return value
    const { data: syncLog } = await supabase
        .from('brevo_sync_logs')
        .select('*')
        .eq('user_id', userId)
        .order('sync_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return {
        totalCRM,
        totalWithEmail,
        foundInBrevo,
        notFoundInBrevo,
        withoutEmail,
        syncedCount: syncedIds.length,
        notSyncedCount: notSyncedIds.length,
        ignoredCount: notEligibleIds.length,
        totalBrevoContacts,
        durationMs,
        log: syncLog
    };
};

// 3. Synchronize Brevo Status (API to CRM check)
app.post('/api/brevo/sync', authenticate, async (req, res) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('brevo_api_key')
            .eq('id', req.user.sub)
            .single();

        if (profileErr || !profile?.brevo_api_key) {
            return res.status(400).json({ error: 'Brevo API key not configured' });
        }

        const result = await runBrevoSyncForUser(req.user.sub, profile.brevo_api_key);
        return res.json({
            success: true,
            ...result,
            lastSyncAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error in POST /api/brevo/sync:', err);
        return res.status(500).json({ error: err.message });
    }
});

// Cron Job: Sincronização Automática do Brevo a cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
    logToFile('⏰ [Brevo Auto-Sync Cron] Iniciando sincronização automática de 5 minutos...');
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        // Busca todos os usuários com chave API configurada via RPC (SECURITY DEFINER para ignorar RLS)
        const { data: profiles, error: profileErr } = await supabase.rpc('get_profiles_with_brevo_key');

        if (profileErr) {
            logToFile(`❌ [Brevo Auto-Sync Cron] Falha ao buscar perfis: ${profileErr.message}`);
            return;
        }

        if (!profiles || profiles.length === 0) {
            logToFile('ℹ️ [Brevo Auto-Sync Cron] Nenhum usuário configurado com chave Brevo.');
            return;
        }

        for (const profile of profiles) {
            try {
                logToFile(`🔄 [Brevo Auto-Sync Cron] Sincronizando para Usuário ID: ${profile.id}...`);
                const result = await runBrevoSyncForUser(profile.id, profile.brevo_api_key);
                logToFile(`✅ [Brevo Auto-Sync Cron] Usuário ${profile.id} sincronizado: ${result.syncedCount} contatos mapeados.`);
            } catch (err) {
                logToFile(`❌ [Brevo Auto-Sync Cron] Erro ao sincronizar para Usuário ${profile.id}: ${err.message}`);
            }
        }
        logToFile('✅ [Brevo Auto-Sync Cron] Sincronização automática finalizada.');
    } catch (e) {
        logToFile(`🔥 [Brevo Auto-Sync Cron Exception]: ${e.message}`);
    }
});

// 4. Send Unsynced and Eligible CRM contacts to Brevo (Batch upload)
app.post('/api/brevo/send', authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        // 1. Fetch Brevo API key
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('brevo_api_key')
            .eq('id', req.user.sub)
            .single();

        if (profileErr || !profile?.brevo_api_key) {
            return res.status(400).json({ error: 'Brevo API key not configured' });
        }

        const apiKey = profile.brevo_api_key;

        // 2. Fetch all contacts from active deals for this user
        const { data: activeDeals, error: dealsErr } = await supabase
            .from('deals')
            .select('contact_id')
            .eq('user_id', req.user.sub)
            .eq('status', 'open');

        if (dealsErr) throw dealsErr;

        const activeDealContactIds = new Set(
            activeDeals
                .filter(d => d.contact_id)
                .map(d => d.contact_id)
        );

        // 3. Fetch CRM contacts with status 'nao_sincronizado'
        const { data: contactsToSend, error: contactsErr } = await supabase
            .from('contacts')
            .select('*')
            .eq('user_id', req.user.sub)
            .eq('brevo_sync_status', 'nao_sincronizado');

        if (contactsErr) throw contactsErr;

        // Filter again in backend to ensure strict security / eligibility
        const eligibleContacts = contactsToSend.filter(c => {
            const hasEmail = !!c.email && c.email.trim().length > 0;
            return hasEmail;
        });

        if (eligibleContacts.length === 0) {
            return res.json({ success: true, count: 0, message: 'Nenhum contato pendente de sincronização.' });
        }

        const cleanEmail = (email) => {
            if (!email) return '';
            const parts = email.split(/[\s,;|/]+/);
            const firstValid = parts.find(p => p.includes('@'));
            return firstValid ? firstValid.trim().toLowerCase() : '';
        };

        // 4. Format for Brevo Batch API
        const brevoContactsList = eligibleContacts.map(c => {
            const attributes = {
                FIRSTNAME: c.name || 'Contato'
            };
            if (c.phone) {
                const digits = c.phone.replace(/\D/g, '');
                if (digits.length === 9) {
                    attributes.SMS = '351' + digits; // Auto-prefix Portugal
                } else if (digits.length === 11 && digits.startsWith('9')) {
                    attributes.SMS = '55' + digits;  // Auto-prefix Brazil
                } else if (digits.length >= 10) {
                    attributes.SMS = digits;          // Has country code
                }
            }
            return {
                email: cleanEmail(c.email),
                attributes
            };
        });

        // 5. Send one by one (upsert) in parallel chunks of 10 to respect rate limits
        const errors = [];
        for (let i = 0; i < brevoContactsList.length; i += 10) {
            const chunk = brevoContactsList.slice(i, i + 10);
            await Promise.all(chunk.map(async (contact) => {
                try {
                    const brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
                        method: 'POST',
                        headers: {
                            'accept': 'application/json',
                            'content-type': 'application/json',
                            'api-key': apiKey
                        },
                        body: JSON.stringify({
                            email: contact.email,
                            attributes: contact.attributes,
                            updateEnabled: true
                        })
                    });
                    
                    if (!brevoRes.ok) {
                        const errBody = await brevoRes.json().catch(() => ({}));
                        console.error("Brevo API error for contact:", contact.email, errBody);
                        errors.push({ email: contact.email, error: errBody.message || brevoRes.statusText });
                    }
                } catch (err) {
                    errors.push({ email: contact.email, error: err.message });
                }
            }));
        }

        if (errors.length > 0) {
            throw new Error(`Erro ao enviar contatos: ${errors.map(e => `${e.email}: ${e.error}`).join(', ')}`);
        }

        // 6. Update status in CRM to 'sincronizado' for all sent contacts
        const contactIds = eligibleContacts.map(c => c.id);
        for (let i = 0; i < contactIds.length; i += 500) {
            await supabase
                .from('contacts')
                .update({ brevo_sync_status: 'sincronizado', brevo_status: true })
                .in('id', contactIds.slice(i, i + 500));
        }

        const now = new Date().toISOString();

        // Update profile last sync time
        await supabase
            .from('profiles')
            .update({ brevo_last_sync_at: now })
            .eq('id', req.user.sub);

        return res.json({
            success: true,
            count: eligibleContacts.length,
            lastSyncAt: now
        });

    } catch (err) {
        console.error('Error in POST /api/brevo/send:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// META LEAD ADS INTEGRATION ENDPOINTS
// ============================================================================

const META_APP_ID = process.env.META_APP_ID || '';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'crm_meta_leadgen_token';
const META_GRAPH_VERSION = 'v21.0';

/**
 * PUBLIC WEBHOOK - GET (Hub challenge verification)
 */
app.get('/api/webhooks/meta-leadgen', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === META_WEBHOOK_VERIFY_TOKEN) {
        logToFile('✅ [Meta Webhook] Verification successful');
        return res.status(200).send(challenge);
    } else {
        logToFile(`❌ [Meta Webhook] Verification failed. Expected token: ${META_WEBHOOK_VERIFY_TOKEN}, got: ${token}`);
        return res.sendStatus(403);
    }
});

/**
 * PUBLIC WEBHOOK - POST (Incoming lead notifications)
 */
app.post('/api/webhooks/meta-leadgen', async (req, res) => {
    // 1. Send 200 immediately to Meta to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');

    try {
        const payload = req.body;
        logToFile(`📥 [Meta Webhook] Event received: ${JSON.stringify(payload)}`);

        if (payload.object !== 'page') return;

        const supabaseAdmin = createClient(
            SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
        );

        for (const entry of payload.entry || []) {
            for (const change of entry.changes || []) {
                if (change.field !== 'leadgen') continue;

                const value = change.value || {};
                const pageId = value.page_id;
                const formId = value.form_id;
                const leadgenId = value.leadgen_id;
                const createdTime = value.created_time;

                if (!leadgenId) continue;

                // Find user_id connected to this page_id
                const { data: pageRecord } = await supabaseAdmin
                    .from('meta_pages')
                    .select('user_id, page_access_token')
                    .eq('page_id', pageId)
                    .single();

                let userId = pageRecord?.user_id;
                let pageAccessToken = pageRecord?.page_access_token ? decrypt(pageRecord.page_access_token) : null;

                if (!userId) {
                    // Fallback to meta_connections
                    const { data: conn } = await supabaseAdmin
                        .from('meta_connections')
                        .select('user_id, access_token')
                        .eq('status', 'active')
                        .limit(1)
                        .single();

                    if (conn) {
                        userId = conn.user_id;
                        pageAccessToken = decrypt(conn.access_token);
                    }
                }

                if (!userId) {
                    logToFile(`⚠️ [Meta Webhook] No user found for page_id: ${pageId}`);
                    continue;
                }

                // Check form sync settings
                if (formId) {
                    const { data: formRecord } = await supabaseAdmin
                        .from('meta_forms')
                        .select('sync_enabled')
                        .eq('form_id', formId)
                        .eq('user_id', userId)
                        .single();

                    if (formRecord && formRecord.sync_enabled === false) {
                        logToFile(`⏸️ [Meta Webhook] Sync disabled for form_id: ${formId}`);
                        continue;
                    }
                }

                // Fetch lead details from Meta Graph API
                let name = '';
                let email = '';
                let phone = '';
                let companyName = '';
                let formName = '';
                let campaignName = '';
                let adsetName = '';
                let adName = '';
                let utmSource = 'meta_ads';
                let utmMedium = 'cpc';
                let utmCampaign = '';
                let utmContent = '';
                let utmTerm = '';

                if (pageAccessToken) {
                    try {
                        const graphRes = await fetch(
                            `https://graph.facebook.com/${META_GRAPH_VERSION}/${leadgenId}?access_token=${pageAccessToken}`
                        );
                        if (graphRes.ok) {
                            const leadDetails = await graphRes.json();
                            logToFile(`📄 [Meta Graph API] Lead details: ${JSON.stringify(leadDetails)}`);

                            formName = leadDetails.form_name || formName;
                            campaignName = leadDetails.campaign_name || campaignName;
                            adsetName = leadDetails.adset_name || adsetName;
                            adName = leadDetails.ad_name || adName;
                            utmCampaign = campaignName;
                            utmContent = adName;
                            utmTerm = adsetName;

                            for (const field of leadDetails.field_data || []) {
                                const fn = (field.name || '').toLowerCase();
                                const val = Array.isArray(field.values) ? field.values[0] : field.values;
                                if (!val) continue;

                                if (fn.includes('email') || fn.includes('e-mail')) {
                                    email = val;
                                } else if (fn.includes('phone') || fn.includes('telefone') || fn.includes('celular') || fn.includes('whatsapp')) {
                                    phone = val;
                                } else if (fn.includes('full_name') || fn.includes('name') || fn.includes('nome')) {
                                    name = val;
                                } else if (fn.includes('company') || fn.includes('empresa') || fn.includes('organizacao')) {
                                    companyName = val;
                                } else if (fn.includes('utm_source')) {
                                    utmSource = val;
                                } else if (fn.includes('utm_medium')) {
                                    utmMedium = val;
                                } else if (fn.includes('utm_campaign')) {
                                    utmCampaign = val;
                                } else if (fn.includes('utm_content')) {
                                    utmContent = val;
                                } else if (fn.includes('utm_term')) {
                                    utmTerm = val;
                                }
                            }
                        } else {
                            const errBody = await graphRes.text();
                            logToFile(`❌ [Meta Graph API] Error fetching lead: ${errBody}`);
                        }
                    } catch (gErr) {
                        logToFile(`❌ [Meta Graph API] Exception: ${gErr.message}`);
                    }
                }

                // Process lead using LeadProcessor
                const processor = new LeadProcessor(supabaseAdmin, userId);
                const result = await processor.processLead({
                    source: 'Meta Lead Ads',
                    leadgenId,
                    pageId,
                    formId,
                    name,
                    email,
                    phone,
                    companyName,
                    formName,
                    campaignName,
                    adsetName,
                    adName,
                    utmSource,
                    utmMedium,
                    utmCampaign,
                    utmContent,
                    utmTerm,
                    rawPayload: payload,
                    createdTime: createdTime ? new Date(createdTime * 1000).toISOString() : new Date().toISOString()
                });

                logToFile(`✅ [Meta LeadProcessor] Result: ${JSON.stringify(result)}`);
            }
        }
    } catch (err) {
        logToFile(`❌ [Meta Webhook Error] ${err.message}`);
    }
});

/**
 * AUTHENTICATED: OAuth URL Generator
 */
app.get('/api/meta/auth-url', authenticate, (req, res) => {
    if (!META_APP_ID) {
        return res.status(400).json({ error: 'META_APP_ID não configurado no servidor' });
    }
    let redirectUri = req.query.redirect_uri;
    if (!redirectUri) {
        const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
        redirectUri = origin ? `${origin}/settings/meta-lead-ads` : 'http://localhost:5173/settings/meta-lead-ads';
    }
    const scope = 'pages_show_list,pages_read_engagement,leads_retrieval,pages_manage_ads,business_management';
    const url = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    return res.json({ url, redirectUri });
});

/**
 * AUTHENTICATED: OAuth Callback (Code -> Token)
 */
app.post('/api/meta/callback', authenticate, async (req, res) => {
    const { code, redirectUri: clientRedirectUri } = req.body;
    if (!code) return res.status(400).json({ error: 'Code é obrigatório' });

    try {
        const userId = req.user.sub;
        let redirectUri = clientRedirectUri;
        if (!redirectUri) {
            const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
            redirectUri = origin ? `${origin}/settings/meta-lead-ads` : 'http://localhost:5173/settings/meta-lead-ads';
        }

        // 1. Exchange code for short-lived token
        const tokenRes = await fetch(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`
        );
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(tokenData.error.message);

        const shortLivedToken = tokenData.access_token;

        // 2. Exchange for long-lived token (60 days)
        const longTokenRes = await fetch(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`
        );
        const longTokenData = await longTokenRes.json();
        const longLivedToken = longTokenData.access_token || shortLivedToken;
        const expiresIn = longTokenData.expires_in;

        // 3. Get Meta User Info
        const meRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me?access_token=${longLivedToken}`);
        const meData = await meRes.json();

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        // 4. Encrypt and save connection
        const encryptedToken = encrypt(longLivedToken);
        const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

        const { error: connErr } = await supabase
            .from('meta_connections')
            .upsert({
                user_id: userId,
                meta_user_id: meData.id || 'unknown',
                meta_user_name: meData.name || 'Usuário Meta',
                access_token: encryptedToken,
                token_type: 'long_lived',
                expires_at: expiresAt,
                status: 'active',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (connErr) throw connErr;

        // Helper function to fetch all pages (direct + Business Manager pages)
        async function fetchAllUserPages(token) {
            const pageMap = new Map();

            // 1. Direct user pages
            try {
                const pagesRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?limit=100&access_token=${token}`);
                const pagesData = await pagesRes.json();
                logToFile(`📄 [Meta Page Fetch] /me/accounts response: ${JSON.stringify(pagesData)}`);
                for (const p of pagesData.data || []) {
                    pageMap.set(p.id, p);
                }
            } catch (err) {
                logToFile(`⚠️ [Meta Page Fetch] Error fetching /me/accounts: ${err.message}`);
            }

            // 2. Business Manager pages
            try {
                const bizRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/businesses?access_token=${token}`);
                const bizData = await bizRes.json();
                logToFile(`🏢 [Meta Page Fetch] /me/businesses response: ${JSON.stringify(bizData)}`);

                for (const biz of bizData.data || []) {
                    // Fetch owned pages
                    try {
                        const ownedRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${biz.id}/owned_pages?fields=id,name,access_token&access_token=${token}`);
                        const ownedData = await ownedRes.json();
                        logToFile(`🏢 [Meta Page Fetch] Business ${biz.id} (${biz.name}) owned_pages: ${JSON.stringify(ownedData)}`);
                        for (const p of ownedData.data || []) {
                            if (!pageMap.has(p.id)) pageMap.set(p.id, p);
                        }
                    } catch (e) { /* silent */ }

                    // Fetch client pages
                    try {
                        const clientRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${biz.id}/client_pages?fields=id,name,access_token&access_token=${token}`);
                        const clientData = await clientRes.json();
                        logToFile(`🏢 [Meta Page Fetch] Business ${biz.id} (${biz.name}) client_pages: ${JSON.stringify(clientData)}`);
                        for (const p of clientData.data || []) {
                            if (!pageMap.has(p.id)) pageMap.set(p.id, p);
                        }
                    } catch (e) { /* silent */ }
                }
            } catch (err) {
                logToFile(`⚠️ [Meta Page Fetch] Error fetching /me/businesses: ${err.message}`);
            }

            return Array.from(pageMap.values());
        }

        // 5. Fetch user pages and save to meta_pages
        const fetchedPages = await fetchAllUserPages(longLivedToken);

        for (const p of fetchedPages) {
            const encPageToken = p.access_token ? encrypt(p.access_token) : null;
            await supabase.from('meta_pages').upsert({
                user_id: userId,
                page_id: p.id,
                page_name: p.name,
                page_access_token: encPageToken,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,page_id' });
        }

        // Log connection event
        const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
        await supabaseAdmin.from('meta_integration_logs').insert({
            user_id: userId,
            event_type: 'connection',
            status: 'success',
            message: `Conta Meta conectada por ${meData.name}`
        });

        return res.json({ success: true, userName: meData.name });
    } catch (err) {
        console.error('Meta Callback Error:', err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * AUTHENTICATED: Status Check
 */
app.get('/api/meta/status', authenticate, async (req, res) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        const { data } = await supabase
            .from('meta_connections')
            .select('*')
            .eq('user_id', req.user.sub)
            .single();

        if (!data) {
            return res.json({ connected: false, userName: null, status: null, expiresAt: null });
        }

        return res.json({
            connected: data.status === 'active',
            userName: data.meta_user_name,
            status: data.status,
            expiresAt: data.expires_at
        });
    } catch (err) {
        return res.json({ connected: false, userName: null, status: null, expiresAt: null });
    }
});

/**
 * AUTHENTICATED: Disconnect
 */
app.delete('/api/meta/disconnect', authenticate, async (req, res) => {
    try {
        const userId = req.user.sub;
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        await supabase.from('meta_connections').delete().eq('user_id', userId);
        await supabase.from('meta_pages').delete().eq('user_id', userId);

        const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
        await supabaseAdmin.from('meta_integration_logs').insert({
            user_id: userId,
            event_type: 'disconnection',
            status: 'success',
            message: 'Conta Meta desconectada'
        });

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * AUTHENTICATED: Pages List
 */
app.get('/api/meta/pages', authenticate, async (req, res) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        const { data } = await supabase
            .from('meta_pages')
            .select('id, page_id, page_name, is_subscribed')
            .eq('user_id', req.user.sub);

        const pages = (data || []).map(p => ({
            id: p.id,
            pageId: p.page_id,
            pageName: p.page_name,
            isSubscribed: p.is_subscribed
        }));

        return res.json({ pages });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * AUTHENTICATED: Subscribe Page Webhook
 */
app.post('/api/meta/pages/:pageId/subscribe', authenticate, async (req, res) => {
    const { pageId } = req.params;
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        const { data: page } = await supabase
            .from('meta_pages')
            .select('page_access_token')
            .eq('page_id', pageId)
            .eq('user_id', req.user.sub)
            .single();

        if (page?.page_access_token) {
            const pageToken = decrypt(page.page_access_token);
            const subRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/subscribed_apps`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscribed_fields: 'leadgen', access_token: pageToken })
            });
            const subData = await subRes.json();
            logToFile(`🔔 [Meta Page Subscribe] Graph API response for page ${pageId}: ${JSON.stringify(subData)}`);
            if (subData.error) throw new Error(subData.error.message);
        }

        await supabase
            .from('meta_pages')
            .update({ is_subscribed: true })
            .eq('page_id', pageId)
            .eq('user_id', req.user.sub);

        // Audit log
        const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
        await supabaseAdmin.from('meta_integration_logs').insert({
            user_id: req.user.sub,
            event_type: 'page_subscribed',
            status: 'success',
            message: `Página ${pageId} inscrita com sucesso nos webhooks de leadgen`,
            page_id: pageId
        });

        return res.json({ success: true });
    } catch (err) {
        logToFile(`❌ [Meta Page Subscribe] Error: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * AUTHENTICATED: Unsubscribe Page Webhook
 */
app.delete('/api/meta/pages/:pageId/subscribe', authenticate, async (req, res) => {
    const { pageId } = req.params;
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        await supabase
            .from('meta_pages')
            .update({ is_subscribed: false })
            .eq('page_id', pageId)
            .eq('user_id', req.user.sub);

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * AUTHENTICATED: Page Forms List
 */
app.get('/api/meta/pages/:pageId/forms', authenticate, async (req, res) => {
    const { pageId } = req.params;
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        // Try fetching cached forms first
        const { data: cachedForms } = await supabase
            .from('meta_forms')
            .select('*')
            .eq('page_id', pageId)
            .eq('user_id', req.user.sub);

        // Fetch fresh list from Meta Graph API if page_access_token exists
        const { data: page } = await supabase
            .from('meta_pages')
            .select('page_access_token')
            .eq('page_id', pageId)
            .eq('user_id', req.user.sub)
            .single();

        if (page?.page_access_token) {
            const pageToken = decrypt(page.page_access_token);
            const graphRes = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/leadgen_forms?access_token=${pageToken}`);
            if (graphRes.ok) {
                const graphData = await graphRes.json();
                for (const f of graphData.data || []) {
                    await supabase.from('meta_forms').upsert({
                        user_id: req.user.sub,
                        form_id: f.id,
                        form_name: f.name,
                        page_id: pageId,
                        status: f.status || 'active'
                    }, { onConflict: 'user_id,form_id' });
                }
            }
        }

        // Return updated list
        const { data: updatedForms } = await supabase
            .from('meta_forms')
            .select('*')
            .eq('page_id', pageId)
            .eq('user_id', req.user.sub);

        const forms = (updatedForms || cachedForms || []).map(f => ({
            id: f.id,
            formId: f.form_id,
            formName: f.form_name,
            pageId: f.page_id,
            syncEnabled: f.sync_enabled ?? true,
            leadsCount: f.leads_count || 0,
            lastLeadAt: f.last_lead_at
        }));

        return res.json({ forms });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * AUTHENTICATED: Toggle Form Sync
 */
app.patch('/api/meta/forms/:formId/toggle', authenticate, async (req, res) => {
    const { formId } = req.params;
    const { sync_enabled } = req.body;
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        await supabase
            .from('meta_forms')
            .update({ sync_enabled: !!sync_enabled })
            .eq('form_id', formId)
            .eq('user_id', req.user.sub);

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * AUTHENTICATED: Get Settings
 */
app.get('/api/meta/settings', authenticate, async (req, res) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        const { data } = await supabase
            .from('meta_lead_ads_settings')
            .select('*')
            .eq('user_id', req.user.sub)
            .single();

        return res.json({
            defaultPipelineId: data?.default_pipeline_id || 'sales',
            defaultStageId: data?.default_stage_id || 'new',
            autoCreateContact: data?.auto_create_contact ?? true,
            autoCreateCompany: data?.auto_create_company ?? true,
            autoCreateDeal: data?.auto_create_deal ?? true,
            autoRegisterHistory: data?.auto_register_history ?? true,
            autoCreateActivity: data?.auto_create_activity ?? true,
            autoStartCadence: data?.auto_start_cadence ?? true,
            capiEnabled: data?.capi_enabled ?? false,
            capiPixelId: data?.capi_pixel_id || '',
            capiAccessToken: data?.capi_access_token ? decrypt(data.capi_access_token) : ''
        });
    } catch (err) {
        return res.json({
            defaultPipelineId: 'sales',
            defaultStageId: 'new',
            autoCreateContact: true,
            autoCreateCompany: true,
            autoCreateDeal: true,
            autoRegisterHistory: true,
            autoCreateActivity: true,
            autoStartCadence: true,
            capiEnabled: false,
            capiPixelId: '',
            capiAccessToken: ''
        });
    }
});

/**
 * AUTHENTICATED: Save Settings
 */
app.put('/api/meta/settings', authenticate, async (req, res) => {
    const s = req.body;
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        const dbSettings = {
            user_id: req.user.sub,
            updated_at: new Date().toISOString()
        };

        if (s.defaultPipelineId !== undefined) dbSettings.default_pipeline_id = s.defaultPipelineId;
        if (s.defaultStageId !== undefined) dbSettings.default_stage_id = s.defaultStageId;
        if (s.autoCreateContact !== undefined) dbSettings.auto_create_contact = s.autoCreateContact;
        if (s.autoCreateCompany !== undefined) dbSettings.auto_create_company = s.autoCreateCompany;
        if (s.autoCreateDeal !== undefined) dbSettings.auto_create_deal = s.autoCreateDeal;
        if (s.autoRegisterHistory !== undefined) dbSettings.auto_register_history = s.autoRegisterHistory;
        if (s.autoCreateActivity !== undefined) dbSettings.auto_create_activity = s.autoCreateActivity;
        if (s.autoStartCadence !== undefined) dbSettings.auto_start_cadence = s.autoStartCadence;
        if (s.capiEnabled !== undefined) dbSettings.capi_enabled = s.capiEnabled;
        if (s.capiPixelId !== undefined) dbSettings.capi_pixel_id = s.capiPixelId;
        if (s.capiAccessToken !== undefined) {
            dbSettings.capi_access_token = s.capiAccessToken ? encrypt(s.capiAccessToken) : null;
        }

        const { error } = await supabase
            .from('meta_lead_ads_settings')
            .upsert(dbSettings, { onConflict: 'user_id' });

        if (error) throw error;
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * AUTHENTICATED: Trigger Conversions API Event
 */
app.post('/api/meta/capi-event', authenticate, async (req, res) => {
    const { dealId, stageId, status } = req.body;
    const userId = req.user.sub;

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        // 1. Resolve event name
        let eventName = 'Lead';
        if (status === 'won') {
            eventName = 'Deal Won';
        } else if (status === 'lost') {
            eventName = 'Deal Lost';
        } else if (stageId) {
            // Get stage name from DB
            const { data: stage } = await supabase
                .from('stages')
                .select('name')
                .eq('id', stageId)
                .single();
            if (stage) {
                eventName = stage.name;
            }
        }

        // 2. Call sendMetaCAPIEvent helper
        const result = await sendMetaCAPIEvent(supabase, userId, dealId, eventName);
        return res.json(result);
    } catch (err) {
        logToFile(`❌ [CAPI Route Error] ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * AUTHENTICATED: Logs List
 */
app.get('/api/meta/logs', authenticate, async (req, res) => {
    const { event_type, limit = 50, offset = 0 } = req.query;
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        let query = supabase
            .from('meta_integration_logs')
            .select('*', { count: 'exact' })
            .eq('user_id', req.user.sub)
            .order('created_at', { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (event_type) {
            query = query.eq('event_type', event_type);
        }

        const { data, count, error } = await query;
        if (error) throw error;

        const logs = (data || []).map(l => ({
            id: l.id,
            eventType: l.event_type,
            status: l.status,
            message: l.message,
            payload: l.payload,
            pageId: l.page_id,
            createdAt: l.created_at
        }));

        return res.json({ logs, total: count || 0 });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * AUTHENTICATED: Diagnostic Test Endpoint
 */
app.post('/api/meta/test', authenticate, async (req, res) => {
    console.log("[1] Recebeu requisição");
    const { testEventCode } = req.body;
    const startTime = Date.now();
    const steps = [];
    const userId = req.user.sub;

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.jwt}` } }
        });

        // Step 1: Check Connection
        const { data: connArr } = await supabase
            .from('meta_connections')
            .select('*')
            .eq('user_id', userId)
            .limit(1);

        const conn = connArr?.[0] || null;

        if (conn && conn.status === 'active') {
            steps.push({ name: 'Conexão Meta', status: 'success', message: `Conectado como ${conn.meta_user_name}` });
        } else {
            steps.push({ name: 'Conexão Meta', status: 'error', message: 'Nenhuma conta Meta ativa encontrada' });
        }

        // Step 2: Check Pages
        const { data: pages } = await supabase
            .from('meta_pages')
            .select('*')
            .eq('user_id', userId);

        const activePages = (pages || []).filter(p => p.is_subscribed);
        if (pages && pages.length > 0) {
            steps.push({
                name: 'Páginas do Facebook',
                status: 'success',
                message: `${pages.length} página(s) conectada(s), ${activePages.length} com webhook ativo`
            });
        } else {
            steps.push({ name: 'Páginas do Facebook', status: 'error', message: 'Nenhuma página sincronizada' });
        }

        // Step 3: Check Settings
        const processor = new LeadProcessor(supabase, userId);
        const settings = await processor.loadSettings();

        steps.push({
            name: 'Configurações de Negócio',
            status: 'success',
            message: `Pipeline: ${settings.default_pipeline_id}, Etapa: ${settings.default_stage_id}`
        });

        // Run isolated connection test (Checklist 9)
        const testConnResult = await testMetaConnection(supabase, userId, testEventCode);
        steps.push({
            name: 'API de Conversões (Teste de Conexão Direta CAPI)',
            status: testConnResult.success ? 'success' : 'error',
            message: testConnResult.success 
                ? `Conexão bem-sucedida! Events received: ${testConnResult.data?.events_received || 0}, fbtrace_id: ${testConnResult.data?.fbtrace_id || 'N/A'}`
                : `Erro de conexão direta: ${testConnResult.reason || testConnResult.error || JSON.stringify(testConnResult.data)}`
        });

        // Step 4: Run Test Lead Processing
        const mockLeadgenId = `test_lead_${Date.now()}`;
        const mockTestLead = {
            source: 'Meta Lead Ads (Teste)',
            leadgenId: mockLeadgenId,
            pageId: pages?.[0]?.page_id || 'test_page_123',
            formId: 'test_form_456',
            name: 'Lead de Teste Diagnóstico',
            email: `teste_${Date.now()}@exemplo.com`,
            phone: '+5511999999999',
            companyName: 'Empresa Teste Ltda',
            formName: 'Formulário Diagnóstico',
            campaignName: 'Campanha de Diagnóstico',
            adsetName: 'Conjunto Diagnóstico',
            adName: 'Anúncio Teste',
            utmSource: 'meta_ads',
            utmMedium: 'cpc',
            utmCampaign: 'diagnostico_teste',
            utmContent: 'banner_teste',
            utmTerm: 'teste',
            createdTime: new Date().toISOString(),
            testEventCode: testEventCode || null
        };

        const processingResult = await processor.processLead(mockTestLead);

        if (processingResult.success) {
            steps.push({ name: 'Lead encontrado', status: 'success', message: 'Lead de teste gerado' });
            steps.push({
                name: 'Pessoa criada ou localizada',
                status: 'success',
                message: `ID: ${processingResult.contactId} (${processingResult.contactCreated ? 'Criada' : 'Localizada'})`
            });
            steps.push({
                name: 'Organização criada ou localizada',
                status: processingResult.companyId ? 'success' : 'skipped',
                message: processingResult.companyId ? `ID: ${processingResult.companyId}` : 'Não aplicável'
            });
            steps.push({
                name: 'Negócio criado ou localizado',
                status: processingResult.dealId ? 'success' : 'skipped',
                message: processingResult.dealId ? `ID: ${processingResult.dealId}` : 'Sem negócio'
            });
            steps.push({
                name: 'Histórico registrado',
                status: processingResult.historyRegistered ? 'success' : 'skipped',
                message: processingResult.historyRegistered ? 'Registrado em deal_logs' : 'Desativado'
            });
            steps.push({
                name: 'Primeira atividade criada',
                status: processingResult.activityCreated ? 'success' : 'skipped',
                message: processingResult.activityCreated ? 'Tarefa agendada' : 'Desativada'
            });
            steps.push({
                name: 'Cadência iniciada',
                status: processingResult.cadenceStarted ? 'success' : 'skipped',
                message: processingResult.cadenceStarted ? 'Iniciada via DB Trigger' : 'Não iniciada'
            });

            if (processingResult.capiResult) {
                steps.push({
                    name: 'API de Conversões (CAPI)',
                    status: processingResult.capiResult.success ? 'success' : 'error',
                    message: processingResult.capiResult.success 
                        ? 'Evento de teste enviado com sucesso para a Meta!' 
                        : `Erro CAPI: ${processingResult.capiResult.reason || processingResult.capiResult.error || 'Erro de conexão/credenciais'}`
                });
            } else {
                steps.push({
                    name: 'API de Conversões (CAPI)',
                    status: 'skipped',
                    message: 'CAPI desativada ou não configurada'
                });
            }

            // Log test execution
            await supabase.from('meta_integration_logs').insert({
                user_id: userId,
                event_type: 'test',
                status: 'success',
                message: 'Teste diagnóstico executado com sucesso'
            });
        } else {
            steps.push({
                name: 'Processamento de Lead',
                status: 'error',
                message: processingResult.error || 'Falha ao processar lead de teste'
            });

            await supabase.from('meta_integration_logs').insert({
                user_id: userId,
                event_type: 'test',
                status: 'error',
                message: `Teste diagnóstico falhou: ${processingResult.error}`
            });
        }

        console.log("[7] Montando resposta");
        console.log("[8] Retornando HTTP");

        const totalTimeMs = Date.now() - startTime;
        return res.json({
            success: processingResult.success || (typeof testConnResult !== 'undefined' && testConnResult.success),
            steps,
            processingResult,
            totalTimeMs
        });
    } catch (err) {
        console.error("❌ [EXCEÇÃO CAPI TESTE]:", err.stack || err);
        const totalTimeMs = Date.now() - startTime;
        steps.push({ 
            name: 'Execução do Teste (Exceção)', 
            status: 'error', 
            message: `Erro interno no servidor: ${err.message}. Stack: ${err.stack?.split('\n')?.[1] || 'N/A'}` 
        });
        
        console.log("[8] Retornando HTTP (Erro 500)");
        
        return res.status(500).json({
            success: false,
            error: err.message,
            stack: err.stack,
            steps,
            totalTimeMs
        });
    }
});

// Only start the server locally, otherwise export the app for Vercel Serverless

if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`🚀 Hardened Server running on port ${PORT}`);
    });
}

export default app;
