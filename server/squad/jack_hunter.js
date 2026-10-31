/**
 * server/squad/jack_hunter.js
 * ============================================================================
 * JACK HUNTER — HEAD DE PROSPEÇÃO & LEAD SCOUTING (PORTUGAL)
 * ============================================================================
 * - Caça novas oportunidades de negócio para a Vamuss em Portugal de Norte a Sul:
 *   • Clínicas Dentárias e Médicos Dentistas (implantes, invisalign, reabilitação).
 *   • Clínicas de Estética e Médicos Estéticos (harmonização facial, botox, bioestimuladores).
 * - ICP Qualificado: foco em clínicas com presença digital e potencial de ticket alto.
 * - SOBERANIA ANTI-DUPLICIDADE:
 *   Antes de adicionar qualquer oportunidade na coluna de Prospect, investiga
 *   se o lead já existe no CRM em QUALQUER status (ABERTO, GANHO ou PERDIDO).
 *   Deduplica por Telefone/WhatsApp, Email, Nome da Clínica e Website.
 *   Se já existir, BARRA a inserção para evitar 100% de duplicidades.
 * - Quando limpo de duplicidades, insere todos os campos e aciona o Jonh
 *   para garantir o Próximo Passo Obrigatório imediatamente.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { ensureNextStepActivity } from './operations_manager.js';

function getSupabaseClient() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

export const JACK_HUNTER_IDENTITY = {
    name: 'Jack Hunter',
    role: 'Head de Prospeção & Caçador de Oportunidades (Norte a Sul de Portugal)',
    supervisor: 'Jonh (Gerente de Operações)',
    ultimateBoss: 'Jarvis (O Chefão)',
    schedule: '24/7 Ininterrupto (Trabalha todos os dias, inclusive sábados, domingos e feriados)',
    mission: 'Descobrir e qualificar clínicas dentárias em Portugal com alto potencial de receita (Implantes, Invisalign e Reabilitação Oral), validando a Tríade do ICP (Site + Instagram + WhatsApp 9x com Firecrawl) e bloqueando 100% de duplicidades no CRM antes de adicionar na coluna de Prospect.',
    territoryCoverage: [
        'Norte: Porto, Vila Nova de Gaia, Matosinhos, Maia, Braga, Guimarães, Viana do Castelo',
        'Centro: Coimbra, Aveiro, Leiria, Viseu, Figueira da Foz',
        'Grande Lisboa & Vale do Tejo: Lisboa, Cascais, Sintra, Oeiras, Loures, Almada, Setúbal',
        'Sul & Ilhas: Faro, Portimão, Albufeira, Loulé, Vilamoura, Évora, Funchal'
    ],
    nicheTargets: [
        'Clínicas Dentárias e Médicos Dentistas (Implantes, Invisalign, Alinhadores, Reabilitação Oral)',
        'Clínicas de Estética e Médicos Estéticos (Harmonização Facial, Botox, Bioestimuladores)'
    ],
    rules: {
        runs247: true,
        neverSpeaksToClientsDirectly: true,
        multiLayerAntiDuplication: true,
        firecrawlPowered: true
    }
};

export const JACK_HUNTER_SCHEDULE = {
    mode: '24/7_CONTINUOUS_SCOUTING',
    activeDays: 'Segunda a Domingo (Sem interrupções)',
    reason: 'Como o Jack Hunter realiza apenas pesquisa interna de dados, validação de websites com Firecrawl e deduplicação no CRM (sem disparar mensagens ativas aos clientes), ele opera continuamente nos bastidores para construir estoque de leads para o Jonh e o SDR.'
};

export const PROSPECT_PIPELINE_CONFIG = {
    DEFAULT_PIPELINE_ID: 'sales',
    PROSPECT_STAGE_ID: '03f4795a-6bed-4043-b66f-cc251c06bb38', // Etapa 'Prospect'
    DEFAULT_USER_ID: '9469fb08-7de5-405e-a4e7-d83cf818ea1e', // Philipe Coelho
    DEFAULT_DEAL_VALUE: 197,
    CURRENCY: 'EUR'
};

/**
 * Normaliza número de telefone português para comparação precisa.
 */
export function normalizePhone(rawPhone) {
    if (!rawPhone) return { raw: '', clean: '', suffix8: '', suffix9: '', isMobile: false, isLandline: false };
    const digits = String(rawPhone).replace(/\D/g, '');
    const clean = digits.startsWith('351') ? digits.slice(3) : digits;
    const suffix8 = clean.length >= 8 ? clean.slice(-8) : clean;
    const suffix9 = clean.length >= 9 ? clean.slice(-9) : clean;
    const isMobile = /^9\d{8}$/.test(clean);
    const isLandline = /^2\d{8}$/.test(clean);

    return {
        raw: rawPhone,
        digits,
        clean,
        suffix8,
        suffix9,
        isMobile,
        isLandline
    };
}

