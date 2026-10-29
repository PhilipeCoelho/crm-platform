/**
 * server/sdr_lint.js
 * ============================================================================
 * VAMUSS SDR — LINTER DE MENSAGENS PRÉ-ENVIO (UPGRADE GROK)
 * ============================================================================
 * Camada determinística de inspeção de qualidade, conformidade e segurança.
 * Nenhuma mensagem gerada por LLM é transmitida pelo WhatsApp sem passar neste linter.
 * 
 * Regras Estritas de Rejeição:
 * 1. Tamanho: > 4 linhas OU > 320 caracteres.
 * 2. Perguntas: > 1 ponto de interrogação (?) por mensagem.
 * 3. Clichés Banidos: "espero que esteja tudo bem", "olá tudo bem", "venho por este meio", "Dr(a)".
 * 4. Fatos e Tratamentos: Não pode citar tratamento ausente do dossiê factual.
 * 5. Preço: Não pode mencionar valores (197 € ou outro) sem pergunta prévia do lead.
 * 6. Cal.com: Não pode incluir link de agenda se não houver intenção de agendamento confirmada.
 * 7. Confiança: Se confiança da intenção < 0.65 (salvo opt-out).
 * 8. Cadência: Não pode ser a 4ª mensagem outbound consecutiva sem resposta humana.
 * 9. Idioma pt-PT: Rejeita brasileirismos (contato, equipe, usuário, etc.).
 * ============================================================================
 */

export const BANNED_CLICHES = [
    /espero\s+que\s+esteja\s+tudo\s+bem/i,
    /ol[aá],?\s+tudo\s+bem\??/i,
    /venho\s+por\s+este\s+meio/i,
    /dr\(a\)/i,
    /dr\.\(a\)/i,
    /dr\/dra/i,
    /prezado/i,
    /atenciosamente/i,
    /gostaria\s+de\s+apresentar\s+a\s+nossa\s+empresa/i,
    /somos\s+uma\s+ag[eê]ncia/i
];

export const BRAZILIAN_WORDS = [
    /\bcontato\b/i,
    /\bcontatos\b/i,
    /\bequipe\b/i,
    /\busu[aá]rio\b/i,
    /\bcadastre\b/i,
    /\bcadastro\b/i,
    /\bconosco\b/i,
    /\bvoc[eê]\s+est[aá]\b/i // preferir "está a" ou "têm sentido"
];

/**
 * Executa o linting rigoroso da mensagem proposta antes do envio
 * 
 * @param {Object} params
 * @param {string} params.messageText - Mensagem proposta para envio
 * @param {Object} [params.dossier=null] - Dossiê factual verificado da clínica
 * @param {number} [params.outboundCountWithoutHuman=0] - Contagem de outbounds sem resposta humana
 * @param {string} [params.intent=''] - Intenção identificada do lead
 * @param {number} [params.intentConfidence=1.0] - Grau de confiança da intenção (0 a 1)
 * @param {boolean} [params.leadAskedPrice=false] - Se o lead perguntou preço explicitamente
 * @param {boolean} [params.leadWantsBooking=false] - Se o lead expressou intenção de agendamento
 * @returns {Object} { ok: boolean, problemas: string[] }
 */
