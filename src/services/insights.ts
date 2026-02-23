import { supabase } from '@/lib/supabase';

export interface InsightsStats {
    totalDeals: number;
    totalWon: number;
    totalLost: number;
    totalAtividades: number;
    mediaContatos: number;
    mediaDiasFechamento: number;
    totalValor: number;
    wonValue: number;
    openValue: number;
    dashboardFlow: {
        ganhos: number;
        perdidos: number;
        receita: number;
        conversao: number;
        pipelineValue: number;
        atividadesConcluidas: number;
        atividadesCriadas: number;
        taxaExecucao: number;
        mediaExecucao: number;
        negociosSemAtividade: number;
    };
}

export interface FunnelData {
    totalDeals: number;
    totalWon: number;
    totalLost: number;
    taxaFechamento: number;
    prospectCount: number;
    leadCount: number;
    leadEngajadoCount: number;
    reuniaoCount: number;
    fechamentoCount: number;
    propostaCount: number;
    prospectToLead: number;
    leadToLeadEngajado: number;
    leadEngajadoToReuniao: number;
    reuniaoToProposta: number;
    propostaToGanho: number;
    reuniaoToFechamento: number;
}

export interface ActivityData {
    totalAtividades: number;
    totalMensagens: number;
    totalEmails: number;
    totalLigacoes: number;
    totalAnalises: number;
    totalAuditorias: number;

    mediaAtividadesPorNegocio: number;
    mediaContatosAteReuniao: number;
    mediaContatosAteFechamento: number;
    mediaFollowUpsAteFechamento: number;
    taxaComparecimento: number;

    percentMensagens: number;
    percentEmails: number;
    percentLigacoes: number;
}

export interface IntensityData {
    mediaContatosPorNegocio: number;
    percent7OuMais: number;
    percentEncerradosAntes5: number;
    faixa0_2: number;
    faixa3_5: number;
    faixa6_9: number;
    faixa10_plus: number;
}

export interface TimingData {
    tempoMedioAteReuniao: number;
    tempoMedioAteFechamento: number;
    tempoMedioCiclo: number;
    tempoMedioEntreContatos: number;

    ciclo_0_7: number;
    ciclo_8_15: number;
    ciclo_16_30: number;
    ciclo_30_plus: number;
}

export interface ChannelData {
    percentMessage: number;
    percentEmail: number;
    percentCall: number;

    taxaReuniaoMessage: number;
    taxaReuniaoEmail: number;
    taxaReuniaoCall: number;

    taxaFechamentoMessage: number;
    taxaFechamentoEmail: number;
    taxaFechamentoCall: number;
}

export interface LostData {
    totalLost: number;
    taxaPerda: number;
    tempoMedioAtePerda: number;
    mediaContatosAtePerda: number;
    etapas: { etapa_onde_perdeu: string; quantidade: number; percentual: number }[];
    motivos: { motivo_perda: string; quantidade: number; percentual: number }[];
}

export interface GoalStats {
    metric: string;
    target: number;
    actual: number;
    percent: number;
}

export interface InsightsData {
    current: InsightsStats & { funnel: FunnelData, activity: ActivityData, intensity: IntensityData, timing: TimingData, channel: ChannelData, lost: LostData };
    previous?: InsightsStats & { funnel: FunnelData, activity: ActivityData, intensity: IntensityData, timing: TimingData, channel: ChannelData, lost: LostData };
    variation: Record<string, number>;
    goals: GoalStats[];
}

