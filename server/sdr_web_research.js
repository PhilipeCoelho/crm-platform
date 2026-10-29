/**
 * ============================================================================
 * VAMUSS SDR + CLOSER — MOTOR DE PESQUISA WEB E DOSSIÊ CLÍNICO (B.15.1)
 * ============================================================================
 * Realiza a prospeção e pesquisa factual da clínica antes da primeira abordagem.
 * 
 * Funcionalidades:
 * 1. Leitura de website: home page e páginas de serviços (tratamentos, gabinetes,
 *    marcação online, equipa médica).
 * 2. Pesquisa de presença web e Google Meu Negócio (avaliações, nota média).
 * 3. Teste simples de visibilidade no concelho ("implantes dentários [concelho]").
 * 4. Geração de dossiê estruturado com fontes comprovadas e expiração de 30 dias.
 * 5. Barreira anti-alucinação: apenas factos rastreáveis e verificados.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { extractClinicalDecisionMaker } from './sdr_decisor.js';

const DOSSIERS_FILE = path.resolve(process.cwd(), 'data', 'sdr_deal_dossiers.json');
const DOSSIER_EXPIRATION_DAYS = 30;

/**
 * Lê o repositório local de dossiês
 */
export function readDossiersStore() {
    try {
        if (!fs.existsSync(DOSSIERS_FILE)) {
            const dir = path.dirname(DOSSIERS_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(DOSSIERS_FILE, JSON.stringify({}, null, 2), 'utf8');
            return {};
        }
        return JSON.parse(fs.readFileSync(DOSSIERS_FILE, 'utf8'));
    } catch {
        return {};
    }
}

/**
 * Guarda o dossiê atualizado de uma clínica
 */
export function saveDossierToStore(dealId, dossier) {
    try {
        const store = readDossiersStore();
        store[dealId] = {
            ...dossier,
            savedAt: new Date().toISOString()
        };
        fs.writeFileSync(DOSSIERS_FILE, JSON.stringify(store, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.warn('⚠️ [Web Research] Erro ao gravar dossiê:', e.message);
        return false;
    }
}

/**
 * Recupera o dossiê se existir e tiver menos de 30 dias
 */
export function getValidDossier(dealId) {
    const store = readDossiersStore();
    const dossier = store[dealId];
    if (!dossier) return null;

    const researchedAt = new Date(dossier.researchedAt || dossier.savedAt || 0).getTime();
    const daysOld = (Date.now() - researchedAt) / (1000 * 60 * 60 * 24);

    if (daysOld > DOSSIER_EXPIRATION_DAYS) {
        console.log(`ℹ️ [Web Research] Dossiê do deal ${dealId} expirou (${daysOld.toFixed(1)} dias). Necessária nova pesquisa.`);
        return null;
    }

    return dossier;
}

/**
 * Sanitiza URL
 */
function normalizeUrl(rawUrl) {
    if (!rawUrl) return null;
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    try {
        const parsed = new URL(url);
        return parsed.href;
    } catch {
        return null;
    }
}

/**
 * Descarrega o HTML de uma página web com timeout e proteção
 */
async function fetchPageHtml(url, timeoutMs = 7000) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 VamussResearch/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8'
            }
        });
        clearTimeout(timeout);

        if (!res.ok) return null;
        const html = await res.text();
        return html;
    } catch (err) {
        return null;
    }
}

/**
 * Extrai texto simples de blocos de HTML sem tags
 */
