import { StageSequence } from "../types/schema";

export const LEAD_SEQUENCE_TEMPLATES: StageSequence[] = [
    {
        id: 'lead_1',
        stageName: 'new',
        dayOffset: 0,
        activityType: 'message',
        defaultTitle: 'WhatsApp: Mensagem inicial',
        defaultDescription: 'Objetivo: Abertura de 70%+ / Resposta de 30%+',
        tooltipScript: `[HOOK DIRETO - Sem "Olá, tudo bem?"]\n"Dra. [Nome], vi que a [Nome da Clínica] está sem presença digital estruturada. Não estou a enviar proposta. Só uma pergunta: quantas consultas deixou de marcar esta semana porque o paciente não a encontrou no Google antes de ligar para a concorrência?"\n\n[PAUSA - Aguardar resposta]\n\n"Trabalho exclusivamente com clínicas dentárias em Portugal. Ajudei a [Nome de Clínica Referência/Genérico] a aumentar o Payer Mix em 40% em 6 meses. Não vendo 'posts bonitos'. Vendo previsibilidade de faturamento."\n\n[CTA LEVE]\n"Valia a pena uma conversa de 15 minutos para eu mostrar onde está a fuga de dinheiro na sua captação? Sem compromisso. Se não fizer sentido, diz-me e não volto a incomodar."`,
        orderIndex: 1,
        isActive: true
    },
    {
        id: 'lead_2',
        stageName: 'new',
        dayOffset: 1,
        activityType: 'email',
        defaultTitle: 'Email: Apresentação',
        defaultDescription: 'Assunto: "A fuga de dinheiro que a Dra. [Nome] não está a ver"',
        tooltipScript: `Assunto: "A fuga de dinheiro que a Dra. [Nome] não está a ver"\n\nCorpo do Email:\nDra. [Nome],\nEnviei-lhe ontem uma mensagem no WhatsApp. Não respondeu. Normal. Gestores de clínicas recebem dezenas de "propostas de marketing" por semana.\n\nA diferença: eu não sou uma agência de "gestão de redes sociais".\n\nO que faço:\nAuditamos a jornada do paciente particular de alta valor desde o primeiro clique no Google até à confirmação da consulta. Depois implementamos os sistemas para que essa máquina funcione sem depender do "humor" da rececionista ou da "sorte" do boca-a-boca.\n\nResultado concreto:\nClínica similar à sua em [Cidade/Região Genérica] passou de 70% convenção/30% particular para 45% convenção/55% particular em 4 meses. O faturamento por consulta médio subiu de 42€ para 89€.\n\nPorque lhe escrevo:\nAnalisei a [Nome da Clínica] e identifiquei 3 pontos de fuga imediatos:\n- [Google Business Profile sem fotos da equipa]\n- [Website sem sistema de marcação online]\n- [Zero rastreio de origem das ligações]\n\nPróximo passo:\nPosso enviar-lhe uma mini-auditoria gratuita (vídeo de 5 minutos) mostrando exatamente onde está a perder dinheiro? Basta confirmar este email.`,
        orderIndex: 2,
        isActive: true
    },
    {
        id: 'lead_3',
        stageName: 'new',
        dayOffset: 3,
        activityType: 'call',
        defaultTitle: 'Ligação: Tentativa 1',
        defaultDescription: 'Duração: Máx 3 minutos | Objetivo: Qualificar + Agendar',
        tooltipScript: `[ABERTURA - 0-10s]\n"Dra. [Nome]? É o Philipe Coelho. Enviei-lhe uma mensagem e um email sobre a captação de pacientes da [Nome da Clínica]. Tem 90 segundos? Se não for boa altura, marcamos para amanhã."\n\n[SE DIZER QUE NÃO TEM TEMPO]\n"Percebo. Só preciso de saber: está satisfeita com a percentagem de consultas particulares vs convencionadas neste momento?"\n\n[SE DEIXAR CONTINUAR]\n"Perfeito. Vou ser direto: não lhe vou vender nada nesta chamada. Só quero perceber se faz sentido eu mostrar-lhe onde está a perder pacientes particulares para a concorrência. São 15 minutos na sexta ou na próxima semana?"\n\n[OBJEÇÃO: "Já temos marketing"]\n"Excelente. Isso significa que já investe em crescer. A minha pergunta é diferente: consegue-me dizer, com números, quanto gastou em anúncios no último mês e quanto retornou em consultas particulares pagas?"\n\n[FECHO]\n"Vou enviar-lhe uma proposta de horário por email."`,
        orderIndex: 3,
        isActive: true
    },
    {
        id: 'lead_4',
        stageName: 'new',
        dayOffset: 5,
        activityType: 'analysis',
        defaultTitle: 'Vídeo: Análise digital',
        defaultDescription: 'Formato: Vídeo Loom de 5-7 minutos (não PDF)',
        tooltipScript: `[0-30s] HOOK VISUAL: "Dra. [Nome], vou mostrar-lhe exatamente o que um paciente particular vê quando procura por 'dentista [cidade]' no Google."\n\n[30s-2min] DIAGNÓSTICO VISUAL: Mostrar Google Business Profile, Website e Redes Sociais.\n\n[2-4min] OS 3 PROBLEMAS:\n1. Invisibilidade de Intenção (Busca)\n2. Fratura de Confiança (Avaliações)\n3. Ausência de Sistema (Marcação Online)\n\n[4-5min] PROVA DE CONCEITO: "Sabe quantos pacientes desistem de marcar se tiverem que ligar vs clicar? 60%. A 80€ médio por consulta, são 2.400€/mês a evaporar-se."\n\n[5-6min] CTA PARA REUNIÃO: "Quer que eu lhe mostre como funciona numa call de 20 minutos?"`,
        orderIndex: 4,
        isActive: true
    },
    {
        id: 'lead_5',
        stageName: 'new',
        dayOffset: 8,
        activityType: 'email',
        defaultTitle: 'Email: Insight estratégico',
        defaultDescription: 'Assunto: "Porque é que 7% dos dentistas fugiram de Portugal em 2025"',
        tooltipScript: `Dra. [Nome],\nNão é clickbait. É dado do Ordem dos Médicos Dentistas.\nO mercado está a dividir-se em dois:\n\nGrupo A: Grandes grupos com máquinas de captação digital, margens de 40%+.\nGrupo B: Clínicas independentes a competir por migalhas de convenção, margens de 8-12%.\n\nA diferença não é qualidade clínica. É arquitetura comercial.\n\nA sua clínica está a construir um ativo que vale alguma coisa para vender no futuro, ou está a criar um emprego para si mesma que paga mal e exige demais?\n\nSe a resposta incomodar, talvez seja altura de conversarmos.`,
        orderIndex: 5,
        isActive: true
    },
    {
        id: 'lead_6',
        stageName: 'new',
        dayOffset: 10,
        activityType: 'audit',
        defaultTitle: 'Vídeo: Mini auditoria',
        defaultDescription: 'Formato: PDF de 1 página + Vídeo de 3 minutos',
        tooltipScript: `DIAGNÓSTICO DIGITAL | [Nome da Clínica]\n\nSecção 1: Score de Maturidade Digital (0-100)\n- Presença de Busca\n- Conversão de Website\n- Gestão de Reputação\n- Sistemas de Retenção\n\nSecção 2: Os 3 Maiores Gargalos\nSecção 3: Impacto Financeiro Estimado\nSecção 4: Próximo Passo: "Reunião de Diagnóstico de 30 minutos. Zero proposta. Só estratégia."`,
        orderIndex: 6,
        isActive: true
    },
    {
        id: 'lead_7',
        stageName: 'new',
        dayOffset: 12,
        activityType: 'call',
        defaultTitle: 'Ligação: Tentativa 2',
        defaultDescription: 'Objetivo: Superar últimas objeções + Agendar RD',
        tooltipScript: `[ABERTURA]\n"Dra. [Nome], Philipe Coelho de novo. Enviei-lhe ontem a auditoria da clínica. Viu o vídeo?"\n\n[SE NÃO VIU]\n"Normal, está ocupada. Só me diga: está satisfeita com o mix de faturamento atual ou quer saber onde está a fugir dinheiro?"\n\n[SE VIU]\n"O que é que mais a incomodou no diagnóstico?"\n\n[OBJEÇÃO: "Preciso de pensar"]\n"Percebo. Mas o dinheiro que está a perder continua a fugir enquanto pensa."\n\n[OBJEÇÃO: "É muito caro"]\n"Ainda não lhe apresentei preço. Mas já lhe mostrei que está a perder [X]€ por mês. É caro resolver, ou é caro continuar a perder?"`,
        orderIndex: 7,
        isActive: true
    },
    {
        id: 'lead_8',
        stageName: 'new',
        dayOffset: 15,
        activityType: 'email',
        defaultTitle: 'Email: Convite fechamento',
        defaultDescription: 'Assunto: "Convite confirmado: Diagnóstico [Nome da Clínica]"',
        tooltipScript: `Dra. [Nome],\nReunião confirmada para [Dia] às [Hora].\n\nO que vai acontecer nestes 30 minutos:\n- Contexto (5 min)\n- Diagnóstico (15 min)\n- Estratégia (8 min)\n- Decisão (2 min)\n\nO que preciso de si:\n- Acesso ao Google Analytics (se tiver)\n- Honestidade sobre números\n- Decisão de sim ou não no final\n\nAté [Dia],`,
        orderIndex: 8,
        isActive: true
    }
];

