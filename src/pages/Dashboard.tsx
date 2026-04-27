import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useCRM } from '@/contexts/CRMContext';
import { Plus, Settings } from 'lucide-react';
import { Currency } from '@/data/currencies';
import { getInsightsData, InsightsData } from '@/services/insights';
import { generateStrategicRecommendations } from '@/services/recommendations';
import { parseISO, isBefore, isToday, subDays } from 'date-fns';
import { filterRealActivities } from '@/utils/activityHelpers';
import { useNavigate } from 'react-router-dom';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import WidgetManagerModal from '@/components/dashboard/WidgetManagerModal';
import { PriorityCard, WidgetsRow, AlertColumns } from '@/components/dashboard/DashboardWidgets';

const PERIOD_OPTIONS = [
    { value: 7, label: '7 dias' },
    { value: 30, label: '30 dias' },
    { value: 60, label: '60 dias' },
    { value: 90, label: '90 dias' },
    { value: 0, label: 'Todo período' },
] as const;

type PeriodValue = typeof PERIOD_OPTIONS[number]['value'];

export default function Dashboard({ currency }: { currency: Currency }) {
    const { user } = useSupabaseAuth();
    const {
        deals,
        activities,
        pipelines,
        openNewDealModal,
        updateActivity,
        deleteActivity,
        openFocusDeal
    } = useCRM();
    const navigate = useNavigate();

    // --- Cache by period ---
    const insightsCacheRef = useRef<Map<number, { data: InsightsData; timestamp: number }>>(new Map());
    const CACHE_TTL = 60_000; // 60s cache validity

    const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { widgets: customWidgets, saveWidgets, showPriority, togglePriority } = useDashboardWidgets();
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);

    const [selectedPeriod, setSelectedPeriod] = useState<PeriodValue>(() => {
        const saved = localStorage.getItem('dashboard_period');
        if (saved !== null) {
            const parsed = Number(saved);
            if (PERIOD_OPTIONS.some(p => p.value === parsed)) return parsed as PeriodValue;
        }
        return 7;
    });

    const periodLabel = useMemo(() => {
        const opt = PERIOD_OPTIONS.find(p => p.value === selectedPeriod);
        return selectedPeriod === 0 ? 'Todo período' : `Últimos ${opt?.label}`;
    }, [selectedPeriod]);

    const handlePeriodChange = useCallback((period: PeriodValue) => {
        setSelectedPeriod(period);
        localStorage.setItem('dashboard_period', String(period));
    }, []);

    // --- Priority Recommendation (memoized) ---
    const priorityRecommendation = useMemo(() => {
        if (!insightsData) return null;
        const recs = generateStrategicRecommendations(insightsData);
        return recs.length > 0 ? recs[0] : null;
    }, [insightsData]);

    // --- Fetch Insights (only on period change, not on deals/activities changes) ---
    useEffect(() => {
        const fetchInsights = async () => {
            // Check cache first
            const cached = insightsCacheRef.current.get(selectedPeriod);
            if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
                setInsightsData(cached.data);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const now = new Date();
                const start = selectedPeriod === 0
                    ? new Date('2000-01-01').toISOString()
                    : subDays(now, selectedPeriod).toISOString();
                const end = now.toISOString();

                const data = await getInsightsData(start, end);
                
                // Save to cache
                insightsCacheRef.current.set(selectedPeriod, { data, timestamp: Date.now() });
                setInsightsData(data);
            } catch (error) {
                console.error("Error fetching insights for dashboard:", error);
            } finally {
                setIsLoading(false);
            }
        };

        // Short debounce to batch rapid period switches
        const timer = setTimeout(fetchInsights, 150);
        return () => clearTimeout(timer);
    }, [selectedPeriod]);

    // --- Background refresh when data changes (debounced, non-blocking) ---
    const dataVersionRef = useRef(0);
    useEffect(() => {
        dataVersionRef.current += 1;
        const version = dataVersionRef.current;

        const timer = setTimeout(async () => {
            // Only refresh if this is still the latest version
            if (version !== dataVersionRef.current) return;

            try {
                const now = new Date();
                const start = selectedPeriod === 0
                    ? new Date('2000-01-01').toISOString()
                    : subDays(now, selectedPeriod).toISOString();
                const end = now.toISOString();

                const data = await getInsightsData(start, end);
                
                // Update cache & state silently (no loading spinner)
                insightsCacheRef.current.set(selectedPeriod, { data, timestamp: Date.now() });
                if (version === dataVersionRef.current) {
                    setInsightsData(data);
                }
            } catch (error) {
                console.error("Background refresh error:", error);
            }
        }, 5000); // 5s debounce for background refresh — non-blocking

        return () => clearTimeout(timer);
    }, [deals.length, activities.length, selectedPeriod]);

    // --- Greeting ---
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Bom dia";
        if (hour < 18) return "Boa tarde";
        return "Boa noite";
    }, []);

    const firstName = useMemo(() => user?.user_metadata?.name?.split(' ')[0] || 'Usuário', [user]);

    // --- Default Stage ---
    const defaultStageId = useMemo(() => {
        const stages = pipelines['sales']?.stages || [];
        const prospect = stages.find((s: any) => s.title.toLowerCase().includes('prospect'));
        if (prospect) return prospect.id;
        if (stages.length > 1 && stages[0].id === 'new') return stages[1].id;
        return 'new';
    }, [pipelines]);

    // --- Alert Lists (optimized: pre-compute Set for O(1) lookups) ---
    const alertLists = useMemo(() => {
        const realActivities = filterRealActivities(activities);
        const openRealActivities = realActivities.filter(a => !a.completed && a.status !== 'canceled');
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

        // Optimized: build Set of dealIds with open activities (O(n) instead of O(n²))
        const dealsWithOpenActivityIds = new Set(
            openRealActivities.filter(a => a.dealId).map(a => a.dealId!)
        );

        const dealsWithoutAction = deals.filter(deal =>
            deal.status === 'open' && !dealsWithOpenActivityIds.has(deal.id)
        );

        return { overdueActivities, todayActivities, dealsWithoutAction };
    }, [activities, deals]);

    // --- Stable callbacks ---
    const handleToggleActivity = useCallback((id: string) => {
        const currentStageIndex = pipeline.stages.findIndex((s: any) => s.id === deal.stageId);
        const activity = activities.find(a => a.id === id);
        if (activity) updateActivity(id, { completed: !activity.completed });
    }, [activities, updateActivity]);

    const handleDeleteActivity = useCallback((id: string) => {
        if (window.confirm('Excluir atividade?')) deleteActivity(id);
    }, [deleteActivity]);

    const handleNavigate = useCallback((path: string) => {
        navigate(path);
    }, [navigate]);

    const handleOpenWidgetModal = useCallback(() => {
        setIsWidgetModalOpen(true);
    }, []);

    return (
        <div className="h-full overflow-y-auto bg-background transition-colors duration-500 custom-scrollbar">
            <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10 space-y-10">

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

                    <div className="flex items-center gap-3">
                        {/* Period Selector */}
                        <div className="flex items-center bg-muted/50 rounded-lg border border-border/60 p-0.5">
                            {PERIOD_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => handlePeriodChange(opt.value)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                                        selectedPeriod === opt.value
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* New Deal */}
                        <button
                            onClick={() => openNewDealModal(defaultStageId)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors shadow-primary/20 active:scale-95"
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
                        {showPriority && (
                            <section>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                                    Tema Prioritário
                                </h2>
                                <PriorityCard
                                    recommendation={priorityRecommendation}
                                    onNavigate={handleNavigate}
                                />
                            </section>
                        )}

                        {/* BLOCO CUSTOMIZÁVEL - WIDGETS ESTRATÉGICOS */}
                        <section className="pt-2">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                    Widgets Estratégicos
                                </h2>
                                <button
                                    onClick={handleOpenWidgetModal}
                                    className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50 hover:border-border"
                                >
                                    <Settings size={14} />
                                    Gerenciar Widgets
                                </button>
                            </div>
                            <WidgetsRow
                                customWidgets={customWidgets}
                                insightsData={insightsData}
                                currency={currency}
                                periodLabel={periodLabel}
                                onNavigate={handleNavigate}
                                onOpenManager={handleOpenWidgetModal}
                            />
                        </section>

                        {/* BLOCO 2 - ATENÇÃO IMEDIATA */}
                        <section>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                                Atenção Imediata
                            </h2>
                            <AlertColumns
                                overdueActivities={alertLists.overdueActivities}
                                todayActivities={alertLists.todayActivities}
                                dealsWithoutAction={alertLists.dealsWithoutAction}
                                onToggleActivity={handleToggleActivity}
                                onDeleteActivity={handleDeleteActivity}
                                onOpenFocusDeal={openFocusDeal}
                            />
                        </section>
                    </div>
                )}
            </div>

            <WidgetManagerModal
                isOpen={isWidgetModalOpen}
                onClose={() => setIsWidgetModalOpen(false)}
                currentWidgets={customWidgets}
                onSave={saveWidgets}
                showPriority={showPriority}
                onTogglePriority={togglePriority}
            />
        </div>
    );
}