export async function getInsightsData(
    startDate: string,
    endDate: string,
    compareStartDate?: string,
    compareEndDate?: string
): Promise<InsightsData> {

    const fetchStats = async (start: string, end: string): Promise<InsightsStats & { funnel: FunnelData, activity: ActivityData, intensity: IntensityData, timing: TimingData, channel: ChannelData, lost: LostData }> => {
        // Garantir que a data final cubra o final do dia
        const endOfDay = end.includes('T') ? end : `${end}T23:59:59.999Z`;
        const startOfDay = start.includes('T') ? start : `${start}T00:00:00.000Z`;

        const IGNORE_TEST_DATA_BEFORE = '2026-02-22T00:00:00.000Z'; // Ajustado para hoje para "esquecer o passado" de testes recente

        // 1. Buscar Estágios válidos para evitar "negócios fantasma" (que não aparem no board)
        const { data: validStages } = await supabase.from('stages').select('id');
        const validStageIds = new Set(validStages?.map(s => s.id) || []);

        // 2. Buscar os IDs Reais dos negócios abertos no Pipeline (Sanity Check)
        // Só incluímos negócios que estão em estágios VÁLIDOS e ATIVOS
        const { data: realOpenDeals } = await supabase.from('deals').select('id, stage_id, value').eq('status', 'open');
        let globalOpenValue = 0;
        const openDealsIds = new Set(
            realOpenDeals
                ?.filter(d => {
                    const isValid = validStageIds.has(d.stage_id);
                    if (isValid) globalOpenValue += Number(d.value || 0);
                    return isValid;
                })
                .map(d => d.id.toLowerCase()) || []
        );

        // 3. Fetch activities within this specific timeframe
        const { data: flowActivitiesRaw } = await supabase
            .from('activities')
            .select('id, status, created_at, completed_at, deal_id, type')
            .or(`created_at.gte.${startOfDay},completed_at.gte.${startOfDay}`);

        const flowActivities = flowActivitiesRaw?.filter(a => {
            const REAL_TYPES = ['call', 'meeting', 'task', 'email', 'message', 'instagram', 'analysis', 'audit'];
            if (!REAL_TYPES.includes(a.type)) return false;
            if (a.created_at < IGNORE_TEST_DATA_BEFORE) return false;
            return true;
        });

        // 3. Buscar dados de analytics
        const { data, error } = await supabase
            .from('deal_analytics')
            .select('*')
            .or(`and(created_at.gte.${startOfDay},created_at.lte.${endOfDay}),and(closed_at.gte.${startOfDay},closed_at.lte.${endOfDay})`);

        if (error) {
            console.error('Error fetching insights data:', error);
            return { ...emptyStats(), funnel: emptyFunnel(), activity: emptyActivity(), intensity: emptyIntensity(), timing: emptyTiming(), channel: emptyChannel(), lost: emptyLost() };
        }

        let currentData = data || [];

        // Filtro rigoroso de Data de Lançamento (ignorar testes anteriores a 22 Fev)
        currentData = currentData.filter(d => {
            if (d.status_final === 'open') {
                // Sanidade: Se o negócio consta como aberto no analytics mas NÃO está no set de IDs abertos reais e ativos, 
                // significa que ele é um "fantasma" (Ex: Caso Tagides ou negócio sem etapa).
                if (!openDealsIds.has(String(d.deal_id).toLowerCase())) {
                    return false;
                }

                // Se é aberto antigo, mantemos na contagem, mas ZERAMOS as atividades de registro de teste
                if (d.created_at < IGNORE_TEST_DATA_BEFORE) {
                    d.total_atividades = 0;
                    d.total_mensagens = 0;
                    d.total_emails = 0;
                    d.total_ligacoes = 0;
                    d.total_analises = 0;
                    d.total_auditorias = 0;
                    d.total_contatos_realizados = 0;
                    d.contatos_ate_reuniao = 0;
                    d.contatos_ate_fechamento = 0;
                    d.total_respostas = 0;
                    d.tempo_medio_entre_contatos = 0;
                    d.dias_totais_no_funil = 0;
                }
                return true;
            } else {
                // Se é fechado (won/lost) e foi fechado ou criado antes do corte de hoje, nós deletamos dos cálculos
                const refDate = d.closed_at || d.created_at;
                if (refDate < IGNORE_TEST_DATA_BEFORE) {
                    return false;
                }
                return true;
            }
        });

        // Regras de filtragem do Funil (usando as datas ajustadas para tempo)
        const dealsCreated = currentData.filter(d => (d.created_at as string) >= startOfDay && (d.created_at as string) <= endOfDay);

        // REGRA OFICIAL ANTIGRAVITY (Fev 2026):
        // KPI "Total de Negócios" = Volume real de negócios criados dentro do período (independente do status).
        const totalDeals = dealsCreated.length;
        const totalWon = dealsCreated.filter(d => d.status_final === 'won').length;
        const totalLost = dealsCreated.filter(d => d.status_final === 'lost').length;

        const totalAtividades = dealsCreated.reduce((sum, d) => sum + (d.total_atividades || 0), 0);
        const totalContatos = dealsCreated.reduce((sum, d) => sum + (d.total_contatos_realizados || 0), 0);
        const mediaContatos = totalDeals > 0 ? totalContatos / totalDeals : 0;

        const wonDeals = dealsCreated.filter(d => d.status_final === 'won');
        const totalDiasFechamento = wonDeals.reduce((sum, d) => sum + (d.dias_ate_fechamento || 0), 0);
        const mediaDiasFechamento = wonDeals.length > 0 ? totalDiasFechamento / wonDeals.length : 0;

        const taxaFechamento = totalDeals > 0 ? (totalWon / totalDeals) * 100 : 0;
        const taxaPerda = totalDeals > 0 ? (totalLost / totalDeals) * 100 : 0;

        // Fase 3: Contagem Exata por Etapa (Visão de Snapshot do Pipeline)
        const prospectCount = dealsCreated.filter(d =>
            d.stage_atual?.toLowerCase().includes('prospect') ||
            d.etapa_onde_perdeu?.toLowerCase().includes('prospect')
        ).length;

        const leadEngajadoCount = dealsCreated.filter(d =>
            d.stage_atual?.toLowerCase().includes('engajado') ||
            d.etapa_onde_perdeu?.toLowerCase().includes('engajado')
        ).length;

        const leadCount = dealsCreated.filter(d =>
            (d.stage_atual?.toLowerCase().includes('lead') && !d.stage_atual?.toLowerCase().includes('engajado')) ||
            (d.etapa_onde_perdeu?.toLowerCase().includes('lead') && !d.etapa_onde_perdeu?.toLowerCase().includes('engajado'))
        ).length;

        const reuniaoCount = dealsCreated.filter(d =>
            d.stage_atual?.toLowerCase().includes('reun') ||
            d.etapa_onde_perdeu?.toLowerCase().includes('reun')
        ).length;

        const propostaCount = dealsCreated.filter(d =>
            d.stage_atual?.toLowerCase().includes('proposta') ||
            d.etapa_onde_perdeu?.toLowerCase().includes('proposta')
        ).length;

        const fechamentoCount = totalWon;

        const prospectToLead = prospectCount > 0 ? (leadCount / prospectCount) * 100 : 0;
        const leadToLeadEngajado = leadCount > 0 ? (leadEngajadoCount / leadCount) * 100 : 0;
        const leadEngajadoToReuniao = leadEngajadoCount > 0 ? (reuniaoCount / leadEngajadoCount) * 100 : 0;
        const reuniaoToProposta = reuniaoCount > 0 ? (propostaCount / reuniaoCount) * 100 : 0;
        const propostaToGanho = propostaCount > 0 ? (totalWon / propostaCount) * 100 : 0;
        const reuniaoToFechamento = reuniaoCount > 0 ? (fechamentoCount / reuniaoCount) * 100 : 0;

        // Fase 4: Atividades
        const totalMensagens = dealsCreated.reduce((sum, d) => sum + (d.total_mensagens || 0), 0);
        const totalEmails = dealsCreated.reduce((sum, d) => sum + (d.total_emails || 0), 0);
        const totalLigacoes = dealsCreated.reduce((sum, d) => sum + (d.total_ligacoes || 0), 0);
        const totalAnalises = dealsCreated.reduce((sum, d) => sum + (d.total_analises || 0), 0);
        const totalAuditorias = dealsCreated.reduce((sum, d) => sum + (d.total_auditorias || 0), 0);

        const mediaAtividadesPorNegocio = totalDeals > 0 ? totalAtividades / totalDeals : 0;

        const openDealsCreated = dealsCreated.filter(d => d.status_final === 'open');

        const reuniaoDeals = openDealsCreated.filter(d => d.contatos_ate_reuniao !== null);
        const mediaContatosAteReuniao = reuniaoDeals.length > 0
            ? reuniaoDeals.reduce((sum, d) => sum + (d.contatos_ate_reuniao || 0), 0) / reuniaoDeals.length
            : 0;

        const mediaContatosAteFechamento = wonDeals.length > 0
            ? wonDeals.reduce((sum, d) => sum + (d.contatos_ate_fechamento || 0), 0) / wonDeals.length
            : 0;

        const mediaFollowUpsAteFechamento = wonDeals.length > 0
            ? wonDeals.reduce((sum, d) => sum + Math.max(0, (d.total_contatos_realizados || 0) - (d.contatos_ate_reuniao || 0)), 0) / wonDeals.length
            : 0;

        // Fetch Taxa de Comparecimento (Meetings completed vs Total meetings)
        const totalMeetings = flowActivities?.filter(a => a.type === 'meeting').length || 0;
        const completedMeetings = flowActivities?.filter(a => a.type === 'meeting' && a.status === 'completed').length || 0;
        const taxaComparecimento = totalMeetings > 0 ? (completedMeetings / totalMeetings) * 100 : 0;

        const percentMensagens = totalAtividades > 0 ? (totalMensagens / totalAtividades) * 100 : 0;
        const percentEmails = totalAtividades > 0 ? (totalEmails / totalAtividades) * 100 : 0;
        const percentLigacoes = totalAtividades > 0 ? (totalLigacoes / totalAtividades) * 100 : 0;

        // Fase 5: Intensidade de Contatos (Baseada apenas em negócios abertos)
        const mediaContatosPorNegocio = totalDeals > 0
            ? openDealsCreated.reduce((sum, d) => sum + (d.total_contatos_realizados || 0), 0) / totalDeals
            : 0;

        const negociosCom7OuMais = openDealsCreated.filter(d => (d.total_contatos_realizados || 0) >= 7).length;
        const percent7OuMais = totalDeals > 0 ? (negociosCom7OuMais / totalDeals) * 100 : 0;

        const encerradosAntes5 = dealsCreated.filter(d =>
            (d.status_final !== 'open') && (d.total_contatos_realizados || 0) < 5
        ).length;
        const percentEncerradosAntes5 = (totalWon + totalLost) > 0 ? (encerradosAntes5 / (totalWon + totalLost)) * 100 : 0;

        const faixa0_2 = openDealsCreated.filter(d => {
            const c = d.total_contatos_realizados || 0;
            return c >= 0 && c <= 2;
        }).length;

        const faixa3_5 = openDealsCreated.filter(d => {
            const c = d.total_contatos_realizados || 0;
            return c >= 3 && c <= 5;
        }).length;

        const faixa6_9 = openDealsCreated.filter(d => {
            const c = d.total_contatos_realizados || 0;
            return c >= 6 && c <= 9;
        }).length;

        const faixa10_plus = openDealsCreated.filter(d => {
            const c = d.total_contatos_realizados || 0;
            return c >= 10;
        }).length;

        // Fase 6: Tempos e Ciclo
        const tempoMedioAteReuniao = reuniaoDeals.length > 0
            ? reuniaoDeals.reduce((sum, d) => sum + (d.dias_ate_reuniao || 0), 0) / reuniaoDeals.length
            : 0;

        const tempoMedioAteFechamento = wonDeals.length > 0
            ? wonDeals.reduce((sum, d) => sum + (d.dias_ate_fechamento || 0), 0) / wonDeals.length
            : 0;
        const tempoMedioCiclo = wonDeals.length > 0
            ? wonDeals.reduce((sum, d) => sum + (d.dias_totais_no_funil || 0), 0) / wonDeals.length
            : 0;

        const tempoMedioEntreContatos = totalDeals > 0
            ? openDealsCreated.reduce((sum, d) => sum + (d.tempo_medio_entre_contatos || 0), 0) / totalDeals
            : 0;

        // Distribuição do Ciclo de Vendas focada em Ganhos (Won)
        const ciclo_0_7 = wonDeals.filter(d => {
            const dias = d.dias_totais_no_funil || 0;
            return dias >= 0 && dias <= 7;
        }).length;

        const ciclo_8_15 = wonDeals.filter(d => {
            const dias = d.dias_totais_no_funil || 0;
            return dias >= 8 && dias <= 15;
        }).length;

        const ciclo_16_30 = wonDeals.filter(d => {
            const dias = d.dias_totais_no_funil || 0;
            return dias >= 16 && dias <= 30;
        }).length;

        const ciclo_30_plus = wonDeals.filter(d => {
            const dias = d.dias_totais_no_funil || 0;
            return dias > 30;
        }).length;

        // Fase 7: Avanço por Canal
        const totalMessage = dealsCreated.filter(d => d.canal_mais_usado === 'message').length;
        const totalEmail = dealsCreated.filter(d => d.canal_mais_usado === 'email').length;
        const totalCall = dealsCreated.filter(d => d.canal_mais_usado === 'call').length;

        const percentMessage = totalDeals > 0 ? (totalMessage / totalDeals) * 100 : 0;
        const percentEmail = totalDeals > 0 ? (totalEmail / totalDeals) * 100 : 0;
        const percentCall = totalDeals > 0 ? (totalCall / totalDeals) * 100 : 0;

        const reuniaoMessage = dealsCreated.filter(d => d.canal_mais_usado === 'message' && d.contatos_ate_reuniao !== null).length;
        const reuniaoEmail = dealsCreated.filter(d => d.canal_mais_usado === 'email' && d.contatos_ate_reuniao !== null).length;
        const reuniaoCall = dealsCreated.filter(d => d.canal_mais_usado === 'call' && d.contatos_ate_reuniao !== null).length;

        const taxaReuniaoMessage = totalMessage > 0 ? (reuniaoMessage / totalMessage) * 100 : 0;
        const taxaReuniaoEmail = totalEmail > 0 ? (reuniaoEmail / totalEmail) * 100 : 0;
        const taxaReuniaoCall = totalCall > 0 ? (reuniaoCall / totalCall) * 100 : 0;

        const fechamentoMessage = dealsCreated.filter(d => d.canal_mais_usado === 'message' && d.status_final === 'won').length;
        const fechamentoEmail = dealsCreated.filter(d => d.canal_mais_usado === 'email' && d.status_final === 'won').length;
        const fechamentoCall = dealsCreated.filter(d => d.canal_mais_usado === 'call' && d.status_final === 'won').length;

        const taxaFechamentoMessage = totalMessage > 0 ? (fechamentoMessage / totalMessage) * 100 : 0;
        const taxaFechamentoEmail = totalEmail > 0 ? (fechamentoEmail / totalEmail) * 100 : 0;
        const taxaFechamentoCall = totalCall > 0 ? (fechamentoCall / totalCall) * 100 : 0;

        // Fase 8: Módulo de Perdas
        const lostDeals = dealsCreated.filter(d => d.status_final === 'lost');
        // taxaPerda já foi calculada acima na Fase 2

        const tempoMedioAtePerda = lostDeals.length > 0
            ? lostDeals.reduce((sum, d) => sum + (d.dias_totais_no_funil || 0), 0) / lostDeals.length
            : 0;

        const mediaContatosAtePerda = lostDeals.length > 0
            ? lostDeals.reduce((sum, d) => sum + (d.total_contatos_realizados || 0), 0) / lostDeals.length
            : 0;

        // Agrupar etapas onde perdeu
        const etapasMap: Record<string, number> = {};
        const motivosMap: Record<string, number> = {};

        lostDeals.forEach(d => {
            const etapa = d.etapa_onde_perdeu || 'Desconhecida';
            etapasMap[etapa] = (etapasMap[etapa] || 0) + 1;

            const motivo = d.motivo_perda || 'Sem motivo registrado';
            motivosMap[motivo] = (motivosMap[motivo] || 0) + 1;
        });

        const etapasList = Object.keys(etapasMap).map(etapa => ({
            etapa_onde_perdeu: etapa,
            quantidade: etapasMap[etapa],
            percentual: totalLost > 0 ? (etapasMap[etapa] / totalLost) * 100 : 0
        })).sort((a, b) => b.quantidade - a.quantidade);

        const motivosList = Object.keys(motivosMap).map(motivo => ({
            motivo_perda: motivo,
            quantidade: motivosMap[motivo],
            percentual: totalLost > 0 ? (motivosMap[motivo] / totalLost) * 100 : 0
        })).sort((a, b) => b.quantidade - a.quantidade);

        // Dashboard Flow Metrics
        const flowGanhosDeals = currentData.filter(d => d.status_final === 'won' && d.closed_at && (d.closed_at as string) >= startOfDay && (d.closed_at as string) <= endOfDay);
        const flowPerdidosDeals = currentData.filter(d => d.status_final === 'lost' && d.closed_at && (d.closed_at as string) >= startOfDay && (d.closed_at as string) <= endOfDay);
        const flowGanhosCount = flowGanhosDeals.length;
        const flowPerdidosCount = flowPerdidosDeals.length;
        const flowReceita = flowGanhosDeals.reduce((sum, d) => sum + (d.valor_ajustado || d.valor || 0), 0);
        const flowConversao = (flowGanhosCount + flowPerdidosCount) > 0 ? (flowGanhosCount / (flowGanhosCount + flowPerdidosCount)) * 100 : 0;

        const atividadesCriadas = flowActivities?.filter(a => (a.created_at as string) >= startOfDay && (a.created_at as string) <= endOfDay).length || 0;
        const atividadesConcluidas = flowActivities?.filter(a => a.status === 'completed' && a.completed_at && (a.completed_at as string) >= startOfDay && (a.completed_at as string) <= endOfDay).length || 0;
        const taxaExecucao = atividadesCriadas > 0 ? (atividadesConcluidas / atividadesCriadas) * 100 : 0;
        const mediaExecucao = totalDeals > 0 ? (atividadesConcluidas / totalDeals) : 0;

        const dealsComAtividade7d = new Set(
            flowActivities?.filter(a => (a.created_at as string) >= startOfDay && a.deal_id && openDealsIds.has(a.deal_id.toLowerCase())).map(a => a.deal_id.toLowerCase())
        );
        const negociosSemAtividade = openDealsIds.size - dealsComAtividade7d.size;

        return {
            totalDeals,
            totalWon,
            totalLost,
            totalAtividades,
            mediaContatos,
            mediaDiasFechamento,
            totalValor: dealsCreated.reduce((sum, d) => sum + (d.total_faturado_nesta_fase || 0), 0),
            wonValue: dealsCreated.filter(d => d.status_final === 'won').reduce((sum, d) => sum + (d.valor_ajustado || d.valor || 0), 0),
            openValue: openDealsCreated.reduce((sum, d) => sum + (d.valor_ajustado || d.valor || 0), 0),
            dashboardFlow: {
                ganhos: flowGanhosCount,
                perdidos: flowPerdidosCount,
                receita: flowReceita,
                conversao: flowConversao,
                pipelineValue: globalOpenValue,
                atividadesConcluidas,
                atividadesCriadas,
                taxaExecucao,
                mediaExecucao,
                negociosSemAtividade
            },
            funnel: {
                totalDeals,
                totalWon,
                totalLost,
                taxaFechamento,
                prospectCount,
                leadCount,
                leadEngajadoCount,
                reuniaoCount,
                fechamentoCount,
                propostaCount,
                prospectToLead,
                leadToLeadEngajado,
                leadEngajadoToReuniao,
                reuniaoToProposta,
                propostaToGanho,
                reuniaoToFechamento
            },
            activity: {
                totalAtividades,
                totalMensagens,
                totalEmails,
                totalLigacoes,
                totalAnalises,
                totalAuditorias,
                mediaAtividadesPorNegocio,
                mediaContatosAteReuniao,
                mediaContatosAteFechamento,
                mediaFollowUpsAteFechamento,
                taxaComparecimento,
                percentMensagens,
                percentEmails,
                percentLigacoes
            },
            intensity: {
                mediaContatosPorNegocio,
                percent7OuMais,
                percentEncerradosAntes5,
                faixa0_2,
                faixa3_5,
                faixa6_9,
                faixa10_plus
            },
            timing: {
                tempoMedioAteReuniao,
                tempoMedioAteFechamento,
                tempoMedioCiclo,
                tempoMedioEntreContatos,
                ciclo_0_7,
                ciclo_8_15,
                ciclo_16_30,
                ciclo_30_plus
            },
            channel: {
                percentMessage,
                percentEmail,
                percentCall,
                taxaReuniaoMessage,
                taxaReuniaoEmail,
                taxaReuniaoCall,
                taxaFechamentoMessage,
                taxaFechamentoEmail,
                taxaFechamentoCall
            },
            lost: {
                totalLost,
                taxaPerda,
                tempoMedioAtePerda,
                mediaContatosAtePerda,
                etapas: etapasList,
                motivos: motivosList
            }
        };
    };

    const current = await fetchStats(startDate, endDate);
    let previous: (InsightsStats & { funnel: FunnelData, activity: ActivityData, intensity: IntensityData, timing: TimingData, channel: ChannelData, lost: LostData }) | undefined;
    const variation: Record<string, number> = {};

    if (compareStartDate && compareEndDate) {
        previous = await fetchStats(compareStartDate, compareEndDate);

        const calculateVariation = (cur: number, pre: number) => {
            if (pre === 0) return cur > 0 ? 100 : 0;
            return ((cur - pre) / pre) * 100;
        };

        // Variation for metrics
        Object.keys(current).forEach(key => {
            if (key !== 'funnel' && key !== 'activity' && key !== 'intensity' && key !== 'timing' && key !== 'channel') {
                variation[key] = calculateVariation((current as any)[key], (previous as any)[key]);
            }
        });

        // Variation for funnel
        Object.keys(current.funnel).forEach(key => {
            variation[key] = calculateVariation((current.funnel as any)[key], (previous!.funnel as any)[key]);
        });

        // Variation for activity
        Object.keys(current.activity).forEach(key => {
            variation[key] = calculateVariation((current.activity as any)[key], (previous!.activity as any)[key]);
        });

        // Variation for intensity
        Object.keys(current.intensity).forEach(key => {
            variation[key] = calculateVariation((current.intensity as any)[key], (previous!.intensity as any)[key]);
        });

        // Variation for timing
        Object.keys(current.timing).forEach(key => {
            variation[key] = calculateVariation((current.timing as any)[key], (previous!.timing as any)[key]);
        });

        // Variation for channel
        Object.keys(current.channel).forEach(key => {
            variation[key] = calculateVariation((current.channel as any)[key], (previous!.channel as any)[key]);
        });

        // Variation for lost
        variation['lost_totalLost'] = calculateVariation(current.lost.totalLost, previous!.lost.totalLost);
        variation['lost_taxaPerda'] = calculateVariation(current.lost.taxaPerda, previous!.lost.taxaPerda);
        variation['lost_tempoMedioAtePerda'] = calculateVariation(current.lost.tempoMedioAtePerda, previous!.lost.tempoMedioAtePerda);
        variation['lost_mediaContatosAtePerda'] = calculateVariation(current.lost.mediaContatosAtePerda, previous!.lost.mediaContatosAtePerda);
    }

    // Buscar Metas do Supabase
    const { data: goalsData } = await supabase.from('insights_goals').select('*');
    const goals: GoalStats[] = (goalsData || []).map(g => {
        let actual = 0;
        if (g.metric_name === 'reunioes') actual = current.funnel.reuniaoCount;
        else if (g.metric_name === 'fechamentos') actual = current.funnel.fechamentoCount;
        else if (g.metric_name === 'taxa_fechamento') actual = current.funnel.taxaFechamento;

        return {
            metric: g.metric_name,
            target: g.target_value,
            actual,
            percent: g.target_value > 0 ? (actual / g.target_value) * 100 : 0
        };
    });

    return { current, previous, variation, goals };
}

