import { useDashboardData } from '@/hooks/useDashboardData';
import NewActivityModal from '@/components/activities/NewActivityModal';
import { useState, ReactNode, useMemo, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Calendar, Plus, ArrowRight, DollarSign, TrendingUp, BarChart3, XCircle, ChevronDown, LayoutGrid, Save, RotateCcw } from 'lucide-react';
import ActivityList from '@/components/activities/ActivityList';
import DraggableGrid from '@/components/ui/DraggableGrid'; // Switched to DraggableGrid
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function MonthFilter({ selected, onToggle }: { selected: string[], onToggle: (m: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Generate last 12 months
    const months = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const d = subMonths(new Date(), i);
            return {
                id: format(d, 'yyyy-MM'),
                label: format(d, 'MMMM', { locale: ptBR }),
                year: format(d, 'yyyy')
            };
        });
    }, []);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const selectedLabels = selected
        .map(s => {
            const m = months.find(x => x.id === s);
            return m ? m.label.substring(0, 3) : s;
        })
        .join(', ');

    return (
        <div className="relative z-50" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-secondary/50 hover:bg-secondary text-foreground rounded-lg transition-colors border border-border/50"
            >
                <Calendar size={16} className="text-muted-foreground" />
                <span className="capitalize">{selectedLabels || 'Filtrar Data'}</span>
                <ChevronDown size={14} className="opacity-50" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl overflow-hidden p-1 grid grid-cols-2 gap-1 animate-in fade-in zoom-in-95 duration-200">
                    {months.map(m => (
                        <button
                            key={m.id}
                            onClick={() => onToggle(m.id)}
                            className={`
                                text-xs px-3 py-2 rounded-lg capitalize flex items-center justify-between transition-colors
                                ${selected.includes(m.id)
                                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'}
                            `}
                        >
                            <span>{m.label}</span>
                            {selected.includes(m.id) && <span className="opacity-60 text-[10px]">{m.year}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Dashboard() {
    const {
        stats,
        lists,
        actions,
        layout, // Now using live layout state
    } = useDashboardData();

    const [isNewActivityModalOpen, setIsNewActivityModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // --- Card Content Factories ---
    const cardContents: Record<string, ReactNode> = {
        dailyActivities: (
            <div className="h-full p-4 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-blue-500" />
                                Meta Diária
                            </p>
                            <input
                                type="number"
                                value={stats.activityGoal}
                                onChange={(e) => actions.handleActivityGoalChange(Number(e.target.value))}
                                className="text-right text-xs text-muted-foreground bg-transparent border-b border-dashed border-border focus:border-primary focus:text-foreground outline-none w-12"
                            />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-bold text-foreground">{stats.completedTodayCount}</h3>
                            <span className="text-sm text-muted-foreground/60 font-medium">/ {stats.activityGoal}</span>
                        </div>
                    </div>
                    <div className={`p-3 rounded-lg ${stats.completedTodayCount >= stats.activityGoal ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {stats.completedTodayCount >= stats.activityGoal ? <CheckCircle2 size={24} /> : <TrendingUp size={24} />}
                    </div>
                </div>
                <div className="space-y-2 mt-auto">
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${stats.completedTodayCount >= stats.activityGoal ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min((stats.completedTodayCount / stats.activityGoal) * 100, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground/80 text-right">
                        {stats.completedTodayCount >= stats.activityGoal ? 'Meta batida! 🚀' : `${stats.activityGoal - stats.completedTodayCount} restantes`}
                    </p>
                </div>
            </div>
        ),
        monthlyRevenue: (
            <div className="h-full p-4 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-full">
                        <div className="flex justify-between items-center w-full mb-2">
                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <DollarSign size={16} className="text-yellow-500" />
                                Meta Mensal
                            </p>
                            <input
                                type="number"
                                value={stats.revenueGoal}
                                onChange={(e) => actions.handleRevenueGoalChange(Number(e.target.value))}
                                className="text-right text-xs text-muted-foreground bg-transparent border-b border-dashed border-border focus:border-primary focus:text-foreground outline-none w-20"
                            />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-bold text-foreground">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' }).format(stats.currentMonthRevenue)}</h3>
                            <span className="text-sm text-muted-foreground/60 font-medium">/ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR', notation: 'compact' }).format(stats.revenueGoal)}</span>
                        </div>
                    </div>
                </div>
                <div className="space-y-2 mt-auto">
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden relative">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${stats.currentMonthRevenue >= stats.revenueGoal ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: `${Math.min((stats.currentMonthRevenue / stats.revenueGoal) * 100, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground/80 text-right">
                        {stats.currentMonthRevenue >= stats.revenueGoal ? 'Meta batida! 🔥' : `${((stats.currentMonthRevenue / stats.revenueGoal) * 100).toFixed(1)}% alcançado`}
                    </p>
                </div>
            </div>
        ),
        pipelineValue: (
            <div className="h-full p-4 flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-full text-green-500">
                    <DollarSign size={22} />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valor em Pipeline</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' }).format(stats.totalPipelineValue)}
                    </p>
                </div>
            </div>
        ),
        openDeals: (
            <div className="h-full p-4 flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-full text-blue-500">
                    <BarChart3 size={22} />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Negócios Abertos</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{stats.totalOpenDeals}</p>
                </div>
            </div>
        ),
        wonDeals: (
            <div className="h-full p-4 flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-500">
                    <TrendingUp size={22} />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Negócios Ganhos</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{stats.wonDealsCount}</p>
                </div>
            </div>
        ),
        lostDeals: (
            <div className="h-full p-4 flex items-center gap-4">
                <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                    <XCircle size={22} />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Negócios Perdidos</p>
                    <p className="text-2xl font-bold text-foreground mt-0.5">{stats.lostDealsCount}</p>
                </div>
            </div>
        ),
        todayAgenda: (
            <div className="h-full p-4 flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 mb-4 shrink-0">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Calendar size={20} />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">
                        Para Hoje <span className="text-muted-foreground font-normal text-base ml-1">({lists.todayActivities.length})</span>
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
                    {lists.todayActivities.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 border-2 border-dashed border-border/50 rounded-xl">
                            <CheckCircle2 size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">Tudo limpo por hoje! 🎉</p>
                        </div>
                    ) : (
                        <ActivityList
                            activities={lists.todayActivities}
                            onToggle={actions.handleToggleActivity}
                            onDelete={actions.handleDeleteActivity}
                        />
                    )}
                </div>
            </div>
        ),
        lateActivities: (
            <div className="h-full bg-red-500/5 p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-4 shrink-0">
                    <h3 className="text-red-500 font-semibold flex items-center gap-2">
                        <AlertTriangle size={18} />
                        Atrasadas ({lists.overdueActivities.length})
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                    <ActivityList
                        activities={lists.overdueActivities}
                        onToggle={actions.handleToggleActivity}
                        onDelete={actions.handleDeleteActivity}
                    />
                </div>
            </div>
        ),
        noActionDeals: (
            <div className="h-full p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-4 shrink-0">
                    <div className="p-1.5 bg-yellow-500/10 rounded-md text-yellow-500">
                        <AlertTriangle size={16} />
                    </div>
                    <h3 className="font-semibold text-foreground">Atenção Necessária ({lists.dealsWithoutAction.length})</h3>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-2">
                    {lists.dealsWithoutAction.map(deal => (
                        <div
                            key={deal.id}
                            onClick={() => actions.navigate(`/deals/${deal.id}`)}
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
        ),
    };

    const gridItems = useMemo(() => {
        return layout
            .filter(item => {
                if (item.id === 'lateActivities' && lists.overdueActivities.length === 0) return false;
                if (item.id === 'noActionDeals' && lists.dealsWithoutAction.length === 0) return false;
                return true;
            })
            .map((item) => ({
                ...item,
                content: cardContents[item.id] || null
            }));
    }, [layout, cardContents, lists.overdueActivities.length, lists.dealsWithoutAction.length]);

    return (
        <div className="h-full overflow-y-auto bg-background transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Minha Agenda</h1>
                        <p className="text-muted-foreground mt-1 text-sm">Foque no que precisa ser feito hoje.</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Date Filter */}
                        <MonthFilter selected={stats.monthFilter} onToggle={actions.toggleMonthFilter} />


                        {/* Edit Mode Toggle */}
                        {isEditMode ? (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                                <button
                                    onClick={() => { actions.resetLayout(); setIsEditMode(false); }}
                                    className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                                >
                                    <RotateCcw size={16} /> Reseta
                                </button>
                                <button
                                    onClick={() => setIsEditMode(false)}
                                    className="px-4 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 rounded-lg shadow-sm flex items-center gap-2 transition-all"
                                >
                                    <Save size={16} /> Salvar & Sair
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsEditMode(true)}
                                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg flex items-center gap-2 transition-colors"
                            >
                                <LayoutGrid size={16} /> Organizar Cards
                            </button>
                        )}

                        <button
                            onClick={() => setIsNewActivityModalOpen(true)}
                            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95 ml-2"
                        >
                            <Plus size={18} />
                            Nova Atividade
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="space-y-8">

                    {/* Draggable Dashboard Grid */}
                    <div className={isEditMode ? 'ring-2 ring-primary/20 rounded-xl p-2 bg-muted/20 border border-dashed border-primary/30 transition-all' : ''}>
                        <DraggableGrid
                            items={gridItems}
                            onLayoutChange={actions.saveLayout}
                            isEditable={isEditMode}
                            rowHeight={80}
                            gap={16}
                        />
                    </div>
                </div>

                <NewActivityModal
                    isOpen={isNewActivityModalOpen}
                    onClose={() => setIsNewActivityModalOpen(false)}
                />
            </div>
        </div>
    );
}
