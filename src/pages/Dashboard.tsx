import { useState, useMemo, useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useCRM } from '@/contexts/CRMContext';
import { Plus, AlertTriangle, CalendarDays, ArrowRight, Target, CheckCircle2, Settings, LayoutDashboard } from 'lucide-react';
import ActivityList from '@/components/activities/ActivityList';
import { Currency } from '@/data/currencies';
import { getInsightsData, InsightsData } from '@/services/insights';
import { generateStrategicRecommendations } from '@/services/recommendations';
import { parseISO, isBefore, isToday, subDays } from 'date-fns';
import { filterRealActivities } from '@/utils/activityHelpers';
import { useNavigate } from 'react-router-dom';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import WidgetManagerModal from '@/components/dashboard/WidgetManagerModal';
import { WIDGET_DEFINITIONS } from '@/data/widgetDefinitions';

export default function Dashboard({ currency }: { currency: Currency }) {
    const { user } = useSupabaseAuth();
    const { deals, activities, pipelines, openNewDealModal, updateActivity, deleteActivity } = useCRM();
    const navigate = useNavigate();

    const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { widgets: customWidgets, saveWidgets } = useDashboardWidgets();
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);

    // Prioridade (Engine de Recomendação)
    const priorityRecommendation = useMemo(() => {
        if (!insightsData) return null;
        const recs = generateStrategicRecommendations(insightsData);
        return recs.length > 0 ? recs[0] : null; // Pega apenas a maior prioridade
    }, [insightsData]);

    // Initial data fetch using Insights central function
    useEffect(() => {
        const fetchInsights = async () => {
            setIsLoading(true);
            try {
                const now = new Date();
                const start = subDays(now, 7).toISOString();
                const end = now.toISOString();

                const data = await getInsightsData(start, end);
                setInsightsData(data);
            } catch (error) {
                console.error("Error fetching insights for dashboard:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInsights();
    }, []);

    // Greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Bom dia";
        if (hour < 18) return "Boa tarde";
        return "Boa noite";
    }, []);

    const firstName = useMemo(() => user?.user_metadata?.name?.split(' ')[0] || 'Usuário', [user]);

    // Handle New Deal Button
    const defaultStageId = useMemo(() => {
        const stages = pipelines['sales']?.stages || [];
        const prospect = stages.find(s => s.title.toLowerCase().includes('prospect'));
        if (prospect) return prospect.id;
        if (stages.length > 1 && stages[0].id === 'new') return stages[1].id;
        return 'new';
    }, [pipelines]);

    // // Format currency helper
    // const formatCurrency = (val: number) => {
    //     return new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(val);
    // };

    // Alertas Operacionais (Lists built locally while Phase 11 engine is not ready)
    const alertLists = useMemo(() => {
        const realActivities = filterRealActivities(activities);
        const openRealActivities = realActivities.filter(a => !a.completed);
        const now = new Date();

        const overdueActivities = openRealActivities.filter(a => {
            if (!a.dueDate) return false;
            const dueDate = parseISO(a.dueDate);
            return isBefore(dueDate, now) && !isToday(dueDate);
        });

        const todayActivities = openRealActivities.filter(a => {
            if (!a.dueDate) return false;
            return isToday(parseISO(a.dueDate));
        });

        const dealsWithoutAction = deals.filter(deal => {
            if (deal.status !== 'open') return false;
            return !realActivities.some(a => a.dealId === deal.id && !a.completed);
        });

        return { overdueActivities, todayActivities, dealsWithoutAction };
    }, [activities, deals]);

    const handleToggleActivity = (id: string) => {
        const activity = activities.find(a => a.id === id);
        if (activity) updateActivity(id, { completed: !activity.completed });
    };

    const handleDeleteActivity = (id: string) => {
        if (window.confirm('Excluir atividade?')) deleteActivity(id);
    };

    const Widget = ({ title, value, description, icon: Icon, color, redirectLink, isVisible = true, showPeriodBadge = true }: any) => {
        if (!isVisible) return null;
        return (
            <div
                onClick={() => redirectLink && navigate(redirectLink)}
                className="bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-primary/30 transition-all cursor-pointer group flex flex-col justify-between flex-1 min-w-[120px] max-w-full relative overflow-hidden"
            >
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className={`p-1.5 rounded-lg ${color}`}>
                            <Icon size={16} className="group-hover:scale-110 transition-transform" />
                        </div>
                        {showPeriodBadge && (
                            <div className="bg-muted text-muted-foreground text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0">
                                Últimos 7 dias
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate" title={title}>{title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                        <h3 className="text-xl font-black text-foreground truncate" title={`${value}`}>{value}</h3>
                    </div>
                </div>
                {description && <p className="text-[9px] text-muted-foreground mt-2 font-medium border-t border-border/50 pt-1.5 truncate" title={description}>{description}</p>}
            </div>
        );
    };


    return (
        <div className="h-full overflow-y-auto bg-background transition-colors duration-300">
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8">

                {/* HEADER SECTION */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/50 pb-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            {greeting}, {firstName}.
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Este é o seu painel de decisão rápida.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* New Deal */}
                        <button
                            onClick={() => openNewDealModal(defaultStageId)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all shadow-primary/20 active:scale-95"
                        >
                            <Plus size={16} />
                            Novo Negócio
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse pt-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-card w-full h-[140px] rounded-xl border border-border/50"></div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-10 pt-2">

                        {/* BLOCO 0 - TEMA PRIORITÁRIO */}
                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                                Tema Prioritário
                            </h2>
                            {priorityRecommendation ? (
                                <div className={`border rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${priorityRecommendation.impacto === 'alto'
                                    ? 'bg-rose-500/5 border-rose-500/30 border-l-4 border-l-rose-500'
                                    : 'bg-amber-500/5 border-amber-500/30 border-l-4 border-l-amber-500'
                                    }`}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${priorityRecommendation.impacto === 'alto'
                                                ? 'bg-rose-500 text-white'
                                                : 'bg-amber-500 text-white'
                                                }`}>
                                                {priorityRecommendation.impacto} Impacto
                                            </span>
                                            <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                                                {priorityRecommendation.area}
                                            </span>
                                        </div>
                                        <h3 className={`text-xl font-bold mb-1 ${priorityRecommendation.impacto === 'alto' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                                            }`}>
                                            {priorityRecommendation.titulo}
                                        </h3>
                                        <p className="text-sm text-foreground/80 font-medium">
                                            {priorityRecommendation.mensagem}
                                        </p>
                                    </div>
                                    <div className="md:shrink-0">
                                        <button
                                            onClick={() => navigate('/insights')}
                                            className={`px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2 transition-all ${priorityRecommendation.impacto === 'alto'
                                                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-500/30'
                                                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-500/30'
                                                }`}
                                        >
                                            Analisar no Insights
                                            <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
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
                            )}
                        </section>

                        {/* BLOCO CUSTOMIZÁVEL - WIDGETS ESTRATÉGICOS */}
                        <section className="pt-2">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                    Widgets Estratégicos
                                </h2>
                                <button
                                    onClick={() => setIsWidgetModalOpen(true)}
                                    className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50 hover:border-border"
                                >
                                    <Settings size={14} />
                                    Gerenciar Widgets
                                </button>
                            </div>

                            {customWidgets.length === 0 ? (
                                <div className="border border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center bg-card/50">
                                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                        <LayoutDashboard size={28} className="text-primary" />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground mb-2">Seu painel estratégico está vazio</h3>
                                    <p className="text-sm text-muted-foreground mb-6 max-w-[300px]">
                                        Adicione métricas do Insights para montar sua visão.
                                    </p>
                                    <button
                                        onClick={() => setIsWidgetModalOpen(true)}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-95"
                                    >
                                        <Settings size={16} />
                                        Gerenciar Widgets
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-stretch gap-3 overflow-x-auto pb-4 custom-scrollbar">
                                    {customWidgets.map(widget => {
                                        const def = WIDGET_DEFINITIONS.find(d => d.key === widget.widget_key);
                                        if (!def) return null;
                                        const { value, microDescription } = def.getValue(insightsData, currency);

                                        return (
                                            <Widget
                                                key={widget.id || widget.widget_key}
                                                title={def.title}
                                                value={value}
                                                description={microDescription}
                                                icon={def.icon}
                                                color={def.color}
                                                redirectLink={def.redirectLink}
                                                showPeriodBadge={def.key !== 'pipeline'}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* BLOCO 2 - ATENÇÃO IMEDIATA */}
                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                                Atenção Imediata
                            </h2>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                {/* Atrasadas */}
                                <div className="bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex flex-col h-[350px]">
                                    <h3 className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2 mb-4">
                                        <AlertTriangle size={18} />
                                        Atrasadas ({alertLists.overdueActivities.length})
                                    </h3>
                                    <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                        {alertLists.overdueActivities.length === 0 ? (
                                            <p className="text-sm text-red-500/60 font-medium">Belo trabalho! Sem atrasos.</p>
                                        ) : (
                                            <ActivityList
                                                activities={alertLists.overdueActivities}
                                                onToggle={handleToggleActivity}
                                                onDelete={handleDeleteActivity}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Para Hoje */}
                                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 flex flex-col h-[350px]">
                                    <h3 className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-2 mb-4">
                                        <CalendarDays size={18} />
                                        Para Hoje ({alertLists.todayActivities.length})
                                    </h3>
                                    <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                        {alertLists.todayActivities.length === 0 ? (
                                            <p className="text-sm text-emerald-500/60 font-medium">Tudo limpo para hoje.</p>
                                        ) : (
                                            <ActivityList
                                                activities={alertLists.todayActivities}
                                                onToggle={handleToggleActivity}
                                                onDelete={handleDeleteActivity}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Sem Atividade */}
                                <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 flex flex-col h-[350px]">
                                    <h3 className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-2 mb-4">
                                        <Target size={18} />
                                        Sem Atividade ({alertLists.dealsWithoutAction.length})
                                    </h3>
                                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {alertLists.dealsWithoutAction.length === 0 ? (
                                            <p className="text-sm text-amber-500/60 font-medium">Nenhum negócio abandonado.</p>
                                        ) : (
                                            alertLists.dealsWithoutAction.map(deal => (
                                                <div
                                                    key={deal.id}
                                                    className="p-3 rounded-lg border border-amber-500/20 bg-card hover:bg-amber-500/10 transition-colors cursor-pointer group flex items-center justify-between"
                                                >
                                                    <div>
                                                        <p className="text-sm font-semibold text-foreground truncate">{deal.title}</p>
                                                        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Sem próximos passos guiados</p>
                                                    </div>
                                                    <ArrowRight size={14} className="text-amber-500 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                            </div>
                        </section>
                    </div>
                )}
            </div>

            <WidgetManagerModal
                isOpen={isWidgetModalOpen}
                onClose={() => setIsWidgetModalOpen(false)}
                currentWidgets={customWidgets}
                onSave={saveWidgets}
            />
        </div>
    );
}
