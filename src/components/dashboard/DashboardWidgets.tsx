import React, { useMemo } from 'react';
import { Activity, Deal } from '@/types/schema';
import { Currency } from '@/data/currencies';
import { AlertTriangle, CalendarDays, ArrowRight, Target, CheckCircle2 } from 'lucide-react';
import ActivityList from '@/components/activities/ActivityList';
import { StrategicRecommendation } from '@/services/recommendations';
import { WIDGET_DEFINITIONS } from '@/data/widgetDefinitions';
import { InsightsData } from '@/services/insights';
import VariationBadge from '../insights/VariationBadge';

// --- Widget Card (memoized) ---
interface WidgetProps {
    title: string;
    value: string | number;
    description?: string;
    icon: any;
    color: string;
    redirectLink?: string;
    showPeriodBadge?: boolean;
    periodLabel: string;
    onNavigate: (link: string) => void;
    variation?: number | null;
}

export const WidgetCard = React.memo(function WidgetCard({
    title, value, description, icon: Icon, color, redirectLink, showPeriodBadge = true, periodLabel, onNavigate, variation
}: WidgetProps) {
    return (
        <div
            onClick={() => redirectLink && onNavigate(redirectLink)}
            className="bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-primary/30 transition-[shadow,transform] cursor-pointer group flex flex-col justify-between flex-1 min-w-[120px] max-w-full relative overflow-hidden"
        >
            <div>
                <div className="flex items-center justify-between mb-2">
                    <div className={`p-1.5 rounded-lg ${color}`}>
                        <Icon size={16} className="group-hover:scale-110 transition-transform" />
                    </div>
                    {showPeriodBadge && (
                        <div className="bg-muted text-muted-foreground text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0">
                            {periodLabel}
                        </div>
                    )}
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate" title={title}>{title}</p>
                <div className="flex items-center gap-1 mt-0.5">
                    <h3 className="text-xl font-black text-foreground truncate" title={`${value}`}>{value}</h3>
                    {variation !== undefined && variation !== null && (
                        <div className="ml-auto scale-90 origin-right">
                            <VariationBadge value={variation} inverse={title.toLowerCase().includes('perda') || title.toLowerCase().includes('perdido')} />
                        </div>
                    )}
                </div>
            </div>
            {description && <p className="text-[9px] text-muted-foreground mt-2 font-medium border-t border-border/50 pt-1.5 truncate" title={description}>{description}</p>}
        </div>
    );
});

// --- Priority Card (memoized) ---
interface PriorityCardProps {
    recommendation: StrategicRecommendation | null;
    onNavigate: (path: string) => void;
}

