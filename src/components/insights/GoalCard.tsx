import { Target, TrendingUp, TrendingDown, Calendar, User, Users, CheckCircle2 } from 'lucide-react';
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

    const getProgressGradient = () => {
        if (progress.percentage >= 100) return 'from-emerald-400 to-emerald-500';
        if (progress.percentage >= 75)  return 'from-blue-400 to-primary';
        if (progress.percentage >= 50)  return 'from-amber-400 to-amber-500';
        return 'from-orange-400 to-orange-500';
    };

    const getProgressTextColor = () => {
        if (progress.percentage >= 100) return 'text-emerald-600 dark:text-emerald-400';
        if (progress.percentage >= 75)  return 'text-primary';
        if (progress.percentage >= 50)  return 'text-amber-600 dark:text-amber-400';
        return 'text-orange-600 dark:text-orange-400';
    };

    const formatValue = (value: number) => {
        if (typeInfo?.isRevenue) {
            return value.toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' });
        }
        return value.toLocaleString('pt-BR');
    };

    const isOnTrack = progress.percentage >= 50;

    return (
        <div
            onClick={onClick}
            className={`
                flex flex-col bg-[#FFFFFF] dark:bg-[#141414]
                border border-[#E5E7EB] dark:border-[#262626]
                rounded-xl p-5 shadow-sm
                transition-all duration-200
                ${onClick ? 'cursor-pointer hover:shadow-md hover:border-[#D0D5DD] dark:hover:border-[#333]' : ''}
                ${progress.isComplete ? 'ring-1 ring-emerald-500/30 dark:ring-emerald-500/20' : ''}
            `}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Target size={14} className="text-primary shrink-0" />
                        <h3 className="font-semibold text-[#111827] dark:text-[#EAEAEA] text-sm truncate">
                            {goal.name}
                        </h3>
                    </div>
                    <p className="text-xs text-[#6B7280] dark:text-[#8A8A8A]">{typeInfo?.name}</p>
                </div>

                <div className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    progress.isComplete
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-[#F3F4F6] text-[#6B7280] dark:bg-[#1F1F1F] dark:text-[#8A8A8A]'
                }`}>
                    {progress.isComplete && <CheckCircle2 size={11} />}
                    {progress.isComplete ? 'Concluída' : 'Em andamento'}
                </div>
            </div>

            {/* Progress */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-3xl font-bold tracking-tight ${getProgressTextColor()}`}>
                        {progress.percentage.toFixed(0)}%
                    </span>
                    <div className="text-right">
                        <p className="text-[11px] font-semibold text-[#111827] dark:text-[#EAEAEA]">
                            {formatValue(currentValue)}
                        </p>
                        <p className="text-[10px] text-[#6B7280] dark:text-[#8A8A8A]">
                            de {formatValue(goal.targetValue)}
                        </p>
                    </div>
                </div>

                {/* Progress bar with gradient */}
                <div className="w-full h-2 bg-[#F3F4F6] dark:bg-[#1F1F1F] rounded-full overflow-hidden">
                    <div
                        className={`h-full bg-gradient-to-r ${getProgressGradient()} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#F7F9FC] dark:bg-[#0D0D0D] rounded-lg p-3">
                    <p className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#8A8A8A] tracking-wider mb-1">Alcançado</p>
                    <p className="text-sm font-bold text-[#111827] dark:text-[#EAEAEA]">
                        {formatValue(progress.achieved)}
                    </p>
                </div>
                <div className="bg-[#F7F9FC] dark:bg-[#0D0D0D] rounded-lg p-3">
                    <p className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#8A8A8A] tracking-wider mb-1">Restante</p>
                    <p className="text-sm font-bold text-[#111827] dark:text-[#EAEAEA]">
                        {progress.isComplete ? '—' : formatValue(progress.remaining)}
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB] dark:border-[#262626]">
                <div className="flex items-center gap-3 text-xs text-[#6B7280] dark:text-[#8A8A8A]">
                    <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>{periodInfo?.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {goal.ownerType === 'user' ? <User size={12} /> : <Users size={12} />}
                        <span>{goal.ownerType === 'user' ? 'Individual' : 'Equipe'}</span>
                    </div>
                </div>

                {progress.percentage > 0 && (
                    <div className={`flex items-center gap-1 text-[11px] font-semibold ${isOnTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500 dark:text-orange-400'}`}>
                        {isOnTrack ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        <span>{isOnTrack ? 'No ritmo' : 'Abaixo'}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
