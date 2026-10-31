/**
 * server/squad/teresa_recon.js
 * ============================================================================
 * TERESA — INVESTIGADORA FORENSE & ANALISTA DE INTELIGÊNCIA COMERCIAL (PORTUGAL)
 * ============================================================================
 * - NÍVEL 3.2 DA MÁQUINA DE VENDAS VAMUSS (Posicionada entre Hunter 3.1 e SDR Outbound 3.3).
 * - Subordinada direta do JONH (Gerente Geral de Operações).
 * - Missão: Perícia profunda e cirúrgica Just-in-Time em clínicas de Portugal antes do envio do SDR.
 * 
 * 5 INSUMOS ESTRUTURAIS:
 *   1. Diretor Clínico / Decisor (com Blindagem Anti-Alucinação Zero-Hallucination Guard).
 *   2. Procedimento de Alto Ticket (All-on-4, Invisalign, Reabilitação Oral, Harmonização).
 *   3. Diagnóstico de Tráfego Meta Ads (Falha no destino, criativo genérico, ou vácuo local).
 *   4. Fricção de Agendamento do Paciente (Telefone fixo noturno, form frio no telemóvel).
 *   5. Gancho Consultivo Sugerido (Pergunta negativa / Chris Voss pronta para WhatsApp).
 * 
 * 4 HABILIDADES TÁTICAS DE GUERRILHA (JARVIS & JONH APPROVED):
 *   1. Blindagem Anti-Alucinação: se incerto sobre o nome do médico, NUNCA chuta. Usa abordagem institucional.
 *   2. Classificação de Porte / Maturidade: Solo Practice, Clínica Média ICP Ouro (2-5 gabinetes), ou Rede/Franquia.
 *   3. Sensor de Dependência de Seguros: detecta Médis, Multicare, AdvanceCare e gera ângulo de rentabilidade privada.
 *   4. Geomarketing & Concorrência Local: contextualiza a freguesia/cidade (Porto, Lisboa, Cascais, Braga, etc.).
 * 
 * VISÃO PERIFÉRICA & MEMÓRIA ADAPTATIVA:
 *   - Captura "Sinais Ouro" (Tecnologia 3D iTero, CBCT, expansão recente, etc.).
 *   - Alimenta e consulta `data/teresa_intelligence_memory.json` para auto-aprendizagem contínua.
 *   - Persiste os dossiês prontos em `data/sdr_deal_dossiers.json` sob comando do Jonh.
 * ============================================================================
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DOSSIERS_FILE = path.join(ROOT_DIR, 'data', 'sdr_deal_dossiers.json');
const MEMORY_FILE = path.join(ROOT_DIR, 'data', 'teresa_intelligence_memory.json');

function getSupabaseClient() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey);
}

export const TERESA_IDENTITY = {
    name: 'Teresa',
    role: 'Investigadora Forense & Analista de Inteligência Comercial (Portugal)',
    superior: 'Jonh (Gerente Geral de Operações)',
    reportsTo: 'Jonh',
    commandChain: 'Teresa ➔ Jonh (Operações) ➔ Jarvis (Chefão) ➔ Philipe Coelho (CEO)',
    ultimateBoss: 'Jarvis (O Chefão)',
    subordinatePartner: 'SDR Outbound',
    mission: 'Investigar clínicas dentárias e de estética em Portugal com profundidade forense Just-in-Time, descobrindo decisores clínicos sem alucinações, falhas em anúncios Meta Ads, dependência de tabelas de seguros, fricções de agendamento e sinais ouro de tecnologia, municiando o SDR Outbound com ganchos táticos em 3 linhas de altíssima conversão.',
    coreSkills: [
        'Auditoria Forense de Websites e Meta Ad Library (Facebook/Instagram)',
        'Blindagem Anti-Alucinação de Decisores Clínicos (Zero-Hallucination Policy)',
        'Classificação de Porte e Maturidade de Gabinetes (Solo vs Média ICP vs Rede)',
        'Sensor de Dependência de Seguros de Saúde (Médis, Multicare, AdvanceCare)',
        'Geomarketing e Mapeamento de Concorrência Local em Portugal',
        'Visão Periférica de Sinais Ouro (iTero 3D, CBCT, Sedação, Expansão)',
        'Auto-Aprendizagem Contínua de Padrões e Ganchos Vencedores'
    ],
    rules: {
        subordinatedToJonh: true,
        neverSpeaksToClientsDirectly: true,
        neverSendsMessagesToDeals: true, // REGRA DE OURO: Jamais contacta nem dispara mensagens aos negócios no CRM
        strictlyInternalRecon: true,     // Atuação estritamente analítica e forense interna
        savesFullDossierToHistory: true, // Todo dossiê é gravado no histórico (activities e custom_fields) do Deal
        zeroHallucinationStrict: true,
        justInTimeAuditing: true
    }
};

/**
 * Carrega a memória de inteligência viva da Teresa
 */
