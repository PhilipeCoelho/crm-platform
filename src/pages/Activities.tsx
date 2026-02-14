import { useState, useMemo, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Currency } from '@/data/currencies';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Plus,
    Calendar,
    ChevronDown,
    Phone,
    Users,
    Mail,
    CheckCircle2,
    Clock,
    CheckCircle,
    Building2,
    X,
    SearchX,
    Settings,
    Filter,
    RefreshCw,
    Trash2,
    Pencil,
    Check
} from 'lucide-react';
import { format, isToday, isTomorrow, isBefore, isAfter, startOfToday, startOfWeek, endOfWeek, addWeeks, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/useMediaQuery';
import GlobalActivityModal from '@/components/activities/GlobalActivityModal';
import CustomizeColumnsModal from '@/components/activities/CustomizeColumnsModal';
import BulkEditActivitiesModal from '@/components/activities/BulkEditActivitiesModal';
import ActivitiesMoreActions from '@/components/activities/ActivitiesMoreActions';

// Types
import { Activity } from '@/types/schema';

type FilterType = 'Para fazer' | 'Vencido' | 'Hoje' | 'Amanhã' | 'Esta semana' | 'Próxima semana' | 'Selecionar período' | 'Todos';

const DEFAULT_COLUMNS = ['completed', 'title', 'dealId', 'priority', 'contactId', 'email', 'phone', 'companyId', 'dueDate', 'duration', 'ownerId'];

export default function Activities({ currency: _currency }: { currency: Currency }) {
    const { activities, deals, contacts, companies, updateActivity, deleteActivity } = useCRM();
    const isMobile = useIsMobile();
    const navigate = useNavigate();

    // States
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('Todos');
    const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

    // Column Persistence
    const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
        const saved = localStorage.getItem('crm_activities_columns');
        return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
    });

    useEffect(() => {
        localStorage.setItem('crm_activities_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({
        key: 'dueDate',
        direction: 'asc'
    });

    // Filtering logic
    const filteredActivities = useMemo(() => {
        let result = activities.filter(activity => {
            // 1. Search Filter
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                const matchedSubject = activity.title.toLowerCase().includes(searchLower);

                const deal = deals.find(d => d.id === activity.dealId);
                const contact = contacts.find(c => c.id === activity.contactId);
                const company = companies.find(c => c.id === activity.companyId);

                const matchedDeal = deal?.title.toLowerCase().includes(searchLower);
                const matchedContact = contact?.name.toLowerCase().includes(searchLower);
                const matchedCompany = company?.name.toLowerCase().includes(searchLower);

                if (!matchedSubject && !matchedDeal && !matchedContact && !matchedCompany) return false;
            }

            // 2. Horizontal Quick Filters
            if (activeFilter !== 'Todos') {
                if (activeFilter === 'Para fazer') return !activity.completed;

                if (!activity.dueDate) return false;
                const date = parseISO(activity.dueDate);
                const today = startOfToday();

                if (activeFilter === 'Hoje') {
                    if (!isToday(date) || activity.completed) return false;
                } else if (activeFilter === 'Amanhã') {
                    if (!isTomorrow(date) || activity.completed) return false;
                } else if (activeFilter === 'Vencido') {
                    if (activity.completed || !isBefore(date, today)) return false;
                } else if (activeFilter === 'Esta semana') {
                    const start = startOfWeek(today, { weekStartsOn: 1 });
                    const end = endOfWeek(today, { weekStartsOn: 1 });
                    if (!(isAfter(date, start) && isBefore(date, end)) || activity.completed) return false;
                } else if (activeFilter === 'Próxima semana') {
                    const start = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
                    const end = endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
                    if (!(isAfter(date, start) && isBefore(date, end)) || activity.completed) return false;
                }
            }

            return true;
        });

        // Sorting
        if (sortConfig) {
            result.sort((a, b) => {
                const aVal = (a as any)[sortConfig.key] || '';
                const bVal = (b as any)[sortConfig.key] || '';
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [activities, searchQuery, activeFilter, sortConfig, deals, contacts, companies]);

    // Helpers
    const getStatusInfo = (activity: Activity) => {
        if (activity.completed) return { label: 'Concluída', color: 'text-slate-400 bg-slate-100 dark:bg-slate-800', indicator: '' };
        if (!activity.dueDate) return { label: 'Sem data', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', indicator: 'bg-amber-400' };

        const date = parseISO(activity.dueDate);
        const today = startOfToday();

        if (isBefore(date, today)) return { label: 'Atrasada', color: 'text-red-600 bg-red-50 dark:bg-red-900/20', indicator: 'bg-red-500' };
        if (isToday(date)) return { label: 'Para Hoje', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/10 border-amber-200/50', indicator: 'bg-amber-400' };

        return { label: 'Futura', color: 'text-slate-500 bg-slate-100 dark:bg-slate-800', indicator: 'bg-slate-300 dark:bg-slate-600' };
    };

    const handleToggleComplete = (id: string, completed: boolean) => {
        updateActivity(id, {
            completed,
            completedAt: completed ? new Date().toISOString() : undefined
        });
    };

    const handleBulkComplete = async () => {
        if (selectedActivities.length === 0) return;
        try {
            const now = new Date().toISOString();
            await Promise.all(selectedActivities.map(id =>
                updateActivity(id, {
                    completed: true,
                    completedAt: now
                })
            ));
            setSelectedActivities([]);
        } catch (error) {
            console.error('Error in bulk complete:', error);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedActivities.length === 0) return;
        if (!confirm(`Tem certeza que deseja excluir ${selectedActivities.length} atividades?`)) return;
        try {
            await Promise.all(selectedActivities.map(id => deleteActivity(id)));
            setSelectedActivities([]);
        } catch (error) {
            console.error('Error in bulk delete:', error);
        }
    };

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0E1116] overflow-hidden">
            {/* Enterprise Header Section */}
            <div className="bg-white dark:bg-[#11141D] border-b border-slate-200 dark:border-white/5 p-4 sm:p-6 shadow-sm z-20">
                <div className="flex flex-row justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                                Atividades
                                <span className="text-sm font-bold text-slate-400 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                                    {filteredActivities.length}
                                </span>
                            </h1>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                    <RefreshCw size={10} className="text-emerald-500 animate-spin-slow" />
                                    Sincronização Ativa
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button className="p-2.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10">
                            <Filter size={20} />
                        </button>
                        <button
                            onClick={() => setIsCustomizeModalOpen(true)}
                            className="p-2.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10"
                        >
                            <Settings size={20} />
                        </button>
                        <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1 hidden sm:block" />
                        <button
                            onClick={() => setIsNewModalOpen(true)}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 active:scale-95 text-sm sm:text-base pr-5"
                        >
                            <Plus size={20} />
                            <span>Atividade</span>
                        </button>
                        <ActivitiesMoreActions
                            filteredActivities={filteredActivities}
                            deals={deals}
                            contacts={contacts}
                            companies={companies}
                            visibleColumns={visibleColumns}
                        />
                    </div>
                </div>

                {/* Advanced Quick Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="relative flex-1 group">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, organização ou negócio..."
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold placeholder:text-slate-400"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Horizontal Quick Filters Bar */}
                <div className="flex items-center gap-2 mt-6 overflow-x-auto no-scrollbar scroll-smooth">
                    {(['Todos', 'Para fazer', 'Vencido', 'Hoje', 'Amanhã', 'Esta semana', 'Próxima semana', 'Selecionar período'] as FilterType[]).map(filter => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap border
                                ${activeFilter === filter
                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                    : 'bg-white dark:bg-white/5 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.08] border-slate-200 dark:border-white/5 hover:border-slate-300'}`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar bg-slate-50/50 dark:bg-transparent -mt-1">
                {isMobile ? (
                    /* Mobile Card View (Enhanced) */
                    <div className="space-y-4">
                        {filteredActivities.map(activity => {
                            const deal = deals.find(d => d.id === activity.dealId);
                            const contact = contacts.find(c => c.id === activity.contactId);
                            const status = getStatusInfo(activity);

                            return (
                                <div key={activity.id} className={`bg-white dark:bg-[#11141D] rounded-3xl border ${status.label === 'Atrasada' ? 'border-red-200 dark:border-red-500/20' : 'border-slate-200 dark:border-white/5'} shadow-sm p-5 space-y-4 transition-all relative overflow-hidden`}>
                                    {status.label === 'Atrasada' && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />}
                                    <div className="flex justify-between items-start pl-2">
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => handleToggleComplete(activity.id, !activity.completed)}
                                                className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center transition-all shrink-0
                                                    ${activity.completed
                                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                                        : 'border-slate-200 dark:border-white/10 hover:border-primary active:scale-90'}`}
                                            >
                                                {activity.completed ? <Check size={22} className="stroke-[3]" /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-white/10" />}
                                            </button>
                                            <div className="min-w-0">
                                                <h4 className={`text-base font-semibold truncate ${activity.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                                    {activity.title}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-widest ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/10" />
                                                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">{activity.type}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {(deal || contact) && (
                                        <div className="grid grid-cols-1 gap-3 pt-4 border-t border-slate-100 dark:border-white/5 pl-2">
                                            {deal && (
                                                <button
                                                    onClick={() => navigate(`/deals/${deal.id}`)}
                                                    className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5 active:bg-slate-100 transition-all group"
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                            <Building2 size={16} />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] uppercase font-semibold text-slate-400 tracking-widest">Negócio</span>
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate pr-4">{deal.title}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-primary group-hover:translate-x-1 transition-transform">
                                                        <Plus size={16} />
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2 pl-2">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Calendar size={14} className="text-primary" />
                                                <span className="text-xs font-semibold uppercase tracking-widest">
                                                    {activity.dueDate ? format(parseISO(activity.dueDate), "dd MMM, HH:mm", { locale: ptBR }) : 'Sem data'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {contact?.phone && (
                                                <a href={`tel:${contact.phone}`} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-emerald-500 text-white active:scale-90 transition-all shadow-lg shadow-emerald-500/20">
                                                    <Phone size={18} className="stroke-[2.5]" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Desktop Dynamic Table View */
                    <div className="bg-white dark:bg-[#11141D] border border-slate-200 dark:border-white/5 sm:rounded-[32px] shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                        <div className="overflow-x-auto flex-1 custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[1200px]">
                                <thead className="bg-[#FBFCFD] dark:bg-white/[0.01] border-b border-slate-200 dark:border-white/5 sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        {visibleColumns.includes('completed') && (
                                            <th className="p-5 w-14 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 rounded-lg border-slate-300 dark:border-white/10 text-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                                    checked={selectedActivities.length > 0 && selectedActivities.length === filteredActivities.length}
                                                    onChange={() => {
                                                        if (selectedActivities.length === filteredActivities.length) setSelectedActivities([]);
                                                        else setSelectedActivities(filteredActivities.map(a => a.id));
                                                    }}
                                                />
                                            </th>
                                        )}

                                        {visibleColumns.map(colId => {
                                            if (colId === 'completed') return null;
                                            const labels: Record<string, string> = {
                                                title: 'Assunto',
                                                dealId: 'Negócio',
                                                priority: 'Prioridade',
                                                contactId: 'Pessoa de contato',
                                                email: 'E-mail',
                                                phone: 'Telefone',
                                                companyId: 'Organização',
                                                dueDate: 'Vencimento',
                                                duration: 'Duração',
                                                ownerId: 'Responsável',
                                                type: 'Tipo',
                                                status: 'Status',
                                                updatedAt: 'Atualizado em',
                                                createdAt: 'Data adicionada',
                                                completedAt: 'Conclusão',
                                                description: 'Notas'
                                            };
                                            return (
                                                <th
                                                    key={colId}
                                                    onClick={() => handleSort(colId)}
                                                    className="p-5 font-semibold text-[10px] uppercase tracking-[0.15em] text-slate-400 hover:text-primary transition-colors cursor-pointer group"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {labels[colId] || colId}
                                                        {sortConfig?.key === colId && (
                                                            <ChevronDown size={12} className={`transition-transform duration-300 ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} />
                                                        )}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th className="p-5 w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {filteredActivities.map(activity => {
                                        const deal = deals.find(d => d.id === activity.dealId);
                                        const contact = contacts.find(c => c.id === activity.contactId);
                                        const company = companies.find(c => c.id === activity.companyId);
                                        const isSelected = selectedActivities.includes(activity.id);

                                        return (
                                            <tr
                                                key={activity.id}
                                                className={`transition-all group border-l-[6px] 
                                                    ${isSelected ? 'bg-primary/[0.03] border-primary' : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.02] border-transparent'}
                                                    ${!activity.completed && isBefore(parseISO(activity.dueDate || ''), startOfToday()) ? 'bg-red-50/30' : ''}
                                                `}
                                            >
                                                {visibleColumns.includes('completed') && (
                                                    <td className="p-5 text-center">
                                                        <div className="flex items-center justify-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-primary focus:ring-primary/20"
                                                                checked={isSelected}
                                                                onChange={() => {
                                                                    setSelectedActivities(prev =>
                                                                        prev.includes(activity.id) ? prev.filter(id => id !== activity.id) : [...prev, activity.id]
                                                                    );
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => handleToggleComplete(activity.id, !activity.completed)}
                                                                className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all shrink-0
                                                                    ${activity.completed
                                                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                                                        : 'border-slate-300 dark:border-white/10 hover:border-emerald-500 hover:bg-emerald-50/50'}`}
                                                            >
                                                                {activity.completed && <Check size={14} className="stroke-[3]" />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}

                                                {visibleColumns.map(colId => {
                                                    if (colId === 'completed') return null;

                                                    return (
                                                        <td key={colId} className="p-5 font-bold text-[13px] text-slate-600 dark:text-slate-300">
                                                            {colId === 'title' && (
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border transition-all
                                                                        ${activity.completed
                                                                            ? 'bg-slate-100 dark:bg-white/5 text-slate-400 border-transparent'
                                                                            : 'bg-white dark:bg-[#1A1D26] text-primary border-slate-200 dark:border-white/10 shadow-sm'}`}>
                                                                        {activity.type === 'call' && <Phone size={15} />}
                                                                        {activity.type === 'meeting' && <Users size={15} />}
                                                                        {activity.type === 'email' && <Mail size={15} />}
                                                                        {(activity.type === 'task' || !activity.type) && <CheckCircle2 size={15} />}
                                                                        {activity.type === 'followup' && <Clock size={15} />}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className={`truncate max-w-[250px] transition-all ${activity.completed ? 'line-through text-slate-400 opacity-70' : 'text-slate-900 dark:text-white'}`}>
                                                                            {activity.title}
                                                                        </span>
                                                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">{activity.type || 'Tarefa'}</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {colId === 'dealId' && (
                                                                deal ? (
                                                                    <button
                                                                        onClick={() => navigate(`/deals/${deal.id}`)}
                                                                        className="flex items-center gap-2 text-primary hover:underline underline-offset-4 decoration-2"
                                                                    >
                                                                        <Building2 size={12} className="opacity-50" />
                                                                        {deal.title}
                                                                    </button>
                                                                ) : <span className="text-slate-300 dark:text-white/5 opacity-50">—</span>
                                                            )}

                                                            {colId === 'contactId' && (
                                                                contact ? (
                                                                    <button
                                                                        onClick={() => navigate(`/contacts/${contact.id}`)}
                                                                        className="flex items-center gap-2 hover:text-primary transition-colors"
                                                                    >
                                                                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] font-semibold uppercase">
                                                                            {contact.name.charAt(0)}
                                                                        </div>
                                                                        {contact.name}
                                                                    </button>
                                                                ) : <span className="text-slate-300 dark:text-white/5 opacity-50">—</span>
                                                            )}

                                                            {colId === 'priority' && (
                                                                <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-semibold uppercase tracking-widest border
                                                                    ${activity.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' :
                                                                        activity.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                            'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                                    {activity.priority || 'Normal'}
                                                                </span>
                                                            )}

                                                            {colId === 'dueDate' && (
                                                                <div className="flex flex-col">
                                                                    <span className={`
                                                                        ${!activity.completed && isBefore(parseISO(activity.dueDate || ''), startOfToday()) ? 'text-red-500' :
                                                                            isToday(parseISO(activity.dueDate || '')) ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}
                                                                    `}>
                                                                        {activity.dueDate ? format(parseISO(activity.dueDate), "dd MMM, yyyy", { locale: ptBR }) : 'Sem data'}
                                                                    </span>
                                                                    {activity.dueDate && (
                                                                        <span className="text-[11px] font-bold text-slate-400">
                                                                            {format(parseISO(activity.dueDate), "HH:mm")}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {colId === 'email' && (
                                                                contact?.email ? (
                                                                    <a href={`mailto:${contact.email}`} className="text-slate-500 hover:text-primary transition-colors flex items-center gap-2">
                                                                        <Mail size={14} className="opacity-50" />
                                                                        {contact.email}
                                                                    </a>
                                                                ) : <span className="text-slate-300 dark:text-white/5 opacity-50">—</span>
                                                            )}

                                                            {colId === 'phone' && (
                                                                contact?.phone ? (
                                                                    <a href={`tel:${contact.phone}`} className="text-slate-500 hover:text-primary transition-colors flex items-center gap-2">
                                                                        <Phone size={14} className="opacity-50" />
                                                                        {contact.phone}
                                                                    </a>
                                                                ) : <span className="text-slate-300 dark:text-white/5 opacity-50">—</span>
                                                            )}

                                                            {colId === 'companyId' && (
                                                                company ? company.name : (deal && deals.find(d => d.id === deal.id)?.companyId ? companies.find(c => c.id === deal.companyId)?.name : <span className="text-slate-300 dark:text-white/5 opacity-50">—</span>)
                                                            )}

                                                            {colId === 'duration' && (
                                                                activity.duration ? `${activity.duration}m` : <span className="text-slate-300 dark:text-white/5 opacity-50">—</span>
                                                            )}

                                                            {colId === 'ownerId' && (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-[10px] font-semibold text-orange-600">
                                                                        U
                                                                    </div>
                                                                    <span className="text-slate-500">Você</span>
                                                                </div>
                                                            )}

                                                            {/* Direct fallbacks for metadata columns */}
                                                            {!['title', 'dealId', 'contactId', 'priority', 'dueDate', 'email', 'phone', 'companyId', 'duration', 'ownerId'].includes(colId) && (
                                                                <span className="text-slate-400">{(activity as any)[colId] || <span className="opacity-30">—</span>}</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                <td className="p-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-blue-500 transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Pencil size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteActivity(activity.id)}
                                                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {filteredActivities.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-40 text-slate-400">
                                    <div className="w-24 h-24 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                                        <SearchX size={48} className="text-slate-200 dark:text-white/10" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">Nenhuma atividade encontrada</h3>
                                    <p className="text-sm font-medium text-slate-500 max-w-xs text-center mt-2">Tente ajustar seus filtros ou termos de pesquisa para encontrar o que procura.</p>
                                    <button
                                        onClick={() => { setActiveFilter('Todos'); setSearchQuery(''); }}
                                        className="mt-6 text-sm font-semibold text-primary uppercase tracking-widest hover:underline"
                                    >
                                        Limpar todos os filtros
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer Status Bar Placeholder */}
                        <div className="p-4 bg-slate-50/50 dark:bg-white/[0.01] border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                    Total: <span className="text-slate-900 dark:text-white ml-1">{filteredActivities.length} registros</span>
                                </span>
                                <div className="w-px h-3 bg-slate-200 dark:bg-white/10" />
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                    Concluídas: <span className="text-emerald-500 ml-1">{activities.filter(a => a.completed).length}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Actions Bar */}
            {selectedActivities.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[28px] flex items-center gap-8 shadow-2xl animate-in slide-in-from-bottom-12 duration-500 z-[100] border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center font-semibold">
                            {selectedActivities.length}
                        </div>
                        <span className="text-sm font-semibold uppercase tracking-[0.1em]">Atividades selecionadas</span>
                    </div>

                    <div className="w-px h-8 bg-white/10" />

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsBulkEditModalOpen(true)}
                            className="text-sm font-bold hover:text-primary transition-colors flex items-center gap-2"
                        >
                            <Pencil size={18} />
                            Editar
                        </button>
                        <button
                            onClick={handleBulkComplete}
                            className="text-sm font-bold hover:text-emerald-400 transition-colors flex items-center gap-2"
                        >
                            <CheckCircle size={18} />
                            Concluir
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="text-sm font-bold hover:text-red-400 transition-colors flex items-center gap-2"
                        >
                            <Trash2 size={18} />
                            Excluir
                        </button>
                    </div>

                    <button
                        onClick={() => setSelectedActivities([])}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            )}

            <GlobalActivityModal
                isOpen={isNewModalOpen}
                onClose={() => setIsNewModalOpen(false)}
            />

            <CustomizeColumnsModal
                isOpen={isCustomizeModalOpen}
                onClose={() => setIsCustomizeModalOpen(false)}
                visibleColumns={visibleColumns}
                onSave={setVisibleColumns}
            />

            <BulkEditActivitiesModal
                isOpen={isBulkEditModalOpen}
                onClose={() => setIsBulkEditModalOpen(false)}
                selectedIds={selectedActivities}
                onSuccess={() => setSelectedActivities([])}
            />
        </div>
    );
}