/**
 * Normaliza o nome da clínica removendo títulos, ruídos e prefixos genéricos do setor.
 */
export function normalizeClinicName(rawName) {
    if (!rawName) return '';
    return String(rawName)
        .replace(/^(Negócio|Clinica|Clínica|Dr\.|Dra\.|Gabinete|Instituto|Centro Médico|Centro Dentário|Centro|Consultório)\s+/i, '')
        .replace(/\b(Dentária|Dentaria|Dental|Odontologia|Odontológica|Estética|Estetica|Médica|Medica)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extrai palavras-chave essenciais e distintivas (removendo stop-words comuns de saúde em Portugal).
 */
export function extractClinicKeywords(rawName) {
    if (!rawName) return [];
    const stopWords = new Set([
        'clinica', 'clínica', 'dentaria', 'dentária', 'dental', 'dentistas', 'odontologia',
        'estetica', 'estética', 'medica', 'médica', 'medicina', 'instituto', 'centro',
        'gabinete', 'consultorio', 'consultório', 'dra', 'dr', 'doutor', 'doutora',
        'negocio', 'negócio', 'portugal', 'lda', 'unipessoal', 'saude', 'saúde', 'de', 'da', 'do', 'e'
    ]);

    return String(rawName)
        .toLowerCase()
        .replace(/[^a-z0-9áàâãéèêíïóôõöúçñ\s]/gi, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.has(w));
}

/**
 * Normaliza handle do Instagram para comparação anti-duplicidade.
 */
export function extractInstagramHandle(url) {
    if (!url) return '';
    const clean = String(url).trim().toLowerCase();
    // Se for URL completa, extrai o handle logo após instagram.com/
    const urlMatch = clean.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
    if (urlMatch) {
        const handle = urlMatch[1].replace(/\/.*$/, '');
        return ['p', 'reel', 'stories', 'explore', 'direct'].includes(handle) ? '' : handle;
    }
    // Se for @handle ou apenas handle
    const handleMatch = clean.replace(/^@/, '').match(/^[a-zA-Z0-9._]+/);
    return handleMatch ? handleMatch[0] : '';
}

/**
 * Extrai domínio de uma URL para verificação anti-duplicidade de website.
 */
export function extractDomain(url) {
    if (!url) return '';
    try {
        const withProtocol = url.startsWith('http') ? url : `https://${url}`;
        const parsed = new URL(withProtocol);
        return parsed.hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        return url.replace(/^(https?:\/\/)?(www\.)?/i, '').split('/')[0].toLowerCase().trim();
    }
}

/**
 * JACK HUNTER MOTOR ANTI-DUPLICIDADE MULTI-CAMADA:
 * Analisa se a oportunidade já existe no CRM em QUALQUER status (aberto, ganho ou perdido).
 * Procura por Telefone, Email, Nome da Clínica e Website.
 */
export async function checkDuplicateInCRM({
    phone,
    email,
    clinicName,
    website,
    instagramUrl
} = {}) {
    const supabase = getSupabaseClient();
    if (!supabase) return { duplicate: false, reason: 'SUPABASE_UNAVAILABLE' };

    const phoneNorm = normalizePhone(phone);
    const cleanName = normalizeClinicName(clinicName);
    const keywords = extractClinicKeywords(clinicName);
    const domain = extractDomain(website);
    const instaHandle = extractInstagramHandle(instagramUrl);
    const cleanEmail = email ? email.toLowerCase().trim() : null;

    try {
        // ====================================================================
        // CAMADA 1: DEDUPLICAÇÃO POR TELEFONE / WHATSAPP (A mais crítica)
        // ====================================================================
        if (phoneNorm.suffix8) {
            // 1a. Buscar em contactos
            const { data: matchedContacts } = await supabase
                .from('contacts')
                .select('id, name, phone, email, company_id')
                .ilike('phone', `%${phoneNorm.suffix8}%`)
                .limit(5);

            if (matchedContacts && matchedContacts.length > 0) {
                const contactIds = matchedContacts.map(c => c.id);
                // Buscar se há deal associado a este contacto (aberto, ganho ou perdido)
                const { data: deals } = await supabase
                    .from('deals')
                    .select('id, title, status, stage_id, created_at, user_id, contact_id, company_id')
                    .in('contact_id', contactIds)
                    .limit(1);

                if (deals && deals.length > 0) {
                    const existingDeal = deals[0];
                    return {
                        duplicate: true,
                        matchedBy: 'PHONE_CONTACT',
                        matchedValue: phoneNorm.clean,
                        reason: `Telefone já cadastrado no contacto '${matchedContacts[0].name}'. Negócio existente: '${existingDeal.title}' (Status: ${existingDeal.status.toUpperCase()}).`,
                        existingDeal,
                        existingContact: matchedContacts[0]
                    };
                }
            }

            // 1b. Buscar em companies pelo telefone
            const { data: matchedCompanies } = await supabase
                .from('companies')
                .select('id, name, phone, website')
                .ilike('phone', `%${phoneNorm.suffix8}%`)
                .limit(5);

            if (matchedCompanies && matchedCompanies.length > 0) {
                const companyIds = matchedCompanies.map(c => c.id);
                const { data: deals } = await supabase
                    .from('deals')
                    .select('id, title, status, stage_id, created_at, user_id, contact_id, company_id')
                    .in('company_id', companyIds)
                    .limit(1);

                if (deals && deals.length > 0) {
                    const existingDeal = deals[0];
                    return {
                        duplicate: true,
                        matchedBy: 'PHONE_COMPANY',
                        matchedValue: phoneNorm.clean,
                        reason: `Telefone já cadastrado na empresa '${matchedCompanies[0].name}'. Negócio existente: '${existingDeal.title}' (Status: ${existingDeal.status.toUpperCase()}).`,
                        existingDeal,
                        existingCompany: matchedCompanies[0]
                    };
                }
            }
        }

        // ====================================================================
        // CAMADA 2: DEDUPLICAÇÃO POR EMAIL
        // ====================================================================
        if (cleanEmail) {
            const { data: matchedContacts } = await supabase
                .from('contacts')
                .select('id, name, email, company_id')
                .ilike('email', cleanEmail)
                .limit(5);

            if (matchedContacts && matchedContacts.length > 0) {
                const contactIds = matchedContacts.map(c => c.id);
                const { data: deals } = await supabase
                    .from('deals')
                    .select('id, title, status, stage_id, created_at, user_id')
                    .in('contact_id', contactIds)
                    .limit(1);

                if (deals && deals.length > 0) {
                    const existingDeal = deals[0];
                    return {
                        duplicate: true,
                        matchedBy: 'EMAIL',
                        matchedValue: cleanEmail,
                        reason: `E-mail já cadastrado no contacto '${matchedContacts[0].name}'. Negócio existente: '${existingDeal.title}' (Status: ${existingDeal.status.toUpperCase()}).`,
                        existingDeal,
                        existingContact: matchedContacts[0]
                    };
                }
            }
        }

        // ====================================================================
        // CAMADA 3: DEDUPLICAÇÃO POR INSTAGRAM
        // ====================================================================
        if (instaHandle && instaHandle.length >= 4) {
            const { data: matchedDeals } = await supabase
                .from('deals')
                .select('id, title, status, stage_id, instagram_url')
                .ilike('instagram_url', `%${instaHandle}%`)
                .limit(1);

            if (matchedDeals && matchedDeals.length > 0) {
                const existingDeal = matchedDeals[0];
                return {
                    duplicate: true,
                    matchedBy: 'INSTAGRAM',
                    matchedValue: instaHandle,
                    reason: `Instagram '@${instaHandle}' já coincide com o negócio '${existingDeal.title}' (Status: ${existingDeal.status.toUpperCase()}).`,
                    existingDeal
                };
            }
        }

        // ====================================================================
        // CAMADA 4: DEDUPLICAÇÃO POR NOME DA CLÍNICA / PALAVRAS-CHAVE
        // ====================================================================
        if (cleanName && cleanName.length >= 3) {
            // 4a. Busca no título do negócio com o nome normalizado
            const { data: dealsByName } = await supabase
                .from('deals')
                .select('id, title, status, stage_id, created_at, contact_id, company_id')
                .ilike('title', `%${cleanName}%`)
                .limit(3);

            if (dealsByName && dealsByName.length > 0) {
                const existingDeal = dealsByName[0];
                return {
                    duplicate: true,
                    matchedBy: 'CLINIC_NAME_DEAL',
                    matchedValue: cleanName,
                    reason: `Nome da clínica já coincide com o negócio '${existingDeal.title}' (Status: ${existingDeal.status.toUpperCase()}).`,
                    existingDeal
                };
            }

            // 4b. Busca avançada por tokens essenciais (ex: 'MOC' e 'Porto')
            if (keywords.length >= 2) {
                const firstToken = keywords[0];
                const { data: tokenDeals } = await supabase
                    .from('deals')
                    .select('id, title, status, stage_id, created_at')
                    .ilike('title', `%${firstToken}%`)
                    .limit(10);

                if (tokenDeals && tokenDeals.length > 0) {
                    for (const d of tokenDeals) {
                        const titleLower = (d.title || '').toLowerCase();
                        const matchesAll = keywords.every(kw => titleLower.includes(kw));
                        if (matchesAll) {
                            return {
                                duplicate: true,
                                matchedBy: 'CLINIC_KEYWORDS_MATCH',
                                matchedValue: keywords.join(' + '),
                                reason: `Palavras-chave da clínica (${keywords.join(', ')}) já coincidem com o negócio '${d.title}' (Status: ${d.status.toUpperCase()}).`,
                                existingDeal: d
                            };
                        }
                    }
                }
            }

            // 4c. Busca no nome das empresas cadastradas
            const { data: matchedCompanies } = await supabase
                .from('companies')
                .select('id, name')
                .ilike('name', `%${cleanName}%`)
                .limit(3);

            if (matchedCompanies && matchedCompanies.length > 0) {
                const companyIds = matchedCompanies.map(c => c.id);
                const { data: deals } = await supabase
                    .from('deals')
                    .select('id, title, status, stage_id, created_at')
                    .in('company_id', companyIds)
                    .limit(1);

                if (deals && deals.length > 0) {
                    const existingDeal = deals[0];
                    return {
                        duplicate: true,
                        matchedBy: 'CLINIC_NAME_COMPANY',
                        matchedValue: cleanName,
                        reason: `Nome da empresa '${matchedCompanies[0].name}' já existe no CRM. Negócio existente: '${existingDeal.title}' (Status: ${existingDeal.status.toUpperCase()}).`,
                        existingDeal,
                        existingCompany: matchedCompanies[0]
                    };
                }
            }
        }

        // ====================================================================
        // CAMADA 5: DEDUPLICAÇÃO POR WEBSITE / DOMÍNIO
        // ====================================================================
        if (domain && domain.length >= 5 && !['facebook.com', 'instagram.com', 'google.com'].includes(domain)) {
            const { data: matchedCompanies } = await supabase
                .from('companies')
                .select('id, name, website')
                .ilike('website', `%${domain}%`)
                .limit(3);

            if (matchedCompanies && matchedCompanies.length > 0) {
                const companyIds = matchedCompanies.map(c => c.id);
                const { data: deals } = await supabase
                    .from('deals')
                    .select('id, title, status, stage_id, created_at')
                    .in('company_id', companyIds)
                    .limit(1);

                if (deals && deals.length > 0) {
                    const existingDeal = deals[0];
                    return {
                        duplicate: true,
                        matchedBy: 'WEBSITE_DOMAIN',
                        matchedValue: domain,
                        reason: `Domínio de website '${domain}' já cadastrado para '${matchedCompanies[0].name}'. Negócio existente: '${existingDeal.title}' (Status: ${existingDeal.status.toUpperCase()}).`,
                        existingDeal,
                        existingCompany: matchedCompanies[0]
                    };
                }
            }
        }

        // Nenhuma duplicidade encontrada em aberto, ganho ou perdido
        return { duplicate: false, cleanName, phoneNorm };
    } catch (err) {
        console.error('❌ [Jack Hunter Anti-Duplicidade] Erro ao checar duplicidades:', err.message);
        return { duplicate: false, error: err.message };
    }
}

/**
 * Validação rigorosa dos dados captados pelo Jack Hunter antes da inserção.
 */
export function validateHuntedOpportunity({
    clinicName,
    phone,
    email,
    website,
    instagramUrl,
    adLibraryUrl,
    city
} = {}) {
    const missing = [];
    const cleanName = normalizeClinicName(clinicName);

    if (!cleanName || cleanName.length < 3) {
        missing.push('Nome da Clínica');
    }

    const phoneNorm = normalizePhone(phone);
    if (!phoneNorm.clean || phoneNorm.clean.length < 9) {
        missing.push('Telefone / WhatsApp Válido');
    }

    const hasDigital = Boolean(website || instagramUrl || adLibraryUrl || email);
    if (!hasDigital) {
        missing.push('Presença Digital (Site, Instagram, Meta Ads ou E-mail)');
    }

    return {
        valid: missing.length === 0,
        missingFields: missing,
        cleanName,
        phoneNorm,
        hasDigital,
        city: city || 'Portugal'
    };
}

/**
 * JACK HUNTER INSERÇÃO COMPLETA DE PROSPECT NO CRM:
 * 1. Verifica duplicidade contra negócios abertos, ganhos e perdidos.
 * 2. Se for duplicado, recusa e reporta.
 * 3. Se for novo e limpo, cria Company, Contact e Deal na etapa 'Prospect'.
 * 4. Aciona o Jonh para criar o Próximo Passo Obrigatório de imediato.
 */
export async function insertNewProspect({
    clinicName,
    contactName,
    phone,
    email,
    website,
    instagramUrl,
    adLibraryUrl,
    city = 'Portugal',
    region = 'Norte',
    niche = 'Clínica Dentária',
    source = 'Jack Hunter (Scouting Portugal)',
    dealValue = PROSPECT_PIPELINE_CONFIG.DEFAULT_DEAL_VALUE,
    userId = PROSPECT_PIPELINE_CONFIG.DEFAULT_USER_ID
} = {}) {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: 'SUPABASE_UNAVAILABLE' };

    // 1. Validação estrutural dos campos
    const validation = validateHuntedOpportunity({
        clinicName,
        phone,
        email,
        website,
        instagramUrl,
        adLibraryUrl,
        city
    });

    if (!validation.valid) {
        console.warn(`⚠️ [Jack Hunter] Oportunidade rejeitada por campos em falta: ${validation.missingFields.join(', ')}`);
        return {
            success: false,
            duplicate: false,
            error: 'MISSING_MANDATORY_FIELDS',
            missingFields: validation.missingFields
        };
    }

    // 2. Investigação Anti-Duplicidade no CRM (Aberto, Ganho ou Perdido)
    const duplicateCheck = await checkDuplicateInCRM({
        phone,
        email,
        clinicName,
        website,
        instagramUrl
    });

    if (duplicateCheck.duplicate) {
        console.log(`🛡️ [Jack Hunter Anti-Duplicidade] INSERÇÃO BARRADA: ${duplicateCheck.reason}`);
        return {
            success: false,
            duplicate: true,
            matchedBy: duplicateCheck.matchedBy,
            matchedValue: duplicateCheck.matchedValue,
            reason: duplicateCheck.reason,
            existingDeal: duplicateCheck.existingDeal
        };
    }

    try {
        const cleanName = validation.cleanName;
        const phoneNorm = validation.phoneNorm;

        // 3. Criar ou Recuperar Company
        let companyId = null;
        const { data: existingCompany } = await supabase
            .from('companies')
            .select('id, name')
            .ilike('name', cleanName)
            .limit(1);

        if (existingCompany && existingCompany.length > 0) {
            companyId = existingCompany[0].id;
        } else {
            const { data: createdCompany, error: compErr } = await supabase
                .from('companies')
                .insert([{
                    user_id: userId,
                    name: cleanName,
                    website: website ? website.trim() : null,
                    phone: phoneNorm.clean,
                    email: email ? email.toLowerCase().trim() : null
                }])
                .select()
                .single();

            if (!compErr && createdCompany) {
                companyId = createdCompany.id;
            }
        }

        // 4. Criar ou Recuperar Contact
        let contactId = null;
        const personName = contactName ? contactName.trim() : `Responsável ${cleanName}`;
        const { data: createdContact, error: contErr } = await supabase
            .from('contacts')
            .insert([{
                user_id: userId,
                name: personName,
                email: email ? email.toLowerCase().trim() : null,
                phone: phoneNorm.clean,
                company_id: companyId,
                role: 'Lead',
                marketing_status: 'subscribed',
                notes: `Captado por Jack Hunter em ${city} (${region} de Portugal). Especialidade: ${niche}.`
            }])
            .select()
            .single();

        if (contErr) {
            // Se falhou por conflito, tenta buscar
            const { data: fbContact } = await supabase
                .from('contacts')
                .select('id')
                .ilike('phone', `%${phoneNorm.suffix8}%`)
                .limit(1);
            contactId = fbContact?.[0]?.id || null;
        } else {
            contactId = createdContact.id;
        }

        // 5. Inserir o Deal na etapa 'Prospect'
        const dealTitle = `Negócio ${cleanName}`;
        const tags = ['Jack Hunter', niche, city];
        if (phoneNorm.isMobile) tags.push('WhatsApp Apto');
        if (phoneNorm.isLandline) tags.push('Linha Fixa');

        const { data: newDeal, error: dealErr } = await supabase
            .from('deals')
            .insert([{
                user_id: userId,
                contact_id: contactId,
                company_id: companyId,
                title: dealTitle,
                value: dealValue,
                pipeline_id: PROSPECT_PIPELINE_CONFIG.DEFAULT_PIPELINE_ID,
                stage_id: PROSPECT_PIPELINE_CONFIG.PROSPECT_STAGE_ID,
                status: 'open',
                source: source,
                currency: PROSPECT_PIPELINE_CONFIG.CURRENCY,
                instagram_url: instagramUrl ? instagramUrl.trim() : '',
                ad_library_url: adLibraryUrl ? adLibraryUrl.trim() : '',
                tags
            }])
            .select()
            .single();

        if (dealErr) throw dealErr;

        console.log(`🎯 [Jack Hunter] Oportunidade inserida com sucesso no CRM: '${dealTitle}' (ID: ${newDeal.id})`);

        // 6. Registrar Log Factual da Ação do Jack Hunter
        await supabase
            .from('deal_logs')
            .insert([{
                deal_id: newDeal.id,
                content: `🎯 [Jack Hunter] Nova oportunidade captada em ${city} e inserida na coluna Prospect. Dados validados e 100% livre de duplicidade no CRM.`,
                log_type: 'lead_captured'
            }]);

        // 7. Acionar Jonh para garantir o Próximo Passo Obrigatório imediatamente
        const nextStepRes = await ensureNextStepActivity(newDeal.id, {
            userId,
            title: `Acompanhamento Jonh: ${dealTitle}`,
            type: 'message',
            dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            notes: `Oportunidade originada por Jack Hunter. Jonh fiscalizou dados e programou Touch 1.`
        });

        return {
            success: true,
            duplicate: false,
            deal: newDeal,
            contactId,
            companyId,
            nextStepScheduled: nextStepRes.success
        };
    } catch (err) {
        console.error('❌ [Jack Hunter] Falha fatal ao inserir prospect:', err.message);
        return { success: false, duplicate: false, error: err.message };
    }
}

/**
 * Processamento em lote de oportunidades caçadas pelo Jack Hunter.
 */
export async function batchHuntAndImport(prospectsList = []) {
    console.log(`\n============================================================`);
    console.log(`🎯 [Jack Hunter] INICIANDO PROCESSAMENTO DE ${prospectsList.length} OPORTUNIDADES...`);
    console.log(`============================================================`);

    const summary = {
        totalScouted: prospectsList.length,
        insertedCount: 0,
        duplicatesPrevented: 0,
        invalidCount: 0,
        inserted: [],
        duplicates: [],
        invalid: []
    };

    for (const item of prospectsList) {
        const res = await insertNewProspect(item);
        if (res.success) {
            summary.insertedCount++;
            summary.inserted.push({
                dealId: res.deal.id,
                title: res.deal.title,
                city: item.city
            });
        } else if (res.duplicate) {
            summary.duplicatesPrevented++;
            summary.duplicates.push({
                clinicName: item.clinicName,
                matchedBy: res.matchedBy,
                matchedValue: res.matchedValue,
                reason: res.reason,
                existingDealId: res.existingDeal?.id,
                existingStatus: res.existingDeal?.status
            });
        } else {
            summary.invalidCount++;
            summary.invalid.push({
                clinicName: item.clinicName,
                error: res.error,
                missingFields: res.missingFields
            });
        }
    }

    console.log(`✅ [Jack Hunter] Varredura Concluída:`);
    console.log(`   • Oportunidades Novas Inseridas: ${summary.insertedCount}`);
    console.log(`   • Duplicidades Prevenidas (Aberto/Ganho/Perdido): ${summary.duplicatesPrevented}`);
    console.log(`   • Inválidos (Campos em falta): ${summary.invalidCount}`);

    return summary;
}

/**
 * ============================================================================
 * MOTOR DE ENRIQUECIMENTO DE SITES (FIRECRAWL & EXTRATOR SEMÂNTICO NATIVO)
 * ============================================================================
 * Varre o site oficial de uma clínica dentária e extrai a Tríade do ICP:
 * 1. Site ativo e funcional
 * 2. Perfil de Instagram oficial
 * 3. Telemóvel português para WhatsApp (9x)
 * + Validação de Alto Ticket (Implantes, All-on-4, Invisalign)
 */
export async function enrichClinicFromWebsite(rawUrl) {
    if (!rawUrl) return { success: false, error: 'URL_REQUIRED' };

    let normalizedUrl = rawUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
    }

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

    // ========================================================================
    // TIER 1: FIRECRAWL CLOUD SDK (Se FIRECRAWL_API_KEY estiver configurada)
    // ========================================================================
    if (firecrawlApiKey && !firecrawlApiKey.includes('SEU_API_KEY')) {
        try {
            console.log(`🔥 [Jack Hunter / Firecrawl] Analisando site com IA: ${normalizedUrl}`);
            const { Firecrawl } = await import('firecrawl');
            const app = new Firecrawl({ apiKey: firecrawlApiKey });

            const extractRes = await app.extract({
                urls: [normalizedUrl],
                prompt: "Extraia o nome limpo da clínica dentária, o telemóvel português de WhatsApp (9 dígitos com ou sem +351, preferência números móveis 9x), o perfil ou URL do Instagram oficial, o e-mail de contacto, o nome do médico dentista responsável ou diretor clínico, a cidade em Portugal e verifique se realizam implantes dentários ou invisalign/alinhadores.",
                schema: {
                    type: "object",
                    properties: {
                        clinicName: { type: "string" },
                        whatsapp: { type: "string" },
                        phone: { type: "string" },
                        email: { type: "string" },
                        instagramUrl: { type: "string" },
                        doctorName: { type: "string" },
                        city: { type: "string" },
                        offersImplants: { type: "boolean" },
                        offersInvisalign: { type: "boolean" }
                    }
                }
            });

            if (extractRes && extractRes.success && extractRes.data) {
                const d = extractRes.data;
                const phoneCandidate = d.whatsapp || d.phone || '';
                const phoneNorm = normalizePhone(phoneCandidate);
                const instaHandle = extractInstagramHandle(d.instagramUrl || '');

                const hasWhatsApp = phoneNorm.isMobile;
                const hasInstagram = Boolean(instaHandle);
                const hasHighTicket = Boolean(d.offersImplants || d.offersInvisalign);
                const icpApproved = hasWhatsApp && hasInstagram && hasHighTicket;

                return {
                    success: true,
                    engine: 'FIRECRAWL',
                    url: normalizedUrl,
                    data: {
                        clinicName: normalizeClinicName(d.clinicName || ''),
                        rawPhone: phoneCandidate,
                        phoneNorm,
                        email: (d.email || '').toLowerCase().trim(),
                        instagramUrl: d.instagramUrl || '',
                        instagramHandle: instaHandle,
                        doctorName: d.doctorName || '',
                        city: d.city || 'Portugal',
                        offersImplants: Boolean(d.offersImplants),
                        offersInvisalign: Boolean(d.offersInvisalign),
                        hasHighTicket
                    },
                    icpTriage: {
                        hasWebsite: true,
                        hasInstagram,
                        hasWhatsApp,
                        icpApproved,
                        status: icpApproved ? 'QUALIFIED' : 'PARTIAL'
                    }
                };
            }
        } catch (fcErr) {
            console.warn(`⚠️ [Jack Hunter / Firecrawl] Aviso na extração via Firecrawl (${fcErr.message}). Acionando extrator semântico nativo...`);
        }
    }

    // ========================================================================
    // TIER 2: EXTRATOR SEMÂNTICO NATIVO (Zero-Dependency Fallback)
    // ========================================================================
    try {
        console.log(`🌐 [Jack Hunter Extrator] Rastreando código do site: ${normalizedUrl}`);
        let html = '';

        try {
            const response = await fetch(normalizedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                redirect: 'follow',
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                html = await response.text();
            }
        } catch (fetchErr) {
            // Se o fetch do Node 22 falhar por TLS handshake / socket, aciona o curl do sistema como fallback resiliente
            console.log(`⚠️ [Jack Hunter] Fetch nativo falhou (${fetchErr.message}). Tentando fallback via curl...`);
            const { execSync } = await import('child_process');
            html = execSync(`curl -s -L -m 10 -A "Mozilla/5.0" "${normalizedUrl}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        }

        if (!html || html.length < 50) {
            return {
                success: false,
                engine: 'NATIVE',
                url: normalizedUrl,
                error: 'EMPTY_HTML',
                icpTriage: { hasWebsite: false, icpApproved: false }
            };
        }

        // 1. WhatsApp Hunting: procura links wa.me, api.whatsapp e padrões de telemóvel 9x
        let foundPhone = '';
        const waLinkMatch = html.match(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(?:%2B|351)?(\d{9})/i);
        if (waLinkMatch) {
            foundPhone = waLinkMatch[1];
        } else {
            // Procura links tel:
            const telMatches = [...html.matchAll(/href=["']tel:(?:\+?351)?(\d{9})["']/gi)];
            for (const tm of telMatches) {
                if (/^9\d{8}$/.test(tm[1])) {
                    foundPhone = tm[1];
                    break;
                } else if (!foundPhone) {
                    foundPhone = tm[1];
                }
            }
        }

        // Se ainda não achou, procura no texto plano por 9xx xxx xxx ou +351 9xx...
        if (!foundPhone) {
            const textMobileMatch = html.match(/(?:\+351\s*)?(9\d{2}[\s.-]?\d{3}[\s.-]?\d{3})/);
            if (textMobileMatch) {
                foundPhone = textMobileMatch[1].replace(/\D/g, '');
            }
        }

        const phoneNorm = normalizePhone(foundPhone);

        // 2. Instagram Hunting: procura links para instagram.com
        let foundInstagram = '';
        let instaHandle = '';
        const instaMatches = [...html.matchAll(/href=["'](https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+(?:\/)?)["']/gi)];
        for (const im of instaMatches) {
            const h = extractInstagramHandle(im[1]);
            if (h && !['p', 'explore', 'stories', 'reels', 'sharer'].includes(h)) {
                foundInstagram = im[1];
                instaHandle = h;
                break;
            }
        }

        // 3. Email Hunting
        let foundEmail = '';
        const emailMatch = html.match(/href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/i);
        if (emailMatch) {
            foundEmail = emailMatch[1].toLowerCase().trim();
        }

        // 4. Detecção de Procedimentos de Alto Ticket
        const htmlLower = html.toLowerCase();
        const offersImplants = /implante|implantes|all-on-4|all-on-6|carga\s+imediata|cirurgia\s+guiada/.test(htmlLower);
        const offersInvisalign = /invisalign|alinhador|alinhadores|ortodontia\s+invis[ií]vel/.test(htmlLower);
        const offersVeneers = /faceta|facetas|lentes\s+de\s+contacto|est[eé]tica\s+dent[aá]ria/.test(htmlLower);
        const hasHighTicket = offersImplants || offersInvisalign || offersVeneers;

        // 5. Nome da Clínica a partir da tag <title>
        let clinicName = '';
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            const rawTitle = titleMatch[1];
            clinicName = rawTitle.split(/[|\-–—]/)[0].trim();
            clinicName = normalizeClinicName(clinicName);
        }

        // 6. Detecção da Cidade
        let city = 'Portugal';
        const cities = ['Porto', 'Lisboa', 'Braga', 'Coimbra', 'Cascais', 'Sintra', 'Oeiras', 'Setúbal', 'Faro', 'Aveiro', 'Leiria', 'Guimarães', 'Matosinhos', 'Vila Nova de Gaia'];
        for (const c of cities) {
            if (new RegExp(`\\b${c}\\b`, 'i').test(htmlLower)) {
                city = c;
                break;
            }
        }

        const hasWebsite = true;
        const hasInstagram = Boolean(instaHandle);
        const hasWhatsApp = phoneNorm.isMobile;
        const icpApproved = hasWebsite && hasInstagram && hasWhatsApp;

        console.log(`🎯 [Jack Hunter Triage] Resultado da Tríade para '${clinicName || normalizedUrl}':`);
        console.log(`   • Site Ativo: SIM`);
        console.log(`   • Instagram: ${hasInstagram ? '@' + instaHandle : 'NÃO DETECTADO'}`);
        console.log(`   • WhatsApp Móvel (9x): ${hasWhatsApp ? phoneNorm.clean : (phoneNorm.isLandline ? 'FIXO (' + phoneNorm.clean + ')' : 'NÃO DETECTADO')}`);
        console.log(`   • Alto Ticket: ${hasHighTicket ? 'SIM (Implantes/Invisalign)' : 'NÃO IDENTIFICADO'}`);
        console.log(`   • Decisão ICP: ${icpApproved ? '✅ APROVADO' : '⚠️ PARCIAL'}`);

        return {
            success: true,
            engine: 'NATIVE',
            url: normalizedUrl,
            data: {
                clinicName: clinicName || extractDomain(normalizedUrl),
                rawPhone: foundPhone,
                phoneNorm,
                email: foundEmail,
                instagramUrl: foundInstagram,
                instagramHandle: instaHandle,
                city,
                offersImplants,
                offersInvisalign,
                offersVeneers,
                hasHighTicket
            },
            icpTriage: {
                hasWebsite: true,
                hasInstagram,
                hasWhatsApp,
                icpApproved,
                status: icpApproved ? 'QUALIFIED' : 'PARTIAL'
            }
        };
    } catch (err) {
        console.error(`❌ [Jack Hunter Extrator] Erro ao extrair dados de ${normalizedUrl}:`, err.message);
        return {
            success: false,
            engine: 'NATIVE',
            url: normalizedUrl,
            error: err.message,
            icpTriage: { hasWebsite: false, icpApproved: false }
        };
    }
}

/**
 * CAÇA COMPLETA & INSERÇÃO POR URL DE WEBSITE:
 * 1. Rastreia e enriquece o site (Firecrawl ou Extrator Nativo).
 * 2. Valida a Tríade do ICP (Site + Instagram + WhatsApp).
 * 3. Analisa 100% de duplicidades no CRM (aberto, ganho ou perdido).
 * 4. Insere na coluna Prospect e aciona o Jonh para o Próximo Passo.
 */
export async function huntAndInsertFromWebsite(rawUrl, {
    forceInsertIfPartial = false,
    niche = 'Clínica Dentária',
    source = 'Jack Hunter (Web Scout)',
    userId = PROSPECT_PIPELINE_CONFIG.DEFAULT_USER_ID
} = {}) {
    const enrichment = await enrichClinicFromWebsite(rawUrl);

    if (!enrichment.success) {
        return {
            success: false,
            error: 'WEBSITE_UNREACHABLE',
            details: enrichment.error
        };
    }

    const { data, icpTriage } = enrichment;

    if (!icpTriage.icpApproved && !forceInsertIfPartial) {
        return {
            success: false,
            rejectedByICP: true,
            reason: 'Clínica não cumpre a Tríade obrigatória do ICP (necessário Site + Instagram + WhatsApp 9x).',
            icpTriage,
            data
        };
    }

    // Se aprovado no ICP, submete à auditoria anti-duplicidade e inserção
    const insertResult = await insertNewProspect({
        clinicName: data.clinicName,
        phone: data.phoneNorm.clean,
        email: data.email,
        website: enrichment.url,
        instagramUrl: data.instagramUrl,
        city: data.city,
        niche,
        source,
        userId
    });

    return {
        ...insertResult,
        enrichmentEngine: enrichment.engine,
        icpTriage
    };
}
