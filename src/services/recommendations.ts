import { InsightsData } from './insights';

export type ImpactLevel = 'alto' | 'medio' | 'baixo';
export type RecommendationType = 'alerta' | 'oportunidade' | 'ajuste';

export interface StrategicRecommendation {
    tipo: RecommendationType;
    area: string;
    impacto: ImpactLevel;
    prioridade: number; // 1 = highest
    titulo: string;
    mensagem: string;
    recomendacao: string;
}

// Weights
const IMPACT_WEIGHT = {
    'alto': 3,
    'medio': 2,
    'baixo': 1
};

export function generateStrategicRecommendations(data: InsightsData): StrategicRecommendation[] {
    const recs: StrategicRecommendation[] = [];
    const { current, variation, goals } = data;

    if (!current) return recs;

    // --- FUNIL ---
    // REGRA F1: Se taxa_fechamento < meta_taxa_fechamento -> alerta
    const taxaFechamentoMeta = goals.find(g => g.metric === 'taxa_fechamento')?.target;
    if (taxaFechamentoMeta !== undefined && current.funnel.taxaFechamento < taxaFechamentoMeta) {
        recs.push({
            tipo: 'alerta',
            area: 'Funil',
            impacto: 'alto',
            prioridade: 0,
            titulo: 'Conversão Abaixo da Meta',
            mensagem: `Taxa de fechamento (${current.funnel.taxaFechamento.toFixed(1)}%) está abaixo da meta (${taxaFechamentoMeta}%).`,
            recomendacao: 'Revisar qualificação e abordagem na etapa de reunião.'
        });
    }

    // --- INTENSIDADE ---
    // REGRA I1: Se percent_encerrados_antes_5 > 30% -> impacto alto
    if (current.intensity.percentEncerradosAntes5 > 30) {
        recs.push({
            tipo: 'alerta',
            area: 'Intensidade',
            impacto: 'alto',
            prioridade: 0,
            titulo: 'Desistência Precoce',
            mensagem: `Alta taxa de encerramento (${current.intensity.percentEncerradosAntes5.toFixed(1)}%) com menos de 5 contatos.`,
            recomendacao: 'Aumentar persistência mínima antes de encerrar negócios.'
        });
    }

    // REGRA I2: Se media_contatos_por_negocio < 5 -> impacto médio
    if (current.intensity.mediaContatosPorNegocio > 0 && current.intensity.mediaContatosPorNegocio < 5) {
        recs.push({
            tipo: 'ajuste',
            area: 'Intensidade',
            impacto: 'medio',
            prioridade: 0,
            titulo: 'Baixa Média de Contatos',
            mensagem: 'O volume de contatos por negócio está abaixo do ideal comercial.',
            recomendacao: 'Elevar média de contatos por negócio para aumentar chances de avanço.'
        });
    }

    // --- TEMPO ---
    // REGRA T1: Se tempo_medio_ate_reuniao aumentou > 20% vs período anterior -> impacto alto
    if (variation['tempoMedioAteReuniao'] > 20) {
        recs.push({
            tipo: 'alerta',
            area: 'Tempo',
            impacto: 'alto',
            prioridade: 0,
            titulo: 'Gargalo no Agendamento',
            mensagem: `Tempo até reunião aumentou significativamente (+${variation['tempoMedioAteReuniao'].toFixed(1)}%).`,
            recomendacao: 'Reduzir intervalo entre contatos iniciais.'
        });
    }

    // REGRA T2: Se tempo_medio_entre_contatos > 3 dias -> impacto médio
    if (current.timing.tempoMedioEntreContatos > 3) {
        recs.push({
            tipo: 'ajuste',
            area: 'Tempo',
            impacto: 'medio',
            prioridade: 0,
            titulo: 'Lead Esfriando Rápido',
            mensagem: `Tempo médio entre interações (${current.timing.tempoMedioEntreContatos.toFixed(1)} dias) está prolongado.`,
            recomendacao: 'Acelerar cadência para evitar esfriamento do lead.'
        });
    }

    // --- CANAL ---
    const fechamentoCall = current.channel.taxaFechamentoCall;
    const fechamentoEmail = current.channel.taxaFechamentoEmail;
    const diffCanal = fechamentoCall - fechamentoEmail;

    // REGRA C1: Se taxa_fechamento_call > taxa_fechamento_email E diferença > 15% -> oportunidade
    if (fechamentoCall > fechamentoEmail && diffCanal > 15) {
        recs.push({
            tipo: 'oportunidade',
            area: 'Canal',
            impacto: 'medio',
            prioridade: 0,
            titulo: 'Ligações em Alta',
            mensagem: `Ligações convertem significativamente mais que emails (+${diffCanal.toFixed(1)}%).`,
            recomendacao: 'Priorizar ligações nos primeiros contatos.'
        });
    }

    // Encontrar melhor canal real de conversão vs. canal mais usado
    const { taxaFechamentoMessage, taxaFechamentoEmail, taxaFechamentoCall, percentMessage, percentEmail, percentCall } = current.channel;

    let bestCanal = 'message';
    let maxTaxa = taxaFechamentoMessage;
    if (taxaFechamentoEmail > maxTaxa) { bestCanal = 'email'; maxTaxa = taxaFechamentoEmail; }
    if (taxaFechamentoCall > maxTaxa) { bestCanal = 'call'; maxTaxa = taxaFechamentoCall; }

    let mostUsedCanal = 'message';
    let maxUsage = percentMessage;
    if (percentEmail > maxUsage) { mostUsedCanal = 'email'; maxUsage = percentEmail; }
    if (percentCall > maxUsage) { mostUsedCanal = 'call'; maxUsage = percentCall; }

    // REGRA C2: Se canal_mais_usado não for o canal com maior taxa de conversão -> impacto médio
    // Considerar apenas se a conversão do melhor canal é significativamente maior (>5%)
    if (bestCanal !== mostUsedCanal && maxTaxa > 0) {
        let bestCanalLabel = bestCanal === 'message' ? 'WhatsApp' : bestCanal === 'email' ? 'E-mail' : 'Ligação';
        recs.push({
            tipo: 'ajuste',
            area: 'Canal',
            impacto: 'medio',
            prioridade: 0,
            titulo: 'Desalinhamento de Esforço',
            mensagem: `Canal principal de esforço não é o mais eficiente (O melhor é ${bestCanalLabel}).`,
            recomendacao: 'Redistribuir esforço para canal mais eficiente.'
        });
    }

    // --- PERDAS ---
    // REGRA P1: Se etapa_onde_perdeu = 'Lead' representar > 40% das perdas
    const etapaLead = current.lost.etapas.find(e => e.etapa_onde_perdeu.toLowerCase().includes('lead') && !e.etapa_onde_perdeu.toLowerCase().includes('engajado'));
    if (etapaLead && etapaLead.percentual > 40) {
        recs.push({
            tipo: 'alerta',
            area: 'Perdas',
            impacto: 'alto',
            prioridade: 0,
            titulo: 'Mortalidade no Topo',
            mensagem: `Maioria das perdas (${etapaLead.percentual.toFixed(1)}%) ocorre na etapa inicial de Lead.`,
            recomendacao: 'Revisar abordagem inicial e proposta de valor.'
        });
    }

    // REGRA P2: Se motivo_perda mais frequente for 'Preço'
    if (current.lost.motivos.length > 0) {
        // Obter motivo principal (motivos já vêm ordenados por quantidade desc, mas vamos garantir pegando o maior)
        const principalMotivo = current.lost.motivos.reduce((prev, curr) => (prev.quantidade > curr.quantidade) ? prev : curr);
        if (principalMotivo.motivo_perda.toLowerCase().includes('preço') || principalMotivo.motivo_perda.toLowerCase().includes('preco')) {
            recs.push({
                tipo: 'ajuste',
                area: 'Perdas',
                impacto: 'medio',
                prioridade: 0,
                titulo: 'Objeção Frequente: Preço',
                mensagem: `O motivo mais frequente de perda é "Preço" (${principalMotivo.percentual.toFixed(1)}%).`,
                recomendacao: 'Revisar posicionamento de valor antes de discutir preço.'
            });
        }
    }

    // --- PRIORIZAÇÃO ---
    // Atribuir prioridade baseada no peso do impacto + fatores secundários (aumento ou problemas diretos de metas terão prioridade bônus no sort)
    recs.sort((a, b) => {
        // Regra Primária: Impacto
        const diff = IMPACT_WEIGHT[b.impacto] - IMPACT_WEIGHT[a.impacto];
        if (diff !== 0) return diff;

        // Empate de Impacto: Tipo (Alerta > Oportunidade > Ajuste)
        const typeWeight = { 'alerta': 3, 'oportunidade': 2, 'ajuste': 1 };
        return typeWeight[b.tipo] - typeWeight[a.tipo];
    });

    // Renumerar e Limitar a 3 recomendações (Visão Estratégica)
    return recs.slice(0, 3).map((r, i) => ({ ...r, prioridade: i + 1 }));
}
