import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import bodyParser from 'body-parser';
import Imap from 'imap';
import jwt from 'jsonwebtoken';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from './utils/crypto.js';

const app = express();
const PORT = process.env.PORT || 3001;

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
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    if (!JWT_SECRET) {
        console.error('CRITICAL: SUPABASE_JWT_SECRET is not defined in .env');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: `${SUPABASE_URL}/auth/v1`,
            audience: 'authenticated'
        });
        req.user = decoded; // Contains sub (uid)
        req.jwt = token;
        next();
    } catch (err) {
        console.warn('JWT Validation Failed:', err.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

// --- Protected Endpoints ---

// Generic Email Sending Endpoint
app.post('/api/send-email', authenticate, async (req, res) => {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Missing to, subject, or body' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT || '587'),
            secure: false,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            tls: { rejectUnauthorized: false }
        });

        const info = await transporter.sendMail({
            from: `"${SMTP_FROM_NAME || 'CRM System'}" <${SMTP_USER}>`,
            to,
            subject,
            html: body.replace(/\n/g, '<br>'),
        });

        res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('[SMTP Error]:', error.message);
        res.status(500).json({ error: 'Email service unavailable' });
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

app.listen(PORT, () => {
    console.log(`🚀 Hardened Server running on port ${PORT}`);
});