export function lintSDRMessage({
    messageText = '',
    dossier = null,
    outboundCountWithoutHuman = 0,
    intent = '',
    intentConfidence = 1.0,
    leadAskedPrice = false,
    leadWantsBooking = false
}) {
    const text = (messageText || '').trim();
    const problemas = [];

    if (!text) {
        return { ok: false, problemas: ['Mensagem vazia'] };
    }

    // 1. Limite de Linhas e Caracteres (> 4 linhas OU > 320 caracteres)
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 4) {
        problemas.push(`Mensagem tem ${lines.length} linhas (máximo permitido: 4 linhas)`);
    }
    if (text.length > 320) {
        problemas.push(`Mensagem tem ${text.length} caracteres (máximo permitido: 320 caracteres)`);
    }

    // 2. Limite de Perguntas (> 1 pergunta por mensagem)
    const questionMarks = (text.match(/\?/g) || []).length;
    if (questionMarks > 1) {
        problemas.push(`Mensagem contém ${questionMarks} perguntas (máximo permitido: 1 pergunta por mensagem)`);
    }

    // 3. Clichés Banidos
    for (const cliche of BANNED_CLICHES) {
        if (cliche.test(text)) {
            problemas.push(`Contém cliché ou fórmula banida: "${cliche.toString()}"`);
            break;
        }
    }

    // 4. Detecção de Brasileirismos (Exigência estrita de pt-PT)
    for (const brPattern of BRAZILIAN_WORDS) {
        if (brPattern.test(text)) {
            problemas.push(`Contém termo em pt-BR em vez de pt-PT (ex: "contato" -> "contacto", "equipe" -> "equipa"): ${brPattern.toString()}`);
            break;
        }
    }

    // 5. Citação de Tratamentos NÃO Constantes no Dossiê
    const treatmentKeywords = [
        { term: 'implante', label: 'Implantes Dentários / Implantologia' },
        { term: 'invisalign', label: 'Ortodontia / Alinhadores Invisíveis' },
        { term: 'alinhador', label: 'Ortodontia / Alinhadores Invisíveis' },
        { term: 'ortodontia', label: 'Ortodontia' },
        { term: 'faceta', label: 'Estética Dental e Facetas' },
        { term: 'reabilita[cç][aã]o', label: 'Reabilitação Oral' }
    ];

    if (dossier) {
        const highlighted = (dossier.siteAnalysis?.highlightedTreatments || []).map(t => t.toLowerCase());
        const verifiedFacts = (dossier.verifiedFacts || []).map(f => (f.fact || '').toLowerCase());
        const combinedDossier = highlighted.join(' ') + ' ' + verifiedFacts.join(' ');

        for (const tk of treatmentKeywords) {
            const regex = new RegExp(`\\b${tk.term}`, 'i');
            if (regex.test(text)) {
                // Se mencionou o tratamento no texto, ele DEVE estar presente no dossiê
                const isConfirmed = combinedDossier.includes(tk.term) || highlighted.some(h => h.includes(tk.term));
                if (!isConfirmed) {
                    problemas.push(`Mencionou tratamento ("${tk.term}") que NÃO consta no dossiê factual da clínica`);
                }
            }
        }
    }

    // 6. Preço Sem Pergunta Prévia (197 € ou menção de valores)
    const mentionsPrice = /(197|€|euros|mensalidade|preço|valor|custa)/i.test(text);
    if (mentionsPrice && !leadAskedPrice) {
        problemas.push('Mencionou preço ou valores sem que o lead tenha perguntado previamente');
    }

    // 7. Cal.com Sem Intenção de Agendamento Confirmada
    const mentionsCalcom = /cal\.com/i.test(text);
    if (mentionsCalcom && !leadWantsBooking && intent !== 'INTENCAO_AGENDAMENTO') {
        problemas.push('Incluiu link do Cal.com sem intenção explícita de agendamento confirmada');
    }

    // 8. Confiança da Intenção Inbound < 0.65
    if (intent && intent !== 'OPTOUT_OU_OPOSICAO' && intentConfidence < 0.65) {
        problemas.push(`Grau de confiança da intenção (${intentConfidence.toFixed(2)}) abaixo do limiar seguro (0.65)`);
    }

    // 9. Bloqueio de Cadência: 4ª Mensagem Outbound Sem Resposta Humana
    if (outboundCountWithoutHuman >= 3) {
        problemas.push(`Bloqueado por teto de cadência: já foram efetuados ${outboundCountWithoutHuman} disparos sem qualquer resposta humana`);
    }

    return {
        ok: problemas.length === 0,
        problemas
    };
}