export const ENGAGED_LEAD_SEQUENCE_TEMPLATES: StageSequence[] = [
    {
        id: 'engaged_1',
        stageName: 'LEAD ENGAJADO',
        dayOffset: 0,
        activityType: 'message',
        defaultTitle: 'Resposta + Pergunta Estratégica',
        defaultDescription: 'Responder o lead e fazer UMA pergunta estratégica. Ex: "Perfeito. Hoje vocês já investem em anúncios ou dependem mais de indicação?"',
        orderIndex: 1,
        isActive: true
    },
    {
        id: 'engaged_2',
        stageName: 'LEAD ENGAJADO',
        dayOffset: 1,
        activityType: 'message',
        defaultTitle: 'Apontar o Problema',
        defaultDescription: 'Mensagem curta ativando a dor principal. Ex: "Normalmente clínicas que dependem só de indicação acabam tendo meses mais fracos. Isso acontece aí também?"',
        orderIndex: 2,
        isActive: true
    },
    {
        id: 'engaged_3',
        stageName: 'LEAD ENGAJADO',
        dayOffset: 3,
        activityType: 'message',
        defaultTitle: 'Ampliar o Impacto',
        defaultDescription: 'Mostrar a consequência do problema. Ex: "Quando a agenda oscila, isso impacta direto no faturamento e na previsibilidade. Já calcularam quanto deixam de faturar nos meses mais fracos?"',
        orderIndex: 3,
        isActive: true
    },
    {
        id: 'engaged_4',
        stageName: 'LEAD ENGAJADO',
        dayOffset: 5,
        activityType: 'message',
        defaultTitle: 'Mostrar Valor da Solução',
        defaultDescription: 'Criar desejo pela solução. Ex: "Se vocês tivessem previsibilidade de 10 a 20 novos pacientes por mês, mudaria o cenário atual?"',
        orderIndex: 4,
        isActive: true
    },
    {
        id: 'engaged_5',
        stageName: 'LEAD ENGAJADO',
        dayOffset: 7,
        activityType: 'message',
        defaultTitle: 'Convite Direto',
        defaultDescription: 'Chamada objetiva para reunião. Ex: "Posso te mostrar onde está o gargalo e como resolver em 20 minutos. Qual dia funciona melhor para você?"',
        orderIndex: 5,
        isActive: true
    }
];

