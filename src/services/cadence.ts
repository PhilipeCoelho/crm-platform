import { StageSequence } from "../types/schema";

export const LEAD_SEQUENCE_TEMPLATES: StageSequence[] = [
    {
        id: 'lead_1',
        stageName: 'new', // Mapping standard 'new' stage to LEAD behavior
        dayOffset: 0,
        activityType: 'message',
        defaultTitle: 'Mensagem inicial',
        orderIndex: 1,
        isActive: true
    },
    {
        id: 'lead_2',
        stageName: 'new',
        dayOffset: 1,
        activityType: 'email',
        defaultTitle: 'Email apresentação',
        orderIndex: 2,
        isActive: true
    },
    {
        id: 'lead_3',
        stageName: 'new',
        dayOffset: 3,
        activityType: 'call',
        defaultTitle: 'Ligação tentativa 1',
        orderIndex: 3,
        isActive: true
    },
    {
        id: 'lead_4',
        stageName: 'new',
        dayOffset: 5,
        activityType: 'analysis',
        defaultTitle: 'Análise digital',
        orderIndex: 4,
        isActive: true
    },
    {
        id: 'lead_5',
        stageName: 'new',
        dayOffset: 6,
        activityType: 'email',
        defaultTitle: 'Email insight estratégico',
        orderIndex: 5,
        isActive: true
    },
    {
        id: 'lead_6',
        stageName: 'new',
        dayOffset: 8,
        activityType: 'audit',
        defaultTitle: 'Enviar mini auditoria',
        orderIndex: 6,
        isActive: true
    },
    {
        id: 'lead_7',
        stageName: 'new',
        dayOffset: 10,
        activityType: 'call',
        defaultTitle: 'Ligação tentativa 2',
        orderIndex: 7,
        isActive: true
    },
    {
        id: 'lead_8',
        stageName: 'new',
        dayOffset: 13,
        activityType: 'email',
        defaultTitle: 'Convite reunião diagnóstico',
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