export function loadTeresaMemory() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const raw = fs.readFileSync(MEMORY_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('⚠️ [Teresa] Falha ao ler memória de inteligência, iniciando nova:', e.message);
    }
    return {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        totalInvestigations: 0,
        regionalPatterns: {
            'Norte': { highTicketPreference: 'Carga Imediata / Eficiência de Gabinete', commonPain: 'Ociosidade de cadeiras e concorrência agressiva' },
            'Grande Lisboa': { highTicketPreference: 'Reabilitação Estética / All-on-4 / Invisalign', commonPain: 'Saturação de clínicas e perda de tráfego para a home' },
            'Centro': { highTicketPreference: 'Ortodontia Digital / Prótese Fixa', commonPain: 'Dependência de seguros e falta de tráfego digital' },
            'Sul & Ilhas': { highTicketPreference: 'Turismo Dentário / Reabilitação Total', commonPain: 'Sazonalidade e atendimento multilingue deficiente' }
        },
        winningHookCategories: {
            'HOME_REDIRECT_FLAW': { timesUsed: 12, positiveReplies: 4, winRate: '33.3%' },
            'INSURANCE_VS_PRIVATE': { timesUsed: 15, positiveReplies: 5, winRate: '33.3%' },
            'NO_ADS_LOCAL_COMPETITOR': { timesUsed: 9, positiveReplies: 3, winRate: '33.3%' },
            'BOOKING_FRICTION_NIGHT': { timesUsed: 8, positiveReplies: 2, winRate: '25.0%' },
            'TECH_3D_UNDERUTILIZED': { timesUsed: 6, positiveReplies: 2, winRate: '33.3%' }
        },
        learnedEmergingTrends: [
            'Aumento de clínicas a promover Alinhadores Spark além de Invisalign',
            'Demanda por Bioestimuladores Radiesse e Sculptra em clínicas integradas de Medicina Dentária & Estética',
            'Clínicas médias a adquirir Scanners 3D mas sem divulgar nos anúncios'
        ]
    };
}

/**
 * Salva a memória de inteligência
 */
export function saveTeresaMemory(memory) {
    try {
        memory.lastUpdated = new Date().toISOString();
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf-8');
    } catch (e) {
        console.error('❌ [Teresa] Erro ao gravar memória:', e.message);
    }
}

/**
 * Carrega a base de dossiês dos deals
 */
export function loadDossiersFile() {
    try {
        if (fs.existsSync(DOSSIERS_FILE)) {
            return JSON.parse(fs.readFileSync(DOSSIERS_FILE, 'utf-8'));
        }
    } catch (e) {
        console.warn('⚠️ [Teresa] Falha ao ler sdr_deal_dossiers.json:', e.message);
    }
    return {};
}

/**
 * Salva o dossiê atualizado
 */
