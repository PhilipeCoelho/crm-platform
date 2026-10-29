import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const AUTH_DIR = path.resolve(ROOT_DIR, 'data', 'whatsapp_web_auth');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

let lastBackupTime = 0;
const BACKUP_DEBOUNCE_MS = 60 * 1000; // at most once every 60s

/**
 * Restores the WhatsApp session archive from Supabase into data/whatsapp_web_auth
 * Returns true if restored, false otherwise.
 */
export async function restoreSessionFromSupabase(force = false) {
  try {
    const credsPath = path.join(AUTH_DIR, 'creds.json');
    if (!force && fs.existsSync(credsPath)) {
      console.log('[WhatsApp Session Sync] Local creds.json already exists. Skipping restore.');
      return true;
    }

    if (!supabase) {
      console.warn('[WhatsApp Session Sync] Supabase client not initialized. Cannot restore.');
      return false;
    }

    console.log('[WhatsApp Session Sync] Checking Supabase for remote WhatsApp session...');
    const { data, error } = await supabase
      .from('sdr_learning')
      .select('content')
      .eq('title', 'WHATSAPP_SESSION_VAULT')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data || !data.content || !data.content.base64) {
      console.warn('[WhatsApp Session Sync] No remote WhatsApp session found in Supabase Vault.', error?.message || '');
      return false;
    }

    console.log(`[WhatsApp Session Sync] Found remote session archive (${data.content.size || 'unknown'} bytes). Restoring...`);
    
    // Ensure AUTH_DIR exists
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const tmpArchive = path.join('/tmp', `whatsapp_auth_restore_${Date.now()}.tar.gz`);
    const buffer = Buffer.from(data.content.base64, 'base64');
    fs.writeFileSync(tmpArchive, buffer);

    // Extract into data/whatsapp_web_auth
    // Note: Archive was created with -C data whatsapp_web_auth
    const dataDir = path.resolve(ROOT_DIR, 'data');
    execSync(`tar -xzf "${tmpArchive}" -C "${dataDir}"`);
    
    // Cleanup tmp file
    try { fs.unlinkSync(tmpArchive); } catch (_) {}

    if (fs.existsSync(credsPath)) {
      console.log('✅ [WhatsApp Session Sync] WhatsApp Web session restored successfully from Supabase Vault!');
      return true;
    } else {
      console.warn('⚠️ [WhatsApp Session Sync] Extracted archive but creds.json was not found.');
      return false;
    }
  } catch (err) {
    console.error('❌ [WhatsApp Session Sync] Error restoring session:', err.message);
    return false;
  }
}

/**
 * Backs up data/whatsapp_web_auth to Supabase
 */
export async function backupSessionToSupabase(force = false) {
  try {
    const now = Date.now();
    if (!force && (now - lastBackupTime < BACKUP_DEBOUNCE_MS)) {
      return false;
    }

    const credsPath = path.join(AUTH_DIR, 'creds.json');
    if (!fs.existsSync(credsPath)) {
      console.log('[WhatsApp Session Sync] No local creds.json to backup yet.');
      return false;
    }

    if (!supabase) {
      return false;
    }

    const tmpArchive = path.join('/tmp', `whatsapp_auth_backup_${now}.tar.gz`);
    const dataDir = path.resolve(ROOT_DIR, 'data');
    execSync(`tar -czf "${tmpArchive}" -C "${dataDir}" whatsapp_web_auth`);

    const buf = fs.readFileSync(tmpArchive);
    const base64 = buf.toString('base64');

    try { fs.unlinkSync(tmpArchive); } catch (_) {}

    const { data: existing } = await supabase
      .from('sdr_learning')
      .select('id')
      .eq('title', 'WHATSAPP_SESSION_VAULT')
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('sdr_learning')
        .update({
          content: {
            base64,
            size: buf.length,
            updated_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', existing[0].id);
    } else {
      await supabase
        .from('sdr_learning')
        .insert({
          entry_type: 'RULE',
          title: 'WHATSAPP_SESSION_VAULT',
          content: {
            base64,
            size: buf.length,
            updated_at: new Date().toISOString()
          },
          status: 'active',
          created_by: 'WhatsApp Session Sync'
        });
    }

    lastBackupTime = now;
    console.log(`✅ [WhatsApp Session Sync] Backed up WhatsApp session to Supabase (${buf.length} bytes).`);
    return true;
  } catch (err) {
    console.error('❌ [WhatsApp Session Sync] Error backing up session:', err.message);
    return false;
  }
}
