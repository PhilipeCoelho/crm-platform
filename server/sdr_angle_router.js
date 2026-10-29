/**
 * server/sdr_angle_router.js
 * ============================================================================
 * VAMUSS SDR — ROUTER DE ÂNGULO COMERCIAL (UPGRADE GROK)
 * ============================================================================
 * Determina o ângulo comercial de ataque cruzando o motivo da perda original no CRM
 * com o dossiê factual de especialidades da clínica.
 * 
 * Matriz de Ângulos:
 * - ja_tinha_agencia -> Foco em consultas particulares marcadas vs métricas de vaidade / likes.
 * - achou_caro       -> Foco em ROI: 1 consulta de implantes cobre a mensalidade de 197 €/mês.
 * - nao_respondeu    -> Facto novo do site + abertura completamente diferente da anterior.
 * - site_em_baixo    -> Baseado estritamente no histórico do CRM. ZERO tratamentos inventados.
 * - default          -> Previsibilidade de particulares via Google e redução de ociosidade.
 * ============================================================================
 */

export const COMMERCIAL_ANGLES = {
    AGENCIA_VS_RESULTADOS: 'agencia_vs_resultados',
    ROI_IMPLANTES_COBRE_CUSTO: 'roi_implantes_cobre_custo',
    NOVO_FACTO_SITE: 'novo_facto_site',
    HISTORICO_CRM_PURO: 'historico_crm_puro',
    PARTICULARES_VS_CONVENCOES: 'particulares_vs_convencoes',
    GABINETES_OCIOSOS_GOOGLE: 'gabinetes_ociosos_google'
};

/**
 * Seleciona o melhor ângulo comercial para o lead
 * 
 * @param {Object} params
 * @param {string} params.lossReason - Motivo de perda original no CRM
 * @param {Object} [params.dossier=null] - Dossiê factual da clínica
 * @param {Object} [params.memory=null] - Memória do lead
 * @returns {Object} { angle: string, angleDescription: string, openingHook: string, recommendedSpinQuestion: string }
 */
export function routeCommercialAngle({
    lossReason = '',
    dossier = null,
    memory = null
}) {
    const normLoss = (lossReason || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const hasWebsite = Boolean(dossier?.hasWebsite && dossier?.accessible !== false);
    const highlightedTreatments = (dossier?.siteAnalysis?.highlightedTreatments || []).map(t => t.toLowerCase());
    const hasImplants = highlightedTreatments.some(t => t.includes('implante') || t.includes('implantologia'));
    const hasOrtho = highlightedTreatments.some(t => t.includes('ortodontia') || t.includes('alinhador') || t.includes('invisalign'));

    // CASO 1: Se o site está em baixo ou não tem website
    if (!hasWebsite) {
        return {
            angle: COMMERCIAL_ANGLES.HISTORICO_CRM_PURO,
            angleDescription: 'Baseado estritamente no CRM. Nenhum tratamento inventado.',
            openingHook: 'Revisão do histórico anterior da clínica sem presunções externas.',
            recommendedSpinQuestion: 'De onde chegam hoje a maioria das vossas primeiras consultas particulares — é sobretudo por recomendação de pacientes?',
            allowsImplants: false
        };
    }

    // CASO 2: Já tinha agência
    if (normLoss.includes('agencia') || normLoss.includes('marketing') || normLoss.includes('equipa interna')) {
        return {
            angle: COMMERCIAL_ANGLES.AGENCIA_VS_RESULTADOS,
            angleDescription: 'Pacientes particulares marcados vs apenas visibilidade ou publicações de redes sociais.',
            openingHook: 'Validar a estrutura atual da clínica e colocar o foco em consultas particulares marcadas.',
            recommendedSpinQuestion: 'No setor dentário, um desafio frequente é medir se a comunicação se traduz em consultas particulares realizadas ou se fica pela visibilidade. No vosso caso, conseguem acompanhar essa correspondência?',
            allowsImplants: hasImplants
        };
    }

    // CASO 3: Achou caro / objeção de preço anterior
    if (normLoss.includes('caro') || normLoss.includes('preco') || normLoss.includes('orcamento') || normLoss.includes('valores')) {
        return {
            angle: hasImplants ? COMMERCIAL_ANGLES.ROI_IMPLANTES_COBRE_CUSTO : COMMERCIAL_ANGLES.PARTICULARES_VS_CONVENCOES,
            angleDescription: hasImplants 
                ? 'Enquadramento em ROI: uma única reabilitação ou implante cobre a estrutura de 197 €/mês.'
                : 'Foco na margem de particulares face aos descontos de seguradoras.',
            openingHook: 'Foco estrito no retorno sobre investimento sem debater custos no vazio.',
            recommendedSpinQuestion: hasImplants
                ? 'Hoje em dia, os pacientes que vos procuram para implantes e reabilitação oral chegam já direcionados para a clínica ou dependem de seguros?'
                : 'Na vossa rotina clínica atual, que peso têm as consultas particulares face às tabelas de convenções?',
            allowsImplants: hasImplants
        };
    }

    // CASO 4: Não respondeu / silêncio anterior
    if (normLoss.includes('nao respondeu') || normLoss.includes('silencio') || normLoss.includes('sem resposta')) {
        // Se temos um facto verificado recente no site, usamos
        const verifiedFacts = dossier?.verifiedFacts || [];
        const hasFacts = verifiedFacts.length > 0;

        return {
            angle: hasFacts ? COMMERCIAL_ANGLES.NOVO_FACTO_SITE : COMMERCIAL_ANGLES.GABINETES_OCIOSOS_GOOGLE,
            angleDescription: hasFacts 
                ? 'Novo facto verificado do website para quebrar o gelo com relevância.'
                : 'Foco na estabilidade de primeiras consultas particulares via pesquisa ativa no Google.',
            openingHook: hasFacts ? `Referência ao facto verificado: "${verifiedFacts[0].fact}"` : 'Pergunta sobre estabilidade de marcações particulares.',
            recommendedSpinQuestion: hasImplants
                ? 'Os tratamentos de maior valor na clínica (como implantes e estética) entram mais por recomendação direta ou sentem oscilações mês a mês?'
                : 'Têm sentido estabilidade no preenchimento dos gabinetes com pacientes particulares ou ainda há semanas mais calmas?',
            allowsImplants: hasImplants
        };
    }

    // CASO DEFAULT: Particulares vs Convenções / Gabinetes Ociosos
    return {
        angle: hasImplants ? COMMERCIAL_ANGLES.GABINETES_OCIOSOS_GOOGLE : COMMERCIAL_ANGLES.PARTICULARES_VS_CONVENCOES,
        angleDescription: 'Previsibilidade de pacientes particulares e redução da dependência de convenções de saúde.',
        openingHook: 'Pergunta cirúrgica sobre a rotina de particulares na clínica.',
        recommendedSpinQuestion: 'De onde chegam hoje a maioria das vossas primeiras consultas particulares — é sobretudo por recomendação de pacientes ou já têm canais ativos de pesquisa?',
        allowsImplants: hasImplants
    };
}
