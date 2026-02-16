import { useState, useMemo } from 'react';
import { Plus, Target } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { Goal } from '@/config/goalConfig';
import GoalBuilder from './GoalBuilder';
import GoalCard from './GoalCard';

interface SavedGoal extends Goal {
    id: string;
    createdAt: string;
    lastModified: string;
}

export default function GoalsView() {
    const { deals, activities } = useCRM();
    const [goals, setGoals] = useState<SavedGoal[]>([]);
    const [showBuilder, setShowBuilder] = useState(false);

    // Calcular valores atuais para cada meta
    const calculateCurrentValue = (goal: SavedGoal): number => {
        const startDate = new Date(goal.startDate);
        const endDate = new Date(goal.endDate);

        switch (goal.type) {
            case 'deals_won':
                return deals.filter(d =>
                    d.status === 'won' &&
                    new Date(d.createdAt) >= startDate &&
                    new Date(d.createdAt) <= endDate
                ).length;

            case 'deals_revenue':
            case 'total_revenue':
                return deals
                    .filter(d =>
                        d.status === 'won' &&
                        new Date(d.createdAt) >= startDate &&
                        new Date(d.createdAt) <= endDate
                    )
                    .reduce((sum, d) => sum + d.value, 0);

            case 'activities_completed':
                return activities.filter(a =>
                    a.completed &&
                    a.dueDate &&
                    new Date(a.dueDate) >= startDate &&
                    new Date(a.dueDate) <= endDate
                ).length;

            case 'leads_created':
                // TODO: Implementar quando houver módulo de leads
                return 0;

            case 'leads_converted':
                // TODO: Implementar quando houver módulo de leads
                return 0;

            default:
                return 0;
        }
    };

    const handleSaveGoal = (goalData: Omit<Goal, 'id' | 'createdAt' | 'lastModified'>) => {
        const newGoal: SavedGoal = {
            ...goalData,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };

        setGoals([...goals, newGoal]);
        setShowBuilder(false);
    };

    // Agrupar metas por período
    const groupedGoals = useMemo(() => {
        const groups: Record<string, SavedGoal[]> = {
            monthly: [],
            quarterly: [],
            yearly: []
        };

        goals.forEach(goal => {
            groups[goal.period].push(goal);
        });

        return groups;
    }, [goals]);

    if (showBuilder) {
        return (
            <GoalBuilder
                onSave={handleSaveGoal}
                onCancel={() => setShowBuilder(false)}
            />
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">Metas</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Compare desempenho real vs meta definida
                    </p>
                </div>
                <button
                    onClick={() => setShowBuilder(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                    <Plus size={16} />
                    Criar Meta
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {goals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <Target size={64} className="text-muted-foreground mb-4 opacity-50" />
                        <h2 className="text-xl font-semibold text-foreground mb-2">
                            Nenhuma meta criada
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md">
                            Crie metas para acompanhar o desempenho da sua equipe.
                            Metas comparam valores reais com objetivos definidos.
                        </p>
                        <button
                            onClick={() => setShowBuilder(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                        >
                            <Plus size={16} />
                            Criar Primeira Meta
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Metas Mensais */}
                        {groupedGoals.monthly.length > 0 && (
                            <div>
                                <h2 className="text-lg font-semibold text-foreground mb-4">Metas Mensais</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {groupedGoals.monthly.map(goal => (
                                        <GoalCard
                                            key={goal.id}
                                            goal={goal}
                                            currentValue={calculateCurrentValue(goal)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Metas Trimestrais */}
                        {groupedGoals.quarterly.length > 0 && (
                            <div>
                                <h2 className="text-lg font-semibold text-foreground mb-4">Metas Trimestrais</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {groupedGoals.quarterly.map(goal => (
                                        <GoalCard
                                            key={goal.id}
                                            goal={goal}
                                            currentValue={calculateCurrentValue(goal)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Metas Anuais */}
                        {groupedGoals.yearly.length > 0 && (
                            <div>
                                <h2 className="text-lg font-semibold text-foreground mb-4">Metas Anuais</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {groupedGoals.yearly.map(goal => (
                                        <GoalCard
                                            key={goal.id}
                                            goal={goal}
                                            currentValue={calculateCurrentValue(goal)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
