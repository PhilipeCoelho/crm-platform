import { Activity, ActivityType } from '@/types/schema';

// Lista de tipos que são atividades REAIS (não eventos internos)
export const REAL_ACTIVITY_TYPES: ActivityType[] = [
    'call',
    'meeting',
    'task',
    'email',
    'message',
    'instagram',
    'analysis',
    'audit'
];

// Verifica se uma atividade é uma atividade real (não é nota/evento interno)
export function isRealActivity(activity: Activity): boolean {
    return REAL_ACTIVITY_TYPES.includes(activity.type as ActivityType);
}

// Filtra apenas atividades reais de uma lista
export function filterRealActivities(activities: Activity[]): Activity[] {
    return activities.filter(isRealActivity);
}

// Configuração de ícones e labels para cada tipo de atividade
export const ACTIVITY_CONFIG = {
    call: {
        label: 'Ligação',
        icon: 'Phone',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100'
    },
    meeting: {
        label: 'Reunião',
        icon: 'Users',
        color: 'text-primary',
        bgColor: 'bg-primary/10'
    },
    task: {
        label: 'Tarefa',
        icon: 'CheckSquare',
        color: 'text-green-600',
        bgColor: 'bg-green-100'
    },
    email: {
        label: 'Email',
        icon: 'Mail',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100'
    },
    message: {
        label: 'Mensagem',
        icon: 'MessageSquare',
        color: 'text-primary',
        bgColor: 'bg-primary'
    },
    analysis: {
        label: 'Análise',
        icon: 'BarChart3',
        color: 'text-primary',
        bgColor: 'bg-primary/10'
    },
    audit: {
        label: 'Auditoria',
        icon: 'Video',
        color: 'text-rose-600',
        bgColor: 'bg-rose-100'
    }
} as const;
