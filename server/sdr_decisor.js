/**
 * server/sdr_decisor.js
 * ============================================================================
 * VAMUSS SDR — EXTRATOR DO DECISOR (DIRETOR CLÍNICO) (UPGRADE GROK)
 * ============================================================================
 * Extrai determinística e heuristicamente o nome do Diretor(a) Clínico(a) a partir
 * do HTML público do website da clínica (home, /equipa, /sobre, /corpo-clinico).
 * 
 * Regras Anti-Alucinação e Etiqueta Comercial:
 * 1. Confiança Alta (>= 0.7) e Nome Claro:
 *    -> Usa o nome pessoal na saudação: "Bom dia, Dr. Pedro," ou "Bom dia, Dra. Ana,"
 * 2. Confiança Baixa (< 0.7) ou Nome Ambíguo:
 *    -> NUNCA inventar nem chutar nomes.
 *    -> Usa a saudação coletiva de respeito: "Bom dia, equipa da [Nome da Clínica],"
 * 3. Proibição Expressa:
 *    -> NUNCA usar "Dr(a)" ou "Dr./Dra." — denuncia de imediato mensagem gerada por robô.
 * ============================================================================
 */

/**
 * Padrões regex para encontrar menção ao Diretor(a) Clínico(a) no HTML
 */
const DECISOR_PATTERNS = [
    // Ex: "Diretora Clínica: Dra. Maria Santos" / "Diretor Clínico - Dr. João Silva"
    /(?:diretor[a]?\s+cl[ií]nic[ao]|dire[cç][aã]o\s+cl[ií]nica|respons[aá]vel\s+cl[ií]nic[ao])(?:\s*:|\s*-|\s*—|\s*\|\s*)?\s*(?:dr[a]?\.?|doutor[a]?\.?)?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,3})/i,

    // Ex: "Dr. Pedro Ferreira (Diretor Clínico)"
    /(?:dr[a]?\.?|doutor[a]?\.?)\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,3})\s*\((?:diretor[a]?\s+cl[ií]nic[ao]|dire[cç][aã]o\s+cl[ií]nica)\)/i,

    // Ex: "Dr. Manuel Antunes, Médico Dentista e Diretor Clínico"
    /(?:dr[a]?\.?|doutor[a]?\.?)\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,3}),?\s*(?:m[eé]dico\s+dentista)?\s*(?:e\s+)?(?:diretor[a]?\s+cl[ií]nic[ao])/i
];

/**
 * Padrões secundários de médicos na equipa (caso não haja diretor explícito)
 */
const DOCTOR_NAME_PATTERN = /(?:dr[a]?\.?|doutor[a]?\.?)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,2})/i;

/**
 * Extrai o decisor do texto limpo ou HTML
 * 
 * @param {string} htmlContent - Conteúdo HTML ou texto das páginas
 * @param {string} [sourceUrl=''] - URL onde foi analisado
 * @param {string} [clinicName='Clínica'] - Nome da clínica para fallback
 * @returns {Object} Informações do decisor com índice de confiança
 */
export function extractClinicalDecisionMaker(htmlContent = '', sourceUrl = '', clinicName = 'Clínica') {
    if (!htmlContent || typeof htmlContent !== 'string') {
        return createFallbackDecisor(clinicName, 'Conteúdo vazio');
    }

    // 1. Procura primeiro padrões com menção explícita a Diretor Clínico
    for (const pat of DECISOR_PATTERNS) {
        const match = htmlContent.match(pat);
        if (match && match[1]) {
            const rawName = match[1].trim();
            const isFemale = /(?:diretora|dra\.?|doutora)/i.test(match[0]);
            const title = isFemale ? 'Dra.' : 'Dr.';
            const cleanName = sanitizeDoctorName(rawName);

            if (isValidDoctorName(cleanName)) {
                return {
                    found: true,
                    nome_decisor: cleanName,
                    titulo: title,
                    nome_completo_com_titulo: `${title} ${cleanName}`,
                    confianca: 0.90,
                    cargo: isFemale ? 'Diretora Clínica' : 'Diretor Clínico',
                    fonte_url: sourceUrl,
                    extrato: match[0].slice(0, 120),
                    salutacao_recomendada: `Bom dia, ${title} ${getShortDoctorName(cleanName)},`
                };
            }
        }
    }

    // 2. Procura menções a médicos dentistas gerais destacados (sem confirmação de direção)
    const docMatch = htmlContent.match(DOCTOR_NAME_PATTERN);
    if (docMatch && docMatch[1]) {
        const rawName = docMatch[1].trim();
        const isFemale = /dra\.?|doutora/i.test(docMatch[0]);
        const title = isFemale ? 'Dra.' : 'Dr.';
        const cleanName = sanitizeDoctorName(rawName);

        if (isValidDoctorName(cleanName)) {
            return {
                found: true,
                nome_decisor: cleanName,
                titulo: title,
                nome_completo_com_titulo: `${title} ${cleanName}`,
                confianca: 0.65, // Abaixo do limiar de 0.7 para uso seguro em cold outreach
                cargo: 'Corpo Clínico (Médico Dentista)',
                fonte_url: sourceUrl,
                extrato: docMatch[0].slice(0, 100),
                salutacao_recomendada: `Bom dia, equipa da ${clinicName},` // Fallback seguro pois confiança < 0.7
            };
        }
    }

    return createFallbackDecisor(clinicName, 'Nenhum diretor clínico identificado com certeza');
}

/**
 * Cria resposta segura de fallback quando o decisor não é conhecido
 */
function createFallbackDecisor(clinicName, reason) {
    const cleanClinic = (clinicName || 'Clínica')
        .replace(/^Negócio\s+/i, '')
        .replace(/\s*\|\s*.*$/, '')
        .trim();

    return {
        found: false,
        nome_decisor: null,
        titulo: null,
        nome_completo_com_titulo: null,
        confianca: 0.0,
        cargo: null,
        fonte_url: null,
        extrato: null,
        motivo_fallback: reason,
        salutacao_recomendada: `Bom dia, equipa da ${cleanClinic},`
    };
}

/**
 * Sanitiza o nome do médico removendo palavras espúrias de HTML
 */
function sanitizeDoctorName(name) {
    return name
        .replace(/\s+(médico|médica|dentista|ortodontia|implantes|clínica|cirurgião|cirurgiã|ordem|omd|nº|\d+).*$/i, '')
        .trim();
}

/**
 * Valida se é um nome pessoal aceitável e não ruído de template
 */
function isValidDoctorName(name) {
    if (!name || name.length < 3 || name.length > 40) return false;
    const parts = name.split(/\s+/);
    if (parts.length < 1 || parts.length > 4) return false;
    const invalidKeywords = ['clínica', 'dental', 'saúde', 'sorriso', 'médico', 'dentista', 'doutor', 'doutora', 'serviços', 'marcação'];
    for (const kw of invalidKeywords) {
        if (name.toLowerCase().includes(kw)) return false;
    }
    return true;
}

/**
 * Obtém o primeiro nome (ou primeiro e último) para saudação natural
 */
function getShortDoctorName(fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    return parts[0]; // ex: "Dr. Pedro" é mais natural em pt-PT no WhatsApp do que "Dr. Pedro Santos Ferreira"
}
