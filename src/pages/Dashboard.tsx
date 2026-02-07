import { useDashboardData, PeriodFilter } from '@/hooks/useDashboardData';
import NewActivityModal from '@/components/activities/NewActivityModal';
import { useState, useMemo, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Calendar, Plus, ArrowRight, DollarSign, TrendingUp, BarChart3, XCircle, ChevronDown, Filter, CalendarDays } from 'lucide-react';
import ActivityList from '@/components/activities/ActivityList';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Components ---

function PeriodSelector({ value, onChange }: { value: PeriodFilter, onChange: (v: PeriodFilter) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const options: { label: string, value: PeriodFilter }[] = [
        { label: 'Últimos 7 dias', value: '7d' },
        { label: 'Últimos 30 dias', value: '30d' },
        { label: 'Últimos 90 dias', value: '90d' },
        { label: 'Este Mês', value: 'month' },
        { label: 'Personalizado', value: 'custom' },
    ];

    const currentLabel = options.find(o => o.value === value)?.label;

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-background hover:bg-muted text-foreground rounded-md transition-colors border border-border shadow-sm"
            >
                <Filter size={14} className="text-muted-foreground" />
                <span>{currentLabel}</span>
                <ChevronDown size={14} className="opacity-50" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`
                                w-full text-left px-4 py-2 text-sm transition-colors
                                ${value === opt.value
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'hover:bg-muted text-foreground'}
                            `}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

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
                className="flex items-center gap-2 px-2 py-1 text-xs font-medium bg-secondary/50 hover:bg-secondary text-foreground rounded transition-colors border border-border/50"
            >
                <Calendar size={12} className="text-muted-foreground" />
                <span className="capitalize max-w-[100px] truncate">{selectedLabels || 'Filtrar'}</span>
                <ChevronDown size={12} className="opacity-50" />
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

const MOTIVATIONAL_QUOTES = [
    "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
    "A persistência é o caminho do êxito.",
    "Não espere por oportunidades, crie-as.",
    "Grandes resultados requerem grandes ambições.",
    "Seu único limite é você mesmo.",
    "Foco no objetivo, força na luta e fé na vitória.",
    "A disciplina é a mãe do sucesso.",
    "Hoje é um dia perfeito para começar.",
    "Transforme seus obstáculos em degraus para o sucesso.",
    "Acredite no seu potencial e os resultados virão."
];

export default function Dashboard() {
    const { user } = useSupabaseAuth();
    const {
        stats,
        lists,
        actions,
    } = useDashboardData();

    const [isNewActivityModalOpen, setIsNewActivityModalOpen] = useState(false);
    const [showAllOverdue, setShowAllOverdue] = useState(false);
    const [showAllToday, setShowAllToday] = useState(false);

    // Daily Quote Logic
    const dailyQuote = useMemo(() => {
        const day = new Date().getDate();
        const index = day % MOTIVATIONAL_QUOTES.length;
        return MOTIVATIONAL_QUOTES[index];
    }, []);

    return (
        <div className="h-full overflow-y-auto bg-background transition-colors duration-300">
            <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    {/* Welcome */}
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            Olá, {user?.user_metadata?.name?.split(' ')[0] || 'Visitante'}.
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {dailyQuote}
                        </p>
                    </div>

                    {/* Actions & Global Filter */}
                    <div className="flex items-center gap-3">
                        <PeriodSelector value={stats.periodFilter} onChange={actions.setPeriodFilter} />

                        <button
                            onClick={() => setIsNewActivityModalOpen(true)}
                            className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 shadow-sm transition-all active:scale-95"
                        >
                            <Plus size={16} />
                            Nova Atividade
                        </button>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* 1. Daily Activity Goal */}
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
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

                    {/* 2. Monthly Revenue */}
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-full">
                                <div className="flex justify-between items-center w-full mb-2">
                                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <DollarSign size={16} className="text-yellow-500" />
                                        Receita ({stats.monthFilter.length > 1 ? 'Múltiplos' : 'Mensal'})
                                    </p>
                                    <MonthFilter selected={stats.monthFilter} onToggle={actions.toggleMonthFilter} />
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <input
                                        type="number"
                                        value={stats.revenueGoal}
                                        onChange={(e) => actions.handleRevenueGoalChange(Number(e.target.value))}
                                        className="text-xs text-muted-foreground bg-transparent border-b border-dashed border-border focus:border-primary focus:text-foreground outline-none w-20"
                                    />
                                    <span className="text-[10px] text-muted-foreground uppercase">Meta</span>
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

                    {/* 3. Pipeline Value (Small) */}
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-3 bg-green-500/10 rounded-full text-green-500">
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valor em Pipeline</p>
                            <p className="text-xl font-bold text-foreground mt-0.5">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'EUR' }).format(stats.totalPipelineValue)}
                            </p>
                        </div>
                    </div>

                    {/* 4. Open Deals (Small) */}
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-3 bg-blue-500/10 rounded-full text-blue-500">
                            <BarChart3 size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Negócios Abertos</p>
                            <p className="text-xl font-bold text-foreground mt-0.5">{stats.totalOpenDeals}</p>
                        </div>
                    </div>

                    {/* 5. Won Deals (Small) */}
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-500">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Negócios Ganhos</p>
                            <p className="text-xl font-bold text-foreground mt-0.5">{stats.wonDealsCount}</p>
                        </div>
                    </div>

                    {/* 6. Lost Deals (Small) */}
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                            <XCircle size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Negócios Perdidos</p>
                            <p className="text-xl font-bold text-foreground mt-0.5">{stats.lostDealsCount}</p>
                        </div>
                    </div>
                </div>

                {/* Activities Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Atrasadas */}
                    <div className="bg-red-50/50 border border-red-200/60 rounded-xl p-5 shadow-sm flex flex-col min-h-0">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-red-600 font-semibold flex items-center gap-2">
                                <AlertTriangle size={18} />
                                Atrasadas ({lists.overdueActivities.length})
                            </h3>
                        </div>

                        <div className="flex-1 min-h-0 space-y-1">
                            {lists.overdueActivities.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic p-2">Nenhuma atividade atrasada.</p>
                            ) : (
                                <ActivityList
                                    activities={lists.overdueActivities.slice(0, showAllOverdue ? undefined : 3)}
                                    onToggle={actions.handleToggleActivity}
                                    onDelete={actions.handleDeleteActivity}
                                />
                            )}
                        </div>

                        {lists.overdueActivities.length > 3 && (
                            <button
                                onClick={() => setShowAllOverdue(!showAllOverdue)}
                                className="mt-3 text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1 self-start"
                            >
                                {showAllOverdue ? 'Mostrar menos' : `Ver todas (${lists.overdueActivities.length - 3} mais)`} <ArrowRight size={12} />
                            </button>
                        )}
                    </div>

                    {/* Para Hoje */}
                    <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-5 shadow-sm flex flex-col min-h-0">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-blue-600 font-semibold flex items-center gap-2">
                                <CalendarDays size={18} />
                                Para Hoje ({lists.todayActivities.length})
                            </h3>
                        </div>

                        <div className="flex-1 min-h-0 space-y-1">
                            {lists.todayActivities.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic p-2">Tudo limpo por hoje!</p>
                            ) : (
                                <ActivityList
                                    activities={lists.todayActivities.slice(0, showAllToday ? undefined : 3)}
                                    onToggle={actions.handleToggleActivity}
                                    onDelete={actions.handleDeleteActivity}
                                />
                            )}
                        </div>

                        {lists.todayActivities.length > 3 && (
                            <button
                                onClick={() => setShowAllToday(!showAllToday)}
                                className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 self-start"
                            >
                                {showAllToday ? 'Mostrar menos' : `Ver todas (${lists.todayActivities.length - 3} mais)`} <ArrowRight size={12} />
                            </button>
                        )}
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
