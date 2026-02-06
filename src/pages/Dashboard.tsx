import { useDashboardData } from '@/hooks/useDashboardData';
import NewActivityModal from '@/components/activities/NewActivityModal';
import { useState, ReactNode, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Calendar, Plus, ArrowRight, DollarSign, TrendingUp, BarChart3, LayoutGrid, Save, RotateCcw } from 'lucide-react';
import ActivityList from '@/components/activities/ActivityList';
import DraggableGrid from '@/components/ui/DraggableGrid'; // Switched to DraggableGrid

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
    };

    const gridItems = useMemo(() => layout.map((item) => ({
        ...item,
        content: cardContents[item.id] || null
    })), [layout, cardContents]);

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

                    {/* Alerts Section (Keep static) */}
                    {(lists.overdueActivities.length > 0 || lists.dealsWithoutAction.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {lists.overdueActivities.length > 0 && (
                                <div className="bg-red-500/5 border border-red-500/20 rounded-[12px] p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <h3 className="text-red-500 font-semibold mb-4 flex items-center gap-2">
                                        <AlertTriangle size={18} />
                                        Atrasadas ({lists.overdueActivities.length})
                                    </h3>
                                    <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        <ActivityList
                                            activities={lists.overdueActivities}
                                            onToggle={actions.handleToggleActivity}
                                            onDelete={actions.handleDeleteActivity}
                                        />
                                    </div>
                                </div>
                            )}

                            {lists.dealsWithoutAction.length > 0 && (
                                <div className="bg-card border border-yellow-500/50 rounded-[12px] p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 delay-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-yellow-500/10 rounded-md text-yellow-500">
                                            <AlertTriangle size={16} />
                                        </div>
                                        <h3 className="font-semibold text-foreground">Atenção Necessária</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        {lists.dealsWithoutAction.length} negócios ativos sem próxima ação.
                                    </p>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
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
                            )}
                        </div>
                    )}

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