function stripHtmlTags(html) {
    if (!html) return '';
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Analisa o website da clínica e extrai tratamentos e dados de negócio
 */
export async function analyzeClinicWebsite(websiteUrl) {
    const normUrl = normalizeUrl(websiteUrl);
    if (!normUrl) {
        return { hasWebsite: false, reason: 'URL inválido ou não fornecido' };
    }

    const homeHtml = await fetchPageHtml(normUrl);
    if (!homeHtml) {
        return { hasWebsite: true, url: normUrl, accessible: false, reason: 'Website inacessível ou timeout' };
    }

    const homeText = stripHtmlTags(homeHtml).toLowerCase();

    // Páginas comuns de tratamentos/especialidades para aprofundar se existirem links
    const serviceEndpoints = ['/servicos', '/tratamentos', '/especialidades', '/equipa', '/sobre-nos', '/contactos'];
    let combinedText = homeText;
    let servicesUrlUsed = null;

    for (const ep of serviceEndpoints) {
        try {
            const subUrl = new URL(ep, normUrl).href;
            if (homeHtml.toLowerCase().includes(ep)) {
                const subHtml = await fetchPageHtml(subUrl, 4000);
                if (subHtml) {
                    combinedText += ' ' + stripHtmlTags(subHtml).toLowerCase();
                    servicesUrlUsed = subUrl;
                    break;
                }
            }
        } catch {}
    }

    // Tratamentos em destaque
    const highlightedTreatments = [];
    if (combinedText.includes('implante') || combinedText.includes('implantologia') || combinedText.includes('all-on-4') || combinedText.includes('carga imediata')) {
        highlightedTreatments.push('Implantes Dentários / Implantologia');
    }
    if (combinedText.includes('ortodontia') || combinedText.includes('invisalign') || combinedText.includes('aparelho invisivel') || combinedText.includes('alinhadores')) {
        highlightedTreatments.push('Ortodontia / Alinhadores Invisíveis');
    }
    if (combinedText.includes('estetica') || combinedText.includes('facetas') || combinedText.includes('branqueamento') || combinedText.includes('lentes de contacto')) {
        highlightedTreatments.push('Estética Dental e Facetas');
    }
    if (combinedText.includes('reabilitacao oral') || combinedText.includes('protese')) {
        highlightedTreatments.push('Reabilitação Oral');
    }
    if (combinedText.includes('periodontologia') || combinedText.includes('gengivas')) {
        highlightedTreatments.push('Periodontologia');
    }
    if (combinedText.includes('odontopediatria') || combinedText.includes('criancas')) {
        highlightedTreatments.push('Odontopediatria');
    }

    // Marcação online
    const hasOnlineBooking = (
        combinedText.includes('marcar consulta') ||
        combinedText.includes('agendar consulta') ||
        combinedText.includes('marcacao online') ||
        combinedText.includes('agendamento online') ||
        combinedText.includes('marcação') ||
        homeHtml.includes('calendly') ||
        homeHtml.includes('cal.com') ||
        homeHtml.includes('whatsapp')
    );

    // Contagem de gabinetes / equipa clínica (se mencionado)
    let teamSizeDetected = null;
    const teamMatch = combinedText.match(/(\d+)\s*(médicos|dentistas|especialistas|gabinetes|consultorios)/i);
    if (teamMatch) {
        teamSizeDetected = `${teamMatch[1]} ${teamMatch[2]}`;
    }

    return {
        hasWebsite: true,
        url: normUrl,
        accessible: true,
        highlightedTreatments,
        hasOnlineBooking,
        teamSizeDetected,
        rawContent: combinedText + ' ' + homeHtml,
        servicesSourceUrl: servicesUrlUsed || normUrl,
        extractedAt: new Date().toISOString()
    };
}

/**
 * Realiza pesquisa de visibilidade local no Google / Web
 * Verifica se a clínica aparece nos resultados orgânicos ou mapa para o concelho
 */
export async function testLocalSearchVisibility(clinicName, concelho) {
    const cleanClinic = (clinicName || '').replace(/^Negócio\s+/i, '').replace(/\|.*/, '').trim();
    const cleanConcelho = (concelho || '').trim();

    if (!cleanClinic) {
        return {
            checked: false,
            reason: 'Nome da clínica ausente'
        };
    }

    const searchQueries = [
        `implantes dentários ${cleanConcelho || 'Portugal'}`,
        `clínica dentária ${cleanConcelho || 'Portugal'}`
    ];

    let appearsInTopResults = false;
    let ratingFound = null;
    let reviewCountFound = null;
    let searchSource = 'Pesquisa Web e Diretórios';

    try {
        // Pesquisa pública via endpoint HTML do DuckDuckGo para verificação orgânica
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${cleanClinic}" ${cleanConcelho} dentista avaliacoes`)}`;
        const searchHtml = await fetchPageHtml(searchUrl, 5000);

        if (searchHtml) {
            const lowerHtml = searchHtml.toLowerCase();
            const lowerClinic = cleanClinic.toLowerCase();

            // Avaliações Google / diretórios (ex: 4.8 estrelas, 35 avaliações)
            const ratingMatch = searchHtml.match(/([45]\.[0-9])\s*(\/5|estrelas|classificação|\()/i);
            if (ratingMatch) {
                ratingFound = parseFloat(ratingMatch[1]);
            }
            const reviewsMatch = searchHtml.match(/(\d+)\s*(avaliações|comentários|classificações|reviews)/i);
            if (reviewsMatch) {
                reviewCountFound = parseInt(reviewsMatch[1], 10);
            }

            // Pesquisa de visibilidade para a query concelhia
            const genericQueryUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`implantes dentarios ${cleanConcelho}`)}`;
            const genericHtml = await fetchPageHtml(genericQueryUrl, 5000);
            if (genericHtml) {
                const genericLower = genericHtml.toLowerCase();
                if (genericLower.includes(lowerClinic)) {
                    appearsInTopResults = true;
                }
            }
        }
    } catch (e) {
        console.warn('⚠️ [Web Research] Aviso ao efetuar consulta de pesquisa:', e.message);
    }

    return {
        checked: true,
        clinicName: cleanClinic,
        concelho: cleanConcelho,
        searchQueries,
        appearsInTopOrganic: appearsInTopResults,
        rating: ratingFound || null,
        reviewCount: reviewCountFound || null,
        source: searchSource,
        extractedAt: new Date().toISOString()
    };
}

/**
 * Constrói o dossiê factual estruturado da clínica
 * Regra anti-alucinação: Apenas factos com fonte explícita e rastreável
 */
export async function generateClinicDossier({ dealId, clinicName, concelho, websiteUrl, lostReason }) {
    // 1. Verifica se já existe dossiê válido em cache (< 30 dias)
    const existing = getValidDossier(dealId);
    if (existing) {
        console.log(`✅ [Web Research] Dossiê em cache reaproveitado para Deal ${dealId} (${existing.clinicName})`);
        return existing;
    }

    console.log(`🔍 [Web Research] Iniciando pesquisa factual para "${clinicName}" (${concelho || 'concelho não especificado'})...`);

    // 2. Análise do website (se fornecido)
    const siteData = await analyzeClinicWebsite(websiteUrl);

    // 3. Teste de visibilidade e avaliações web
    const visibilityData = await testLocalSearchVisibility(clinicName, concelho);

    // 3.5. Extração do Decisor Clínico (sdr_decisor.js)
    let decisionMaker = { found: false, confianca: 0.0, salutacao_recomendada: `Bom dia, equipa da ${clinicName},` };
    if (siteData.hasWebsite && siteData.rawContent) {
        decisionMaker = extractClinicalDecisionMaker(siteData.rawContent, siteData.url, clinicName);
    }

    // 4. Compilação estrita de Factos Verificados (anti-alucinação)
    const verifiedFacts = [];

    // Facto 0: Diretor Clínico Verificado (Confiança >= 0.7)
    if (decisionMaker.found && decisionMaker.confianca >= 0.7) {
        verifiedFacts.push({
            factId: 'FACT_CLINICAL_DIRECTOR',
            category: 'DECISOR',
            fact: `A direção clínica da clínica é assumida por ${decisionMaker.nome_completo_com_titulo}.`,
            source: `Website da clínica (${decisionMaker.fonte_url || siteData.url})`,
            confidence: 'HIGH'
        });
    }

    // Facto 1: Tratamentos destacados no website
    if (siteData.hasWebsite && siteData.accessible && siteData.highlightedTreatments?.length > 0) {
        verifiedFacts.push({
            factId: 'FACT_SITE_TREATMENTS',
            category: 'TREATMENTS',
            fact: `A clínica promove e destaca no seu website tratamentos de ${siteData.highlightedTreatments.slice(0, 2).join(' e ')}.`,
            source: `Website da clínica (${siteData.servicesSourceUrl || siteData.url})`,
            confidence: 'HIGH'
        });
    }

    // Facto 2: Agendamento / Marcação
    if (siteData.hasWebsite && siteData.accessible && siteData.hasOnlineBooking) {
        verifiedFacts.push({
            factId: 'FACT_SITE_BOOKING',
            category: 'BOOKING',
            fact: `A clínica disponibiliza canais diretos de marcação/agendamento online para primeiras consultas.`,
            source: `Website da clínica (${siteData.url})`,
            confidence: 'HIGH'
        });
    }

    // Facto 3: Equipa / Gabinetes identificados
    if (siteData.teamSizeDetected) {
        verifiedFacts.push({
            factId: 'FACT_TEAM_SIZE',
            category: 'STRUCTURE',
            fact: `O website identifica uma estrutura com ${siteData.teamSizeDetected}.`,
            source: `Website da clínica (${siteData.url})`,
            confidence: 'MEDIUM'
        });
    }

    // Facto 4: Avaliações e Reputação Google
    if (visibilityData.rating && visibilityData.reviewCount) {
        verifiedFacts.push({
            factId: 'FACT_GOOGLE_REPUTATION',
            category: 'REPUTATION',
            fact: `A clínica possui uma reputação pública forte com classificação de ${visibilityData.rating} estrelas em ${visibilityData.reviewCount} avaliações.`,
            source: 'Presença no Google / Diretórios Médicos',
            confidence: 'HIGH'
        });
    }

    // Facto 5: Visibilidade Orgânica em Implantes no Concelho
    if (visibilityData.checked && cleanConcelho(concelho)) {
        if (!visibilityData.appearsInTopOrganic) {
            verifiedFacts.push({
                factId: 'FACT_LOCAL_SEARCH_GAP',
                category: 'VISIBILITY',
                fact: `A clínica não surge na primeira página dos resultados diretos de pesquisa orgânica para "implantes dentários ${concelho}".`,
                source: `Pesquisa pública de termos de valor em ${concelho}`,
                confidence: 'MEDIUM'
            });
        } else {
            verifiedFacts.push({
                factId: 'FACT_LOCAL_SEARCH_LEADER',
                category: 'VISIBILITY',
                fact: `A clínica tem boa visibilidade orgânica posicionando-se nos resultados para pesquisas de medicina dentária em ${concelho}.`,
                source: `Pesquisa pública de termos de valor em ${concelho}`,
                confidence: 'HIGH'
            });
        }
    }

    const dossier = {
        dealId,
        clinicName,
        concelho: concelho || null,
        researchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + DOSSIER_EXPIRATION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        hasReliableData: verifiedFacts.length > 0,
        decisionMaker,
        siteAnalysis: siteData,
        visibilityAnalysis: visibilityData,
        verifiedFacts,
        antiHallucinationCheck: {
            strictSourceRequired: true,
            maxFactsPerMessage: 1,
            relyOnCRMOnlyIfEmpty: verifiedFacts.length === 0
        }
    };

    saveDossierToStore(dealId, dossier);
    console.log(`✅ [Web Research] Dossiê gerado com sucesso: ${verifiedFacts.length} factos verificados.`);
    return dossier;
}

function cleanConcelho(c) {
    if (!c) return '';
    return c.trim();
}
