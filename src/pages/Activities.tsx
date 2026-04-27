import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Currency } from '@/data/currencies';
import { useSearchParams } from 'react-router-dom';
import {
    Search,
    Plus,
    Phone,
    Mail,
    CheckCircle2,
    Building2,
    X,
    Trash2,
    Pencil,
    Check,
    Users,
    MessageCircle,
    Video,
    BarChart3,
    MessageSquare,
    Filter,
    ClipboardList,
    PlayCircle,
    SkipForward,
    CalendarClock,
    PhoneOff,
    CheckSquare
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
    differenceInDays,
    startOfMonth,
    endOfMonth,
    parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import GlobalActivityModal from '@/components/activities/GlobalActivityModal';
import BulkEditActivitiesModal from '@/components/activities/BulkEditActivitiesModal';
import ActivitiesMoreActions from '@/components/activities/ActivitiesMoreActions';
import DealDetailsModal from '@/components/kanban/DealDetailsModal';
import { filterRealActivities } from '@/utils/activityHelpers';
import { Activity, ActivityType, Deal } from '@/types/schema';


// ─── Types ────────────────────────────────────────────────────────────────────
type PeriodFilter = 'Hoje' | 'Amanhã' | 'Próximos 7 dias' | 'Atrasadas' | 'Este mês' | 'Todos' | 'Personalizado';
type StatusFilter = 'pendente' | 'concluído' | 'atrasado' | 'todos';
type ResponsavelFilter = 'todos' | 'eu' | 'equipe';
type QuickTypeFilter = 'Todos' | ActivityType;

const PERIOD_OPTIONS: PeriodFilter[] = ['Hoje', 'Amanhã', 'Próximos 7 dias', 'Atrasadas', 'Este mês', 'Todos'];

const QUICK_TYPE_FILTERS: { id: QuickTypeFilter; label: string }[] = [
    { id: 'Todos', label: 'Todos' },
    { id: 'call', label: 'Ligações' },
    { id: 'email', label: 'Emails' },
    { id: 'message', label: 'Mensagem' },
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

const typeColor: Record<string, string> = {
    call: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10',
    email: 'text-sky-600 bg-purple-50 dark:text-sky-400 dark:bg-sky-500/10',
    message: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
    meeting: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/10',
    task: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-500/10',
    audit: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10',
    analysis: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
    instagram: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-500/10',
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

// ─── Component ────────────────────────────────────────────────────────────────
export default function Activities({ currency: _currency }: { currency: Currency }) {
    const { activities, deals, contacts, companies, users, updateActivity, deleteActivity, pipelines } = useCRM();
    const [searchParams] = useSearchParams();

    // ── Filter State ──────────────────────────────────────────────────────────
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setSearchQuery(value);
        }, 300);
    }, []);
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('Todos');
    const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('pendente'); // Default to pending for execution focus
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
    
    // Execution Mode State
    const [isExecutionMode, setIsExecutionMode] = useState(false);
    const [executionCompletedCount, setExecutionCompletedCount] = useState(0);

    // Sync URL filter
    useEffect(() => {
        const urlFilter = searchParams.get('filter');
        if (urlFilter === 'Vencido' || urlFilter === 'Atrasadas') setPeriodFilter('Atrasadas');
        else if (urlFilter === 'Hoje') setPeriodFilter('Hoje');
    }, [searchParams]);

    // ── Pre-Filter for Tab Counts ──────────────────────────────────────────────────
    const baseActivitiesForTabs = useMemo(() => {
        let result = filterRealActivities(activities);
        result = result.filter(a => a.status !== 'canceled');

        const today = startOfToday();

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

        if (statusFilter === 'pendente') {
            result = result.filter(a => !a.completed && a.status !== 'canceled');
        } else if (statusFilter === 'concluído') {
            result = result.filter(a => a.completed);
        } else if (statusFilter === 'atrasado') {
            result = result.filter(a => !a.completed && a.dueDate && isBefore(parseISO(a.dueDate), today));
        }

        return result;
    }, [activities, searchQuery, periodFilter, statusFilter, customStart, customEnd, deals, contacts, companies]);

    // ── Filtered & Ordered Activities ─────────────────────────────────────────
    const filteredActivities = useMemo(() => {
        let result = baseActivitiesForTabs;

        if (selectedTypes.length > 0) {
            result = result.filter(a => selectedTypes.includes(a.type as ActivityType));
        }

        const today = startOfToday();

        // Smart Ordering: Overdue -> Today -> High Priority Deals (Engaged) -> Others
        result.sort((a, b) => {
            // Priority 1: Completed status (completed go to bottom)
            if (a.completed !== b.completed) return a.completed ? 1 : -1;

            const dateA = a.dueDate ? parseISO(a.dueDate) : null;
            const dateB = b.dueDate ? parseISO(b.dueDate) : null;
            const dealA = deals.find(d => d.id === a.dealId);
            const dealB = deals.find(d => d.id === b.dealId);

            // Priority 2: Atrasadas
            const isAOverdue = dateA && isBefore(dateA, today);
            const isBOverdue = dateB && isBefore(dateB, today);
            if (isAOverdue && !isBOverdue) return -1;
            if (!isAOverdue && isBOverdue) return 1;

            // Priority 3: Hoje
            const isAToday = dateA && isToday(dateA);
            const isBToday = dateB && isToday(dateB);
            if (isAToday && !isBToday) return -1;
            if (!isAToday && isBToday) return 1;

            // Priority 4: Leads mais engajados (Proxy: Deal Priority High)
            const isAEngaged = dealA?.priority === 'high';
            const isBEngaged = dealB?.priority === 'high';
            if (isAEngaged && !isBEngaged) return -1;
            if (!isAEngaged && isBEngaged) return 1;

            // Secondary: Temporal Date Order
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA.getTime() - dateB.getTime();
        });

        return result;
    }, [activities, searchQuery, selectedTypes, periodFilter, statusFilter, customStart, customEnd, deals, contacts, companies]);

    // ── Summary Counts ────────────────────────────────────────────────────────
    const summaryStats = useMemo(() => {
        const real = filterRealActivities(activities);
        const today = startOfToday();
        const in7 = endOfDay(addDays(today, 7));

        return {
            pending: real.filter(a => !a.completed && a.status !== 'canceled').length,
            overdue: real.filter(a => !a.completed && a.status !== 'canceled' && a.dueDate && isBefore(parseISO(a.dueDate), today)).length,
            todayCount: real.filter(a => !a.completed && a.status !== 'canceled' && a.dueDate && isToday(parseISO(a.dueDate))).length,
            next7: real.filter(a => !a.completed && a.status !== 'canceled' && a.dueDate && isAfter(parseISO(a.dueDate), today) && isBefore(parseISO(a.dueDate), in7)).length,
        };
    }, [activities]);

    // ── Grouping ──────────────────────────────────────────────────────────────
    const groups = useMemo(() => {
        const today = startOfToday();
        const priority1: Activity[] = []; // CRÍTICAS — MAIS DE 14 DIAS
        const priority2: Activity[] = []; // ATRASADAS — 7 A 14 DIAS
        const priority3: Activity[] = []; // RECENTES — ÚLTIMOS 7 DIAS
        const todayArr: Activity[] = [];  // HOJE
        const upcoming: Activity[] = [];  // PRÓXIMOS DIAS
        const completed: Activity[] = []; // CONCLUÍDAS

        for (const a of filteredActivities) {
            if (a.completed) { completed.push(a); continue; }
            if (!a.dueDate) { priority3.push(a); continue; }
            
            const d = parseISO(a.dueDate);
            if (isBefore(d, today)) { 
                const diff = differenceInDays(today, d);
                if (diff > 14) {
                    priority1.push(a);
                } else if (diff >= 7) {
                    priority2.push(a);
                } else {
                    priority3.push(a);
                }
                continue; 
            }
            if (isToday(d)) { todayArr.push(a); continue; }
            upcoming.push(a);
        }

        const result: { label: string; activities: Activity[] }[] = [];
        if (priority1.length) result.push({ label: 'CRÍTICAS — MAIS DE 14 DIAS', activities: priority1 });
        if (priority2.length) result.push({ label: 'ATRASADAS — 7 A 14 DIAS', activities: priority2 });
        if (priority3.length) result.push({ label: 'RECENTES — ÚLTIMOS 7 DIAS', activities: priority3 });
        if (todayArr.length) result.push({ label: 'HOJE', activities: todayArr });
        if (upcoming.length) result.push({ label: 'PRÓXIMOS DIAS', activities: upcoming });
        if (completed.length) result.push({ label: 'CONCLUÍDAS', activities: completed });
        return result;
    }, [filteredActivities]);

    // Execution Mode activities
    const executableActivities = useMemo(() => {
        return filteredActivities.filter(a => !a.completed);
    }, [filteredActivities]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleToggleComplete = (id: string, completed: boolean) => {
        updateActivity(id, { completed, completedAt: completed ? new Date().toISOString() : undefined });
        if (isExecutionMode && completed) {
            setExecutionCompletedCount(prev => prev + 1);
        }
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
        setSearchInput('');
        setSearchQuery('');
        setPeriodFilter('Todos');
        setSelectedTypes([]);
        setStatusFilter('todos');
        setResponsavelFilter('todos');
        setCustomStart('');
        setCustomEnd('');
    };

    const hasActiveFilters = periodFilter !== 'Todos' || selectedTypes.length > 0 || statusFilter !== 'todos' || responsavelFilter !== 'todos' || searchQuery;

    const findStageTitle = (deal?: Deal) => {
        if (!deal) return null;
        const pipeline = pipelines[deal.pipelineId || 'sales'];
        const stage = pipeline?.stages.find((s: any) => s.id === deal.stageId);
        return stage?.title || 'Lead';
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-[#FCFCFD] dark:bg-background overflow-hidden relative">

            {/* ── ZONA 1 & 2: HEADER MINIMALISTA ─────────────────────────────────── */}
            <div className="bg-white dark:bg-card border-b border-slate-200 dark:border-border px-8 py-5 z-20 sticky top-0 flex flex-col gap-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-primary/10 flex items-center justify-center text-primary dark:text-primary shrink-0">
                            <ClipboardList size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-[#141414] dark:text-white tracking-tight">Vendas & Execução</h1>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{executableActivities.length} atividades aguardando execução</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {[
                            { id: 'Atrasadas', label: 'atrasadas', count: summaryStats.overdue, isPeriod: true, colorClasses: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/20', dot: 'bg-rose-500' },
                            { id: 'pendente', label: 'pendentes', count: summaryStats.pending, isPeriod: false, colorClasses: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/20', dot: 'bg-amber-500' },
                            { id: 'Hoje', label: 'hoje', count: summaryStats.todayCount, isPeriod: true, colorClasses: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-[#1A1A1A] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700', dot: 'bg-slate-500' },
                            { id: 'Próximos 7 dias', label: 'próx. 7 dias', count: summaryStats.next7, isPeriod: true, colorClasses: 'bg-sky-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-primary/10 dark:border-primary/30 dark:text-primary dark:hover:bg-sky-500/20', dot: 'bg-sky-500' },
                        ].map((f) => {
                            const isActive = f.isPeriod ? periodFilter === f.id : (statusFilter === f.id && periodFilter === 'Todos');
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => {
                                        if (f.isPeriod) { setPeriodFilter(f.id as PeriodFilter); setStatusFilter('todos'); }
                                        else { setStatusFilter(f.id as StatusFilter); setPeriodFilter('Todos'); }
                                    }}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all 
                                        ${isActive ? f.colorClasses + ' ring-2 ring-offset-2 dark:ring-offset-[#141414] ring-slate-300 dark:ring-slate-600 scale-105' : 'bg-transparent border-slate-200 text-slate-500 dark:border-border dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-muted'}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${f.dot}`}></span>
                                    <span className="font-bold text-sm tracking-tight">{f.count} <span className="font-medium opacity-80">{f.label}</span></span>
                                </button>
                            );
                        })}

                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2 hidden lg:block"></div>

                        <button
                            onClick={() => setIsNewModalOpen(true)}
                            className="hidden lg:flex items-center gap-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 px-5 py-2.5 rounded-full text-slate-600 dark:text-slate-300 transition-all font-bold text-sm"
                        >
                            <Plus size={16} strokeWidth={3} /> <span className="hidden xl:inline">Nova</span>
                        </button>
                        
                        <button
                            onClick={() => {
                                setIsExecutionMode(true);
                                setExecutionCompletedCount(0);
                            }}
                            disabled={executableActivities.length === 0}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-full font-bold transition-all text-sm disabled:opacity-50 shadow-sm shadow-indigo-500/20"
                        >
                            <PlayCircle size={18} />
                            <span>Executar</span>
                        </button>
                    </div>
                </div>

                {/* Filtros Secundários com Contagem (Estilo Tabs) */}
                <div className="flex flex-col-reverse lg:flex-row lg:items-center justify-between gap-4 mt-2">
                    <div className="flex border-b border-slate-200 dark:border-border overflow-x-auto pb-px scrollbar-hide">
                        {QUICK_TYPE_FILTERS.map(({ id, label }) => {
                            const isActive = id === 'Todos' ? selectedTypes.length === 0 : selectedTypes.includes(id as ActivityType);
                            const count = id === 'Todos' 
                                ? baseActivitiesForTabs.length 
                                : baseActivitiesForTabs.filter(a => a.type === id).length;
                            return (
                                <button
                                    key={id}
                                    onClick={() => {
                                        if (id === 'Todos') setSelectedTypes([]);
                                        else toggleType(id as ActivityType);
                                    }}
                                    className={`flex items-center gap-2 px-5 py-3 border-b-2 transition-all text-sm font-semibold whitespace-nowrap
                                        ${isActive
                                            ? 'text-primary border-indigo-600 dark:text-primary dark:border-indigo-500 bg-sky-50/50 dark:bg-sky-500/5'
                                            : 'text-slate-500 border-transparent hover:text-[#1A1A1A] dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                                >
                                    <span>{label}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold
                                        ${isActive ? 'bg-indigo-100 text-indigo-700 dark:bg-sky-500/20 dark:text-indigo-300' : 'bg-slate-100 text-slate-500 dark:bg-[#1A1A1A] dark:text-slate-400'}
                                    `}>{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group hidden lg:block">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Pesquisar..."
                                className="w-64 pl-9 pr-4 py-1.5 bg-transparent border-b border-slate-200 dark:border-slate-700 text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium text-[#141414] dark:text-white"
                                value={searchInput}
                                onChange={e => handleSearchChange(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-xs transition-all border
                                ${showFilters || hasActiveFilters
                                    ? 'bg-sky-50 dark:bg-primary/10 text-primary border-indigo-100 dark:border-indigo-500/20'
                                    : 'text-slate-500 border-transparent hover:bg-slate-100 dark:hover:bg-muted'}`}
                        >
                            <Filter size={14} />
                            <span>Filtros</span>
                        </button>
                        
                        <ActivitiesMoreActions
                            filteredActivities={filteredActivities}
                            deals={deals}
                            contacts={contacts}
                            companies={companies}
                            visibleColumns={['completed', 'title', 'dealId', 'contactId', 'companyId', 'dueDate', 'ownerId']}
                        />
                    </div>
                </div>
            </div>

            {/* Advanced Filters Overlay */}
            {showFilters && (
                <div className="mx-8 mt-4 p-8 bg-white dark:bg-card rounded-[32px] border border-slate-200 dark:border-border shadow-2xl animate-in slide-in-from-top-6 duration-500 z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div>
                            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-3 block">Período</label>
                            <select
                                value={periodFilter}
                                onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
                                className="w-full py-3 px-4 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-700 dark:text-slate-200"
                            >
                                {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                <option value="Personalizado">Data Personalizada</option>
                            </select>
                            {periodFilter === 'Personalizado' && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                                        className="w-full py-2 px-3 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none" />
                                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                                        className="w-full py-2 px-3 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none" />
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-3 block">Tipo de Status</label>
                            <div className="flex bg-slate-50 dark:bg-[#1A1A1A] p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                                {(['todos', 'pendente', 'concluído'] as StatusFilter[]).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setStatusFilter(s)}
                                        className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all
                                            ${statusFilter === s ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {s === 'todos' ? 'Todos' : s === 'pendente' ? 'Abertas' : 'Feitas'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-3 block">Responsável</label>
                            <select
                                value={responsavelFilter}
                                onChange={e => setResponsavelFilter(e.target.value as ResponsavelFilter)}
                                className="w-full py-3 px-4 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-700 dark:text-slate-200"
                            >
                                <option value="todos">Toda a Equipe</option>
                                <option value="eu">Apenas Minhas</option>
                            </select>
                        </div>
                    </div>
                    
                    {hasActiveFilters && (
                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-border flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-400 italic">Dica: Use os atalhos do topo para filtros rápidos.</span>
                            <button
                                onClick={clearAllFilters}
                                className="px-6 py-2 bg-slate-100 dark:bg-[#1A1A1A] text-slate-500 dark:text-slate-400 text-xs font-black rounded-xl hover:text-rose-500 transition-colors uppercase tracking-widest"
                            >
                                Limpar Todos
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── ZONA 3: LISTA DE EXECUÇÃO MINIMALISTA ──────────────────────── */}
            <div className="flex-1 overflow-auto bg-white dark:bg-background">
                <div className="max-w-7xl mx-auto py-8 px-8">
                    {filteredActivities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <CheckCircle2 size={40} className="opacity-20 text-slate-400 mb-6" />
                            <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-2">Inbox Zero!</h3>
                            <p className="text-sm">Todas as tarefas foram concluídas.</p>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {groups.map(group => (
                                <section key={group.label}>
                                    <div className="flex items-center gap-3 mb-3 pl-2">
                                        <h3 className="text-sm font-bold text-[#141414] dark:text-white uppercase tracking-wider">
                                            {group.label}
                                        </h3>
                                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-[#1A1A1A] px-2 py-0.5 rounded-full">
                                            {group.activities.length}
                                        </span>
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-border/80">
                                        {group.activities.map(activity => {
                                            const deal = deals.find(d => d.id === activity.dealId);
                                            const contact = contacts.find(c => c.id === activity.contactId);
                                            return (
                                                <ActivityCompactRow
                                                    key={activity.id}
                                                    activity={activity}
                                                    users={users}
                                                    isSelected={selectedActivities.includes(activity.id)}
                                                    onToggleSelect={() =>
                                                        setSelectedActivities(prev =>
                                                            prev.includes(activity.id) ? prev.filter(i => i !== activity.id) : [...prev, activity.id]
                                                        )
                                                    }
                                                    onToggleComplete={() => handleToggleComplete(activity.id, !activity.completed)}
                                                    onEdit={() => {
                                                        if (activity.dealId) setSelectedDealId(activity.dealId);
                                                        else setEditingActivity(activity);
                                                    }}
                                                    onDelete={() => deleteActivity(activity.id)}
                                                    deal={deal}
                                                    contact={contact}
                                                    stageTitle={findStageTitle(deal)}
                                                    onReschedule={() => setEditingActivity(activity)}
                                                />
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bulk Actions ─────────────────────────────────────────────── */}
            {selectedActivities.length > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#141414] dark:bg-[#1A1A1A] border border-white/10 text-white px-10 py-4 rounded-3xl flex items-center gap-10 shadow-2xl animate-in slide-in-from-bottom-12 duration-500 z-[100]">
                    <div className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center text-sm font-black text-white">{selectedActivities.length}</span>
                        <span className="text-sm font-black uppercase tracking-widest text-slate-200">Selecionadas</span>
                    </div>
                    <div className="w-px h-8 bg-slate-700" />
                    <div className="flex items-center gap-8">
                        <button onClick={() => setIsBulkEditModalOpen(true)} className="text-sm font-black text-slate-300 hover:text-white transition-colors uppercase tracking-widest">Editar</button>
                        <button onClick={handleBulkComplete} className="text-sm font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest">Concluir</button>
                        <button onClick={handleBulkDelete} className="text-sm font-black text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-widest">Excluir</button>
                    </div>
                    <button onClick={() => setSelectedActivities([])} className="ml-6 p-2 hover:bg-white/10 rounded-full transition-colors text-slate-500 hover:text-white">
                        <X size={20} />
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

            {/* Execution Mode Overlay */}
            {isExecutionMode && (
                <ExecutionMode
                    activities={executableActivities}
                    deals={deals}
                    contacts={contacts}
                    completedCount={executionCompletedCount}
                    onClose={() => setIsExecutionMode(false)}
                    onComplete={(id) => handleToggleComplete(id, true)}
                    onReschedule={(activity) => {
                        setEditingActivity(activity);
                    }}
                />
            )}
        </div>
    );
}

// ─── Compact Activity Row Component ──────────────────────────────────────────
interface CardProps {
    activity: Activity;
    isSelected: boolean;
    onToggleSelect: () => void;
    onToggleComplete: () => void;
    onEdit: () => void;
    onDelete: () => void;
    deal?: Deal;
    contact?: any;
    users: any[];
    stageTitle: string | null;
    onReschedule?: () => void;
}

function ActivityCompactRow({
    activity, isSelected, onToggleComplete, onEdit, onDelete,
    deal, contact, stageTitle, onReschedule
}: CardProps) {
    const Icon = typeIcon[activity.type] || CheckCircle2;
    const priority = getActivityPriority(activity);

    const isOverdue = priority === 'overdue';

    const urgencyColor = useMemo(() => {
        if (activity.completed || !activity.dueDate) return 'bg-slate-200 dark:bg-slate-700';
        const d = parseISO(activity.dueDate);
        const today = startOfToday();
        if (isBefore(d, today)) {
            const diff = differenceInDays(today, d);
            if (diff > 14) return 'bg-rose-500';
            if (diff >= 7) return 'bg-amber-500';
        }
        return 'bg-slate-300 dark:bg-slate-600';
    }, [activity.completed, activity.dueDate]);

    const relativeTime = useMemo(() => {
        if (!activity.dueDate) return '';
        const d = parseISO(activity.dueDate);
        const today = startOfToday();
        if (isToday(d)) return 'Hoje';
        if (isTomorrow(d)) return 'Amanhã';
        const diff = differenceInDays(today, d);
        if (diff > 0) return diff === 1 ? 'ontem' : `${diff} dias atrás`;
        return `Em ${Math.abs(diff)} dias`;
    }, [activity.dueDate]);

    return (
        <div 
            className={`relative group flex items-start sm:items-center gap-4 py-4 px-5 mb-3 rounded-2xl border bg-white dark:bg-card shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-[shadow,transform] hover:-translate-y-0.5 hover:shadow-lg dark:border-border
                ${activity.completed ? 'opacity-60 grayscale' : ''} 
                ${isSelected ? 'bg-sky-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-primary/30' : 'border-slate-200/50'}`}
        >
            {/* Urgency Color Bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${urgencyColor}`} />

            {/* Checkbox */}
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
                className={`w-5 h-5 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors cursor-pointer
                    ${activity.completed 
                        ? 'bg-slate-200 border-slate-200 text-slate-500 dark:bg-slate-700 dark:border-slate-700 dark:text-slate-400' 
                        : 'bg-transparent border-slate-300 dark:border-slate-600 text-transparent hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-primary'}`}
            >
                <Check size={12} strokeWidth={4} />
            </button>

            {/* Ícone Diferenciado do Canal */}
            <div className={`shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center border
                ${activity.completed ? 'bg-slate-50 text-slate-400 border-slate-100 dark:bg-[#1A1A1A]/80 dark:border-border' : `${typeColor[activity.type]} border-white/50 dark:border-border/50`}`}>
                <Icon size={16} strokeWidth={2.5} />
            </div>

            {/* Main Info (Single/Tight Line) */}
            <div className="flex-1 min-w-0 pr-4 flex items-center gap-2 cursor-pointer" onClick={onEdit}>
                
                <h4 className={`text-[15px] font-bold truncate hover:underline hover:text-primary dark:hover:text-primary
                    ${activity.completed ? 'line-through text-slate-400' : 'text-[#141414] dark:text-white'}`}>
                    {activity.title}
                </h4>

                <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 truncate">
                    {deal ? (
                        <span 
                            className="font-medium bg-slate-100 dark:bg-[#1A1A1A] px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-primary truncate max-w-[180px]"
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        >
                            {deal.title}
                        </span>
                    ) : contact ? (
                        <span className="font-medium bg-slate-100 dark:bg-[#1A1A1A] px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 truncate">{contact.name}</span>
                    ) : null}

                    {stageTitle && (
                        <>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="truncate max-w-[150px] font-medium text-slate-600 dark:text-slate-400 hidden sm:inline">{stageTitle}</span>
                        </>
                    )}

                    {contact?.phone && (
                        <>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="truncate hidden md:flex items-center gap-1 font-mono text-xs"><Phone size={12}/> {contact.phone}</span>
                        </>
                    )}

                    {activity.dueDate && (
                        <>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className={`shrink-0 font-medium ${isOverdue && !activity.completed ? 'text-rose-500' : ''}`}>
                                {format(parseISO(activity.dueDate), "dd MMM", { locale: ptBR })} 
                                <span className={isOverdue && !activity.completed ? 'text-rose-500' : 'text-slate-400'}> · {relativeTime}</span>
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Quick Actions Restritas ao Hover */}
            <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bg-gradient-to-l from-white via-white dark:from-[#141414] dark:via-[#141414] to-transparent pl-8">
                {!activity.completed && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleComplete(); }}
                        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 text-xs font-black uppercase rounded-lg transition-all"
                    >
                        <Check size={14} strokeWidth={3} />
                        Concluir
                    </button>
                )}
                <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2 ml-1">
                    {onReschedule && !activity.completed && (
                         <button 
                            onClick={(e) => { e.stopPropagation(); onReschedule(); }}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-muted rounded-lg transition-colors"
                            title="Reagendar"
                        >
                            <CalendarClock size={16} />
                        </button>
                    )}
                    {contact?.phone && (
                        <a 
                            href={`tel:${contact.phone}`} 
                            className="p-2 text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-slate-100 dark:hover:bg-muted rounded-lg transition-colors"
                            title="Ligar"
                        >
                            <Phone size={16} />
                        </a>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-muted rounded-lg transition-colors"
                        title="Anotar / Editar"
                    >
                        <Pencil size={16} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                        className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-muted rounded-lg transition-colors"
                        title="Excluir"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Refined Execution Mode Component ─────────────────────────────────────────
function ExecutionMode({ activities, deals, contacts, completedCount, onClose, onComplete, onReschedule }: {
    activities: Activity[], deals: Deal[], contacts: any[], completedCount: number, onClose: () => void, onComplete: (id: string) => void, onReschedule: (a: Activity) => void
}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const activeA = activities[currentIndex];

    // Auto-close if finished
    useEffect(() => {
        if (currentIndex >= activities.length && activities.length > 0) {
            onClose();
        }
    }, [currentIndex, activities, onClose]);

    if (!activeA) return null;

    const Icon = typeIcon[activeA.type] || CheckCircle2;
    const deal = deals.find(d => d.id === activeA.dealId);
    const contact = contacts.find(c => c.id === activeA.contactId);

    const handleCompleteNext = () => {
        onComplete(activeA.id);
        setCurrentIndex(v => v + 1);
    };

    const handleNoAnswer = () => {
        setCurrentIndex(v => v + 1);
    };

    const handleSkip = () => {
        setCurrentIndex(v => v + 1);
    };

    return (
        <div className="fixed inset-0 z-[200] bg-[#0D0D0D]/98 flex flex-col animate-in fade-in duration-300">
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-2xl bg-white dark:bg-card border-none shadow-[0_0_80px_rgba(79,70,229,0.15)] rounded-[48px] overflow-hidden p-12 flex flex-col animate-in zoom-in-95 duration-700">
                    
                    {/* Header: Progress Counter */}
                    <div className="mb-12 flex items-center justify-between">
                        <div className="flex flex-col gap-2">
                            <span className="text-[11px] font-black text-sky-500 uppercase tracking-[0.3em]">Modo de Alta Performance</span>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-black text-slate-400 whitespace-nowrap">
                                    {completedCount + currentIndex} de {activities.length + completedCount} atividades concluídas
                                </span>
                                <div className="w-48 h-2 bg-slate-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-sky-500 transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)" 
                                        style={{ width: `${((completedCount + currentIndex) / (activities.length + completedCount)) * 100}%` }} 
                                    />
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-muted rounded-2xl transition-all text-slate-400 hover:text-rose-500"><X size={28} /></button>
                    </div>

                    <div className="flex flex-col items-center text-center">
                        <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl border border-white/10 rotate-3 ${typeColor[activeA.type] || 'bg-slate-500 text-white'}`}>
                            <Icon size={44} strokeWidth={2.5} />
                        </div>
                        
                        <h2 className="text-4xl font-black text-[#141414] dark:text-white mb-4 tracking-tighter leading-tight">{activeA.title}</h2>
                        
                        <div className="flex flex-col gap-5 items-center justify-center mt-2 mb-12">
                            {deal && (
                                <div className="flex items-center gap-3 bg-sky-50/50 dark:bg-primary/10 text-primary dark:text-primary px-6 py-2.5 rounded-[22px] font-black border border-indigo-100/50 dark:border-indigo-500/20 text-md uppercase tracking-wider shadow-sm">
                                    <Building2 size={18} /> {deal.title}
                                </div>
                            )}
                            {contact && (
                                <div className="flex flex-col gap-2">
                                    <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{contact.name}</span>
                                    <div className="flex gap-8 text-slate-400 font-bold uppercase tracking-widest text-xs">
                                        {contact.phone && <span className="flex items-center gap-2 hover:text-primary transition-colors"><Phone size={14} /> {contact.phone}</span>}
                                        {contact.email && <span className="flex items-center gap-2 hover:text-primary transition-colors"><Mail size={14} /> {contact.email}</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {activeA.notes && (
                            <div className="w-full bg-slate-50 dark:bg-[#1A1A1A]/40 border border-slate-100 dark:border-border rounded-3xl p-8 mb-12 text-left shadow-inner">
                                <span className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-4 block">Observações do Negócio</span>
                                <p className="text-slate-600 dark:text-slate-300 font-bold text-lg leading-relaxed">{activeA.notes}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                            <button 
                                onClick={handleSkip}
                                className="px-6 py-4 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-500 dark:text-slate-400 font-black rounded-3xl flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-widest text-xs"
                            >
                                <SkipForward size={20} /> Pular
                            </button>
                            <button 
                                onClick={handleNoAnswer}
                                className="px-6 py-4 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:text-amber-600 text-slate-500 font-black rounded-3xl flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-widest text-xs"
                            >
                                <PhoneOff size={20} /> Não atendeu
                            </button>
                            <button 
                                onClick={() => {
                                    onReschedule(activeA);
                                }}
                                className="px-6 py-4 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-primary text-slate-500 font-black rounded-3xl flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-widest text-xs"
                            >
                                <CalendarClock size={20} /> Reagendar
                            </button>
                            <button 
                                onClick={handleCompleteNext}
                                className="px-8 py-4 bg-emerald-600 text-white font-black rounded-3xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-500/20 active:scale-95 uppercase tracking-widest text-xs"
                            >
                                <CheckSquare size={20} /> Concluir
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
    const [notes, setNotes] = useState(activity.notes || '');

    const handleSave = () => {
        const updates: Partial<Activity> = {
            title,
            type: type as any,
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
        { value: 'message', label: 'Mensagem', Icon: MessageCircle },
        { value: 'meeting', label: 'Reunião', Icon: Users },
        { value: 'task', label: 'Tarefa', Icon: CheckCircle2 },
        { value: 'audit', label: 'Visita', Icon: Video },
    ];

    return (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-[#141414]/80 p-0 sm:p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-card w-full max-w-lg sm:rounded-[48px] rounded-t-[48px] border-none shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in slide-in-from-bottom-12 duration-500"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-10 py-8 border-b border-slate-100 dark:border-border">
                    <h3 className="text-2xl font-black text-[#141414] dark:text-white tracking-tight">Editar Atividade</h3>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-muted rounded-2xl text-slate-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-10 space-y-10">
                    {/* Title */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block">Título da Atividade</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-[#1A1A1A] border-none rounded-2xl text-lg font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/20 transition-all text-[#141414] dark:text-white shadow-inner"
                        />
                    </div>

                    {/* Type Selection */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 block">Meio de Contato</label>
                        <div className="grid grid-cols-3 gap-3">
                            {TYPE_OPTS.map(({ value, label, Icon }) => (
                                <button
                                    key={value}
                                    onClick={() => setType(value as any)}
                                    className={`flex flex-col items-center justify-center gap-3 p-5 rounded-[22px] border transition-all
                                        ${type === value 
                                            ? 'bg-primary text-white border-indigo-600 shadow-xl shadow-indigo-600/20 scale-105' 
                                            : 'bg-white dark:bg-[#1A1A1A] text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}
                                >
                                    <Icon size={24} strokeWidth={type === value ? 3 : 2} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date & Time Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block">Dia da Execução</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 dark:bg-[#1A1A1A] border-none rounded-2xl text-md font-bold text-[#141414] dark:text-white outline-none ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block">Horário</label>
                            <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 dark:bg-[#1A1A1A] border-none rounded-2xl text-md font-bold text-[#141414] dark:text-white outline-none ring-2 focus:ring-indigo-500/20" />
                        </div>
                    </div>

                    {/* Notes Field */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block">Detalhamento / Contexto</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={4}
                            placeholder="Descreva o objetivo desta interação..."
                            className="w-full px-6 py-5 bg-slate-50 dark:bg-[#1A1A1A] border-none rounded-2xl text-md font-bold text-slate-700 dark:text-slate-300 outline-none ring-2 focus:ring-indigo-500/20 transition-all resize-none shadow-inner"
                        />
                    </div>
                </div>

                {/* Footer buttons */}
                <div className="flex items-center justify-end gap-6 px-10 py-8 bg-slate-50/50 dark:bg-[#1A1A1A]/50 border-t border-slate-100 dark:border-border">
                    <button onClick={onClose} className="px-6 py-3 text-sm font-black text-slate-400 hover:text-rose-500 transition-all uppercase tracking-widest">Descartar</button>
                    <button
                        onClick={handleSave}
                        disabled={!title.trim()}
                        className="px-10 py-4 bg-primary text-white text-sm font-black rounded-3xl shadow-2xl shadow-indigo-600/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-40"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
}


