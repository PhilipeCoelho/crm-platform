import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import bodyParser from 'body-parser';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Check for SMTP config
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME } = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn('⚠️  SMTP credentials not fully set in .env file. Email sending will fail.');
}

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Generic Email Sending Endpoint
app.post('/api/send-email', async (req, res) => {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }

    try {
        const info = await transporter.sendMail({
            from: `"${SMTP_FROM_NAME || 'CRM System'}" <${SMTP_USER}>`, // sender address
            to: to, // list of receivers
            subject: subject, // Subject line
            text: body, // plain text body
            html: body.replace(/\n/g, '<br>'), // html body
        });

        console.log('Message sent: %s', info.messageId);
        res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
});

// Supabase Config for Backend
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// --- IMAP Integration ---

/**
 * Endpoint to sync emails for an account
 * Expects: { accountId }
 * Headers: Authorization: Bearer <JWT>
 */
app.post('/api/imap/sync', async (req, res) => {
    const { accountId } = req.body;
    const authHeader = req.headers.authorization;

    if (!accountId || !authHeader) {
        return res.status(400).json({ error: 'Missing accountId or Authorization header' });
    }

    // Initialize Supabase client with user's JWT
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
    });

    try {
        // 1. Get account details
        const { data: account, error: accError } = await supabase
            .from('email_accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (accError || !account) {
            throw new Error('Account not found or access denied');
        }

        const { connection_config } = account;
        const { host, port, user, password, tls } = connection_config;

        console.log(`[Sync] Starting sync for ${user}...`);

        const imap = new Imap({
            user,
            password,
            host,
            port: parseInt(port),
            tls: tls !== false,
            tlsOptions: { rejectUnauthorized: false },
            connTimeout: 30000,
        });

        imap.once('ready', () => {
            imap.openBox('INBOX', true, (err, box) => {
                if (err) {
                    imap.end();
                    return res.status(500).json({ error: 'Failed to open INBOX', details: err.message });
                }

                // Fetch last 50 emails (Initial sync)
                const fetchRange = box.messages.total > 50 ? `${box.messages.total - 49}:*` : '1:*';
                const f = imap.fetch(fetchRange, {
                    bodies: '',
                    struct: true
                });

                const messagesToInsert = [];

                f.on('message', (msg, seqno) => {
                    let buffer = '';
                    let attrs;

                    msg.on('body', (stream, info) => {
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8');
                        });
                    });

                    msg.once('attributes', (a) => {
                        attrs = a;
                    });

                    msg.once('end', async () => {
                        try {
                            const parsed = await simpleParser(buffer);
                            messagesToInsert.push({
                                account_id: accountId,
                                user_id: account.user_id,
                                remote_id: attrs.uid.toString(),
                                message_id: parsed.messageId,
                                subject: parsed.subject,
                                body_text: parsed.text,
                                body_html: parsed.html,
                                from_address: parsed.from ? { name: parsed.from.value[0].name, email: parsed.from.value[0].address } : { name: 'Unknown', email: 'unknown' },
                                to_addresses: parsed.to ? parsed.to.value.map(t => ({ name: t.name, email: t.address })) : [],
                                received_at: parsed.date || new Date().toISOString(),
                                is_read: attrs.flags.includes('\\Seen'),
                                folder: 'inbox'
                            });
                        } catch (parseErr) {
                            console.error('Error parsing message:', parseErr);
                        }
                    });
                });

                f.once('error', (err) => {
                    console.error('Fetch error:', err);
                    imap.end();
                    res.status(500).json({ error: 'Error fetching emails' });
                });

                f.once('end', async () => {
                    console.log(`[Sync] Fetched ${messagesToInsert.length} messages for ${user}`);
                    imap.end();

                    // Insert into Supabase (Upsert based on remote_id to avoid dups)
                    // Note: In real world, we'd use a unique constraint on (account_id, remote_id)
                    const { error: insError } = await supabase
                        .from('emails')
                        .upsert(messagesToInsert, { onConflict: 'account_id,remote_id' });

                    if (insError) {
                        console.error('Supabase Insert Error:', insError);
                        return res.status(500).json({ error: 'Failed to save emails to database' });
                    }

                    // Update last_sync_at
                    await supabase
                        .from('email_accounts')
                        .update({ last_sync_at: new Date().toISOString(), status: 'active' })
                        .eq('id', accountId);

                    res.status(200).json({ success: true, count: messagesToInsert.length });
                });
            });
        });

        imap.once('error', (err) => {
            console.error(`[IMAP Sync Error] ${user}:`, err);
            res.status(500).json({ error: 'IMAP connection failed during sync', details: err.message });
        });

        imap.connect();

    } catch (err) {
        console.error('Sync process error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Endpoint to verify IMAP credentials
 */
app.post('/api/imap/verify', (req, res) => {
    const { user, password, host, port, tls } = req.body;

    if (!user || !password || !host || !port) {
        return res.status(400).json({ error: 'Missing IMAP configuration fields (user, password, host, port).' });
    }

    console.log(`[IMAP] Verifying connection for ${user} at ${host}:${port}...`);

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
        console.log(`[IMAP] Connection successful for ${user}`);
        imap.end();
        return res.status(200).json({ success: true, message: 'IMAP connection verified successfully.' });
    });

    imap.once('error', (err) => {
        console.error(`[IMAP] Connection failed for ${user}:`, err);
        return res.status(401).json({ error: 'IMAP connection failed. Please check your credentials and server settings.', details: err.message });
    });

    try {
        imap.connect();
    } catch (err) {
        console.error(`[IMAP] Unexpected error connecting for ${user}:`, err);
        return res.status(500).json({ error: 'Unexpected error during connection attempt', details: err.message });
    }
});


app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
