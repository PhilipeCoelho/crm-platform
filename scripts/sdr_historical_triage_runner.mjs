import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizePhone, normalizeEmail, createSuppressionRecord, deduplicateSuppressionList } from './sdr_suppression_engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const INPUT_FILE = path.join(ROOT_DIR, 'data', 'sdr_reactivation_simulation_fase_a3_405_deals.json');
const OUTPUT_FILE = path.join(ROOT_DIR, 'data', 'sdr_suppression_historical_triage_405.json');

function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Motor de classificação factual da evidência histórica do CRM
 */
export function classifyHistoricalEvidence(dealRecord) {
    const { identificacao = {}, interpretacao_comercial = {} } = dealRecord;
    const rawReason = (identificacao.motivo_perda_registrado || '').trim();
    const reasonNorm = normalizeText(rawReason);
    
    const rawDetail = (interpretacao_comercial.detalhe_resposta || '').trim();
    const detailNorm = normalizeText(rawDetail);

    const objections = (interpretacao_comercial.objecoes_ou_motivos_perda_identificados || []).join(' ');
    const objectionsNorm = normalizeText(objections);

    const combinedAll = `${reasonNorm} ${detailNorm} ${objectionsNorm}`;

    // 1. OPTOUT_EXPLICITO (Pedido formal de não contacto / oposição - Art. 13º DL 7/2004)
    // Usamos expressões completas para evitar falsos positivos (ex: "processos de clínicas")
    const isOptout = 
        combinedAll.includes('nao ligar mais') ||
        combinedAll.includes('nao voltar a contactar') ||
        combinedAll.includes('remover da lista') ||
        combinedAll.includes('remover da vossa lista') ||
        combinedAll.includes('retirar da lista') ||
        combinedAll.includes('pediu para nao ligar') ||
        combinedAll.includes('nao telefonar mais') ||
        combinedAll.includes('processo judicial') ||
        combinedAll.includes('fazer queixa') ||
        combinedAll.includes('bloqueou o numero') ||
        combinedAll.includes('pediu para retirar o numero');

    if (isOptout) {
        return {
            categoria: 'OPTOUT_EXPLICITO',
            evidencia: rawReason || rawDetail || 'Pedido formal de oposição e não contacto',
            bloqueio_sugerido: 'TODOS',
            acao_cadencia: 'bloqueio_permanente',
            revisao_humana: false
        };
    }

    // 2. RESTRICAO_CANAL (Exclusividade de email / bloqueio de WhatsApp)
    const isChannelRestriction = 
        combinedAll.includes('apenas por email') ||
        combinedAll.includes('enviar para o nosso email') ||
        combinedAll.includes('enviar para o email') ||
        combinedAll.includes('mandar email aos cuidados') ||
        combinedAll.includes('consultas dentibus pt') ||
        combinedAll.includes('smilemed pt') ||
        combinedAll.includes('canal de atendimento medico') ||
        combinedAll.includes('apenas marcacoes');

    if (isChannelRestriction) {
        return {
            categoria: 'RESTRICAO_CANAL',
            evidencia: rawReason || rawDetail || 'Restrição explícita de canal de contacto',
            bloqueio_sugerido: 'WHATSAPP',
            canal_autorizado: 'EMAIL',
            acao_cadencia: 'bloquear_whatsapp_permitir_email',
            revisao_humana: false
        };
    }

    // 3. RECUSA_COMERCIAL (Declaração expressa de falta de interesse ou agência contratada)
    const isRefusal = 
        combinedAll.includes('nao teve interesse') ||
        combinedAll.includes('nao tem interesse') ||
        combinedAll.includes('nao estamos interessados') ||
        combinedAll.includes('nao temos interesse') ||
        combinedAll.includes('sem interesse') ||
        combinedAll.includes('nao ha interesse') ||
        combinedAll.includes('dispensamos') ||
        combinedAll.includes('nao precisamos de') ||
        combinedAll.includes('ja temos agencia') ||
        combinedAll.includes('ja tem agencia') ||
        combinedAll.includes('ja temos quem trate') ||
        combinedAll.includes('ja tem quem faz') ||
        combinedAll.includes('ja temos uma equipe de marketing') ||
        combinedAll.includes('ja temos uma equipa de marketing') ||
        combinedAll.includes('ja temos uma empresa') ||
        combinedAll.includes('ja tem equipe');

    if (isRefusal) {
        return {
            categoria: 'RECUSA_COMERCIAL',
            evidencia: rawReason || rawDetail || 'Declaração de falta de interesse ou agência ativa',
            bloqueio_sugerido: 'TODOS',
            acao_cadencia: 'bloqueio_comercial',
            revisao_humana: false
        };
    }

    // 4. CONTINGENCIA_OPERACIONAL (Equipa completa / Obras / Migração)
    const isOperationalContingency = 
        combinedAll.includes('equipa completa') ||
        combinedAll.includes('em obras') ||
        combinedAll.includes('migracao') ||
        combinedAll.includes('passa por uma migracao') ||
        combinedAll.includes('em reestruturacao') ||
        combinedAll.includes('nao seria o melhor momento');

    if (isOperationalContingency) {
        return {
            categoria: 'CONTINGENCIA_OPERACIONAL',
            evidencia: rawReason || rawDetail || 'Contingência temporária declarada',
            bloqueio_sugerido: null,
            acao_cadencia: 'quarentena_espera_3_6_meses',
            revisao_humana: false
        };
    }

    // 5. ADIAMENTO (Pedido de contacto posterior ou encaminhamento a responsável)
    const isPostponement = 
        combinedAll.includes('contactar mais tarde') ||
        combinedAll.includes('contacte mais tarde') ||
        combinedAll.includes('fale mais tarde') ||
        combinedAll.includes('ligar no proximo mes') ||
        combinedAll.includes('se houver interesse certamente') ||
        combinedAll.includes('ja informamos o responsavel');

    if (isPostponement) {
        return {
            categoria: 'ADIAMENTO',
            evidencia: rawReason || rawDetail || 'Pedido para retomar contacto ou encaminhado internamente',
            bloqueio_sugerido: null,
            acao_cadencia: 'agendar_reavaliacao_data_especifica',
            revisao_humana: false
        };
    }

    // 6. AMBIGUO (Secretária cansada, contexto dúbio, resposta automática de férias)
    const isAmbiguous = 
        combinedAll.includes('cansada de ligacoes') ||
        combinedAll.includes('cansada de agencias') ||
        combinedAll.includes('ficou de retornar mas') ||
        combinedAll.includes('duvido muito') ||
        combinedAll.includes('encontramo nos encerrados') ||
        combinedAll.includes('fora de perfil nao responde');

    if (isAmbiguous) {
        return {
            categoria: 'AMBIGUO',
            evidencia: rawReason || rawDetail || 'Objeção de gatekeeper ou contexto ambíguo',
            bloqueio_sugerido: null,
            acao_cadencia: 'revisao_humana_obrigatoria',
            revisao_humana: true
        };
    }

    // 7. SEM_EVIDENCIA (Motivo ausente ou histórico nulo)
    if (!rawReason || rawReason === '(sem motivo registrado)' || rawReason === 'Sem motivo') {
        return {
            categoria: 'SEM_EVIDENCIA',
            evidencia: '(sem motivo registrado no CRM)',
            bloqueio_sugerido: null,
            acao_cadencia: 'revisao_humana_por_falta_de_dados',
            revisao_humana: true
        };
    }

    // 8. SILÊNCIO (Não respondeu, desqualificado sem objeção de recusa, sem resposta há tempo hábil)
    return {
        categoria: 'SILENCIO',
        evidencia: rawReason || 'Ausência de resposta prolongada',
        bloqueio_sugerido: null,
        acao_cadencia: 'candidato_elegivel_com_abordagem_respeitosa',
        revisao_humana: false
    };
}

