/**
 * ============================================================================
 * VAMUSS SDR — CÓPIA CONSULTIVA E NORMALIZAÇÃO (FASE B.12.8)
 * ============================================================================
 * Funções puras de geração de mensagens em português europeu (pt-PT)
 * e normalização de dados, reutilizáveis no browser e em scripts Node.
 * ============================================================================
 */

export function cleanPhone(phone: string | null | undefined): string {
    return (phone || '').replace(/\D/g, '');
}

/**
 * Gera mensagem personalizada e consultiva em português europeu (pt-PT)
 * sem falsas promessas, sem supor problemas de caixa e sem pedir reunião no 1º contacto.
 */
export function generateConsultativeMessage(clinicName: string, channel: 'WHATSAPP' | 'EMAIL'): {
    message: string;
    facts: string[];
    hypotheses: string[];
} {
    const cleanName = clinicName
        .replace(/^Negócio\s+/i, '')
        .replace(/\s*\|\s*.*$/, '')
        .trim();

    if (channel === 'EMAIL') {
        return {
            message: `Assunto: Consultas particulares na ${cleanName}\n\n` +
                     `Exma. equipa da ${cleanName},\n\n` +
                     `Entro em contacto convosco a respeito dos serviços de medicina dentária da vossa clínica.\n\n` +
                     `A Vamuss apoia clínicas em Portugal na estruturação de canais digitais para captação de pacientes para tratamentos particulares (como reabilitação oral, implantes e alinhadores), promovendo previsibilidade na agenda.\n\n` +
                     `Gostaria de colocar uma questão simples: o desenvolvimento do volume de novas primeiras consultas particulares faz parte dos vossos objetivos atuais, ou a vossa agenda já se encontra estabilizada por recomendação?\n\n` +
                     `Com os melhores cumprimentos,\n` +
                     `Philipe Coelho | Vamuss\n` +
                     `[Caso não pretenda receber futuros contactos institucionais, basta responder "Parar" e os vossos dados serão suprimidos.]`,
            facts: [
                `Nome da clínica registado: ${cleanName}`,
                'Canal institucional de correio eletrónico sob domínio corporativo',
                'Setor médico-dentário em Portugal'
            ],
            hypotheses: [
                'Prioridade atual da direção clínica em tratamentos particulares vs. convenções',
                'Grau de dependência de recomendações orgânicas'
            ]
        };
    }

    // Canal WHATSAPP
    return {
        message: `Boa tarde à equipa da ${cleanName}. O meu nome é Philipe e contacto-vos a respeito da área de medicina dentária.\n\n` +
                 `Apoiamos clínicas em Portugal a estruturar sistemas de comunicação focados na atração de primeiras consultas para tratamentos particulares, sem depender de publicações genéricas.\n\n` +
                 `Gostaria de vos colocar uma questão rápida: o crescimento de novas consultas particulares é uma prioridade na vossa gestão neste momento, ou a recomendação de pacientes tem sido suficiente para a vossa capacidade?`,
        facts: [
            `Identificação da entidade: ${cleanName}`,
            'Canal móvel corporativo verificado',
            'Respiro comercial superior a 30 dias'
        ],
        hypotheses: [
            'Capacidade de absorção de novos pacientes na clínica',
            'Existência de equipa de triagem e receção para agendamento'
        ]
    };
}
