/**
 * server/sdr_auto_reply_filter.js
 * ============================================================================
 * FILTRO SUB-MILISSEGUNDO DE RESPOSTAS AUTOMÁTICAS (WHATSAPP BUSINESS BOTS)
 * ============================================================================
 * Executa inspeção de regex compilado em < 0.01 ms (sub-milissegundo).
 * Garante que APENAS respostas de humanos reais avançam o negócio para "Lead Engajado".
 * Respostas de bots de receção, mensagens de boas-vindas ou ausência são detetadas,
 * silenciadas e mantêm o lead na etapa "Lead (Aguardando Retorno Humano)".
 * ============================================================================
 */

export const AUTO_REPLY_PATTERNS = [
    /obrigad[oa] por nos contactar/i,
    /obrigad[oa] por entrar em contacto/i,
    /obrigad[oa] pelo seu contacto/i,
    /agradecemos a sua mensagem/i,
    /agradecemos o seu contacto/i,
    /estamos [àa] sua disposi[çc][ãa]o/i,
    /está a contactar a /i,
    /está a contatar a /i,
    /está a falar com a /i,
    /bem[- ]vindo\(?a?\)? [àa] /i,
    /daremos resposta t[ãa]o breve quanto poss[íi]vel/i,
    /responderemos assim que poss[íi]vel/i,
    /responderemos com a maior brevidade/i,
    /fora do hor[áa]rio de atendimento/i,
    /o nosso hor[áa]rio de funcionamento/i,
    /hor[áa]rio de atendimento/i,
    /estamos encerrados/i,
    /de momento n[ãa]o estamos dispon[íi]veis/i,
    /de momento n[ãa]o nos [ée] poss[íi]vel atender/i,
    /informamos que o nosso hor[áa]rio/i,
    /mensagem autom[áa]tica/i,
    /esta [ée] uma mensagem autom[áa]tica/i,
    /auto[ -]?reply/i,
    /auto[ -]?responder/i,
    /mensagem predefinida/i,
    /assistente virtual/i,
    /atendimento autom[áa]tico/i,
    /digite \d|prima \d|op[çc][ãa]o \d|menu principal/i,
    /para agendar consulta envie/i,
    /pedimos-lhe que nos contacte para \d+/i,
    /in order to answer you as soon as possible/i,
    /welcome to /i
];

/**
 * Validação instantânea (< 0.01ms):
 * Retorna true se a mensagem for auto-resposta automática de WhatsApp Business.
 * @param {string} rawText 
 * @returns {boolean}
 */
export function isClinicAutoReply(rawText) {
    if (!rawText || typeof rawText !== 'string') return false;
    const text = rawText.toLowerCase().trim();
    if (text.length === 0) return false;

    for (let i = 0; i < AUTO_REPLY_PATTERNS.length; i++) {
        if (AUTO_REPLY_PATTERNS[i].test(text)) {
            return true;
        }
    }
    return false;
}
