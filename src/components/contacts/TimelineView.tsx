import { useState, useMemo, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Plus, ChevronRight, ChevronDown, MoreHorizontal, Phone, Mail, Calendar, FileText, CheckCircle, Clock, Briefcase, Coffee, Target, AlertCircle } from 'lucide-react';
import { PrivacyText } from '../ui/PrivacyMask';

type EventFilter = 'all' | 'deals' | 'emails' | 'notes' | 'call' | 'meeting' | 'task' | 'deadline' | 'lunch';

interface TimelineEvent {
    id: string;
    contactId: string;
    type: 'call' | 'email' | 'meeting' | 'task' | 'note' | 'deal' | 'deadline' | 'lunch';
    date: Date;
    title: string;
    completed: boolean;
    overdue: boolean;
}

export default function TimelineView() {
    const { contacts, companies, activities, deals } = useCRM();

    // Load persisted filters from localStorage
    const [activeFilter, setActiveFilter] = useState<EventFilter>(() => {
        return (localStorage.getItem('timeline_activeFilter') as EventFilter) || 'all';
    });
    const [showFrequencyFilter, setShowFrequencyFilter] = useState(false);
    const [showPeriodFilter, setShowPeriodFilter] = useState(false);
    const [showOwnerFilter, setShowOwnerFilter] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [showRiskFilter, setShowRiskFilter] = useState(false);
    const [selectedFrequency, setSelectedFrequency] = useState(() => {
        return localStorage.getItem('timeline_frequency') || 'Nenhuma frequência estabelecida';
    });
    const [selectedPeriod, setSelectedPeriod] = useState(() => {
        return localStorage.getItem('timeline_period') || '1 mês atrás';
    });
    const [selectedOwner, setSelectedOwner] = useState(() => {
        return localStorage.getItem('timeline_owner') || 'Philippe';
    });
    const [selectedRiskStatus, setSelectedRiskStatus] = useState<string>(() => {
        return localStorage.getItem('timeline_riskStatus') || 'all';
    });
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [activeContactMenu, setActiveContactMenu] = useState<string | null>(null);

    // Persist filters to localStorage
    useEffect(() => {
        localStorage.setItem('timeline_activeFilter', activeFilter);
    }, [activeFilter]);

    useEffect(() => {
        localStorage.setItem('timeline_frequency', selectedFrequency);
    }, [selectedFrequency]);

    useEffect(() => {
        localStorage.setItem('timeline_period', selectedPeriod);
    }, [selectedPeriod]);

    useEffect(() => {
        localStorage.setItem('timeline_owner', selectedOwner);
    }, [selectedOwner]);

    useEffect(() => {
        localStorage.setItem('timeline_riskStatus', selectedRiskStatus);
    }, [selectedRiskStatus]);

    const filters = [
        { id: 'all' as EventFilter, label: 'Tudo', icon: Target },
        { id: 'deals' as EventFilter, label: 'Negócios', icon: Briefcase },
        { id: 'emails' as EventFilter, label: 'E-mails', icon: Mail },
        { id: 'notes' as EventFilter, label: 'Anotações', icon: FileText },
        { id: 'call' as EventFilter, label: 'Chamada', icon: Phone },
        { id: 'meeting' as EventFilter, label: 'Reunião', icon: Calendar },
        { id: 'task' as EventFilter, label: 'Tarefa', icon: CheckCircle },
        { id: 'deadline' as EventFilter, label: 'Prazo', icon: Clock },
        { id: 'lunch' as EventFilter, label: 'Almoço', icon: Coffee },
    ];

    // Generate timeline events from activities and deals
    const timelineEvents = useMemo(() => {
        const events: TimelineEvent[] = [];
        const today = new Date();

        // Add activities as events
        activities.forEach(activity => {
            if (activity.dueDate) {
                const dueDate = new Date(activity.dueDate);
                const isOverdue = !activity.completed && dueDate < today;

                events.push({
                    id: activity.id,
                    contactId: activity.contactId || '',
                    type: activity.type as any || 'task',
                    date: dueDate,
                    title: activity.title,
                    completed: activity.completed,
                    overdue: isOverdue,
                });
            }
        });

        // Add deals as events
        deals.forEach(deal => {
            if (deal.createdAt) {
                events.push({
                    id: deal.id,
                    contactId: deal.contactId || '',
                    type: 'deal',
                    date: new Date(deal.createdAt),
                    title: deal.title,
                    completed: deal.status === 'won',
                    overdue: deal.status === 'lost',
                });
            }
        });

        return events;
    }, [activities, deals]);

    // Filter events by active filter
    const filteredEvents = useMemo(() => {
        if (activeFilter === 'all') return timelineEvents;

        const filterMap: Record<EventFilter, string[]> = {
            all: [],
            deals: ['deal'],
            emails: ['email'],
            notes: ['note'],
            call: ['call'],
            meeting: ['meeting'],
            task: ['task'],
            deadline: ['deadline'],
            lunch: ['lunch'],
        };

        const allowedTypes = filterMap[activeFilter] || [];
        return timelineEvents.filter(event => allowedTypes.includes(event.type));
    }, [timelineEvents, activeFilter]);

    // Generate months for timeline (last 6 months + next 6 months)
    const months = useMemo(() => {
        const result = [];
        const today = new Date();

        for (let i = -6; i <= 6; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            result.push({
                date,
                label: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
                monthKey: `${date.getFullYear()}-${date.getMonth()}`,
            });
        }

        return result;
    }, []);

    // Calculate position for TODAY line (percentage)
    const todayPosition = useMemo(() => {
        const today = new Date();
        const firstMonth = months[0].date;
        const lastMonth = months[months.length - 1].date;

        const totalDays = (lastMonth.getTime() - firstMonth.getTime()) / (1000 * 60 * 60 * 24);
        const daysSinceStart = (today.getTime() - firstMonth.getTime()) / (1000 * 60 * 60 * 24);

        return (daysSinceStart / totalDays) * 100;
    }, [months]);

    // Get events for a specific contact
    const getContactEvents = (contactId: string) => {
        return filteredEvents.filter(event => event.contactId === contactId);
    };

    // Calculate event position on timeline
    const getEventPosition = (eventDate: Date) => {
        const firstMonth = months[0].date;
        const lastMonth = months[months.length - 1].date;

        const totalDays = (lastMonth.getTime() - firstMonth.getTime()) / (1000 * 60 * 60 * 24);
        const daysSinceStart = (eventDate.getTime() - firstMonth.getTime()) / (1000 * 60 * 60 * 24);

        return Math.max(0, Math.min(100, (daysSinceStart / totalDays) * 100));
    };

    // Get icon for event type
    const getEventIcon = (type: string) => {
        const iconMap: Record<string, any> = {
            call: Phone,
            email: Mail,
            meeting: Calendar,
            task: CheckCircle,
            note: FileText,
            deal: Briefcase,
            deadline: Clock,
            lunch: Coffee,
        };
        return iconMap[type] || CheckCircle;
    };

    // Get company name for contact
    const getCompanyName = (contactId: string) => {
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) return '';
        const company = companies.find(c => c.id === contact.companyId);
        return company?.name || '';
    };

    // Calculate activity frequency and risk status
    const getContactFrequencyStatus = (contactId: string) => {
        const events = getContactEvents(contactId);
        if (events.length === 0) return { status: 'inactive', label: 'Sem atividades', color: 'text-red-500' };

        const sortedEvents = [...events].sort((a, b) => b.date.getTime() - a.date.getTime());
        const lastEvent = sortedEvents[0];
        const daysSinceLastActivity = Math.floor((new Date().getTime() - lastEvent.date.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastActivity > 60) return { status: 'risk', label: 'Risco de esquecimento', color: 'text-orange-500' };
        if (daysSinceLastActivity > 30) return { status: 'warning', label: 'Atenção necessária', color: 'text-yellow-600' };
        if (daysSinceLastActivity <= 7) return { status: 'active', label: 'Contato ativo', color: 'text-green-500' };
        return { status: 'normal', label: 'Contato regular', color: 'text-blue-500' };
    };

    // Get active deal period for relationship bar
    const getActiveDealPeriod = (contactId: string) => {
        const contactDeals = deals.filter(d => d.contactId === contactId && d.status === 'open');
        if (contactDeals.length === 0) return null;

        const oldestDeal = contactDeals.reduce((oldest, deal) => {
            const dealDate = new Date(deal.createdAt || Date.now());
            const oldestDate = new Date(oldest.createdAt || Date.now());
            return dealDate < oldestDate ? deal : oldest;
        });

        return {
            start: new Date(oldestDeal.createdAt || Date.now()),
            end: new Date(), // Active until now
        };
    };

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Breadcrumb */}
            <div className="px-6 pt-4 pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="hover:text-foreground cursor-pointer transition-colors">Contatos</span>
                    <ChevronRight size={14} />
                    <span className="text-foreground font-medium">Linha do tempo de contatos</span>
                </div>
            </div>

            {/* Header with Actions */}
            <div className="px-6 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                    {/* Left: Primary Action with Dropdown */}
                    <div className="flex items-center gap-2 relative">
                        <button
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm hover:shadow"
                        >
                            <Plus size={16} strokeWidth={2.5} />
                            Adicionar
                            <ChevronDown size={14} />
                        </button>
                        {showAddMenu && (
                            <div className="absolute top-full left-0 mt-2 w-44 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2">
                                    <Calendar size={14} />
                                    Atividade
                                </button>
                                <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2">
                                    <Briefcase size={14} />
                                    Negócio
                                </button>
                                <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2">
                                    <FileText size={14} />
                                    Nota
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: Filters and Controls */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                            {contacts.length} {contacts.length === 1 ? 'pessoa' : 'pessoas'}
                        </span>

                        {/* Frequency Filter */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFrequencyFilter(!showFrequencyFilter);
                                    setShowPeriodFilter(false);
                                    setShowOwnerFilter(false);
                                    setShowMoreActions(false);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-lg hover:bg-muted transition-colors text-sm"
                            >
                                <span>{selectedFrequency}</span>
                                <ChevronDown size={14} />
                            </button>
                            {showFrequencyFilter && (
                                <div className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                    {['Nenhuma frequência estabelecida', 'Diária', 'Semanal', 'Mensal'].map((freq) => (
                                        <button
                                            key={freq}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedFrequency(freq);
                                                setShowFrequencyFilter(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedFrequency === freq ? 'bg-muted font-medium' : ''}`}
                                        >
                                            {freq}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Period Filter */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowPeriodFilter(!showPeriodFilter);
                                    setShowFrequencyFilter(false);
                                    setShowOwnerFilter(false);
                                    setShowRiskFilter(false);
                                    setShowMoreActions(false);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-lg hover:bg-muted transition-colors text-sm"
                            >
                                <span>{selectedPeriod}</span>
                                <ChevronDown size={14} />
                            </button>
                            {showPeriodFilter && (
                                <div className="absolute right-0 mt-2 w-40 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                    {['1 mês atrás', '3 meses atrás', '6 meses atrás', '1 ano atrás'].map((period) => (
                                        <button
                                            key={period}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedPeriod(period);
                                                setShowPeriodFilter(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedPeriod === period ? 'bg-muted font-medium' : ''}`}
                                        >
                                            {period}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Owner Filter */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowOwnerFilter(!showOwnerFilter);
                                    setShowFrequencyFilter(false);
                                    setShowPeriodFilter(false);
                                    setShowRiskFilter(false);
                                    setShowMoreActions(false);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
                            >
                                <span>{selectedOwner}</span>
                                <ChevronDown size={14} />
                            </button>
                            {showOwnerFilter && (
                                <div className="absolute right-0 mt-2 w-40 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                    {['Philippe', 'Todos', 'Sem proprietário'].map((owner) => (
                                        <button
                                            key={owner}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedOwner(owner);
                                                setShowOwnerFilter(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedOwner === owner ? 'bg-muted font-medium' : ''}`}
                                        >
                                            {owner}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Risk Status Filter */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowRiskFilter(!showRiskFilter);
                                    setShowFrequencyFilter(false);
                                    setShowPeriodFilter(false);
                                    setShowOwnerFilter(false);
                                    setShowMoreActions(false);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-lg hover:bg-muted transition-colors text-sm"
                            >
                                <AlertCircle size={14} />
                                <span>{selectedRiskStatus === 'all' ? 'Todos os status' :
                                    selectedRiskStatus === 'active' ? 'Contato ativo' :
                                        selectedRiskStatus === 'normal' ? 'Contato regular' :
                                            selectedRiskStatus === 'warning' ? 'Atenção necessária' :
                                                selectedRiskStatus === 'risk' ? 'Risco de esquecimento' :
                                                    'Sem atividades'}</span>
                                <ChevronDown size={14} />
                            </button>
                            {showRiskFilter && (
                                <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                    {[
                                        { value: 'all', label: 'Todos os status', color: 'bg-gray-400' },
                                        { value: 'active', label: 'Contato ativo', color: 'bg-green-500' },
                                        { value: 'normal', label: 'Contato regular', color: 'bg-blue-500' },
                                        { value: 'warning', label: 'Atenção necessária', color: 'bg-yellow-600' },
                                        { value: 'risk', label: 'Risco de esquecimento', color: 'bg-orange-500' },
                                        { value: 'inactive', label: 'Sem atividades', color: 'bg-red-500' },
                                    ].map((status) => (
                                        <button
                                            key={status.value}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedRiskStatus(status.value);
                                                setShowRiskFilter(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${selectedRiskStatus === status.value ? 'bg-muted font-medium' : ''}`}
                                        >
                                            <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                            {status.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* More Actions */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMoreActions(!showMoreActions);
                                    setShowFrequencyFilter(false);
                                    setShowPeriodFilter(false);
                                    setShowOwnerFilter(false);
                                    setShowRiskFilter(false);
                                }}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                <MoreHorizontal size={18} />
                            </button>
                            {showMoreActions && (
                                <div className="absolute right-0 mt-2 w-44 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                                        Exportar
                                    </button>
                                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                                        Configurações
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Event Type Filters (Pills) */}
            <div className="px-6 py-3 border-b border-border bg-muted/20">
                <div className="flex gap-2 flex-wrap">
                    {filters.map((filter) => {
                        const Icon = filter.icon;
                        const isActive = activeFilter === filter.id;
                        return (
                            <button
                                key={filter.id}
                                onClick={() => setActiveFilter(filter.id)}
                                className={`
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                                    ${isActive
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-background border border-input text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }
                                `}
                            >
                                <Icon size={12} />
                                {filter.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Timeline Area */}
            <div className="flex-1 overflow-auto">
                <div className="min-w-max">
                    {/* Timeline Header (Months) */}
                    <div className="flex border-b border-border bg-muted/50 sticky top-0 z-20">
                        {/* Fixed column for names */}
                        <div className="w-64 px-4 py-3 border-r border-border bg-muted/50 shrink-0 sticky left-0 z-10">
                            <span className="text-xs font-semibold text-muted-foreground uppercase">Pessoas</span>
                        </div>

                        {/* Months */}
                        <div className="flex-1 relative">
                            <div className="flex">
                                {months.map((month) => (
                                    <div
                                        key={month.monthKey}
                                        className="flex-1 px-4 py-3 text-center border-r border-border"
                                        style={{ minWidth: '120px' }}
                                    >
                                        <span className="text-xs font-medium text-muted-foreground uppercase">
                                            {month.label}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* TODAY Line */}
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                                style={{ left: `${todayPosition}%` }}
                            >
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
                                    HOJE
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Rows (Contacts) - Filtered by Risk Status */}
                    <div className="relative">
                        {contacts.filter((contact) => {
                            // Filter by risk status if not 'all'
                            if (selectedRiskStatus === 'all') return true;
                            const status = getContactFrequencyStatus(contact.id);
                            return status.status === selectedRiskStatus;
                        }).map((contact) => {
                            const contactEvents = getContactEvents(contact.id);
                            const companyName = getCompanyName(contact.id);

                            return (
                                <div key={contact.id} className="flex border-b border-border hover:bg-muted/30 transition-colors group">
                                    {/* Fixed column: Contact info */}
                                    <div className="w-64 px-4 py-3 border-r border-border bg-background shrink-0 sticky left-0 z-10 group-hover:bg-muted/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                {contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-foreground truncate">
                                                    <PrivacyText text={contact.name} type="name" />
                                                </div>
                                                {companyName && (
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {companyName}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Frequency Status Indicator */}
                                            <div className="absolute -right-1 top-1/2 -translate-y-1/2">
                                                {(() => {
                                                    const status = getContactFrequencyStatus(contact.id);
                                                    return (
                                                        <div
                                                            className={`w-2 h-2 rounded-full ${status.color.replace('text-', 'bg-')}`}
                                                            title={status.label}
                                                        />
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timeline events */}
                                    <div className="flex-1 relative py-3" style={{ minHeight: '60px' }}>
                                        <div className="absolute inset-0" style={{ width: `${months.length * 120}px` }}>
                                            {/* Month grid lines */}
                                            {months.map((month, idx) => (
                                                <div
                                                    key={month.monthKey}
                                                    className="absolute top-0 bottom-0 border-r border-border/30"
                                                    style={{ left: `${(idx / months.length) * 100}%` }}
                                                />
                                            ))}

                                            {/* Active Deal Period Bar */}
                                            {(() => {
                                                const dealPeriod = getActiveDealPeriod(contact.id);
                                                if (!dealPeriod) return null;

                                                const startPos = getEventPosition(dealPeriod.start);
                                                const endPos = getEventPosition(dealPeriod.end);
                                                const width = endPos - startPos;

                                                return (
                                                    <div
                                                        className="absolute top-1/2 -translate-y-1/2 h-1 bg-blue-400/30 rounded-full"
                                                        style={{
                                                            left: `${startPos}%`,
                                                            width: `${width}%`,
                                                            minWidth: '2px'
                                                        }}
                                                        title="Período de relacionamento ativo"
                                                    />
                                                );
                                            })()}

                                            {/* Events */}
                                            {contactEvents.map((event) => {
                                                const Icon = getEventIcon(event.type);
                                                const position = getEventPosition(event.date);

                                                return (
                                                    <div
                                                        key={event.id}
                                                        className="absolute top-1/2 -translate-y-1/2 group/event cursor-pointer"
                                                        style={{ left: `${position}%` }}
                                                        title={`${event.title} - ${event.date.toLocaleDateString('pt-BR')}`}
                                                    >
                                                        <div
                                                            className={`
                                                                w-6 h-6 rounded-full flex items-center justify-center transition-all
                                                                ${event.completed
                                                                    ? 'bg-blue-500 text-white'
                                                                    : event.overdue
                                                                        ? 'bg-red-500 text-white'
                                                                        : 'bg-gray-400 text-white'
                                                                }
                                                                group-hover/event:scale-125 group-hover/event:shadow-lg
                                                            `}
                                                        >
                                                            <Icon size={12} strokeWidth={2.5} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Quick Add Button with Dropdown */}
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="relative">
                                                <button
                                                    onClick={() => setActiveContactMenu(activeContactMenu === contact.id ? null : contact.id)}
                                                    className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 transition-transform shadow-sm"
                                                >
                                                    <Plus size={14} strokeWidth={2.5} />
                                                </button>
                                                {activeContactMenu === contact.id && (
                                                    <div className="absolute right-0 top-full mt-2 w-36 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                                        <button className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2">
                                                            <Calendar size={12} />
                                                            Atividade
                                                        </button>
                                                        <button className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2">
                                                            <Briefcase size={12} />
                                                            Negócio
                                                        </button>
                                                        <button className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-2">
                                                            <FileText size={12} />
                                                            Nota
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* TODAY Line (extends through all rows) */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500/50 pointer-events-none z-10"
                            style={{ left: `calc(256px + ${todayPosition}%)` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
