/**
 * ============================================================================
 * VAMUSS SDR — CLASSIFICADOR DE RESPOSTAS INBOUND (FASE B.1)
 * ============================================================================
 * Módulo de inteligência e segurança para interpretação de mensagens recebidas.
 * Opera de forma desacoplada para testes offline e execução em produção.
 * 
 * Regra de Ouro de Segurança:
 * Se uma mensagem contiver simultaneamente interesse e um pedido de oposição,
 * a OPOSIÇÃO / OPT-OUT PREVALECE SEMPRE.
 * ============================================================================
 */

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
 * Classificador determinístico de alta precisão (Firewall de Respostas)
 */
export function classifyInboundResponse({ texto, canal_origem = 'WHATSAPP', contexto = {} } = {}) {
    if (!texto || typeof texto !== 'string' || !texto.trim()) {
        return {
            categoria: 'RESPOSTA_INDETERMINADA',
            confianca: 'baixa',
            evidencia: '(mensagem vazia ou sem texto)',
            acao_recomendada: 'revisao_humana',
            revisao_humana: true,
            data_seguimento: null,
            bloqueio_contacto: false,
            canal_permitido: null,
            motivo_bloqueio_sugerido: null
        };
    }

    const raw = texto.trim();
    const norm = normalizeText(raw);

    // -------------------------------------------------------------------------
    // PRIORIDADE 1: RESPOSTA AUTOMÁTICA / AUTO-REPLY / FORA DO ESCRITÓRIO
    // -------------------------------------------------------------------------
    const isAutoReply = 
        norm.includes('mensagem automatica') ||
        norm.includes('resposta automatica') ||
        norm.includes('estamos ausentes') ||
        norm.includes('fora do escritorio') ||
        norm.includes('auto reply') ||
        norm.includes('agradecemos o seu contacto responderemos assim que possivel') ||
        norm.includes('este e um canal de atendimento automatico');

    if (isAutoReply) {
        return {
            categoria: 'RESPOSTA_AUTOMATICA',
            confianca: 'alta',
            evidencia: raw,
            acao_recomendada: 'ignorar_e_aguardar_resposta_humana',
            revisao_humana: false,
            data_seguimento: null,
            bloqueio_contacto: false,
            canal_permitido: canal_origem,
            motivo_bloqueio_sugerido: null
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 2: OPTOUT FORMAL / OPOSIÇÃO LEGAL (RGPD / DL 7/2004)
    // -------------------------------------------------------------------------
    const optoutSingleWords = ['stop', 'pare', 'sair', 'cancelar', 'cancel', 'basta', 'unsubscribe'];
    const words = norm.split(/\s+/);
    const isSingleWordOptout = optoutSingleWords.includes(norm) || (words.length <= 2 && words.some(w => optoutSingleWords.includes(w)));

    const isOptout = 
        isSingleWordOptout ||
        norm.startsWith('pare ') ||
        norm.startsWith('parem ') ||
        norm.startsWith('stop ') ||
        norm.includes('pare de enviar') ||
        norm.includes('parem de enviar') ||
        norm.includes('pare de mandar') ||
        norm.includes('parem de mandar') ||
        norm.includes('pare de ligar') ||
        norm.includes('parem de ligar') ||
        norm.includes('parar de enviar') ||
        norm.includes('parar com as mensagens') ||
        norm.includes('parem com as mensagens') ||
        norm.includes('parar de mandar') ||
        norm.includes('parar de ligar') ||
        norm.includes('nao voltem a contactar') ||
        norm.includes('nao nos voltem a contactar') ||
        norm.includes('nao volte a contactar') ||
        norm.includes('nao nos volte a contactar') ||
        norm.includes('nao voltem a ligar') ||
        norm.includes('nao nos voltem a ligar') ||
        norm.includes('retirem o nosso contacto') ||
        norm.includes('retirem o meu contacto') ||
        norm.includes('retirem o nosso numero') ||
        norm.includes('retirem o meu numero') ||
        norm.includes('remover o nosso numero') ||
        norm.includes('remover o meu numero') ||
        norm.includes('remover da lista') ||
        norm.includes('remover da vossa lista') ||
        norm.includes('retirar da lista') ||
        norm.includes('retirar da vossa lista') ||
        norm.includes('nao liguem mais') ||
        norm.includes('nao nos liguem mais') ||
        norm.includes('nao enviem mais') ||
        norm.includes('nao nos enviem mais') ||
        norm.includes('nao mandem mais') ||
        norm.includes('nao nos mandem mais') ||
        norm.includes('vou fazer queixa') ||
        norm.includes('bloquear') ||
        norm.includes('bloqueado');

    if (isOptout) {
        return {
            categoria: 'OPTOUT',
            confianca: 'maxima',
            evidencia: raw,
            acao_recomendada: 'interromper_cadencia_e_registar_supressao',
            revisao_humana: false,
            data_seguimento: null,
            bloqueio_contacto: true,
            canal_permitido: null,
            motivo_bloqueio_sugerido: 'OPTOUT_EXPLICITO'
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 3: RECUSA COMERCIAL EXPRESSA (Sem interesse na proposta / Agência ativa)
    // -------------------------------------------------------------------------
    const isRefusal = 
        norm.includes('nao temos interesse') ||
        norm.includes('nao temos qualquer interesse') ||
        norm.includes('nao tenho interesse') ||
        norm.includes('nao estamos interessados') ||
        norm.includes('nao estou interessado') ||
        norm.includes('sem interesse') ||
        norm.includes('nao obrigado') ||
        norm.includes('nao obrigada') ||
        norm.includes('obrigado mas nao') ||
        norm.includes('obrigada mas nao') ||
        norm.includes('dispensamos') ||
        norm.includes('nao precisamos de') ||
        norm.includes('nao precisamos') ||
        norm.includes('ja temos agencia') ||
        norm.includes('ja trabalhamos com outra') ||
        norm.includes('ja anunciamos') ||
        norm.includes('ja temos quem trate') ||
        norm.includes('nao pretendemos');

    if (isRefusal) {
        return {
            categoria: 'RECUSA_COMERCIAL',
            confianca: 'alta',
            evidencia: raw,
            acao_recomendada: 'interromper_cadencia_e_registar_recusa',
            revisao_humana: false,
            data_seguimento: null,
            bloqueio_contacto: true,
            canal_permitido: null,
            motivo_bloqueio_sugerido: 'RECUSA_COMERCIAL'
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 4: RESTRIÇÃO EXPLÍCITA DE CANAL (ex: apenas por email)
    // -------------------------------------------------------------------------
    const isChannelRestricted = 
        (norm.includes('apenas por email') ||
         norm.includes('enviem apenas por email') ||
         norm.includes('so por email') ||
         norm.includes('enviem para o nosso email') ||
         norm.includes('enviar para o email') ||
         norm.includes('enviar para o nosso email') ||
         norm.includes('mandem por email') ||
         norm.includes('canal de atendimento medico') ||
         norm.includes('este contacto e apenas para marcacoes')) &&
        !isRefusal;

    if (isChannelRestricted) {
        return {
            categoria: 'RESTRICAO_CANAL',
            confianca: 'alta',
            evidencia: raw,
            acao_recomendada: 'bloquear_whatsapp_e_avaliar_email',
            revisao_humana: false,
            data_seguimento: null,
            bloqueio_contacto: false,
            canal_permitido: 'EMAIL',
            motivo_bloqueio_sugerido: 'RESTRICAO_CANAL'
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 5: ADIAMENTO / MOMENTO INOPORTUNO COM DATA OU CONDIÇÃO
    // -------------------------------------------------------------------------
    const isPostponed = 
        norm.includes('em obras') ||
        norm.includes('equipa completa') ||
        norm.includes('contactem mais tarde') ||
        norm.includes('contactem nos mais tarde') ||
        norm.includes('falem mais tarde') ||
        norm.includes('agora nao') ||
        norm.includes('no proximo mes') ||
        norm.includes('para a semana') ||
        norm.includes('em janeiro') ||
        norm.includes('em fevereiro') ||
        norm.includes('em marco') ||
        norm.includes('em setembro') ||
        norm.includes('depois das ferias');

    if (isPostponed) {
        // Tentar extrair mês ou prazo
        let followUpDate = null;
        const meses = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        for (const m of meses) {
            if (norm.includes(m)) {
                followUpDate = m;
                break;
            }
        }
        if (!followUpDate) {
            if (norm.includes('no proximo mes')) followUpDate = 'proximo_mes';
            else if (norm.includes('para a semana') || norm.includes('proxima semana')) followUpDate = 'proxima_semana';
            else if (norm.includes('depois das ferias')) followUpDate = 'pos_ferias';
        }

        return {
            categoria: 'ADIAMENTO',
            confianca: 'alta',
            evidencia: raw,
            acao_recomendada: 'pausar_cadencia_e_agendar_reavaliacao',
            revisao_humana: false,
            data_seguimento: followUpDate,
            bloqueio_contacto: false,
            canal_permitido: canal_origem,
            motivo_bloqueio_sugerido: 'CONTINGENCIA_OPERACIONAL'
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 6: INTERESSE COMERCIAL OU PEDIDO DE INFORMAÇÃO
    // -------------------------------------------------------------------------
    const isInterest = 
        norm.includes('como funciona') ||
        norm.includes('quanto custa') ||
        norm.includes('quais sao os valores') ||
        norm.includes('tem apresentacao') ||
        norm.includes('pode explicar') ||
        norm.includes('podem enviar proposta') ||
        norm.includes('mais detalhes') ||
        norm.includes('mais informacoes') ||
        norm.includes('mais informacao') ||
        norm.includes('enviar detalhes') ||
        norm.includes('enviar informacoes') ||
        norm.includes('podemos marcar') ||
        norm.includes('qual o vosso contacto') ||
        norm.includes('podem ligar') ||
        norm.includes('tenho interesse') ||
        norm.includes('temos interesse');

    if (isInterest) {
        const isInfoRequest = 
            norm.includes('quanto custa') || 
            norm.includes('como funciona') || 
            norm.includes('pode explicar') ||
            norm.includes('mais detalhes') ||
            norm.includes('mais informac') ||
            norm.includes('enviar detalhes') ||
            norm.includes('enviar informac');

        return {
            categoria: isInfoRequest ? 'PEDIDO_INFORMACAO' : 'INTERESSE',
            confianca: 'alta',
            evidencia: raw,
            acao_recomendada: 'encaminhar_closer_alta_prioridade',
            revisao_humana: false,
            data_seguimento: null,
            bloqueio_contacto: false,
            canal_permitido: canal_origem,
            motivo_bloqueio_sugerido: null
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 7: OBJEÇÃO COMERCIAL CONVERSACIONAL (Ex: "Já temos alguém mas...")
    // -------------------------------------------------------------------------
    const isObjection = 
        norm.includes('e muito caro') ||
        norm.includes('ja tivemos mas correu mal') ||
        norm.includes('nao acredito em') ||
        norm.includes('ja tivemos mas');

    if (isObjection) {
        return {
            categoria: 'OBJECAO',
            confianca: 'media',
            evidencia: raw,
            acao_recomendada: 'encaminhar_sdr_para_contorno_consultivo',
            revisao_humana: true,
            data_seguimento: null,
            bloqueio_contacto: false,
            canal_permitido: canal_origem,
            motivo_bloqueio_sugerido: null
        };
    }

    // -------------------------------------------------------------------------
    // PRIORIDADE 8: AMBIGUIDADE / RESPOSTA INDETERMINADA (Ex: "Neste momento não dá")
    // -------------------------------------------------------------------------
    return {
        categoria: 'RESPOSTA_INDETERMINADA',
        confianca: 'baixa',
        evidencia: raw,
        acao_recomendada: 'revisao_humana_obrigatoria',
        revisao_humana: true,
        data_seguimento: null,
        bloqueio_contacto: false,
        canal_permitido: null,
        motivo_bloqueio_sugerido: null
    };
}
