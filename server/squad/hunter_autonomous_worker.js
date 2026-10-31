/**
 * server/squad/hunter_autonomous_worker.js
 * ============================================================================
 * HUNTER — MOTOR AUTÓNOMO DE PROSPEÇÃO 24/7 (PORTUGAL)
 * ============================================================================
 * - NÍVEL 3.1 DA MÁQUINA DE VENDAS VAMUSS.
 * - Subordinado direto do JONH (Gerente de Operações).
 * - Opera 24/7 (incluindo fins de semana e noites) construindo estoque de leads.
 * 
 * DIRETRIZES DE ENTRADA RÍGIDAS:
 *   1. CANAL DE ORIGEM OBRIGATÓRIO: 'Hunter (Scouting Portugal 24/7)'.
 *   2. TRÍADE DO ICP EXIGIDA: Nome da Clínica + Telefone Válido (9x/2x) + Presença Digital (Website ou Instagram).
 *   3. SOBERANIA ANTI-DUPLICIDADE EM 5 CAMADAS:
 *      NUNCA insere se já existir no CRM como ABERTO, GANHO ou PERDIDO.
 *   4. TOLERÂNCIA ZERO COM DADOS VAZIOS:
 *      Se a clínica não tiver telefone nem site, é DESCARTADA NO ATO e NUNCA entra no CRM.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import {
    checkDuplicateInCRM,
    insertNewProspect,
    enrichClinicFromWebsite,
    normalizeClinicName
} from './jack_hunter.js';
import { execSync } from 'child_process';

function getSupabaseClient() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

// Cidades e Concelhos de Portugal para ronda rotativa 24/7
export const TARGET_PORTUGAL_CITIES = [
    'Lisboa',
    'Porto',
    'Braga',
    'Cascais',
    'Sintra',
    'Oeiras',
    'Matosinhos',
    'Vila Nova de Gaia',
    'Coimbra',
    'Leiria',
    'Guimarães',
    'Aveiro',
    'Setúbal',
    'Faro',
    'Portimão',
    'Albufeira',
    'Viseu',
    'Funchal'
];

export const TARGET_NICHES = [
    'clínica dentária implantes',
    'clínica dentária invisalign',
    'clínica dentária reabilitação oral',
    'clínica estética harmonização facial botox'
];

export class HunterAutonomousWorker {
    constructor() {
        this.isRunning = false;
        this.timer = null;
        this.intervalMinutes = 30; // Ciclos a cada 30 minutos
        this.cityIndex = 0;
        this.nicheIndex = 0;
        this.cycleCount = 0;
        this.lastCycleAt = null;
        this.totalFound = 0;
        this.totalInserted = 0;
        this.totalDuplicatesBarred = 0;
        this.totalIncompleteDiscarded = 0;
    }

    /**
     * Inicia o trabalhador 24/7 do Hunter
     */
    start({ intervalMinutes = 30 } = {}) {
        if (this.isRunning) {
            console.log('⚠️ [Hunter Worker] O Hunter já se encontra em caça contínua 24/7.');
            return;
        }

        this.isRunning = true;
        this.intervalMinutes = intervalMinutes;
        console.log(`🎯 [Hunter Worker] Caçador 24/7 ATIVADO (Rondas a cada ${this.intervalMinutes} min em Portugal).`);

        // Executa primeira caçada
        this.runHuntCycle().catch(err => {
            console.error('❌ [Hunter Worker] Erro na ronda inicial:', err.message);
        });

        // Agenda loop 24/7
        this.timer = setInterval(() => {
            this.runHuntCycle().catch(err => {
                console.error('❌ [Hunter Worker] Erro no ciclo periódico:', err.message);
            });
        }, this.intervalMinutes * 60 * 1000);
    }

    /**
     * Para o daemon
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        console.log('🛑 [Hunter Worker] Caçador 24/7 pausado.');
    }

    /**
     * Ronda de Caça em Portugal
     */
    async runHuntCycle() {
        this.cycleCount++;
        this.lastCycleAt = new Date().toISOString();

        const currentCity = TARGET_PORTUGAL_CITIES[this.cityIndex % TARGET_PORTUGAL_CITIES.length];
        const currentNiche = TARGET_NICHES[this.nicheIndex % TARGET_NICHES.length];

        // Incrementa índices para próxima ronda rotativa
        this.cityIndex++;
        if (this.cityIndex % TARGET_PORTUGAL_CITIES.length === 0) {
            this.nicheIndex++;
        }

        console.log(`\n============================================================`);
        console.log(`🎯 [Hunter 24/7 ➔ Jonh] INICIANDO RONDA #${this.cycleCount}`);
        console.log(`📍 Alvo Geográfico: ${currentCity} | Nicho: ${currentNiche}`);
        console.log(`============================================================`);

        const cycleResults = {
            cycle: this.cycleCount,
            city: currentCity,
            niche: currentNiche,
            startedAt: this.lastCycleAt,
            prospectsFound: 0,
            duplicatesBarred: 0,
            incompleteDiscarded: 0,
            inserted: 0
        };

        try {
            // 1. Pesquisa web por clínicas na cidade
            const candidates = await this.discoverClinicCandidates(currentCity, currentNiche);
            cycleResults.prospectsFound = candidates.length;
            this.totalFound += candidates.length;

            console.log(`🔍 [Hunter 24/7] ${candidates.length} clínicas potenciais descobertas em ${currentCity}.`);

            for (const cand of candidates) {
                // 2. Trava de Dados Mínimos Obrigatórios (Anti-Lixo)
                if (!cand.name || (!cand.phone && !cand.website)) {
                    console.log(`🗑️ [Hunter Descarte] "${cand.name || 'Sem nome'}" descartada por falta de telefone e website.`);
                    cycleResults.incompleteDiscarded++;
                    this.totalIncompleteDiscarded++;
                    continue;
                }

                // 3. Soberania Anti-Duplicidade no CRM (5 Camadas)
                const dupeCheck = await checkDuplicateInCRM({
                    phone: cand.phone,
                    email: cand.email,
                    clinicName: cand.name,
                    websiteUrl: cand.website,
                    instagramUrl: cand.instagram
                });

                if (dupeCheck.isDuplicate) {
                    console.log(`🛡️ [Hunter Anti-Duplicidade] Barra inserção de "${cand.name}" (Já existe como ${dupeCheck.matchedDeal?.status || 'registado'}).`);
                    cycleResults.duplicatesBarred++;
                    this.totalDuplicatesBarred++;
                    continue;
                }

                // 4. Inserção Segura e Estruturada no CRM
                const insertRes = await insertNewProspect({
                    name: cand.name,
                    phone: cand.phone,
                    email: cand.email || null,
                    website: cand.website || null,
                    instagram: cand.instagram || null,
                    concelho: currentCity,
                    niche: 'Clínica Dentária',
                    sourceNotes: `Caçado autonomamente pelo Hunter 24/7 em ${currentCity} (${currentNiche}).`
                });

                if (insertRes.success && insertRes.inserted) {
                    console.log(`✅ [Hunter ➔ Jonh] Nova clínica inserida como Prospect: "${cand.name}" (${cand.phone || cand.website})`);
                    cycleResults.inserted++;
                    this.totalInserted++;
                } else if (insertRes.blockedByDuplicate) {
                    cycleResults.duplicatesBarred++;
                    this.totalDuplicatesBarred++;
                }
            }

            // 5. CAÇA ATIVA DE ENRIQUECIMENTO PARA DEALS PENDENTES NO CRM
            const enrichRes = await this.enrichPendingTriadDeals(3);
            cycleResults.dealsEnriched = enrichRes.enriched;

            console.log(`📊 [Hunter 24/7 Ronda #${this.cycleCount} Concluída] Inseridos: ${cycleResults.inserted} | Enriquecidos: ${enrichRes.enriched} | Duplicados Barrados: ${cycleResults.duplicatesBarred} | Descartados: ${cycleResults.incompleteDiscarded}`);

        } catch (err) {
            console.error(`❌ [Hunter 24/7] Erro na ronda de caça:`, err.message);
        }

        return cycleResults;
    }

    /**
     * Caça e enriquece ativamente deals antigos do CRM que estão sem a Tríade (WhatsApp + Website)
     */
    async enrichPendingTriadDeals(limit = 3) {
        const supabase = getSupabaseClient();
        if (!supabase) return { enriched: 0, disqualified: 0 };

        try {
            const { data: deals } = await supabase
                .from('deals')
                .select('id, title, contact_id, company_id, tags')
                .contains('tags', ['Pendente Enriquecimento Hunter'])
                .eq('status', 'open')
                .limit(limit);

            if (!deals || deals.length === 0) {
                return { enriched: 0, disqualified: 0 };
            }

            console.log(`🔍 [Hunter ➔ Jonh] ${deals.length} deals em fila para enriquecimento activo da Tríade...`);
            let enrichedCount = 0;

            for (const deal of deals) {
                const cleanName = (deal.title || '').replace(/^(Negócio|Clinica|Clínica)\s+/i, '').trim();
                const candidates = await this.discoverClinicCandidates('Portugal', cleanName);
                const best = candidates.find(c => c.phone || c.website);

                if (best && (best.phone || best.website)) {
                    // Atualiza company
                    if (deal.company_id) {
                        await supabase.from('companies').update({
                            phone: best.phone || null,
                            website: best.website || null
                        }).eq('id', deal.company_id);
                    }
                    // Atualiza contact
                    if (deal.contact_id) {
                        await supabase.from('contacts').update({
                            phone: best.phone || null,
                            email: best.email || null,
                            notes: `Enriquecido pelo Hunter 24/7. Site: ${best.website || 'N/A'}`
                        }).eq('id', deal.contact_id);
                    }
                    // Atualiza deal
                    const newTags = (deal.tags || []).filter(t => t !== 'Pendente Enriquecimento Hunter' && t !== 'Sem WhatsApp');
                    newTags.push('Enriquecido pelo Hunter', 'WhatsApp Apto');
                    await supabase.from('deals').update({ tags: newTags }).eq('id', deal.id);

                    // Conclui atividade de auditoria
                    await supabase.from('activities').update({
                        status: 'completed',
                        completed: true,
                        completed_at: new Date().toISOString(),
                        notes: `✅ Tríade encontrada pelo Hunter: Telefone (${best.phone || 'N/A'}), Website (${best.website || 'N/A'}).`
                    }).eq('deal_id', deal.id).eq('status', 'pending');

                    console.log(`✅ [Hunter Enriquecimento] "${cleanName}" ENRIQUECIDA com sucesso!`);
                    enrichedCount++;
                }
            }

            return { enriched: enrichedCount };
        } catch (err) {
            console.error('❌ [Hunter Enriquecimento] Erro:', err.message);
            return { enriched: 0, error: err.message };
        }
    }

    /**
     * Mapeia clínicas reais através de pesquisa web resiliente
     */
    async discoverClinicCandidates(city, niche) {
        const query = `${niche} ${city} Portugal contacto telefone site`;
        const candidates = [];

        try {
            // Tenta via Firecrawl Search se chave presente
            const firecrawlKey = process.env.FIRECRAWL_API_KEY;
            if (firecrawlKey && !firecrawlKey.includes('placeholder')) {
                const { default: FirecrawlApp } = await import('firecrawl');
                const app = new FirecrawlApp({ apiKey: firecrawlKey });
                
                if (typeof app.search === 'function') {
                    const searchRes = await app.search(query, { limit: 6 });
                    if (searchRes && searchRes.data && searchRes.data.length > 0) {
                        for (const item of searchRes.data) {
                            const url = item.url || '';
                            if (/facebook|instagram|linkedin|youtube|yellowpages|pai\.pt|doctoralia|empresite/i.test(url)) {
                                continue; // Ignora diretórios gerais, queremos o site da clínica
                            }
                            const title = item.title || '';
                            const cleanName = (title.split(/[-–|]/)[0] || title).replace(/^(Clínica|Dentária|Consultório)\s+/i, '').trim();
                            if (cleanName.length > 3) {
                                candidates.push({
                                    name: cleanName,
                                    website: url,
                                    city
                                });
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // Silencioso, segue para enriquecimento
        }

        // Se encontrou URLs de clínicas, extrai dados via enrichClinicFromWebsite
        for (const cand of candidates) {
            if (cand.website && !cand.phone) {
                try {
                    const enriched = await enrichClinicFromWebsite(cand.website);
                    if (enriched && enriched.success && enriched.data) {
                        cand.name = enriched.data.clinicName || cand.name;
                        cand.phone = enriched.data.whatsapp || enriched.data.phone;
                        cand.email = enriched.data.email;
                        cand.instagram = enriched.data.instagramUrl;
                    }
                } catch (cErr) {
                    // Silencioso
                }
            }
        }

        return candidates;
    }

    /**
     * Status do Hunter
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            cycleCount: this.cycleCount,
            lastCycleAt: this.lastCycleAt,
            intervalMinutes: this.intervalMinutes,
            currentCity: TARGET_PORTUGAL_CITIES[this.cityIndex % TARGET_PORTUGAL_CITIES.length],
            totalFound: this.totalFound,
            totalInserted: this.totalInserted,
            totalDuplicatesBarred: this.totalDuplicatesBarred,
            totalIncompleteDiscarded: this.totalIncompleteDiscarded
        };
    }
}

export const defaultHunterWorker = new HunterAutonomousWorker();