function emptyStats(): InsightsStats {
    return {
        totalDeals: 0,
        totalWon: 0,
        totalLost: 0,
        totalAtividades: 0,
        mediaContatos: 0,
        mediaDiasFechamento: 0,
        totalValor: 0,
        wonValue: 0,
        openValue: 0,
        dashboardFlow: {
            ganhos: 0,
            perdidos: 0,
            receita: 0,
            conversao: 0,
            pipelineValue: 0,
            atividadesConcluidas: 0,
            atividadesCriadas: 0,
            taxaExecucao: 0,
            mediaExecucao: 0,
            negociosSemAtividade: 0
        }
    };
}

function emptyFunnel(): FunnelData {
    return {
        totalDeals: 0,
        totalWon: 0,
        totalLost: 0,
        taxaFechamento: 0,
        prospectCount: 0,
        leadCount: 0,
        leadEngajadoCount: 0,
        reuniaoCount: 0,
        fechamentoCount: 0,
        propostaCount: 0,
        prospectToLead: 0,
        leadToLeadEngajado: 0,
        leadEngajadoToReuniao: 0,
        reuniaoToProposta: 0,
        propostaToGanho: 0,
        reuniaoToFechamento: 0
    };
}

function emptyActivity(): ActivityData {
    return {
        totalAtividades: 0,
        totalMensagens: 0,
        totalEmails: 0,
        totalLigacoes: 0,
        totalAnalises: 0,
        totalAuditorias: 0,
        mediaAtividadesPorNegocio: 0,
        mediaContatosAteReuniao: 0,
        mediaContatosAteFechamento: 0,
        mediaFollowUpsAteFechamento: 0,
        taxaComparecimento: 0,
        percentMensagens: 0,
        percentEmails: 0,
        percentLigacoes: 0
    };
}

