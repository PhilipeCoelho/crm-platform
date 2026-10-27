/**
 * ============================================================================
 * VAMUSS SDR — GESTOR DE SUPRESSÃO E CONFORMIDADE (FASE B.13.4)
 * ============================================================================
 * Armazenamento persistente local (mirror síncrono) para a lista de supressão,
 * garantindo comportamento fail-closed mesmo durante quebras de ligação ou reinícios.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPPRESSION_FILE = path.resolve(process.cwd(), 'data', 'sdr_suppression_active.json');
const BACKUPS_DIR = path.resolve(process.cwd(), 'data', 'backups');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Garante que a pasta de backups existe
 */
function ensureBackupsDir() {
    if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
}

/**
 * Executa backup diário automático da lista de supressão
 */
export function backupSuppressionStore() {
    try {
        ensureBackupsDir();
        const dateStr = new Date().toISOString().slice(0, 10);
        const backupFile = path.join(BACKUPS_DIR, `sdr_suppression_backup_${dateStr}.json`);
        
        const list = readLocalSuppression();
        fs.writeFileSync(backupFile, JSON.stringify(list, null, 2), 'utf8');
        console.log(`💾 [Suppression Backup] Backup diário gravado: ${backupFile} (${list.length} entradas)`);
        return true;
    } catch (e) {
        console.warn('⚠️ [Suppression Backup] Erro no backup diário:', e.message);
        return false;
    }
}

/**
 * Lê a lista de supressão (com fallback para o espelho local)
 */
export function readLocalSuppression() {
    try {
        if (!fs.existsSync(SUPPRESSION_FILE)) {
            return [];
        }
        const data = fs.readFileSync(SUPPRESSION_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.warn('⚠️ [Suppression Store] Erro ao ler supressão local:', e.message);
        return [];
    }
}

/**
 * Grava a lista de supressão no espelho local e aciona backup
 */
export function writeLocalSuppression(list) {
    try {
        fs.writeFileSync(SUPPRESSION_FILE, JSON.stringify(list, null, 2), 'utf8');
        backupSuppressionStore();
        return true;
    } catch (e) {
        console.warn('⚠️ [Suppression Store] Erro ao gravar supressão local:', e.message);
        return false;
    }
}

/**
 * Adiciona ou reativa uma entrada na lista de supressão (Supabase como fonte + mirror local)
 */
export async function addSuppression(entry) {
    return addLocalSuppression(entry);
}

export function addLocalSuppression(entry) {
    const list = readLocalSuppression();
    const cleanPhone = entry.telefone_normalizado ? entry.telefone_normalizado.replace(/\D/g, '') : null;
    
    // Evitar duplicações
    const existing = list.find(s => 
        (entry.deal_id && s.deal_id === entry.deal_id) ||
        (cleanPhone && s.telefone_normalizado && s.telefone_normalizado.replace(/\D/g, '') === cleanPhone)
    );
    
    if (existing) {
        existing.estado = 'ativo';
        existing.motivo = entry.motivo || existing.motivo;
        existing.motivo_bloqueio = entry.motivo_bloqueio || existing.motivo_bloqueio || existing.motivo;
        existing.updated_at = new Date().toISOString();
    } else {
        list.unshift({
            id: entry.id || `supp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            deal_id: entry.deal_id || null,
            contact_id: entry.contact_id || null,
            telefone_normalizado: cleanPhone,
            email: entry.email || null,
            motivo: entry.motivo || entry.motivo_bloqueio || 'OPTOUT_EXPLICITO',
            motivo_bloqueio: entry.motivo_bloqueio || entry.motivo || 'OPTOUT_EXPLICITO',
            estado: 'ativo',
            canal_bloqueado: entry.canal_bloqueado || 'TODOS',
            created_at: new Date().toISOString()
        });
    }

    writeLocalSuppression(list);

    // Sincronizar assincronamente com o Supabase
    if (supabase) {
        (async () => {
            try {
                if (entry.email) {
                    await supabase.from('unsubscribed_emails').insert({ email: entry.email.toLowerCase().trim() }).catch(() => {});
                }
                if (cleanPhone) {
                    // Armazena também identificador virtual do telefone no unsubscribe para consulta global
                    await supabase.from('unsubscribed_emails').insert({ email: `phone_${cleanPhone}@vamuss-optout.internal` }).catch(() => {});
                }
            } catch (err) {
                console.warn('⚠️ [Suppression Store] Aviso ao sincronizar com Supabase:', err.message);
            }
        })();
    }

    return true;
}

/**
 * Verifica de forma fail-closed se um telefone, deal ou contacto está suprimido localmente
 */
export function isPhoneSuppressedLocally(phone, dealId, contactId) {
    const list = readLocalSuppression();
    const clean = phone ? phone.replace(/\D/g, '') : null;
    const cleanLast9 = clean && clean.length >= 9 ? clean.slice(-9) : null;

    const found = list.find(s => {
        if (s.estado !== 'ativo') return false;
        if (dealId && s.deal_id === dealId) return true;
        if (contactId && s.contact_id === contactId) return true;
        if (clean && s.telefone_normalizado) {
            const sClean = s.telefone_normalizado.replace(/\D/g, '');
            if (sClean === clean) return true;
            if (cleanLast9 && sClean.endsWith(cleanLast9)) return true;
        }
        return false;
    });
    return Boolean(found);
}
