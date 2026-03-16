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


// Helper for Tracking Injection
function injectTracking(body, baseUrl, logId) {
    let html = body; // Mantemos o HTML original, sem corromper com <br> nos \n

    // Inject Tracking Pixel
    const pixel = `<img src="${baseUrl}/api/email/open/${logId}" width="1" height="1" style="display:none;" />`;
    html = html.includes('</body>')
        ? html.replace('</body>', `${pixel}</body>`)
        : html + pixel;

    // Track Links
    html = html.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi, (match, url) => {
        if (!url || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#') || url.includes('/api/email/')) return match;
        const trackUrl = `${baseUrl}/api/email/click/${logId}?url=${encodeURIComponent(url)}`;
        return match.replace(`href="${url}"`, `href="${trackUrl}"`);
    });

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
        const finalHtml = injectTracking(body, baseUrl, tempLogId);

        const info = await transporter.sendMail({
            from: `"${SMTP_FROM_NAME || 'CRM System'}" <${SMTP_USER}>`,
            to,
            subject,
            html: finalHtml,
        });

        // Log to email_logs
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

                // Inject Tracking
                const finalHtml = injectTracking(body, baseUrl, tempLogId);
                logToFile(`   🔗 Tracking injected for ${recipient.email}.`);

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

// Only start the server locally, otherwise export the app for Vercel Serverless
if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`🚀 Hardened Server running on port ${PORT}`);
    });
}

export default app;
