import { useState, useMemo, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Currency } from '@/data/currencies';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Search,
    Plus,
    Calendar,
    Phone,
    Mail,
    CheckCircle2,
    Clock,
    CheckCircle,
    Building2,
    X,
    SearchX,
    RefreshCw,
    Trash2,
    Pencil,
    Check,
    Users,
    MessageCircle,
    Video,
    BarChart3,
    MessageSquare,
    AlarmClock,
    Filter,
    ClipboardList,
    User,
} from 'lucide-react';
import {
    format,
    isToday,
    isTomorrow,
    isBefore,
    isAfter,
    startOfToday,
    endOfDay,
    addDays,
    startOfMonth,
    endOfMonth,
    parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/useMediaQuery';
import GlobalActivityModal from '@/components/activities/GlobalActivityModal';
import BulkEditActivitiesModal from '@/components/activities/BulkEditActivitiesModal';
import ActivitiesMoreActions from '@/components/activities/ActivitiesMoreActions';
import { PrivacyText } from '@/components/ui/PrivacyMask';
import { ActivityScriptPopover } from '@/components/activities/ActivityScriptPopover';
import DealDetailsModal from '@/components/kanban/DealDetailsModal';
import { getScriptByTitle, formatScript } from '@/services/cadence';
import { filterRealActivities } from '@/utils/activityHelpers';
import { Activity, ActivityType } from '@/types/schema';


// ─── Types ────────────────────────────────────────────────────────────────────
type PeriodFilter = 'Hoje' | 'Amanhã' | 'Próximos 7 dias' | 'Atrasadas' | 'Este mês' | 'Todos' | 'Personalizado';
type StatusFilter = 'pendente' | 'concluído' | 'atrasado' | 'todos';
type ResponsavelFilter = 'todos' | 'eu' | 'equipe';
type QuickTypeFilter = 'Todos' | ActivityType;

const PERIOD_OPTIONS: PeriodFilter[] = ['Hoje', 'Amanhã', 'Próximos 7 dias', 'Atrasadas', 'Este mês', 'Todos'];

const TYPE_OPTIONS: { id: ActivityType; label: string }[] = [
    { id: 'call', label: 'Ligação' },
    { id: 'email', label: 'Email' },
    { id: 'message', label: 'WhatsApp' },
    { id: 'meeting', label: 'Reunião' },
    { id: 'task', label: 'Tarefa' },
    { id: 'audit', label: 'Visita' },
];

const QUICK_TYPE_FILTERS: { id: QuickTypeFilter; label: string }[] = [
    { id: 'Todos', label: 'Todos' },
    { id: 'call', label: 'Ligações' },
    { id: 'email', label: 'Emails' },
    { id: 'message', label: 'WhatsApp' },
    { id: 'meeting', label: 'Reuniões' },
    { id: 'task', label: 'Tarefas' },
];

// ─── Icon map ─────────────────────────────────────────────────────────────────
const typeIcon: Record<string, React.ElementType> = {
    call: Phone,
    email: Mail,
    message: MessageCircle,
    meeting: Users,
    task: CheckCircle2,
    audit: Video,
    analysis: BarChart3,
    instagram: MessageSquare,
};

const typeLabel: Record<string, string> = {
    call: 'Ligação',
    email: 'Email',
    message: 'WhatsApp',
    meeting: 'Reunião',
    task: 'Tarefa',
    audit: 'Visita',
    analysis: 'Análise',
    instagram: 'Instagram',
};

const typeColor: Record<string, string> = {
    call: 'text-blue-500 bg-blue-500/10',
    email: 'text-orange-500 bg-orange-500/10',
    message: 'text-green-500 bg-green-500/10',
    meeting: 'text-violet-500 bg-violet-500/10',
    task: 'text-sky-500 bg-sky-500/10',
    audit: 'text-rose-500 bg-rose-500/10',
    analysis: 'text-amber-500 bg-amber-500/10',
    instagram: 'text-pink-500 bg-pink-500/10',
};

// ─── Helpers  ─────────────────────────────────────────────────────────────────
function getActivityPriority(activity: Activity): 'overdue' | 'today' | 'future' {
    if (activity.completed) return 'future';
    if (!activity.dueDate) return 'future';
    const date = parseISO(activity.dueDate);
    const today = startOfToday();
    if (isBefore(date, today)) return 'overdue';
    if (isToday(date)) return 'today';
    return 'future';
}

function priorityStyles(p: 'overdue' | 'today' | 'future') {
    if (p === 'overdue') return {
        border: 'border-l-red-500',
        badge: 'bg-red-500/10 text-red-500',
        label: 'Atrasada',
        dot: 'bg-red-500',
    };
    if (p === 'today') return {
        border: 'border-l-orange-500',
        badge: 'bg-orange-500/10 text-orange-500',
        label: 'Hoje',
        dot: 'bg-orange-500',
    };
    return {
        border: 'border-l-emerald-500',
        badge: 'bg-emerald-500/10 text-emerald-500',
        label: 'Futuro',
        dot: 'bg-emerald-500',
    };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Activities({ currency: _currency }: { currency: Currency }) {
    const { activities, deals, contacts, companies, updateActivity, deleteActivity } = useCRM();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // ── Filter State ──────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('Todos');
    const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
    const [responsavelFilter, setResponsavelFilter] = useState<ResponsavelFilter>('todos');


    // Custom date range
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // UI State
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
    const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Sync URL filter
    useEffect(() => {
        const urlFilter = searchParams.get('filter');
        if (urlFilter === 'Vencido' || urlFilter === 'Atrasadas') setPeriodFilter('Atrasadas');
        else if (urlFilter === 'Hoje') setPeriodFilter('Hoje');
    }, [searchParams]);

    // ── Filtered & Grouped Activities ─────────────────────────────────────────
    const filteredActivities = useMemo(() => {
        let result = filterRealActivities(activities);
        const today = startOfToday();

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(a => {
                const deal = deals.find(d => d.id === a.dealId);
                const contact = contacts.find(c => c.id === a.contactId);
                const company = companies.find(c => c.id === a.companyId);
                return (
                    a.title.toLowerCase().includes(q) ||
                    deal?.title.toLowerCase().includes(q) ||
                    contact?.name.toLowerCase().includes(q) ||
                    company?.name.toLowerCase().includes(q)
                );
            });
        }

        // Type filter (multi-selection)
        if (selectedTypes.length > 0) {
            result = result.filter(a => selectedTypes.includes(a.type as ActivityType));
        }

        // Period filter
        if (periodFilter !== 'Todos') {
            if (periodFilter === 'Hoje') {
                result = result.filter(a => a.dueDate && isToday(parseISO(a.dueDate)));
            } else if (periodFilter === 'Amanhã') {
                result = result.filter(a => a.dueDate && isTomorrow(parseISO(a.dueDate)));
            } else if (periodFilter === 'Próximos 7 dias') {
                const end = endOfDay(addDays(today, 7));
                result = result.filter(a => {
                    if (!a.dueDate) return false;
                    const d = parseISO(a.dueDate);
                    return isAfter(d, today) && isBefore(d, end);
                });
            } else if (periodFilter === 'Atrasadas') {
                result = result.filter(a => !a.completed && a.dueDate && isBefore(parseISO(a.dueDate), today));
            } else if (periodFilter === 'Este mês') {
                const start = startOfMonth(today);
                const end = endOfMonth(today);
                result = result.filter(a => {
                    if (!a.dueDate) return false;
                    const d = parseISO(a.dueDate);
                    return isAfter(d, start) && isBefore(d, end);
                });
            } else if (periodFilter === 'Personalizado' && customStart && customEnd) {
                const start = parseISO(customStart);
                const end = endOfDay(parseISO(customEnd));
                result = result.filter(a => {
                    if (!a.dueDate) return false;
                    const d = parseISO(a.dueDate);
                    return isAfter(d, start) && isBefore(d, end);
                });
            }
        }

        // Status filter
        if (statusFilter === 'pendente') {
            result = result.filter(a => !a.completed && a.status !== 'canceled');
        } else if (statusFilter === 'concluído') {
            result = result.filter(a => a.completed);
        } else if (statusFilter === 'atrasado') {
            result = result.filter(a => !a.completed && a.dueDate && isBefore(parseISO(a.dueDate), today));
        }

        // Sort by dueDate asc (nulls last)
        result.sort((a, b) => {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
        });

        return result;
    }, [activities, searchQuery, selectedTypes, periodFilter, statusFilter, customStart, customEnd, deals, contacts, companies]);

    // ── Summary Counts ────────────────────────────────────────────────────────
    const summaryStats = useMemo(() => {
        const real = filterRealActivities(activities);
        const today = startOfToday();
        const in7 = endOfDay(addDays(today, 7));

        return {
            pending: real.filter(a => !a.completed).length,
            overdue: real.filter(a => !a.completed && a.dueDate && isBefore(parseISO(a.dueDate), today)).length,
            todayCount: real.filter(a => !a.completed && a.dueDate && isToday(parseISO(a.dueDate))).length,
            next7: real.filter(a => !a.completed && a.dueDate && isAfter(parseISO(a.dueDate), today) && isBefore(parseISO(a.dueDate), in7)).length,
        };
    }, [activities]);

    // ── Grouping ──────────────────────────────────────────────────────────────
    const groups = useMemo(() => {
        const today = startOfToday();
        const overdue: Activity[] = [];
        const todayArr: Activity[] = [];
        const tomorrowArr: Activity[] = [];
        const upcoming: Activity[] = [];
        const completed: Activity[] = [];

        for (const a of filteredActivities) {
            if (a.completed) { completed.push(a); continue; }
            if (!a.dueDate) { upcoming.push(a); continue; }
            const d = parseISO(a.dueDate);
            if (isBefore(d, today)) { overdue.push(a); continue; }
            if (isToday(d)) { todayArr.push(a); continue; }
            if (isTomorrow(d)) { tomorrowArr.push(a); continue; }
            upcoming.push(a);
        }

        const result: { label: string; color: string; icon: React.ElementType; activities: Activity[] }[] = [];
        if (overdue.length) result.push({ label: 'Atrasadas', color: 'text-red-500 border-red-500/30 bg-red-500/5', icon: AlarmClock, activities: overdue });
        if (todayArr.length) result.push({ label: 'Hoje', color: 'text-orange-500 border-orange-500/30 bg-orange-500/5', icon: Calendar, activities: todayArr });
        if (tomorrowArr.length) result.push({ label: 'Amanhã', color: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5', icon: Calendar, activities: tomorrowArr });
        if (upcoming.length) result.push({ label: 'Próximos dias', color: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5', icon: Calendar, activities: upcoming });
        if (completed.length) result.push({ label: 'Concluídas', color: 'text-muted-foreground border-border bg-muted/20', icon: CheckCircle, activities: completed });
        return result;
    }, [filteredActivities]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleToggleComplete = (id: string, completed: boolean) => {
        updateActivity(id, { completed, completedAt: completed ? new Date().toISOString() : undefined });
    };

    const handleBulkComplete = async () => {
        if (selectedActivities.length === 0) return;
        const now = new Date().toISOString();
        await Promise.all(selectedActivities.map(id => updateActivity(id, { completed: true, completedAt: now })));
        setSelectedActivities([]);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Excluir ${selectedActivities.length} atividade(s)?`)) return;
        await Promise.all(selectedActivities.map(id => deleteActivity(id)));
        setSelectedActivities([]);
    };

    const toggleType = (t: ActivityType) => {
        setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
    };

    const clearAllFilters = () => {
        setSearchQuery('');
        setPeriodFilter('Todos');
        setSelectedTypes([]);
        setStatusFilter('todos');
        setResponsavelFilter('todos');
        setCustomStart('');
        setCustomEnd('');
    };

    const hasActiveFilters = periodFilter !== 'Todos' || selectedTypes.length > 0 || statusFilter !== 'todos' || responsavelFilter !== 'todos' || searchQuery;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="bg-card border-b border-border/60 px-4 sm:px-6 pt-5 pb-0 z-20 shadow-sm">
                {/* Title row */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <ClipboardList size={18} className="text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground tracking-tight">Atividades</h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <RefreshCw size={9} className="text-emerald-500 animate-spin-slow" />
                                <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">Sincronização Ativa</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all
                                ${showFilters || hasActiveFilters
                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                    : 'bg-muted/30 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'}`}
                        >
                            <Filter size={15} />
                            <span className="hidden sm:inline">Filtros</span>
                            {hasActiveFilters && (
                                <span className="w-4 h-4 rounded-full bg-white/20 text-white text-[9px] font-bold flex items-center justify-center">
                                    {[
                                        periodFilter !== 'Todos' ? 1 : 0,
                                        selectedTypes.length,
                                        statusFilter !== 'todos' ? 1 : 0,
                                        responsavelFilter !== 'todos' ? 1 : 0,
                                    ].reduce((a, b) => a + b, 0)}
                                </span>
                            )}
                        </button>
                        <ActivitiesMoreActions
                            filteredActivities={filteredActivities}
                            deals={deals}
                            contacts={contacts}
                            companies={companies}
                            visibleColumns={['completed', 'title', 'dealId', 'contactId', 'companyId', 'dueDate', 'ownerId']}
                        />
                        <button
                            onClick={() => setIsNewModalOpen(true)}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 text-sm active:scale-95"
                        >
                            <Plus size={16} />
                            <span>Nova</span>
                        </button>
                    </div>
                </div>

                {/* ── Summary strip ──────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    {[
                        {
                            label: 'Pendentes', value: summaryStats.pending, color: 'from-primary/20 to-primary/5 text-primary border-primary/20',
                            onClick: () => { setStatusFilter('pendente'); setPeriodFilter('Todos'); }
                        },
                        {
                            label: 'Atrasadas', value: summaryStats.overdue, color: 'from-red-500/20 to-red-500/5 text-red-500 border-red-500/20',
                            onClick: () => { setPeriodFilter('Atrasadas'); setStatusFilter('todos'); }
                        },
                        {
                            label: 'Hoje', value: summaryStats.todayCount, color: 'from-orange-500/20 to-orange-500/5 text-orange-500 border-orange-500/20',
                            onClick: () => { setPeriodFilter('Hoje'); setStatusFilter('todos'); }
                        },
                        {
                            label: 'Próximos 7 dias', value: summaryStats.next7, color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/20',
                            onClick: () => { setPeriodFilter('Próximos 7 dias'); setStatusFilter('todos'); }
                        },
                    ].map(({ label, value, color, onClick }) => (
                        <button
                            key={label}
                            onClick={onClick}
                            className={`flex flex-col items-start p-3 rounded-2xl border bg-gradient-to-br ${color} transition-all hover:scale-[1.02] active:scale-95 text-left`}
                        >
                            <span className="text-2xl font-black">{value}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mt-0.5">{label}</span>
                        </button>
                    ))}
                </div>

                {/* ── Advanced Filter Panel ──────────────────────────────── */}
                {showFilters && (
                    <div className="border border-border/60 rounded-2xl p-4 mb-5 bg-muted/20 space-y-4">
                        {/* Row 1: Search + Period */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Search */}
                            <div className="relative group">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar atividade, negócio, contato..."
                                    className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium placeholder:text-muted-foreground/40 transition-all"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Period */}
                            <div className="flex items-center gap-2">
                                <Calendar size={15} className="text-muted-foreground/50 shrink-0" />
                                <select
                                    value={periodFilter}
                                    onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
                                    className="flex-1 py-2.5 px-3 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground"
                                >
                                    {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                    <option value="Personalizado">Personalizado</option>
                                </select>
                            </div>
                        </div>

                        {/* Custom date range */}
                        {periodFilter === 'Personalizado' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">De</label>
                                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                        className="w-full py-2.5 px-3 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Até</label>
                                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                        className="w-full py-2.5 px-3 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                </div>
                            </div>
                        )}

                        {/* Row 2: Type multi-select */}
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2 block">Tipo de atividade</label>
                            <div className="flex flex-wrap gap-2">
                                {TYPE_OPTIONS.map(({ id, label }) => {
                                    const Icon = typeIcon[id] || CheckCircle2;
                                    const isSelected = selectedTypes.includes(id);
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => toggleType(id)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                                                ${isSelected
                                                    ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                                                    : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'}`}
                                        >
                                            <Icon size={12} />
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Row 3: Status + Responsável */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                                    className="w-full py-2.5 px-3 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground"
                                >
                                    <option value="todos">Todos</option>
                                    <option value="pendente">Pendente</option>
                                    <option value="concluído">Concluído</option>
                                    <option value="atrasado">Atrasado</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Responsável</label>
                                <select
                                    value={responsavelFilter}
                                    onChange={e => setResponsavelFilter(e.target.value as ResponsavelFilter)}
                                    className="w-full py-2.5 px-3 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground"
                                >
                                    <option value="todos">Todos</option>
                                    <option value="eu">Eu</option>
                                    <option value="equipe">Equipe</option>
                                </select>
                            </div>
                        </div>

                        {/* Clear */}
                        {hasActiveFilters && (
                            <button
                                onClick={clearAllFilters}
                                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors"
                            >
                                <X size={13} />
                                Limpar todos os filtros
                            </button>
                        )}
                    </div>
                )}

                {/* ── Quick type pills ───────────────────────────────────────── */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4">
                    {QUICK_TYPE_FILTERS.map(({ id, label }) => {
                        const Icon = id !== 'Todos' ? (typeIcon[id] || CheckCircle2) : ClipboardList;
                        const isActive = id === 'Todos' ? selectedTypes.length === 0 : selectedTypes.includes(id as ActivityType);
                        return (
                            <button
                                key={id}
                                onClick={() => {
                                    if (id === 'Todos') {
                                        setSelectedTypes([]);
                                    } else {
                                        toggleType(id as ActivityType);
                                    }
                                }}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all
                                    ${isActive
                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                        : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'}`}
                            >
                                <Icon size={12} />
                                {label}
                            </button>
                        );
                    })}

                    {/* Active search pill */}
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20 whitespace-nowrap"
                        >
                            <Search size={11} />
                            "{searchQuery}"
                            <X size={11} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Content ─────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto custom-scrollbar bg-background">
                {filteredActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-muted-foreground/40 px-4">
                        <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-5">
                            <SearchX size={36} className="opacity-40" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-1">Nenhuma atividade encontrada</h3>
                        <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
                            Tente ajustar os filtros ou termos de busca.
                        </p>
                        <button
                            onClick={clearAllFilters}
                            className="mt-5 text-xs font-bold text-primary uppercase tracking-widest hover:underline"
                        >
                            Limpar filtros
                        </button>
                    </div>
                ) : (
                    <div className="p-4 sm:p-6 space-y-8">
                        {groups.map(group => (
                            <section key={group.label}>
                                {/* Group header */}
                                <div className={`flex items-center gap-2 mb-3 px-1`}>
                                    <group.icon size={14} className={group.color.split(' ')[0]} />
                                    <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${group.color.split(' ')[0]}`}>
                                        {group.label}
                                    </span>
                                    <span className="text-[10px] font-bold text-muted-foreground/40 ml-1">
                                        ({group.activities.length})
                                    </span>
                                    <div className="flex-1 h-px bg-border/50 ml-2" />
                                </div>

                                {/* Activity cards */}
                                <div className="space-y-2.5">
                                    {group.activities.map(activity => (
                                        <ActivityCard
                                            key={activity.id}
                                            activity={activity}
                                            isSelected={selectedActivities.includes(activity.id)}
                                            onToggleSelect={() =>
                                                setSelectedActivities(prev =>
                                                    prev.includes(activity.id) ? prev.filter(i => i !== activity.id) : [...prev, activity.id]
                                                )
                                            }
                                            onToggleComplete={() => handleToggleComplete(activity.id, !activity.completed)}
                                            onEdit={() => {
                                                if (activity.dealId) {
                                                    setSelectedDealId(activity.dealId);
                                                } else {
                                                    setEditingActivity(activity);
                                                }
                                            }}
                                            onDelete={() => deleteActivity(activity.id)}
                                            onNavigateDeal={dealId => navigate(`/deals/${dealId}`)}
                                            onNavigateContact={contactId => navigate(`/contacts/${contactId}`)}
                                            deal={deals.find(d => d.id === activity.dealId)}
                                            contact={contacts.find(c => c.id === activity.contactId)}
                                            company={companies.find(c => c.id === (activity.companyId || deals.find(d => d.id === activity.dealId)?.companyId))}
                                            contacts={contacts}
                                            companies={companies}
                                            deals={deals}
                                            isMobile={isMobile}
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Bottom stats bar ─────────────────────────────────────────── */}
            <div className="border-t border-border/60 px-5 py-2.5 bg-card flex items-center gap-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                <span>Total: <span className="text-foreground">{filteredActivities.length}</span></span>
                <div className="w-px h-3 bg-border" />
                <span>Concluídas: <span className="text-emerald-500">{filteredActivities.filter(a => a.completed).length}</span></span>
                <div className="w-px h-3 bg-border" />
                <span>Pendentes: <span className="text-orange-500">{filteredActivities.filter(a => !a.completed).length}</span></span>
            </div>

            {/* ── Bulk Actions ─────────────────────────────────────────────── */}
            {selectedActivities.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1A1D26] text-white px-8 py-4 rounded-[28px] flex items-center gap-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 z-[100] border border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center font-bold text-sm">
                            {selectedActivities.length}
                        </div>
                        <span className="text-sm font-semibold">selecionadas</span>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsBulkEditModalOpen(true)} className="flex items-center gap-1.5 text-sm font-bold hover:text-primary transition-colors">
                            <Pencil size={15} /> Editar
                        </button>
                        <button onClick={handleBulkComplete} className="flex items-center gap-1.5 text-sm font-bold hover:text-emerald-400 transition-colors">
                            <CheckCircle size={15} /> Concluir
                        </button>
                        <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-sm font-bold hover:text-red-400 transition-colors">
                            <Trash2 size={15} /> Excluir
                        </button>
                    </div>
                    <button onClick={() => setSelectedActivities([])} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* ── Modals ────────────────────────────────────────────────────── */}
            <GlobalActivityModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} />
            <BulkEditActivitiesModal
                isOpen={isBulkEditModalOpen}
                onClose={() => setIsBulkEditModalOpen(false)}
                selectedIds={selectedActivities}
                onSuccess={() => setSelectedActivities([])}
            />
            {editingActivity && (
                <QuickEditModal
                    activity={editingActivity}
                    onClose={() => setEditingActivity(null)}
                    onSave={(id, updates) => { updateActivity(id, updates); setEditingActivity(null); }}
                />
            )}
            <DealDetailsModal
                isOpen={!!selectedDealId}
                onClose={() => setSelectedDealId(null)}
                dealId={selectedDealId}
                currency={_currency}
            />
        </div>
    );
}

// ─── Activity Card Component ──────────────────────────────────────────────────
interface CardProps {
    activity: Activity;
    isSelected: boolean;
    onToggleSelect: () => void;
    onToggleComplete: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onNavigateDeal: (id: string) => void;
    onNavigateContact: (id: string) => void;
    deal?: { id: string; title: string };
    contact?: { id: string; name: string; email?: string; phone?: string };
    company?: { id: string; name: string };
    contacts: any[];
    companies: any[];
    deals: any[];
    isMobile?: boolean;
}

function ActivityCard({
    activity, isSelected, onToggleSelect, onToggleComplete, onEdit, onDelete,
    onNavigateDeal, onNavigateContact, deal, contact, company,
    contacts, companies, deals
}: CardProps) {
    const Icon = typeIcon[activity.type] || CheckCircle2;
    const iconColors = typeColor[activity.type] || 'text-muted-foreground bg-muted';
    const label = typeLabel[activity.type] || activity.type;
    const priority = getActivityPriority(activity);
    const styles = priorityStyles(priority);

    // Script logic
    const rawScript = activity.tooltipScript || getScriptByTitle(activity.title);
    const contactForScript = contacts.find(c => c.id === activity.contactId);
    const companyForScript = companies.find(c => c.id === activity.companyId);
    const dealForScript = deals.find(d => d.id === activity.dealId);
    const formattedScript = rawScript ? formatScript(rawScript, {
        contactName: contactForScript?.name,
        companyName: companyForScript?.name,
        dealTitle: dealForScript?.title
    }) : undefined;
    const hasScript = (activity.tooltipScript || activity.notes || rawScript) && !activity.completed;

    return (
        <div
            onClick={onEdit}
            className={`group relative bg-card border border-border/40 rounded-xl transition-all hover:bg-muted/30 cursor-pointer
            border-l-[3px] ${activity.completed ? 'border-l-border/30 opacity-70' : styles.border}
            ${isSelected ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
        >
            <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Selection & Complete toggle */}
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggleSelect}
                        className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/20 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                    <button
                        onClick={onToggleComplete}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all
                            ${activity.completed
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                : 'border-border hover:border-primary hover:bg-primary/10 active:scale-95'}`}
                    >
                        {activity.completed && <Check size={12} className="stroke-[3]" />}
                    </button>
                </div>

                {/* Type icon (Small) */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColors}`}>
                    <Icon size={14} />
                </div>

                {/* Main Content (Horizontal Line) */}
                <div className="flex-1 flex items-center justify-between min-w-0 gap-4">
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-bold truncate ${activity.completed ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                                <PrivacyText text={activity.title} type="text" />
                            </h4>
                            {hasScript && (
                                <span onClick={e => e.stopPropagation()}>
                                    <ActivityScriptPopover suggestion={activity.notes} script={formattedScript} />
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-3 mt-0.5">
                            {deal && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onNavigateDeal(deal.id); }}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline truncate max-w-[150px]"
                                >
                                    <Building2 size={10} className="opacity-70" />
                                    <PrivacyText text={deal.title} type="text" />
                                </button>
                            )}
                            {contact && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onNavigateContact(contact.id); }}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground truncate max-w-[120px]"
                                >
                                    <div className="w-3.5 h-3.5 rounded-full bg-muted flex items-center justify-center text-[7px] font-bold uppercase">
                                        {contact.name.charAt(0)}
                                    </div>
                                    <PrivacyText text={contact.name} type="name" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                        {activity.dueDate && (
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                                    <Calendar size={10} className={activity.completed ? 'opacity-40' : priority === 'overdue' ? 'text-red-500' : priority === 'today' ? 'text-orange-500' : 'text-emerald-500'} />
                                    <span className={activity.completed ? 'opacity-50' : priority === 'overdue' ? 'text-red-500' : priority === 'today' ? 'text-orange-500' : ''}>
                                        {format(parseISO(activity.dueDate), "dd/MM", { locale: ptBR })}
                                    </span>
                                </div>
                                <span className="text-[9px] font-bold opacity-40">
                                    {format(parseISO(activity.dueDate), "HH:mm")}
                                </span>
                            </div>
                        )}

                        <div className="w-px h-6 bg-border/40 hidden sm:block" />

                        {/* Actions (Always visible or compact) */}
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            {contact?.phone && (
                                <a href={`tel:${contact.phone}`} className="p-1.5 hover:bg-blue-500/10 text-blue-500 rounded-lg transition-colors border border-transparent hover:border-blue-500/20">
                                    <Phone size={14} />
                                </a>
                            )}
                            <button onClick={onEdit} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground/60 hover:text-primary transition-colors border border-transparent hover:border-border">
                                <Pencil size={14} />
                            </button>
                            <button onClick={onDelete} className="p-1.5 hover:bg-destructive/10 rounded-lg text-muted-foreground/60 hover:text-destructive transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── QuickEditModal ───────────────────────────────────────────────────────────
interface QuickEditModalProps {
    activity: Activity;
    onClose: () => void;
    onSave: (id: string, updates: Partial<Activity>) => void;
}

function QuickEditModal({ activity, onClose, onSave }: QuickEditModalProps) {
    const [title, setTitle] = useState(activity.title);
    const [type, setType] = useState(activity.type);
    const [dueDate, setDueDate] = useState(activity.dueDate ? activity.dueDate.split('T')[0] : '');
    const [dueTime, setDueTime] = useState(() => {
        if (!activity.dueDate) return '09:00';
        const d = new Date(activity.dueDate);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });
    const [duration, setDuration] = useState(activity.duration || 30);
    const [notes, setNotes] = useState(activity.notes || '');

    const handleSave = () => {
        const updates: Partial<Activity> = {
            title,
            type: type as any,
            duration,
            notes,
        };
        if (dueDate) {
            updates.dueDate = `${dueDate}T${dueTime}:00.000`;
        }
        onSave(activity.id, updates);
    };

    const TYPE_OPTS = [
        { value: 'call', label: 'Ligação', Icon: Phone },
        { value: 'email', label: 'Email', Icon: Mail },
        { value: 'message', label: 'WhatsApp', Icon: MessageCircle },
        { value: 'meeting', label: 'Reunião', Icon: Users },
        { value: 'task', label: 'Tarefa', Icon: CheckCircle2 },
        { value: 'audit', label: 'Visita', Icon: Video },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div
                className="bg-card w-full max-w-md sm:rounded-3xl rounded-t-3xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h3 className="text-base font-bold">Editar Atividade</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Title */}
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Título</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2 block">Tipo</label>
                        <div className="flex flex-wrap gap-2">
                            {TYPE_OPTS.map(({ value, label, Icon }) => (
                                <button
                                    key={value}
                                    onClick={() => setType(value as any)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                                        ${type === value ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}
                                >
                                    <Icon size={12} />{label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Data</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Hora</label>
                            <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                                className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2 block">Duração</label>
                        <div className="flex gap-2">
                            {[15, 30, 60, 90].map(d => (
                                <button key={d} onClick={() => setDuration(d)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all
                                        ${duration === d ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>
                                    {d}min
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">Observações</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={4}
                            placeholder="Adicione detalhes sobre a atividade..."
                            className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-all">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={!title.trim()}
                        className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
                    >
                        Salvar alterações
                    </button>
                </div>
            </div>
        </div>
    );
}