export const PriorityCard = React.memo(function PriorityCard({ recommendation, onNavigate }: PriorityCardProps) {
    if (!recommendation) {
        return (
            <div className="bg-emerald-500/5 border-l-4 border-l-emerald-500 border-border rounded-xl p-6 shadow-sm flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-2.5 py-0.5 rounded bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider">
                            Estável
                        </span>
                    </div>
                    <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                        Operação Saudável
                    </h3>
                    <p className="text-sm text-foreground/80 font-medium">
                        Performance estável. Nenhum gargalo crítico detectado no período.
                    </p>
                </div>
                <CheckCircle2 size={40} className="text-emerald-500 opacity-20" />
            </div>
        );
    }

    const isAlto = recommendation.impacto === 'alto';

    return (
        <div className={`border rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors ${
            isAlto
                ? 'bg-rose-500/5 border-rose-500/30 border-l-4 border-l-rose-500'
                : 'bg-amber-500/5 border-amber-500/30 border-l-4 border-l-amber-500'
        }`}>
            <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                        isAlto ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                        {recommendation.impacto} Impacto
                    </span>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                        {recommendation.area}
                    </span>
                </div>
                <h3 className={`text-xl font-bold mb-1 ${isAlto ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {recommendation.titulo}
                </h3>
                <p className="text-sm text-foreground/80 font-medium">
                    {recommendation.mensagem}
                </p>
            </div>
            <div className="md:shrink-0">
                <button
                    onClick={() => onNavigate('/insights')}
                    className={`px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                        isAlto
                            ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-500/30'
                            : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/30'
                    }`}
                >
                    Analisar no Insights
                    <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
});

// --- Widgets Row (memoized) ---
interface WidgetsRowProps {
    customWidgets: any[];
    insightsData: InsightsData | null;
    currency: Currency;
    periodLabel: string;
    onNavigate: (path: string) => void;
    onOpenManager: () => void;
}

export const WidgetsRow = React.memo(function WidgetsRow({ customWidgets, insightsData, currency, periodLabel, onNavigate, onOpenManager }: WidgetsRowProps) {
    if (customWidgets.length === 0) {
        return (
            <div className="border border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center bg-card/50">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Target size={28} className="text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Seu painel estratégico está vazio</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-[300px]">
                    Adicione métricas do Insights para montar sua visão.
                </p>
                <button
                    onClick={onOpenManager}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors active:scale-95"
                >
                    Gerenciar Widgets
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-stretch gap-3 overflow-x-auto pb-4 custom-scrollbar">
            {customWidgets.map(widget => {
                const def = WIDGET_DEFINITIONS.find(d => d.key === widget.widget_key);
                if (!def) return null;
                const { value, microDescription, variation } = def.getValue(insightsData, currency);

                return (
                    <WidgetCard
                        key={widget.id || widget.widget_key}
                        title={def.title}
                        value={value}
                        description={microDescription}
                        icon={def.icon}
                        color={def.color}
                        redirectLink={def.redirectLink}
                        showPeriodBadge={def.key !== 'pipeline'}
                        periodLabel={periodLabel}
                        onNavigate={onNavigate}
                        variation={variation}
                    />
                );
            })}
        </div>
    );
});

// --- Alert Columns (memoized) ---
const MAX_VISIBLE_ITEMS = 50;

interface AlertColumnsProps {
    overdueActivities: Activity[];
    todayActivities: Activity[];
    dealsWithoutAction: Deal[];
    onToggleActivity: (id: string) => void;
    onDeleteActivity: (id: string) => void;
    onOpenFocusDeal: (dealId: string) => void;
}

export const AlertColumns = React.memo(function AlertColumns({
    overdueActivities, todayActivities, dealsWithoutAction,
    onToggleActivity, onDeleteActivity, onOpenFocusDeal
}: AlertColumnsProps) {
    const visibleDeals = useMemo(() => dealsWithoutAction.slice(0, MAX_VISIBLE_ITEMS), [dealsWithoutAction]);
    const hasMoreDeals = dealsWithoutAction.length > MAX_VISIBLE_ITEMS;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Atrasadas */}
            <div className="bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex flex-col h-[350px]">
                <h3 className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2 mb-4">
                    <AlertTriangle size={18} />
                    Atrasadas ({overdueActivities.length})
                </h3>
                <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                    {overdueActivities.length === 0 ? (
                        <p className="text-sm text-red-500/60 font-medium">Belo trabalho! Sem atrasos.</p>
                    ) : (
                        <ActivityList
                            activities={overdueActivities}
                            onToggle={onToggleActivity}
                            onDelete={onDeleteActivity}
                            onItemClick={(activity) => activity.dealId && onOpenFocusDeal(activity.dealId)}
                        />
                    )}
                </div>
            </div>

            {/* Para Hoje */}
            <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 flex flex-col h-[350px]">
                <h3 className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2 mb-4">
                    <CalendarDays size={18} />
                    Para Hoje ({todayActivities.length})
                </h3>
                <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                    {todayActivities.length === 0 ? (
                        <p className="text-sm text-emerald-500/60 font-medium">Tudo limpo para hoje.</p>
                    ) : (
                        <ActivityList
                            activities={todayActivities}
                            onToggle={onToggleActivity}
                            onDelete={onDeleteActivity}
                            onItemClick={(activity) => activity.dealId && onOpenFocusDeal(activity.dealId)}
                        />
                    )}
                </div>
            </div>

            {/* Sem Atividade */}
            <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 flex flex-col h-[350px]">
                <h3 className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-2 mb-4">
                    <Target size={18} />
                    Sem Atividade ({dealsWithoutAction.length})
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {dealsWithoutAction.length === 0 ? (
                        <p className="text-sm text-amber-500/60 font-medium">Nenhum negócio abandonado.</p>
                    ) : (
                        <>
                            {visibleDeals.map(deal => (
                                <div
                                    key={deal.id}
                                    onClick={() => onOpenFocusDeal(deal.id)}
                                    className="p-3 rounded-lg border border-amber-500/20 bg-card hover:bg-amber-500/10 transition-colors cursor-pointer group flex items-center justify-between"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-foreground truncate">{deal.title}</p>
                                        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Sem próximos passos guiados</p>
                                    </div>
                                    <ArrowRight size={14} className="text-amber-500 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-[opacity,transform]" />
                                </div>
                            ))}
                            {hasMoreDeals && (
                                <p className="text-xs text-amber-500/60 font-medium text-center pt-2">
                                    +{dealsWithoutAction.length - MAX_VISIBLE_ITEMS} negócios não exibidos
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});