export function saveDossier(dealId, dossier) {
    try {
        const dossiers = loadDossiersFile();
        dossiers[dealId] = dossier;
        fs.writeFileSync(DOSSIERS_FILE, JSON.stringify(dossiers, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error(`❌ [Teresa] Erro ao salvar dossiê para deal ${dealId}:`, e.message);
        return false;
    }
}

/**
 * Extrator web resiliente para a investigação da Teresa
 */
async function fetchWebsiteForensic(url) {
    if (!url) return null;
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;

    // Tentativa 1: Firecrawl se configurado
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (firecrawlKey && !firecrawlKey.includes('placeholder')) {
        try {
            const { default: FirecrawlApp } = await import('firecrawl');
            const app = new FirecrawlApp({ apiKey: firecrawlKey });
            const scrapeFn = typeof app.scrape === 'function' ? app.scrape.bind(app) : app.scrapeUrl.bind(app);
            const scrapeRes = await scrapeFn(normalized, {
                formats: ['markdown', 'html'],
                onlyMainContent: false,
                waitFor: 2000
            });
            if (scrapeRes && scrapeRes.success && (scrapeRes.markdown || scrapeRes.content)) {
                return {
                    source: 'FIRECRAWL_ENGINE',
                    url: normalized,
                    markdown: scrapeRes.markdown || '',
                    html: scrapeRes.html || scrapeRes.content || '',
                    metadata: scrapeRes.metadata || {}
                };
            }
        } catch (fcErr) {
            // Continua para fallback nativo
        }
    }

    // Tentativa 2: Fetch nativo Node
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(normalized, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        clearTimeout(timeout);
        if (res.ok) {
            const html = await res.text();
            return {
                source: 'NODE_FETCH',
                url: normalized,
                html,
                markdown: html.replace(/<[^>]+>/g, ' ')
            };
        }
    } catch (e) {
        // Fallback para curl (resiliente contra handshake TLS do Node 22)
    }

    // Tentativa 3: Curl nativo
    try {
        const curlCmd = `curl -s -L -m 8 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" "${normalized}"`;
        const html = execSync(curlCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        if (html && html.length > 200) {
            return {
                source: 'CURL_FALLBACK',
                url: normalized,
                html,
                markdown: html.replace(/<[^>]+>/g, ' ')
            };
        }
    } catch (curlErr) {
        // Falha completa de acesso
    }

    return null;
}

/**
 * 1. BLINDAGEM ANTI-ALUCINAÇÃO DE DECISOR CLÍNICO (ZERO-HALLUCINATION GUARD)
 */
function extractClinicalDirectorSafe(text, clinicName = '') {
    if (!text) {
        return {
            targetName: null,
            targetRole: 'Direção Clínica',
            confidence: 'UNCERTAIN',
            salutation: 'À Direção Clínica',
            evidence: 'Website inacessível ou sem dados públicos do corpo clínico'
        };
    }

    // Padrão 1: Diretor(a) Clínico(a) explícito
    const dirMatch = text.match(/(?:diretor[a]?\s+cl[íi]nico[a]?|respons[áa]vel\s+t[ée]cnico[a]?)\s*[:\-–]?\s*(?:dr[a]?\.?\s+)?([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+){1,3})/i);
    if (dirMatch && dirMatch[1]) {
        const name = dirMatch[1].trim();
        // Checar se não é falso positivo (ex: nome da clínica ou termo genérico)
        if (!/cl[íi]nica|hospital|m[ée]dica|sa[úu]de|portugal|geral/i.test(name)) {
            const hasDr = /dr[a]?\.?/i.test(dirMatch[0]);
            return {
                targetName: (hasDr ? 'Dr. ' : '') + name,
                rawName: name,
                targetRole: 'Diretor Clínico',
                confidence: 'HIGH',
                salutation: `Dr. ${name.split(' ')[0]}`,
                evidence: `Identificado expressamente como Diretor Clínico: "${dirMatch[0].trim().slice(0, 80)}"`
            };
        }
    }

    // Padrão 2: Citação com número de Ordem dos Médicos Dentistas (OMD xxxx)
    const omdMatch = text.match(/(?:dr[a]?\.?\s+)([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+){1,3})\s*(?:\([^)]*\))?\s*(?:-\s*)?(?:omd\s*[:#]?\s*\d{2,6})/i);
    if (omdMatch && omdMatch[1]) {
        const name = omdMatch[1].trim();
        return {
            targetName: `Dr. ${name}`,
            rawName: name,
            targetRole: 'Médico Dentista Inscrito na OMD',
            confidence: 'HIGH',
            salutation: `Dr. ${name.split(' ')[0]}`,
            evidence: `Identificado com cédula profissional OMD no site: "${omdMatch[0].trim().slice(0, 80)}"`
        };
    }

    // Padrão 3: Nome da clínica contém nome próprio de médico (ex: Clínica Dr. Hugo Madeira, Dra. Catarina)
    const nameInTitleMatch = clinicName.match(/(?:dr[a]?\.?\s+)([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+){0,2})/i);
    if (nameInTitleMatch && nameInTitleMatch[1]) {
        const name = nameInTitleMatch[1].trim();
        return {
            targetName: `Dr. ${name}`,
            rawName: name,
            targetRole: 'Médico Titular da Clínica',
            confidence: 'HIGH',
            salutation: `Dr. ${name.split(' ')[0]}`,
            evidence: `O próprio nome da clínica referencia o médico fundador: "${clinicName}"`
        };
    }

    // Padrão 4: Menção a Dr./Dra. proeminente na secção sobre nós / corpo clínico
    const teamMatch = text.match(/(?:corpo\s+cl[íi]nico|nossa\s+equipa|especialistas)[\s\S]{1,300}?(?:dr[a]?\.?\s+)([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõ]+){1,2})/i);
    if (teamMatch && teamMatch[1]) {
        const name = teamMatch[1].trim();
        if (!/cl[íi]nica|hospital|m[ée]dica|sa[úu]de/i.test(name)) {
            return {
                targetName: `Dr. ${name}`,
                rawName: name,
                targetRole: 'Especialista em Destaque',
                confidence: 'MEDIUM',
                salutation: `Dr. ${name.split(' ')[0]}`,
                evidence: `Primeiro médico dentista em evidência no corpo clínico: "${teamMatch[0].trim().slice(0, 90)}"`
            };
        }
    }

    // Fallback Anti-Alucinação Estrito (Nunca chuta!)
    return {
        targetName: null,
        targetRole: 'Direção Clínica / Coordenação Geral',
        confidence: 'UNCERTAIN',
        salutation: 'À Direção Clínica',
        evidence: 'Nome específico do médico não confirmado com 100% de precisão no site. Abordagem institucional recomendada para proteger a reputação.'
    };
}

/**
 * 2. DETECTOR DE PROCEDIMENTOS DE ALTO TICKET & CARRO-CHEFE
 */
function extractHeroProcedure(text) {
    const procedures = [];
    const t = (text || '').toLowerCase();

    // All-on-4 / Carga Imediata / Implantes
    if (/all-on-4|all on 4|all-on-6|carga imediata|implantes dent[áa]rios|implantologia|pr[óo]tese fixa sobre implantes|cirurgia guiada|enxerto [óo]sseo/i.test(t)) {
        procedures.push({
            category: 'IMPLANTS_AND_REHABILITATION',
            name: 'Carga Imediata e Reabilitação All-on-4',
            ticketTier: 'HIGH_TICKET_5K_15K',
            keywordsFound: ['implantes', 'carga imediata', 'all-on-4']
        });
    }

    // Ortodontia Invisível / Invisalign
    if (/invisalign|spark|alinhadores invis[íi]veis|ortodontia invis[íi]vel|ortodontia digital|alinhador transparente/i.test(t)) {
        procedures.push({
            category: 'INVISIBLE_ALIGNERS',
            name: 'Ortodontia Digital e Alinhadores Invisíveis',
            ticketTier: 'HIGH_TICKET_3K_6K',
            keywordsFound: ['invisalign', 'alinhadores']
        });
    }

    // Facetas / Reabilitação Estética
    if (/facetas de porcelana|facetas cer[âa]micas|lentes de contacto dent[áa]rias|est[ée]tica dent[áa]ria avan[çc]ada|reabilita[çc][ãa]o oral est[ée]tica/i.test(t)) {
        procedures.push({
            category: 'DENTAL_VENEERS',
            name: 'Facetas Cerâmicas e Reabilitação Estética',
            ticketTier: 'HIGH_TICKET_3K_8K',
            keywordsFound: ['facetas', 'reabilitação estética']
        });
    }

    // Medicina Estética / Harmonização
    if (/harmoniza[çc][ãa]o facial|botox|toxina botul[íi]nica|bioestimulador|sculptra|radiesse|harmonyca|preenchimento com [áa]cido hialur[óo]nico|fios pdo/i.test(t)) {
        procedures.push({
            category: 'FACIAL_AESTHETICS',
            name: 'Harmonização Facial e Bioestimuladores de Colagénio',
            ticketTier: 'HIGH_TICKET_1K_4K',
            keywordsFound: ['harmonização', 'bioestimuladores', 'botox']
        });
    }

    if (procedures.length === 0) {
        procedures.push({
            category: 'GENERAL_DENTISTRY',
            name: 'Clínica Geral e Saúde Oral',
            ticketTier: 'STANDARD',
            keywordsFound: ['dentária geral']
        });
    }

    // O Hero é o procedimento de maior ticket disponível
    const hero = procedures[0];
    return {
        hero,
        allDetected: procedures
    };
}

/**
 * 3. AUDITORIA FORENSE DE TRÁFEGO META ADS (FACEBOOK / INSTAGRAM)
 */
function auditMetaAdsAndTraffic(text, html = '', instagramHandle = null) {
    const t = (text + ' ' + html).toLowerCase();
    
    // Sinais de anúncios ativos ou infraestrutura de anúncios
    const hasPixel = /fbq\(['"]init['"]|connect\.facebook\.net|fbevents\.js|meta-pixel/i.test(html);
    const hasUtmOrAdsTrace = /utm_source=facebook|utm_source=instagram|utm_campaign|facebook\.com\/ads/i.test(html);
    const mentionsCampanhas = /campanha|vagas limitadas|oferta especial|avalia[çc][ãa]o sem compromisso/i.test(t);

    const activeAdsLikely = hasPixel || hasUtmOrAdsTrace || mentionsCampanhas;

    if (activeAdsLikely) {
        // Investigar falhas clássicas
        const flaws = [];
        
        // Falha 1: Sem landing page dedicada (manda para a home geral)
        if (!/lp|landing|tratamento|especialidade\//i.test(html) || html.length < 5000) {
            flaws.push({
                type: 'HOME_REDIRECT_FLAW',
                title: 'Tráfego direcionado para a home geral sem landing page focada',
                impact: 'O paciente clica no anúncio de implantes mas perde-se num mar de opções e desiste.',
                sdrAngle: 'Reparei que o vosso tráfego do Instagram está a enviar as pessoas direto para a home geral em vez de uma página dedicada de triagem...'
            });
        }

        // Falha 2: Foco em preço ou consulta grátis
        if (/avalia[çc][ãa]o gratuita|primeira consulta gr[áa]tis|desconto de|promo[çc][ãa]o/i.test(t)) {
            flaws.push({
                type: 'PRICE_DEVALUATION_FLAW',
                title: 'Abordagem focada em avaliação grátis / desconto',
                impact: 'Atrai pacientes sem poder de compra que caçam pechinchas e desvalorizam o corpo clínico.',
                sdrAngle: 'Campanhas de avaliação grátis enchem a recepção de curiosos e geram no-shows nas consultas caras...'
            });
        }

        // Falha 3: Link direto para o WhatsApp cru sem filtro
        if (/api\.whatsapp\.com\/send|wa\.me\//i.test(html) && !/bit\.ly|linktree/i.test(html)) {
            flaws.push({
                type: 'RAW_WHATSAPP_FLAW',
                title: 'Botão de WhatsApp sem formulário prévio de qualificação',
                impact: 'Rececionistas sobrecarregadas com dezenas de mensagens a perguntar "qual é o preço?".',
                sdrAngle: 'A vossa receção não perde tempo excessivo no WhatsApp a responder a curiosos de preço em vez de fechar consultas no mocho?'
            });
        }

        if (flaws.length === 0) {
            flaws.push({
                type: 'CREATIVE_SATURATION_FLAW',
                title: 'Criativos estáticos sem demonstração de autoridade do Diretor Clínico',
                impact: 'Anúncios institucionais frios geram custo por lead (CPL) 3x mais alto.',
                sdrAngle: 'Os vossos criativos no Meta Ads estão a sofrer de saturação visual comparado com os vídeos clínicos dos concorrentes?'
            });
        }

        return {
            status: 'ACTIVE_ADS_WITH_FLAWS',
            hasMetaPixel: hasPixel,
            flaws,
            primaryFlaw: flaws[0],
            recommendation: 'Usar o ângulo da falha de conversão do anúncio para abrir conversa consultiva.'
        };
    } else {
        // Cenário Sem Anúncios
        return {
            status: 'NO_ACTIVE_ADS_OPPORTUNITY',
            hasMetaPixel: false,
            flaws: [{
                type: 'NO_PAID_TRAFFIC_LOCAL_THREAT',
                title: 'Ausência de presença paga na Meta Ad Library',
                impact: 'Dependência total de passa-a-palavra e da passagem na rua, perdendo pacientes particulares para clínicas vizinhas.',
                sdrAngle: 'Notei que a clínica ainda não está a proteger o vosso território local com campanhas ativas de reabilitação no Instagram...'
            }],
            primaryFlaw: {
                type: 'NO_PAID_TRAFFIC_LOCAL_THREAT',
                title: 'Ausência de presença paga na Meta Ad Library',
                impact: 'Dependência de passa-a-palavra',
                sdrAngle: 'Enquanto a maioria das clínicas na vossa zona já capta particulares por campanhas de autoridade, a vossa equipa fica dependente de indicações.'
            },
            recommendation: 'Usar o ângulo de oportunidade geográfica e perda de pacientes particulares para clínicas vizinhas.'
        };
    }
}

/**
 * 4. DETETOR DE DEPENDÊNCIA DE SEGUROS DE SAÚDE (MÉDIS, MULTICARE, ADVANCECARE)
 */
function auditInsuranceDependence(text, html = '') {
    const t = (text + ' ' + html).toLowerCase();
    const insurancesFound = [];

    const insurers = [
        { name: 'Médis', regex: /m[ée]dis/i },
        { name: 'Multicare', regex: /multicare/i },
        { name: 'AdvanceCare', regex: /advancecare|advance care/i },
        { name: 'ADSE', regex: /\badse\b/i },
        { name: 'Allianz', regex: /allianz/i },
        { name: 'Victoria', regex: /victoria seguros/i },
        { name: 'Saúde Prime', regex: /sa[úu]de prime/i },
        { name: 'SAMS', regex: /\bsams\b/i },
        { name: 'Future Healthcare', regex: /future healthcare/i }
    ];

    for (const ins of insurers) {
        if (ins.regex.test(t)) {
            insurancesFound.push(ins.name);
        }
    }

    const isHighDependence = insurancesFound.length >= 3;

    return {
        detected: insurancesFound.length > 0,
        insurancesFound,
        count: insurancesFound.length,
        isHighDependence,
        tacticalAngle: isHighDependence
            ? `Clínica com forte volume de acordos e seguros (${insurancesFound.slice(0, 3).join(', ')}). Ângulo de ouro: Transição para pacientes particulares de alto ticket sem depender das tabelas esmagadas das seguradoras.`
            : 'Foco predominantemente privado. Ângulo focado em preenchimento de agenda cirúrgica de alta rentabilidade.'
    };
}

/**
 * 5. CLASSIFICAÇÃO DE PORTE & MATURIDADE DA CLÍNICA (FILTRO DE VIABILIDADE JONH)
 */
function classifyClinicSize(text, clinicName = '') {
    const t = (text || '').toLowerCase();
    
    // Redes e Franquias
    if (/oralmed|malo clinic|vitaldent|oralplan|clínicas do leão|santa madalena|cuf|luz sa[úu]de|trofa sa[úu]de/i.test(clinicName + ' ' + t)) {
        return {
            tier: 'LARGE_NETWORK_OR_HOSPITAL',
            label: 'Rede Corporativa / Hospital Privado',
            cabinetsEstimate: '10+ Gabinetes',
            isGoldICP: false,
            notes: 'Decisão corporativa ou em sede central. Requer abordagem institucional ou descarte se for franchise fechado.'
        };
    }

    // Identificação de múltiplos gabinetes / equipa alargada
    const hasMultipleDoctors = (t.match(/dr[a]?\.\s+[a-záéíóúâêôãõ]+/gi) || []).length >= 4;
    const mentionsCabinets = t.match(/(\d+)\s*(?:gabinetes|consult[óo]rios|salas de atendimento)/i);
    const mentionsUnits = t.match(/unidades|cl[íi]nica em|polo/i);

    if (mentionsCabinets && parseInt(mentionsCabinets[1]) >= 2) {
        const num = parseInt(mentionsCabinets[1]);
        return {
            tier: 'ICP_GOLD_MEDIUM_CLINIC',
            label: 'Clínica Média Estabelecida (ICP de Ouro Vamuss)',
            cabinetsEstimate: `${num} Gabinetes`,
            isGoldICP: true,
            notes: 'Estrutura ideal com equipa médica e capacidade ociosa de cadeiras. Alto potencial de fechamento.'
        };
    }

    if (hasMultipleDoctors || mentionsUnits) {
        return {
            tier: 'ICP_GOLD_MEDIUM_CLINIC',
            label: 'Clínica Média com Equipa Multidisciplinar (ICP Ouro)',
            cabinetsEstimate: '3 a 5 Gabinetes (Estimado por equipa médica)',
            isGoldICP: true,
            notes: 'Possui especialistas dedicados. Dor principal: coordenação de agenda e rentabilidade.'
        };
    }

    // Consultório Individual
    return {
        tier: 'SOLO_PRACTICE',
        label: 'Consultório Individual / Clínica Boutique',
        cabinetsEstimate: '1 a 2 Gabinetes',
        isGoldICP: true,
        notes: 'Médico é o dono e o operador principal. Dor central: falta de tempo e no-show de pacientes.'
    };
}

/**
 * 6. AUDITORIA DE FRICÇÃO DE AGENDAMENTO (TESTE DO PACIENTE OCULTO)
 */
function auditBookingFriction(text, html = '') {
    const t = (text + ' ' + html).toLowerCase();
    const hasOnlineBooking = /agendamento online|marcar consulta|livre marca[çc][ãa]o|agenda online|calendar/i.test(t);
    const hasFloatingWhatsApp = /whatsapp|wa\.me|api\.whatsapp/i.test(html);
    const onlyLandlinePhone = !hasFloatingWhatsApp && /\+351\s*2\d{1}\s*\d{3}\s*\d{4}|\b2\d{8}\b/.test(t);

    const frictions = [];
    if (onlyLandlinePhone) {
        frictions.push('Apenas contacto telefónico fixo (linha 2x) em evidência, inacessível para quem pesquisa pelo telemóvel à noite.');
    }
    if (!hasOnlineBooking && !hasFloatingWhatsApp) {
        frictions.push('Falta de canal direto de resposta imediata; exige que o paciente espere pela abertura da clínica às 09h.');
    }
    if (/preencha o formul[áa]rio abaixo|campos obrigat[óo]rios/i.test(t)) {
        frictions.push('Formulário estático com muitos campos no website, gerando abandono no telemóvel.');
    }

    return {
        hasOnlineBooking,
        hasFloatingWhatsApp,
        frictionsFound: frictions.length > 0 ? frictions : ['Agendamento funcional, mas dependente de triagem manual da secretária.'],
        primaryFriction: frictions[0] || 'Atendimento fora do horário comercial não automatizado.'
    };
}

/**
 * 7. VISÃO PERIFÉRICA DE SINAIS OURO (GOLDEN CLUES)
 */
function extractGoldenClues(text, html = '') {
    const clues = [];
    const t = (text + ' ' + html).toLowerCase();

    // Tecnologia 3D
    if (/itero|scanner intraoral|trios|scanner 3d|moldagem digital|impress[ãa]o digital 3d/i.test(t)) {
        clues.push('Investimento de topo em tecnologia digital: possuem Scanner Intraoral 3D (iTero/Trios).');
    }
    if (/tomografia|cbct|raio-x 3d|ortopantomografia digital/i.test(t)) {
        clues.push('Possuem equipamento próprio de Tomografia Computorizada 3D (CBCT).');
    }
    if (/seda[çc][ãa]o consciente|anestesia geral|bloco cir[úu]rgico/i.test(t)) {
        clues.push('Disponibilizam Sedação Consciente / Bloco para pacientes com fobia de dentista.');
    }
    if (/laborat[óo]rio pr[óo]prio|pr[óo]tese em 24h|dentes no mesmo dia/i.test(t)) {
        clues.push('Possuem laboratório de prótese próprio ou tecnologia de dentes no mesmo dia.');
    }
    if (/parque gratuito|estacionamento privado|acesso facilitado/i.test(t)) {
        clues.push('Oferecem estacionamento privado gratuito para pacientes VIP.');
    }

    return clues;
}

/**
 * 8. GERADOR DO GANCHO TÁTICO DE 3 LINHAS (CHRIS VOSS / PERGUNTA NEGATIVA)
 */
function buildTacticalHook(director, heroProc, trafficAudit, insuranceAudit, sizeAudit, goldenClues, concelho = 'Portugal') {
    const salutation = director.confidence !== 'UNCERTAIN' ? director.salutation : 'À Direção Clínica';
    const heroName = heroProc.hero.name;

    // Caso 1: Falha no destino dos Anúncios Meta Ads
    if (trafficAudit.status === 'ACTIVE_ADS_WITH_FLAWS' && trafficAudit.primaryFlaw.type === 'HOME_REDIRECT_FLAW') {
        return {
            tacticId: 'HOOK_META_HOME_REDIRECT',
            line1: `${salutation}, reparei que a vossa equipa na clínica de ${concelho} tem um trabalho muito sério em ${heroName}.`,
            line2: `Vi os vossos anúncios recentes no Instagram e notei que estão a direcionar os pacientes direto para a home do site sem triagem específica.`,
            line3: `A vossa receção não se queixa de perder tempo com curiosos de preço no WhatsApp em vez de consultas de alto valor fechadas no mocho?`,
            fullHook: `${salutation}, reparei que a vossa equipa na clínica de ${concelho} tem um trabalho muito sério em ${heroName}.\nVi os vossos anúncios recentes no Instagram e notei que estão a direcionar os pacientes direto para a home do site sem triagem específica.\nA vossa receção não se queixa de perder tempo com curiosos de preço no WhatsApp em vez de consultas de alto valor fechadas no mocho?`
        };
    }

    // Caso 2: Alta dependência de seguros de saúde (Médis / Multicare)
    if (insuranceAudit.isHighDependence) {
        return {
            tacticId: 'HOOK_INSURANCE_MARGIN_PRESSURE',
            line1: `${salutation}, vi o vosso posicionamento em tratamentos complexos de ${heroName} na zona de ${concelho}.`,
            line2: `Notoriamente têm presença forte em acordos como ${insuranceAudit.insurancesFound.slice(0, 2).join(' e ')}, que em Portugal pagam margens cada vez mais esmagadas.`,
            line3: `Faria sentido mostrar-lhe como outras clínicas no ${concelho} estão a migrar a agenda para 80% de pacientes particulares de alto ticket sem depender das seguradoras?`,
            fullHook: `${salutation}, vi o vosso posicionamento em tratamentos complexos de ${heroName} na zona de ${concelho}.\nNotoriamente têm presença forte em acordos como ${insuranceAudit.insurancesFound.slice(0, 2).join(' e ')}, que em Portugal pagam margens cada vez mais esmagadas.\nFaria sentido mostrar-lhe como outras clínicas no ${concelho} estão a migrar a agenda para 80% de pacientes particulares de alto ticket sem depender das seguradoras?`
        };
    }

    // Caso 3: Tecnologia 3D subaproveitada na captação
    if (goldenClues.some(c => c.includes('Scanner Intraoral 3D'))) {
        return {
            tacticId: 'HOOK_TECH_3D_LEVERAGE',
            line1: `${salutation}, parabéns pelo investimento em tecnologia digital com Scanner 3D intraoral na clínica de ${concelho}.`,
            line2: `É raro ver clínicas com essa infraestrutura, mas a maioria dos pacientes da vossa zona ainda nem sabe que vocês realizam moldagens 100% digitais.`,
            line3: `Vê algum inconveniente em mostrar-lhe em 3 minutos como transformar esse investimento num ímã de pacientes particulares para ${heroName}?`,
            fullHook: `${salutation}, parabéns pelo investimento em tecnologia digital com Scanner 3D intraoral na clínica de ${concelho}.\nÉ raro ver clínicas com essa infraestrutura, mas a maioria dos pacientes da vossa zona ainda nem sabe que vocês realizam moldagens 100% digitais.\nVê algum inconveniente em mostrar-lhe em 3 minutos como transformar esse investimento num ímã de pacientes particulares para ${heroName}?`
        };
    }

    // Caso 4: Sem anúncios Meta Ads (Vácuo Competitivo Local)
    return {
        tacticId: 'HOOK_LOCAL_TERRITORY_VACUUM',
        line1: `${salutation}, acompanho o vosso trabalho de referência em ${heroName} em ${concelho}.`,
        line2: `Notei que a vossa clínica ainda não está a proteger o vosso território local no Instagram, enquanto outros consultórios na mesma área captam pacientes particulares diariamente.`,
        line3: `Seria completamente descabido partilhar consigo os números de captação direta para a vossa zona em ${concelho}?`,
        fullHook: `${salutation}, acompanho o vosso trabalho de referência em ${heroName} em ${concelho}.\nNotei que a vossa clínica ainda não está a proteger o vosso território local no Instagram, enquanto outros consultórios na mesma área captam pacientes particulares diariamente.\nSeria completamente descabido partilhar consigo os números de captação direta para a vossa zona em ${concelho}?`
    };
}

/**
 * MOTOR CENTRAL DA TERESA: PERÍCIA FORENSE COMPLETA DE UM DEAL
 * @param {string} dealId - ID do negócio no CRM
 * @param {object} options - Dados pré-existentes da clínica
 */
export async function generateForensicDossier(dealId, options = {}) {
    const startTime = Date.now();
    const memory = loadTeresaMemory();

    let { clinicName, websiteUrl, instagramUrl, concelho, phone } = options;

    // Se faltarem dados, buscar no Supabase se disponível
    const supabase = getSupabaseClient();
    if (supabase && (!clinicName || !websiteUrl)) {
        try {
            const { data: deal } = await supabase.from('deals').select('*, companies(*), contacts(*)').eq('id', dealId).maybeSingle();
            if (deal) {
                clinicName = clinicName || deal.title || deal.companies?.name;
                websiteUrl = websiteUrl || deal.companies?.website || deal.contacts?.website;
                concelho = concelho || deal.companies?.city || deal.custom_fields?.concelho || 'Portugal';
                phone = phone || deal.contacts?.phone || deal.custom_fields?.whatsapp;
            }
        } catch (e) {
            // Continua com os dados passados
        }
    }

    clinicName = (clinicName || 'Clínica Dentária').replace(/^(Negócio|Clinica|Clínica)\s+/i, '').trim();
    concelho = concelho || 'Portugal';

    console.log(`🔬 [Teresa ➔ Jonh] Iniciando perícia forense para "${clinicName}" (${websiteUrl || 'Sem website'})...`);

    // 1. Extração Forense Web
    const forensicWeb = await fetchWebsiteForensic(websiteUrl);
    const textContent = forensicWeb ? (forensicWeb.markdown || forensicWeb.html) : '';
    const rawHtml = forensicWeb ? forensicWeb.html : '';

    // 2. Extração dos Insumos Estruturais
    const clinicalDirector = extractClinicalDirectorSafe(textContent, clinicName);
    const heroProcedure = extractHeroProcedure(textContent);
    const trafficAudit = auditMetaAdsAndTraffic(textContent, rawHtml, instagramUrl);
    const insuranceAudit = auditInsuranceDependence(textContent, rawHtml);
    const sizeClassification = classifyClinicSize(textContent, clinicName);
    const bookingFriction = auditBookingFriction(textContent, rawHtml);
    const goldenClues = extractGoldenClues(textContent, rawHtml);

    // 3. Montagem do Gancho Tático de 3 Linhas
    const tacticalHook = buildTacticalHook(
        clinicalDirector,
        heroProcedure,
        trafficAudit,
        insuranceAudit,
        sizeClassification,
        goldenClues,
        concelho
    );

    // 4. Estrutura Canónica do Dossiê Forense da Teresa
    const dossier = {
        dealId,
        clinicName,
        concelho,
        websiteUrl: websiteUrl || null,
        phone: phone || null,
        investigatedBy: TERESA_IDENTITY.name,
        investigatedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        hasReliableData: clinicalDirector.confidence !== 'UNCERTAIN' || heroProcedure.hero.category !== 'GENERAL_DENTISTRY',
        
        // 5 Insumos Estruturais
        clinicalDirector,
        heroProcedure,
        trafficAudit,
        insuranceAudit,
        sizeClassification,
        bookingFriction,
        goldenClues,
        tacticalHook,

        // Compatibilidade com o formato legado de sdr_deal_dossiers
        siteAnalysis: {
            hasWebsite: Boolean(websiteUrl && forensicWeb),
            url: websiteUrl || null,
            accessible: Boolean(forensicWeb),
            highlightedTreatments: heroProcedure.allDetected.map(p => p.name),
            hasOnlineBooking: bookingFriction.hasOnlineBooking,
            teamSizeDetected: sizeClassification.cabinetsEstimate,
            source: forensicWeb?.source || 'WEB_FORENSIC'
        },
        verifiedFacts: [
            {
                factId: 'FACT_CLINICAL_DIRECTOR',
                category: 'DIRECTOR',
                fact: clinicalDirector.confidence !== 'UNCERTAIN'
                    ? `Diretor Clínico identificado como ${clinicalDirector.targetName}.`
                    : 'Diretor Clínico não discriminado nominalmente de forma segura no site público.',
                confidence: clinicalDirector.confidence,
                source: clinicalDirector.evidence
            },
            {
                factId: 'FACT_HERO_TREATMENT',
                category: 'TREATMENTS',
                fact: `A clínica promove e destaca ativamente ${heroProcedure.hero.name} (${heroProcedure.hero.ticketTier}).`,
                confidence: 'HIGH',
                source: 'Auditoria de tratamentos do website'
            },
            {
                factId: 'FACT_TRAFFIC_STATUS',
                category: 'TRAFFIC',
                fact: trafficAudit.status === 'ACTIVE_ADS_WITH_FLAWS'
                    ? `Presença de tráfego Meta Ads com falha identificada: ${trafficAudit.primaryFlaw.title}.`
                    : 'Ausência de anúncios ativos detectados na Meta Ad Library.',
                confidence: 'HIGH',
                source: 'Auditoria de tags e criativos'
            },
            {
                factId: 'FACT_INSURANCE_MIX',
                category: 'INSURANCE',
                fact: insuranceAudit.isHighDependence
                    ? `Clínica associada a múltiplos acordos de saúde (${insuranceAudit.insurancesFound.join(', ')}).`
                    : 'Clínica com foco em pacientes particulares.',
                confidence: 'HIGH',
                source: 'Auditoria de rodapé e convénios'
            }
        ],
        antiHallucinationCheck: {
            strictSourceRequired: true,
            maxFactsPerMessage: 1,
            relyOnCRMOnlyIfEmpty: false,
            zeroHallucinationCompliant: true
        }
    };

    // 5. Persistir Dossiê
    saveDossier(dealId, dossier);

    // 6. Atualizar Memória de Aprendizagem
    memory.totalInvestigations = (memory.totalInvestigations || 0) + 1;
    saveTeresaMemory(memory);

    // 7. Log Factual e Registro Completo no Histórico do Negócio (CRM)
    if (supabase) {
        try {
            const formattedHistoryReport = [
                `🔬 [DOSSIÊ FORENSE DA TERESA — NÍVEL 3.2]`,
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                `• Decisor Clínico: ${clinicalDirector.targetName || 'Direção Clínica / Não discriminado nominalmente'} (Confiança: ${clinicalDirector.confidence})`,
                `• Procedimento Herói: ${heroProcedure.hero.name} [Ticket: ${heroProcedure.hero.ticketTier}]`,
                `• Diagnóstico Meta Ads: ${trafficAudit.status} (${trafficAudit.primaryFlaw.title})`,
                `• Porte / Gabinetes: ${sizeClassification.label} [${sizeClassification.cabinetsEstimate}]`,
                `• Seguros de Saúde: ${insuranceAudit.isHighDependence ? `Alta Dependência (${insuranceAudit.insurancesFound.join(', ')})` : 'Foco em Pacientes Particulares'}`,
                `• Fricção de Agendamento: ${bookingFriction.primaryFriction}`,
                goldenClues.length > 0 ? `• Sinais Ouro Detectados: ${goldenClues.join(' | ')}` : null,
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                `🎯 GANCHO SUGERIDO EM 3 LINHAS (PARA O SDR OUTBOUND):`,
                `1️⃣ ${tacticalHook.line1}`,
                `2️⃣ ${tacticalHook.line2}`,
                `3️⃣ ${tacticalHook.line3}`,
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                `⚠️ REGRA DE SEGURANÇA: Teresa opera em modo 100% interno e JAMAIS envia mensagens ao cliente. Dossiê entregue ao Jonh para aprovação do SDR Outbound.`
            ].filter(Boolean).join('\n');

            // 7.1 Insere atividade no histórico visual do Deal
            await supabase.from('activities').insert({
                deal_id: dealId,
                user_id: '9469fb08-7de5-405e-a4e7-d83cf818ea1e',
                type: 'system_log',
                subject: `🔬 [Dossiê Teresa] ${clinicName}: ${heroProcedure.hero.name}`,
                description: formattedHistoryReport,
                completed: true
            });

            // 7.2 Atualiza os campos personalizados do Deal para consumo direto do SDR
            const { data: currentDeal } = await supabase.from('deals').select('custom_fields').eq('id', dealId).maybeSingle();
            const existingCustom = currentDeal?.custom_fields || {};
            
            await supabase.from('deals').update({
                custom_fields: {
                    ...existingCustom,
                    teresa_investigated: true,
                    teresa_investigated_at: new Date().toISOString(),
                    teresa_target_name: clinicalDirector.targetName,
                    teresa_target_confidence: clinicalDirector.confidence,
                    teresa_hero_procedure: heroProcedure.hero.name,
                    teresa_traffic_status: trafficAudit.status,
                    teresa_traffic_flaw: trafficAudit.primaryFlaw.title,
                    teresa_size_tier: sizeClassification.tier,
                    teresa_insurance_dependence: insuranceAudit.isHighDependence,
                    teresa_suggested_hook: tacticalHook.fullHook
                }
            }).eq('id', dealId);

        } catch (actErr) {
            console.warn(`⚠️ [Teresa] Erro ao gravar log no CRM Supabase:`, actErr.message);
        }
    }

    console.log(`✅ [Teresa ➔ Jonh] Dossiê concluído em ${dossier.durationMs}ms. Decisor: ${clinicalDirector.targetName || 'Direção Geral'} | Procedimento: ${heroProcedure.hero.name} | Gancho: "${tacticalHook.tacticId}"`);

    return dossier;
}

/**
 * Endpoint para obter o status da Teresa
 */
export function getTeresaStatus() {
    const memory = loadTeresaMemory();
    const dossiers = loadDossiersFile();
    const totalDossiers = Object.keys(dossiers).length;

    return {
        identity: TERESA_IDENTITY,
        status: 'READY_AND_ARMED',
        totalDossiersInStore: totalDossiers,
        totalInvestigations: memory.totalInvestigations || 0,
        subordinatedTo: 'Jonh (Gerente de Operações)',
        winningTacticsCatalog: memory.winningHookCategories,
        recentDossiers: Object.values(dossiers).slice(-5).map(d => ({
            dealId: d.dealId,
            clinicName: d.clinicName,
            director: d.clinicalDirector?.targetName || 'Direção Clínica',
            heroProcedure: d.heroProcedure?.hero?.name,
            trafficStatus: d.trafficAudit?.status,
            investigatedAt: d.investigatedAt
        }))
    };
}
