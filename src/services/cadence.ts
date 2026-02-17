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
