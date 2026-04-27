// Tipos e configurações de Metas (conforme PDFs Pipedrive)

export type GoalType = 'deals_won' | 'deals_revenue' | 'activities_completed' | 'leads_created' | 'leads_converted' | 'total_revenue';
export type GoalPeriod = 'monthly' | 'quarterly' | 'yearly';
export type GoalOwnerType = 'user' | 'team';

export interface Goal {
    id: string;
    name: string;
    type: GoalType;
    targetValue: number;
    period: GoalPeriod;
    ownerType: GoalOwnerType;
    ownerId: string;
    startDate: string;
    endDate: string;
    createdAt: string;
    lastModified: string;
}

// Tipos de metas permitidos (FIXOS conforme Pipedrive)
export const GOAL_TYPES = [
    {
        id: 'deals_won' as GoalType,
        name: 'Negócios Ganhos',
        description: 'Número de negócios ganhos no período',
        category: 'Negócios',
        unit: 'negócios',
        isRevenue: false
    },
    {
        id: 'deals_revenue' as GoalType,
        name: 'Receita de Negócios',
        description: 'Valor total de receita ganha',
        category: 'Negócios',
        unit: 'EUR',
        isRevenue: true
    },
    {
        id: 'activities_completed' as GoalType,
        name: 'Atividades Concluídas',
        description: 'Número de atividades concluídas',
        category: 'Atividades',
        unit: 'atividades',
        isRevenue: false
    },
    {
        id: 'leads_created' as GoalType,
        name: 'Leads Criados',
        description: 'Número de leads criados',
        category: 'Leads',
        unit: 'leads',
        isRevenue: false
    },
    {
        id: 'leads_converted' as GoalType,
        name: 'Leads Convertidos',
        description: 'Número de leads convertidos em negócios',
        category: 'Leads',
        unit: 'leads',
        isRevenue: false
    },
    {
        id: 'total_revenue' as GoalType,
        name: 'Receita Total',
        description: 'Receita total no período',
        category: 'Receita',
        unit: 'EUR',
        isRevenue: true
    }
];

// Períodos permitidos (FIXOS conforme Pipedrive)
export const GOAL_PERIODS = [
    {
        id: 'monthly' as GoalPeriod,
        name: 'Mensal',
        description: 'Meta para o mês atual'
    },
    {
        id: 'quarterly' as GoalPeriod,
        name: 'Trimestral',
        description: 'Meta para o trimestre atual'
    },
    {
        id: 'yearly' as GoalPeriod,
        name: 'Anual',
        description: 'Meta para o ano atual'
    }
];

// Função para obter informações do tipo de meta
export function getGoalTypeInfo(type: GoalType) {
    return GOAL_TYPES.find((t: any) => t.id === type);
}

// Função para obter informações do período
export const getGoalType = (type: string) => GOAL_TYPES.find((t: any) => t.id === type);
export const getGoalPeriod = (period: string) => GOAL_PERIODS.find((p: any) => p.id === period);

export function getGoalPeriodInfo(period: GoalPeriod) {
    return GOAL_PERIODS.find((p: any) => p.id === period);
}

// Função para calcular datas de início e fim baseado no período
export function calculateGoalDates(period: GoalPeriod): { startDate: string; endDate: string } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
        case 'monthly':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'quarterly':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
            break;
        case 'yearly':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
    };
}

// Função para calcular progresso da meta
export function calculateGoalProgress(goal: Goal, currentValue: number): {
    percentage: number;
    achieved: number;
    remaining: number;
    isComplete: boolean;
} {
    const percentage = goal.targetValue > 0 ? (currentValue / goal.targetValue) * 100 : 0;
    const remaining = Math.max(0, goal.targetValue - currentValue);

    return {
        percentage: Math.min(percentage, 100),
        achieved: currentValue,
        remaining,
        isComplete: currentValue >= goal.targetValue
    };
}
