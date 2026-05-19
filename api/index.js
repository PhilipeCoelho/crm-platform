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

// Tracking de Cliques
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

    res.redirect(originalUrl);

    // Async Update
    (async () => {
        try {
            const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            logToFile(`   🔍 [Tracking] Fetching log for click ID: ${log_id}`);

            const { data: log, error: fetchErr } = await supabase.from('email_logs').select('*').eq('id', log_id).single();
            if (fetchErr || !log) {
                logToFile(`   ❌ [Tracking] Click log not found for ID ${log_id}`);
                return;
            }

            logToFile(`   ✅ [Tracking] Processing click for: ${log_id}`);

            const isFirstClick = !log.clicked;

            // 1. Update Log
            await supabase.from('email_logs').update({
                clicked: true,
                clicked_at: new Date().toISOString(),
                click_ip: ip,
                click_user_agent: userAgent,
                clicked_url: originalUrl,
                // Also mark as opened if it wasn't
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
            logToFile(`   ❌ [Tracking] Error in async click tracking: ${e.message}`);
        }
    })();
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

// Only start the server locally, otherwise export the app for Vercel Serverless
if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`🚀 Hardened Server running on port ${PORT}`);
    });
}

export default app;
