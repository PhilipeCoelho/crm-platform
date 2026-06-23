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

    // Acknowledge request immediately to run in background (fire-and-forget)
    res.status(202).json({ message: 'Classification queued' });

    // Run classification in the background
    (async () => {
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
            } catch (dbErr) {
                logToFile(`❌ [Insights DB] Failed to save outgoing activity: ${dbErr.message}`);
            }
            return;
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
                // If it looks like a lost reason or objection based on pricing/agency
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
            } catch (dbErr) {
                logToFile(`❌ [Insights DB] [MOCK MODE] Failed to save classified insight: ${dbErr.message}`);
            }
            return;
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
            } catch (dbErr) {
                logToFile(`❌ [Insights DB] Failed to write API key error to DB: ${dbErr.message}`);
            }
            return;
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

        const maxAttempts = 4; // 1 initial + 3 retries
        const backoffTimes = [1000, 3000, 9000];

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
            } catch (dbErr) {
                logToFile(`❌ [Insights DB] Failed to save classified insight to database: ${dbErr.message}`);
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
            } catch (dbErr) {
                logToFile(`❌ [Insights DB] Failed to save failure state to database: ${dbErr.message}`);
            }
        }
    })();
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
    res.status(202).json({
        found: allItems.length,
        queued: allItems.length,
        skipped: 0,
        errors: 0,
        duration_ms: 0,
        message: `${allItems.length} itens encontrados. A classificação está a correr em background — recarregue o painel em alguns minutos.`
    });

    // Process in batches of 10 with 500ms delay between batches (background)
    (async () => {
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
    })();
});

// Only start the server locally, otherwise export the app for Vercel Serverless

if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`🚀 Hardened Server running on port ${PORT}`);
    });
}

export default app;
