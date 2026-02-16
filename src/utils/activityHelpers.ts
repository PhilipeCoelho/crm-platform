import { Activity, ActivityType } from '@/types/schema';

// Lista de tipos que são atividades REAIS (não eventos internos)
export const REAL_ACTIVITY_TYPES: ActivityType[] = [
    'call',
    'meeting',
    'task',
    'email',
    'message'
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
        color: 'text-purple-600',
        bgColor: 'bg-purple-100'
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
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-100'
    }
} as const;
