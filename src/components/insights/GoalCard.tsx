import { Target, TrendingUp, Calendar, User, Users } from 'lucide-react';
import { Goal, getGoalTypeInfo, getGoalPeriodInfo, calculateGoalProgress } from '@/config/goalConfig';

interface GoalCardProps {
    goal: Goal;
    currentValue: number;
    onClick?: () => void;
}

export default function GoalCard({ goal, currentValue, onClick }: GoalCardProps) {
    const typeInfo = getGoalTypeInfo(goal.type);
    const periodInfo = getGoalPeriodInfo(goal.period);
    const progress = calculateGoalProgress(goal, currentValue);

    // Determinar cor baseada no progresso
    const getProgressColor = () => {
        if (progress.percentage >= 100) return 'bg-green-500';
        if (progress.percentage >= 75) return 'bg-blue-500';
        if (progress.percentage >= 50) return 'bg-yellow-500';
        return 'bg-orange-500';
    };

    const getProgressTextColor = () => {
        if (progress.percentage >= 100) return 'text-green-600';
        if (progress.percentage >= 75) return 'text-blue-600';
        if (progress.percentage >= 50) return 'text-yellow-600';
        return 'text-orange-600';
    };

    const formatValue = (value: number) => {
        if (typeInfo?.isRevenue) {
            return value.toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' });
        }
        return value.toLocaleString('pt-BR');
    };

    return (
        <div
            onClick={onClick}
            className={`bg-card border border-border rounded-lg p-6 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                }`}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Target size={18} className="text-primary" />
                        <h3 className="font-semibold text-foreground">{goal.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{typeInfo?.name}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${progress.isComplete
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                    {progress.isComplete ? 'Concluída' : 'Em andamento'}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-2xl font-bold ${getProgressTextColor()}`}>
                        {progress.percentage.toFixed(0)}%
                    </span>
                    <span className="text-sm text-muted-foreground">
                        {formatValue(currentValue)} / {formatValue(goal.targetValue)}
                    </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                        className={`h-full ${getProgressColor()} transition-all duration-500`}
                        style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-muted-foreground mb-1">Alcançado</p>
                    <p className="text-sm font-semibold text-foreground">
                        {formatValue(progress.achieved)}
                    </p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground mb-1">Restante</p>
                    <p className="text-sm font-semibold text-foreground">
                        {formatValue(progress.remaining)}
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{periodInfo?.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {goal.ownerType === 'user' ? <User size={14} /> : <Users size={14} />}
                        <span>{goal.ownerType === 'user' ? 'Individual' : 'Equipe'}</span>
                    </div>
                </div>
                {progress.percentage > 0 && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                        <TrendingUp size={14} />
                        <span>Progresso</span>
                    </div>
                )}
            </div>
        </div>
    );
}