export function runHistoricalTriageSimulation() {
    console.log('🚀 Iniciando Triagem Histórica dos 405 Negócios Perdidos (Fase B.1)...');

    if (!fs.existsSync(INPUT_FILE)) {
        throw new Error(`Ficheiro de dados não encontrado: ${INPUT_FILE}`);
    }

    const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    const allResults = data.resultados_individuais || [];
    console.log(`📦 Carregados ${allResults.length} negócios perdidos para triagem de segurança.`);

    // Deduplicação estrita por deal_id
    const uniqueDealsMap = new Map();
    allResults.forEach(r => uniqueDealsMap.set(r.identificacao.deal_id, r));
    const uniqueDeals = Array.from(uniqueDealsMap.values());
    console.log(`🎯 Negócios únicos confirmados: ${uniqueDeals.length}`);

    const stats = {
        total_analisado: uniqueDeals.length,
        distribuicao_categorias: {
            OPTOUT_EXPLICITO: 0,
            RECUSA_COMERCIAL: 0,
            RESTRICAO_CANAL: 0,
            ADIAMENTO: 0,
            CONTINGENCIA_OPERACIONAL: 0,
            SILENCIO: 0,
            AMBIGUO: 0,
            SEM_EVIDENCIA: 0
        },
        candidatos_supressao_proposta: 0
    };

    const classifiedDeals = [];
    const proposedSuppressionList = [];

    for (const deal of uniqueDeals) {
        const triage = classifyHistoricalEvidence(deal);
        stats.distribuicao_categorias[triage.categoria]++;

        const triageRecord = {
            identificacao: {
                deal_id: deal.identificacao.deal_id,
                nome: deal.identificacao.nome,
                motivo_original_crm: deal.identificacao.motivo_perda_registrado || '(sem motivo)'
            },
            classificacao_seguranca: {
                categoria: triage.categoria,
                evidencia: triage.evidencia,
                acao_cadencia: triage.acao_cadencia,
                revisao_humana: triage.revisao_humana,
                bloqueio_sugerido: triage.bloqueio_sugerido || null
            }
        };

        // Se a classificação indicar bloqueio, gera registo simulado para a lista de supressão
        if (['OPTOUT_EXPLICITO', 'RECUSA_COMERCIAL', 'RESTRICAO_CANAL'].includes(triage.categoria)) {
            const suppressionEntry = createSuppressionRecord({
                deal_id: deal.identificacao.deal_id,
                motivo_bloqueio: triage.categoria,
                origem_bloqueio: 'HISTORICO_CRM',
                canal_bloqueado: triage.bloqueio_sugerido || 'TODOS',
                evidencia: `[Triagem Histórica] ${triage.evidencia}`.slice(0, 500),
                estado: 'ativo'
            });
            proposedSuppressionList.push(suppressionEntry);
            stats.candidatos_supressao_proposta++;
        }

        classifiedDeals.push(triageRecord);
    }

    const deduplicatedSuppressions = deduplicateSuppressionList(proposedSuppressionList);

    const simulationOutput = {
        meta: {
            projeto: 'Vamuss SDR Automático — Fase B.1 (Triagem Histórica de Supressão)',
            data_execucao: new Date().toISOString(),
            modo: 'simulacao_leitura_estrita_sem_escrita_producao',
            total_negocios_analisados: uniqueDeals.length,
            total_supressoes_propostas: deduplicatedSuppressions.length
        },
        estatisticas: stats,
        lista_supressao_proposta_simulada: deduplicatedSuppressions,
        amostras_anonimizadas_por_categoria: {
            OPTOUT_EXPLICITO: classifiedDeals.filter(d => d.classificacao_seguranca.categoria === 'OPTOUT_EXPLICITO').slice(0, 3),
            RECUSA_COMERCIAL: classifiedDeals.filter(d => d.classificacao_seguranca.categoria === 'RECUSA_COMERCIAL').slice(0, 3),
            RESTRICAO_CANAL: classifiedDeals.filter(d => d.classificacao_seguranca.categoria === 'RESTRICAO_CANAL').slice(0, 3),
            ADIAMENTO: classifiedDeals.filter(d => d.classificacao_seguranca.categoria === 'ADIAMENTO').slice(0, 3),
            CONTINGENCIA_OPERACIONAL: classifiedDeals.filter(d => d.classificacao_seguranca.categoria === 'CONTINGENCIA_OPERACIONAL').slice(0, 3),
            SILENCIO: classifiedDeals.filter(d => d.classificacao_seguranca.categoria === 'SILENCIO').slice(0, 3),
            AMBIGUO: classifiedDeals.filter(d => d.classificacao_seguranca.categoria === 'AMBIGUO').slice(0, 3),
            SEM_EVIDENCIA: classifiedDeals.filter(d => d.classificacao_seguranca.categoria === 'SEM_EVIDENCIA').slice(0, 3)
        },
        resultados_completos: classifiedDeals
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(simulationOutput, null, 2), 'utf8');
    console.log(`\n🎉 Triagem concluída com sucesso! Resultados salvos em: ${OUTPUT_FILE}`);
    return simulationOutput;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runHistoricalTriageSimulation();
}
