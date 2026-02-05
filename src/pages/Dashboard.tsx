import { useCRM } from '@/contexts/CRMContext';
import { CheckCircle2, AlertTriangle, Calendar, Plus, ArrowRight, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import { isBefore, isToday, parseISO, startOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ActivityList from '@/components/activities/ActivityList';
import NewActivityModal from '@/components/activities/NewActivityModal';
import DraggableGrid, { GridItem } from '@/components/ui/DraggableGrid';
import { useState, ReactNode } from 'react';

const LAYOUT_STORAGE_KEY = 'dashboard_layout_v1';

const DEFAULT_LAYOUT: GridItem[] = [
    { id: 'dailyActivities', x: 0, y: 0, w: 6, h: 2, content: null },
    { id: 'monthlyRevenue', x: 6, y: 0, w: 6, h: 2, content: null },
    { id: 'pipelineValue', x: 0, y: 2, w: 4, h: 1, content: null },
    { id: 'openDeals', x: 4, y: 2, w: 4, h: 1, content: null },
    { id: 'wonDeals', x: 8, y: 2, w: 4, h: 1, content: null },
    { id: 'todayAgenda', x: 0, y: 3, w: 12, h: 3, content: null },
];

export default function Dashboard() {
    const { deals, activities, updateActivity, deleteActivity } = useCRM();
    const navigate = useNavigate();
    const [isNewActivityModalOpen, setIsNewActivityModalOpen] = useState(false);

    // Load saved layout with Smart Collision Detection
    const [layout, setLayout] = useState<GridItem[]>(() => {
        const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
        let finalLayout = [...DEFAULT_LAYOUT];

        if (saved) {
            try {
                const savedItems = JSON.parse(saved) as GridItem[];

                // 1. Identify "Known" items (User has moved/saved these)
                const processedIds = new Set<string>();

                const mergedLayout: (GridItem | null)[] = DEFAULT_LAYOUT.map(defaultItem => {
                    const savedItem = savedItems.find(p => p.id === defaultItem.id);
                    if (savedItem) {
                        processedIds.add(defaultItem.id);
                        return { ...defaultItem, ...savedItem, content: null };
                    }
                    return null; // temporary marker for new items
                });

                // 2. Place New Items (Items in Default but NOT in Saved)
                // We must find a spot for them that doesn't overlap with 'savedItem' positions.

                // Helper to check collision
                const collides = (rect1: GridItem, rect2: GridItem) => {
                    return (
                        rect1.x < rect2.x + rect2.w &&
                        rect1.x + rect1.w > rect2.x &&
                        rect1.y < rect2.y + rect2.h &&
                        rect1.y + rect1.h > rect2.y
                    );
                };

                // Get all currently occupied spaces from the saved items
                const occupied = mergedLayout.filter((i): i is GridItem => i !== null);

                // Process the nulls (new items)
                finalLayout = mergedLayout.map((item, index) => {
                    if (item) return item; // It's a saved item

                    // It's a new item, we need to find a spot.
                    const defaultItem = DEFAULT_LAYOUT[index];
                    let candidate: GridItem = { ...defaultItem, content: null };

                    // Try to place it at default position first
                    let hasCollision = occupied.some(occ => collides(candidate, occ));

                    if (!hasCollision) {
                        occupied.push(candidate);
                        return candidate;
                    }

                    // If default is taken, simple algorithms: Place at the bottom
                    const maxY = occupied.reduce((max, i) => Math.max(max, i.y + i.h), 0);
                    candidate = { ...candidate, x: 0, y: maxY }; // Start mostly at left-bottom

                    // TODO: Could be smarter (scan for gaps), but 'bottom' is safe preventing overlap.
                    occupied.push(candidate);
                    return candidate;
                });

            } catch {
                finalLayout = DEFAULT_LAYOUT;
            }
        }
        return finalLayout;
    });

    // Save layout
    const handleLayoutChange = (newLayout: GridItem[]) => {
        const layoutToSave = newLayout.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutToSave));
        setLayout(newLayout);
    };

    // Data Processing
    const today = startOfDay(new Date());

    const completedTodayCount = activities.filter(a =>
        a.completed && a.dueDate && isToday(parseISO(a.dueDate))
    ).length;

    const totalPipelineValue = deals
        .filter(d => d.status === 'open')
        .reduce((sum, d) => sum + d.value, 0);

    const totalOpenDeals = deals.filter(d => d.status === 'open').length;
    const wonDealsCount = deals.filter(d => d.status === 'won').length;

    const currentMonthRevenue = deals
        .filter(d => d.status === 'won' && (d.wonAt ? new Date(d.wonAt).getMonth() === new Date().getMonth() : true))
        .reduce((sum, d) => sum + d.value, 0);

    const [revenueGoal, setRevenueGoal] = useState(() => Number(localStorage.getItem('dashboard_revenue_goal')) || 5000);
    const [activityGoal, setActivityGoal] = useState(() => Number(localStorage.getItem('dashboard_activity_goal')) || 10);

    const handleRevenueGoalChange = (val: number) => {
        setRevenueGoal(val);
        localStorage.setItem('dashboard_revenue_goal', String(val));
    };

    const handleActivityGoalChange = (val: number) => {
        setActivityGoal(val);
        localStorage.setItem('dashboard_activity_goal', String(val));
    };

    const openActivities = activities.filter(a => !a.completed).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    const overdueActivities = openActivities.filter(a => {
        if (!a.dueDate) return false;
        return isBefore(parseISO(a.dueDate), today);
    });

    const todayActivities = openActivities.filter(a => {
        if (!a.dueDate) return false;
        return isToday(parseISO(a.dueDate));
    });

    const dealsWithoutAction = deals.filter(deal => {
        if (deal.status !== 'open') return false;
        const hasOpenActivity = activities.some(a => a.dealId === deal.id && !a.completed);
        return !hasOpenActivity;
    });

    const handleToggleActivity = (id: string) => {
        const activity = activities.find(a => a.id === id);
        if (activity) {
            updateActivity(id, { completed: !activity.completed });
        }
    };

    const handleDeleteActivity = (id: string) => {
        if (window.confirm('Excluir atividade?')) {
            deleteActivity(id);
        }
    };

    // Card Components
    const cardContents: Record<string, ReactNode> = {
        dailyActivities: (
            <>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-blue-500" />
                                Meta Diária de Atividades
                            </p>
                            <input
                                type="number"
                                value={activityGoal}
                                onChange={(e) => handleActivityGoalChange(Number(e.target.value))}
                                className="text-right text-xs text-muted-foreground bg-transparent border-b border-dashed border-border focus:border-primary focus:text-foreground outline-none w-12"
                                title="Clique para editar a meta"
                            />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-bold text-foreground">{completedTodayCount}</h3>
                            <span className="text-sm text-muted-foreground/60 font-medium">/ {activityGoal}</span>
                        </div>
                    </div>
                    <div className={`p-3 rounded-lg ${completedTodayCount >= activityGoal ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {completedTodayCount >= activityGoal ? <CheckCircle2 size={24} /> : <TrendingUp size={24} />}
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${completedTodayCount >= activityGoal ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min((completedTodayCount / activityGoal) * 100, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground/80 text-right">
                        {completedTodayCount >= activityGoal ? 'Meta batida! 🚀' : `${activityGoal - completedTodayCount} restantes`}
                    </p>
                </div>
            </>
        ),
        monthlyRevenue: (
            <>
                <div className="flex justify-between items-start mb-4">
                    <div className="w-full">
                        <div className="flex justify-between items-center w-full mb-2">
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <DollarSign size={16} className="text-yellow-500" />
                                Meta Mensal de Faturamento
                            </p>
                            <input
                                type="number"
                                value={revenueGoal}
                                onChange={(e) => handleRevenueGoalChange(Number(e.target.value))}
                                className="text-right text-xs text-muted-foreground bg-transparent border-b border-dashed border-border focus:border-primary focus:text-foreground outline-none w-20"
                                title="Clique para editar a meta"
                            />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-bold text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' }).format(currentMonthRevenue)}</h3>
                            <span className="text-sm text-muted-foreground/60 font-medium">/ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR', notation: 'compact' }).format(revenueGoal)}</span>
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden relative">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${currentMonthRevenue >= revenueGoal ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: `${Math.min((currentMonthRevenue / revenueGoal) * 100, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground/80 text-right">
                        {currentMonthRevenue >= revenueGoal ? 'Meta batida! 🔥' : `${((currentMonthRevenue / revenueGoal) * 100).toFixed(1)}% alcançado`}
                    </p>
                </div>
            </>
        ),
        pipelineValue: (
            <div className="flex items-center gap-4 h-full">
                <div className="p-3 bg-green-500/10 rounded-full text-green-500">
                    <DollarSign size={22} />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valor em Pipeline</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' }).format(totalPipelineValue)}
                    </p>
                </div>
            </div>
        ),
        openDeals: (
            <div className="flex items-center gap-4 h-full">
                <div className="p-3 bg-blue-500/10 rounded-full text-blue-500">
                    <BarChart3 size={22} />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Negócios Abertos</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{totalOpenDeals}</p>
                </div>
            </div>
        ),
        wonDeals: (
            <div className="flex items-center gap-4 h-full">
                <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-500">
                    <TrendingUp size={22} />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Negócios Ganhos</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{wonDealsCount}</p>
                </div>
            </div>
        ),
        todayAgenda: (
            <>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Calendar size={20} />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">
                        Para Hoje <span className="text-muted-foreground font-normal text-base ml-1">({todayActivities.length})</span>
                    </h3>
                </div>

                {todayActivities.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground/60 border-2 border-dashed border-border/50 rounded-xl">
                        <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">Tudo limpo por hoje! 🎉</p>
                        <p className="text-sm">Aproveite para adiantar tarefas de amanhã.</p>
                    </div>
                ) : (
                    <div className="max-w-4xl">
                        <ActivityList
                            activities={todayActivities}
                            onToggle={handleToggleActivity}
                            onDelete={handleDeleteActivity}
                        />
                    </div>
                )}
            </>
        ),
    };

    // Update layout with content
    const layoutWithContent = layout.map(item => ({
        ...item,
        content: cardContents[item.id] || <div>Card não encontrado</div>
    }));

    return (
        <div className="h-full overflow-y-auto transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-8 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Minha Agenda</h1>
                        <p className="text-muted-foreground mt-1 text-sm">Foque no que precisa ser feito hoje.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsNewActivityModalOpen(true)}
                            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
                        >
                            <Plus size={18} />
                            Nova Atividade
                        </button>
                    </div>
                </div>

                {/* Alerts Section */}
                {(overdueActivities.length > 0 || dealsWithoutAction.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {overdueActivities.length > 0 && (
                            <div className="bg-red-500/5 border border-red-500/20 rounded-[12px] p-6">
                                <h3 className="text-red-500 font-semibold mb-4 flex items-center gap-2">
                                    <AlertTriangle size={18} />
                                    Atrasadas ({overdueActivities.length})
                                </h3>
                                <ActivityList
                                    activities={overdueActivities}
                                    onToggle={handleToggleActivity}
                                    onDelete={handleDeleteActivity}
                                />
                            </div>
                        )}

                        {dealsWithoutAction.length > 0 && (
                            <div className="bg-card border border-yellow-500/50 rounded-[12px] p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-yellow-500/10 rounded-md text-yellow-500">
                                        <AlertTriangle size={16} />
                                    </div>
                                    <h3 className="font-semibold text-foreground">Atenção Necessária</h3>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">Existem {dealsWithoutAction.length} negócios ativos sem próxima ação definida no pipeline.</p>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {dealsWithoutAction.map(deal => (
                                        <div
                                            key={deal.id}
                                            onClick={() => navigate(`/deals/${deal.id}`)}
                                            className="p-3 bg-secondary/50 hover:bg-secondary border border-border/50 rounded-lg cursor-pointer transition-all group flex justify-between items-center"
                                        >
                                            <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">{deal.title}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-muted-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: deal.currency }).format(deal.value)}</span>
                                                <ArrowRight size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Draggable Grid */}
                <DraggableGrid
                    items={layoutWithContent}
                    onLayoutChange={handleLayoutChange}
                    cols={12}
                    rowHeight={100}
                    gap={24}
                />

                <NewActivityModal
                    isOpen={isNewActivityModalOpen}
                    onClose={() => setIsNewActivityModalOpen(false)}
                />
            </div>
        </div>
    );
}
