import { Deal, Activity } from '@/types/schema';

export interface AutomationResult {
    triggered: boolean;
    newActivity?: Omit<Activity, 'id' | 'createdAt'>;
    message?: string;
}

export const AutomationService = {
    /**
     * Checks if any automation rules should be triggered based on deal update
     */
    checkRules: (oldDeal: Deal | undefined, newDeal: Deal): AutomationResult[] => {
        const results: AutomationResult[] = [];

        // RULE 1: If moved to 'negotiation', create a task to "Prepare Contract"
        if (oldDeal?.stageId !== 'negotiation' && newDeal.stageId === 'negotiation') {
            results.push({
                triggered: true,
                message: 'Deal moved to Negotiation -> Task created',
                newActivity: {
                    type: 'task',
                    title: 'Preparar Contrato',
                    description: `Negócio ${newDeal.title} entrou em negociação. Preparar minuta.`,
                    dealId: newDeal.id,
                    completed: false,
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
                }
            });
        }

        // RULE 2: If status changes to 'won', create a "Onboarding Call" task
        if (oldDeal?.status !== 'won' && newDeal.status === 'won') {
            results.push({
                triggered: true,
                message: 'Deal Won -> Schedule Onboarding',
                newActivity: {
                    type: 'call',
                    title: 'Agendar Onboarding',
                    description: `Cliente fechado! Agendar reunião de boas-vindas.`,
                    dealId: newDeal.id,
                    completed: false,
                    dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                }
            });
        }

        return results;
    }
};