export const RD_SEQUENCE_TEMPLATES: StageSequence[] = [
    {
        id: 'rd_1',
        stageName: 'REUNIÃO DE DIAGNÓSTICO',
        dayOffset: 0,
        activityType: 'message',
        defaultTitle: 'RD – Confirmação oficial',
        tooltipScript: 'Confirmado para dia [DATA] às [HORA].\nVou analisar sua presença online antes da nossa conversa.',
        orderIndex: 1,
        isActive: true
    },
    {
        id: 'rd_2',
        stageName: 'REUNIÃO DE DIAGNÓSTICO',
        dayOffset: 0,
        activityType: 'task',
        defaultTitle: 'RD – Preparar análise digital',
        defaultDescription: 'Tarefa interna para preparar os pontos da clínica.',
        orderIndex: 2,
        isActive: true
    },
    {
        id: 'rd_3',
        stageName: 'REUNIÃO DE DIAGNÓSTICO',
        dayOffset: 1,
        defaultTitle: 'RD – Lembrete 24h',
        activityType: 'message',
        tooltipScript: 'Amanhã às [HORA] analisamos sua clínica.\nJá levantei alguns pontos importantes.',
        orderIndex: 3,
        isActive: true
    },
    {
        id: 'rd_4',
        stageName: 'REUNIÃO DE DIAGNÓSTICO',
        dayOffset: 2,
        defaultTitle: 'RD – Lembrete 1h',
        activityType: 'message',
        tooltipScript: 'Nos vemos em 1 hora.\nSegue o link da reunião: [LINK]',
        orderIndex: 4,
        isActive: true
    },
    {
        id: 'rd_5',
        stageName: 'REUNIÃO DE DIAGNÓSTICO',
        dayOffset: 2,
        defaultTitle: 'RD – Reunião realizada',
        activityType: 'task',
        defaultDescription: 'Registro manual da reunião.',
        orderIndex: 5,
        isActive: true
    }
];