function emptyIntensity(): IntensityData {
    return {
        mediaContatosPorNegocio: 0,
        percent7OuMais: 0,
        percentEncerradosAntes5: 0,
        faixa0_2: 0,
        faixa3_5: 0,
        faixa6_9: 0,
        faixa10_plus: 0
    };
}

function emptyTiming(): TimingData {
    return {
        tempoMedioAteReuniao: 0,
        tempoMedioAteFechamento: 0,
        tempoMedioCiclo: 0,
        tempoMedioEntreContatos: 0,
        ciclo_0_7: 0,
        ciclo_8_15: 0,
        ciclo_16_30: 0,
        ciclo_30_plus: 0
    };
}

function emptyChannel(): ChannelData {
    return {
        percentMessage: 0,
        percentEmail: 0,
        percentCall: 0,
        taxaReuniaoMessage: 0,
        taxaReuniaoEmail: 0,
        taxaReuniaoCall: 0,
        taxaFechamentoMessage: 0,
        taxaFechamentoEmail: 0,
        taxaFechamentoCall: 0
    };
}

function emptyLost(): LostData {
    return {
        totalLost: 0,
        taxaPerda: 0,
        tempoMedioAtePerda: 0,
        mediaContatosAtePerda: 0,
        etapas: [],
        motivos: []
    };
}