export const FE_SEQUENCE_TEMPLATES: StageSequence[] = [
    {
        id: 'fe_1',
        stageName: 'FECHAMENTO',
        dayOffset: 0,
        activityType: 'message',
        defaultTitle: 'FE – Resumo pós-reunião',
        tooltipScript: 'Conforme alinhamos, hoje vocês perdem previsibilidade\npor falta de aquisição estruturada.\nO plano seria iniciar com [PLATAFORMA] focando em [SERVIÇO].',
        orderIndex: 1,
        isActive: true
    },
    {
        id: 'fe_2',
        stageName: 'FECHAMENTO',
        dayOffset: 2,
        activityType: 'message',
        defaultTitle: 'FE – Follow-up 1',
        tooltipScript: 'Conseguiu avaliar a proposta?\nFaz sentido avançarmos ainda esta semana?',
        orderIndex: 2,
        isActive: true
    },
    {
        id: 'fe_3',
        stageName: 'FECHAMENTO',
        dayOffset: 4,
        activityType: 'message',
        defaultTitle: 'FE – Follow-up 2',
        tooltipScript: 'Enquanto isso não estiver ativo,\nvocês continuam dependentes de indicação.\nQuer que iniciemos este mês?',
        orderIndex: 3,
        isActive: true
    },
    {
        id: 'fe_4',
        stageName: 'FECHAMENTO',
        dayOffset: 7,
        activityType: 'message',
        defaultTitle: 'FE – Última chamada',
        tooltipScript: 'Se não for prioridade agora,\nposso retomar mais à frente.',
        orderIndex: 4,
        isActive: true
    }
];
export const formatScript = (
    template: string,
    context: {
        contactName?: string;
        companyName?: string;
        dealTitle?: string;
    }
): string => {
    let formatted = template;

    // 1. Determine Identity (Pessoa vs Equipe)
    const isTalkingToPerson = !!context.contactName;

    // Clean recipient name: remove Dr./Dra./Sr./Sra. and take first name
    let cleanRecipient = context.contactName || '';
    cleanRecipient = cleanRecipient.replace(/^(Dr\.|Dra\.|Sr\.|Sra\.|Prof\.|Doutor\(a\))\s+/gi, '');
    const recipientName = isTalkingToPerson
        ? cleanRecipient.split(' ')[0]
        : (context.companyName || context.dealTitle || 'Equipe');

    // 2. Replace Placeholders
    formatted = formatted.replace(/\[Nome\]/g, recipientName);

    // Clean Clinic/Deal Name (remove "Negócio" prefix more thoroughly)
    const cleanLogic = (t: string) => t.replace(/\bNegócio\b:?\s*/gi, '').trim();

    const rawClinicName = context.companyName || context.dealTitle || 'sua clínica';
    const clinicName = cleanLogic(rawClinicName) || 'sua clínica';

    formatted = formatted.replace(/\[Nome da Clínica\]/g, clinicName);

    // 3. Tone Adjustment: "Eu" -> "Nós" if talking as a team
    if (!isTalkingToPerson) {
        formatted = formatted.replace(/\bEu \b/gi, 'Nós ');
        formatted = formatted.replace(/\beu \b/gi, 'nós ');
        formatted = formatted.replace(/\bTrabalho\b/gi, 'Trabalhamos');
        formatted = formatted.replace(/\btrabalho\b/gi, 'trabalhamos');
        formatted = formatted.replace(/\bAjudei\b/gi, 'Ajudamos');
        formatted = formatted.replace(/\bajudei\b/gi, 'ajudamos');
        formatted = formatted.replace(/\bvendo\b/gi, 'vendemos');
        formatted = formatted.replace(/\bVendo\b/gi, 'Vendemos');
        formatted = formatted.replace(/\bEnviei-lhe\b/gi, 'Enviámos-lhe');
        formatted = formatted.replace(/\benviei-lhe\b/gi, 'enviámos-lhe');
        formatted = formatted.replace(/\bescrevo\b/gi, 'escrevemos');
        formatted = formatted.replace(/\bAnalisei\b/gi, 'Analisámos');
        formatted = formatted.replace(/\banalisei\b/gi, 'analisámos');
    }

    return formatted;
};

export const getScriptByTitle = (title: string): string | undefined => {
    const template = LEAD_SEQUENCE_TEMPLATES.find(t => t.defaultTitle === title);
    if (template) return template.tooltipScript;

    // Support matching without the prefix if titles were saved differently
    const cleanTitle = title.split(': ').pop();
    const fallbackTemplate = LEAD_SEQUENCE_TEMPLATES.find(t => t.defaultTitle.includes(cleanTitle || ''));
    return fallbackTemplate?.tooltipScript;
};
