
import { useState, useEffect, useRef } from "react";
import { useCRM } from "@/contexts/CRMContext";
import { Deal } from "@/types/schema";
import KanbanColumn from "./KanbanColumn";
import {
    DndContext,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";

import { createPortal } from "react-dom";
import { DealCardBase } from "./KanbanCard";
import SuggestionModal from "./SuggestionModal";

import { Filter, Search, Plus } from "lucide-react";
import { Currency } from "@/data/currencies";
import DealDetailsModal from "./DealDetailsModal";
import MobileKanbanView from "./MobileKanbanView";
import { useIsMobile } from "@/hooks/useMediaQuery";

interface KanbanBoardProps {
    currency: Currency;
}

function KanbanBoard({ currency }: KanbanBoardProps) {
    const {
        deals, contacts, companies, pipelines, moveDeal, activities,
        isLoading, setPipelineSettingsOpen,
        openNewDealModal
    } = useCRM();

    const isMobile = useIsMobile();
    // Default to 'sales' pipeline for now, can be dynamic
    const [currentPipelineId, setCurrentPipelineId] = useState(() => {
        const saved = localStorage.getItem('kanban_pipeline_id');
        return saved || 'sales';
    });

    useEffect(() => {
        localStorage.setItem('kanban_pipeline_id', currentPipelineId);
    }, [currentPipelineId]);

    const currentPipeline = pipelines[currentPipelineId];
    // Helper to get columns (stages)
    const columns = currentPipeline?.stages || [];


    // --- Filters State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    // Handle click outside filters
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                // Check if the click was on the toggle button
                const toggleButton = document.getElementById('filter-toggle-button');
                if (toggleButton && toggleButton.contains(event.target as Node)) return;

                setShowFilters(false);
            }
        }
        if (showFilters) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showFilters]);

    // Strict Types for Local State
    type ViewMode = 'all' | 'today' | 'overdue' | 'no-action' | 'high-value';
    type StatusFilter = 'open' | 'won' | 'lost' | 'all';

    // Safe LocalStorage Parsers
    const getSavedViewMode = (): ViewMode => {
        const saved = localStorage.getItem('kanban_view_mode');
        const validModes: ViewMode[] = ['all', 'today', 'overdue', 'no-action', 'high-value'];
        return validModes.includes(saved as ViewMode) ? (saved as ViewMode) : 'all';
    };

    const getSavedStatusFilter = (): StatusFilter => {
        const saved = localStorage.getItem('kanban_status_filter');
        const validStatuses: StatusFilter[] = ['open', 'won', 'lost', 'all'];
        return validStatuses.includes(saved as StatusFilter) ? (saved as StatusFilter) : 'open';
    };

    // Persisted State
    const [viewMode, setViewMode] = useState<ViewMode>(getSavedViewMode);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(getSavedStatusFilter);

    // Persistence Effects
    useEffect(() => {
        localStorage.setItem('kanban_view_mode', viewMode);
    }, [viewMode]);

    useEffect(() => {
        localStorage.setItem('kanban_status_filter', statusFilter);
    }, [statusFilter]);

    // Filter deals for current pipeline
    const pipelineDeals = deals.filter(deal => deal.pipelineId === currentPipelineId);

    // --- Filter Logic ---
    const normalizeText = (text: string) =>
        text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

    const normalizeDigits = (text: string) => text.replace(/\D/g, "");
    const searchUpper = normalizeText(searchTerm);
    const searchDigits = normalizeDigits(searchTerm);

    const filteredDeals = pipelineDeals.filter(deal => {
        // Find linked info for deeper search
        const contact = contacts.find(c => c.id === deal.contactId);
        const company = companies.find(c => c.id === deal.companyId);

        const dealTitle = normalizeText(deal.title);
        const contactName = contact ? normalizeText(contact.name) : '';
        const companyName = company ? normalizeText(company.name) : '';
        const contactPhone = contact?.phone ? normalizeText(contact.phone) : '';
        const contactEmail = contact?.email ? normalizeText(contact.email) : '';
        const contactPhoneDigits = contact?.phone ? normalizeDigits(contact.phone) : '';

        const matchesSearch = dealTitle.includes(searchUpper) ||
            contactName.includes(searchUpper) ||
            companyName.includes(searchUpper) ||
            contactPhone.includes(searchUpper) ||
            contactEmail.includes(searchUpper) ||
            (searchDigits.length >= 7 && contactPhoneDigits.includes(searchDigits));



        // View Mode Logic
        let matchesView = true;
        const dealActivities = activities.filter(a => a.dealId === deal.id && !a.completed);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (viewMode === 'today') {
            matchesView = dealActivities.some(a => {
                if (!a.dueDate) return false;
                const d = new Date(a.dueDate);
                return d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
            });
        } else if (viewMode === 'overdue') {
            matchesView = dealActivities.some(a => {
                if (!a.dueDate) return false;
                return a.dueDate < new Date().toISOString().split('T')[0];
            });
        } else if (viewMode === 'no-action') {
            matchesView = dealActivities.length === 0;
        } else if (viewMode === 'high-value') {
            matchesView = deal.value >= 10000;
        }

        const matchesStatus = statusFilter === 'all' ? true : deal.status === statusFilter;
        return matchesSearch && matchesView && matchesStatus;
    }).sort((a, b) => {
        const posA = a.position || 0;
        const posB = b.position || 0;
        if (posA !== posB) return posA - posB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });


    const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

    // Suggestion Modal State


    const [dragStartDeals, setDragStartDeals] = useState<Deal[]>([]);
    const [suggestionModal, setSuggestionModal] = useState<{ isOpen: boolean; deal: Deal | null; stageName: string }>({
        isOpen: false, deal: null, stageName: ''
    });

    // Deal Modal State (Replaces Preview)
    const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 10,
            },
        })
    );



    const handleDealClick = (dealId: string) => {
        setSelectedDealId(dealId);
    };





    // Mobile View
    if (isMobile) {
        return (
            <div className="flex flex-col h-full w-full overflow-hidden">
                {/* Mobile Toolbar */}
                <div className="min-h-[3rem] py-2 border-b border-border flex items-center justify-between px-3 bg-background shrink-0 z-30">
                    {/* Search */}
                    <div className="relative flex-1 max-w-[200px]">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-2 py-1.5 text-sm border border-border/60 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-full"
                        />
                    </div>

                    {/* Filters Toggle */}
                    <button
                        id="filter-toggle-button"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 border ml-2 ${showFilters
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'hover:bg-muted text-muted-foreground border-border/60'
                            }`}
                    >
                        <Filter size={14} />
                    </button>
                </div>

                {/* Filters Dropdown (Mobile) */}
                {showFilters && (
                    <div
                        ref={filterRef}
                        className="absolute right-3 top-[7.5rem] w-[calc(100%-1.5rem)] max-w-sm bg-popover border border-border rounded-xl shadow-2xl z-50 p-3 space-y-4 animate-in fade-in zoom-in-95 duration-200"
                    >
                        {/* Status Filter */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-1">Status do negócio</h3>
                            <div className="grid grid-cols-2 gap-1">
                                {[
                                    { id: 'open', label: 'Abertos', icon: '🟢' },
                                    { id: 'won', label: 'Ganhos', icon: '🏆' },
                                    { id: 'lost', label: 'Perdidos', icon: '❌' },
                                    { id: 'all', label: 'Todos', icon: '📑' }
                                ].map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            if (statusFilter === s.id) setStatusFilter('all');
                                            else setStatusFilter(s.id as StatusFilter);
                                        }}
                                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${statusFilter === s.id
                                            ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                                            : 'hover:bg-muted text-muted-foreground border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs">{s.icon}</span>
                                            <span>{s.label}</span>
                                        </div>
                                        {statusFilter === s.id && <div className="w-1 h-1 rounded-full bg-primary" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* View Mode Filter */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-1">Prioridade</h3>
                            <div className="grid grid-cols-2 gap-1">
                                {[
                                    { id: 'all', label: 'Ver tudo' },
                                    { id: 'today', label: 'Hoje' },
                                    { id: 'overdue', label: 'Atrasado' },
                                    { id: 'high-value', label: 'Alto Valor' }
                                ].map((v) => (
                                    <button
                                        key={v.id}
                                        onClick={() => {
                                            if (viewMode === v.id) setViewMode('all');
                                            else setViewMode(v.id as ViewMode);
                                        }}
                                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${viewMode === v.id
                                            ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                                            : 'hover:bg-muted text-muted-foreground border border-transparent'
                                            }`}
                                    >
                                        <span>{v.label}</span>
                                        {viewMode === v.id && <div className="w-1 h-1 rounded-full bg-primary" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Pipeline Filter */}
                        <div className="space-y-2">
                            <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-1">Funil</h3>
                            <div className="grid grid-cols-1 gap-1">
                                {Object.values(pipelines).map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setCurrentPipelineId(p.id)}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between ${currentPipelineId === p.id
                                            ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                                            : 'hover:bg-muted text-muted-foreground border border-transparent'
                                            }`}
                                    >
                                        <span>{p.name}</span>
                                        {currentPipelineId === p.id && <div className="w-1 h-1 rounded-full bg-primary" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between border-t border-border/50">
                            <button
                                onClick={() => {
                                    setStatusFilter('open');
                                    setViewMode('all');
                                    setSearchTerm('');
                                }}
                                className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
                            >
                                Limpar filtros
                            </button>
                            <button
                                onClick={() => setShowFilters(false)}
                                className="text-[11px] font-bold text-foreground hover:bg-muted px-2 py-1 rounded transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                )}

                {/* Mobile Kanban View */}
                <MobileKanbanView
                    columns={columns}
                    filteredDeals={filteredDeals}
                    currency={currency}
                    onDealClick={handleDealClick}
                    onAddDeal={openNewDealModal}
                />

                {/* Modals */}


                {selectedDealId && (
                    <DealDetailsModal
                        dealId={selectedDealId}
                        isOpen={!!selectedDealId}
                        onClose={() => setSelectedDealId(null)}
                        currency={currency}
                    />
                )}
            </div>
        );
    }

    // Desktop View
    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            {/* Toolbar - Aligned with Dashboard */}
            <div className="min-h-[3.5rem] py-2 border-b border-border flex items-center justify-center px-4 bg-transparent shrink-0 z-40">
                <div className="w-full max-w-[1600px] flex flex-wrap items-center justify-between gap-2">
                    {/* Check Pipedrive Style Toolbar */}
                    <div className="flex items-center gap-2 mr-auto mb-1 sm:mb-0">
                        <h1 className="text-lg font-bold text-foreground flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded-md transition-colors whitespace-nowrap">
                            {currentPipeline?.name}
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                        {/* Search */}
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar negócios..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-sm border border-border/60 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-48 transition-all"
                            />
                        </div>

                        {/* Advanced Filters Toggle */}
                        <button
                            id="filter-toggle-button"
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 border ${showFilters
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'hover:bg-muted text-muted-foreground border-border/60'
                                }`}
                        >
                            <Filter size={14} />
                            <span>Filtros</span>
                        </button>

                        {/* Advanced Filters Dropdown */}
                        {showFilters && (
                            <div
                                ref={filterRef}
                                className="absolute right-4 top-16 w-72 bg-popover border border-border rounded-xl shadow-2xl z-50 p-4 space-y-5 animate-in fade-in zoom-in-95 duration-200"
                            >
                                {/* GRUPO 1 — Status do negócio */}
                                <div className="space-y-2">
                                    <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-1">Status do negócio</h3>
                                    <div className="grid grid-cols-1 gap-1">
                                        {[
                                            { id: 'open', label: 'Abertos', icon: '🟢' },
                                            { id: 'won', label: 'Ganhos', icon: '🏆' },
                                            { id: 'lost', label: 'Perdidos', icon: '❌' },
                                            { id: 'all', label: 'Todos', icon: '📑' }
                                        ].map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    if (statusFilter === s.id) setStatusFilter('all');
                                                    else setStatusFilter(s.id as StatusFilter);
                                                }}
                                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${statusFilter === s.id
                                                    ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                                                    : 'hover:bg-muted text-muted-foreground border border-transparent'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span>{s.icon}</span>
                                                    <span>{s.label}</span>
                                                </div>
                                                {statusFilter === s.id && <div className="w-1 h-1 rounded-full bg-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* GRUPO 2 — Prioridade das atividades */}
                                <div className="space-y-2">
                                    <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-1">Prioridade das atividades</h3>
                                    <div className="grid grid-cols-1 gap-1">
                                        {[
                                            { id: 'all', label: 'Ver tudo' },
                                            { id: 'today', label: 'Hoje' },
                                            { id: 'overdue', label: 'Atrasado' },
                                            { id: 'no-action', label: 'Sem ação' },
                                            { id: 'high-value', label: 'Alto Valor' }
                                        ].map((v) => (
                                            <button
                                                key={v.id}
                                                onClick={() => {
                                                    if (viewMode === v.id) setViewMode('all');
                                                    else setViewMode(v.id as ViewMode);
                                                }}
                                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${viewMode === v.id
                                                    ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                                                    : 'hover:bg-muted text-muted-foreground border border-transparent'
                                                    }`}
                                            >
                                                <span>{v.label}</span>
                                                {viewMode === v.id && <div className="w-1 h-1 rounded-full bg-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* GRUPO 3 — Visualização de funil */}
                                <div className="space-y-2">
                                    <h3 className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-1">Visualização de funil</h3>
                                    <div className="grid grid-cols-1 gap-1">
                                        {Object.values(pipelines).map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setCurrentPipelineId(p.id)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${currentPipelineId === p.id
                                                    ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                                                    : 'hover:bg-muted text-muted-foreground border border-transparent'
                                                    }`}
                                            >
                                                <span>{p.name}</span>
                                                {currentPipelineId === p.id && <div className="w-1 h-1 rounded-full bg-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2 flex items-center justify-between border-t border-border/50">
                                    <button
                                        onClick={() => {
                                            setStatusFilter('open');
                                            setViewMode('all');
                                            setSearchTerm('');
                                        }}
                                        className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        Limpar filtros
                                    </button>
                                    <button
                                        onClick={() => setShowFilters(false)}
                                        className="text-[11px] font-bold text-foreground hover:bg-muted px-2 py-1 rounded transition-all"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* New Deal */}
                        <button
                            onClick={() => openNewDealModal(columns[0]?.id)}
                            className="ml-2 bg-[#00875A] hover:bg-[#00704a] text-white px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-1 shadow-sm transition-all"
                        >
                            <Plus size={16} />
                            <span>Novo Negócio</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Board Content - Professional Horizontal Scroll Layout */}
            <div className="flex-1 w-full h-full overflow-hidden bg-transparent relative">
                <DndContext
                    sensors={sensors}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDragOver={onDragOver}
                >
                    {/* Horizontal Scroll Container with Controlled Width */}
                    <div className="h-full w-full overflow-x-auto overflow-y-hidden pb-3 custom-scrollbar">
                        {/* Columns Container - Fixed Width, Centered */}
                        <div className="flex h-full min-w-max px-6 gap-6 mx-auto max-w-[1600px]">
                            {isLoading && columns.length === 0 ? (
                                /* Skeleton Loader */
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="flex flex-col h-full min-w-[270px] w-[270px] shrink-0 rounded-xl bg-muted/10 animate-pulse border border-border/30">
                                        <div className="h-14 bg-muted/20 rounded-t-xl mb-2 border-b border-border/20" />
                                        <div className="flex-1 p-3 space-y-4">
                                            <div className="h-28 bg-muted/20 rounded-lg" />
                                            <div className="h-28 bg-muted/20 rounded-lg" />
                                            <div className="h-28 bg-muted/20 rounded-lg" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <>
                                    {/* Static Columns Render */}
                                    {columns.map((col) => (
                                        <KanbanColumn
                                            key={col.id}
                                            column={col}
                                            tasks={filteredDeals.filter(d => d.stageId === col.id)}
                                            onAdd={openNewDealModal}
                                            currency={currency}
                                            onPreview={handleDealClick}
                                            onEditStage={() => setPipelineSettingsOpen(true)}
                                            searchTerm={searchTerm}
                                        />
                                    ))}

                                    {/* Add Column Ghost - Professional Pipeline Style */}
                                    <button
                                        onClick={() => setPipelineSettingsOpen(true)}
                                        className="group/ghost shrink-0 min-w-[280px] w-[280px] h-full rounded-xl border border-dashed border-slate-300/40 dark:border-white/12 bg-transparent hover:bg-slate-100/30 dark:hover:bg-white/[0.03] hover:border-slate-400/60 dark:hover:border-white/25 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer"
                                        title="Adicionar Nova Etapa"
                                    >
                                        {/* Circular + Button Inside Ghost Column */}
                                        <div className="w-[36px] h-[36px] rounded-full bg-neutral-800 group-hover/ghost:bg-neutral-700 dark:bg-neutral-800 dark:group-hover/ghost:bg-neutral-700 text-neutral-300 border border-neutral-700 dark:border-neutral-600 flex items-center justify-center transition-all duration-200 group-hover/ghost:scale-110 shadow-lg">
                                            <Plus size={18} strokeWidth={2.5} />
                                        </div>

                                        {/* Optional Label */}
                                        <span className="mt-3 text-xs font-medium text-muted-foreground group-hover/ghost:text-foreground transition-colors">
                                            Nova Etapa
                                        </span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {createPortal(
                        <DragOverlay>
                            {/* Only Deal Overlay */}
                            {activeDeal && <DealCardBase deal={activeDeal!} currency={currency} />}
                        </DragOverlay>,
                        document.body
                    )}
                </DndContext>



                <SuggestionModal
                    isOpen={suggestionModal.isOpen}
                    onClose={() => setSuggestionModal(prev => ({ ...prev, isOpen: false }))}
                    deal={suggestionModal.deal!}
                    newStageTitle={suggestionModal.stageName}
                />

                <DealDetailsModal
                    isOpen={!!selectedDealId}
                    dealId={selectedDealId}
                    onClose={() => setSelectedDealId(null)}
                    currency={currency}
                />
            </div>
        </div>
    );

    function onDragStart(event: DragStartEvent) {
        // Only handle Deal dragging
        if (event.active.data.current?.type === "Deal") {
            const dealId = event.active.id as string;
            const deal = deals.find(d => d.id === dealId);

            setDragStartDeals(deals);
            setActiveDeal(deal || null);

        }
    }

    function onDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        setActiveDeal(null);

        if (!over) return;

        // Deal Drop Logic
        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        // Use SNAPSHOT
        const sourceDeal = dragStartDeals.find(d => d.id === activeId);
        if (!sourceDeal) return;

        let targetStageId = sourceDeal.stageId;
        let newPos = sourceDeal.position || 0;
        let shouldUpdate = false;

        // Check if dropped on Column (Droppable Container)
        if (over.data.current?.type === "Column") {
            targetStageId = over.id as string;
            // Calculate position at end
            const targetDeals = dragStartDeals.filter(d => d.stageId === targetStageId && d.id !== activeId);
            const maxPos = targetDeals.length > 0 ? Math.max(...targetDeals.map(d => d.position || 0)) : 0;
            newPos = maxPos + 1024;
            shouldUpdate = true;
        } else if (over.data.current?.type === "Deal") {
            // Dropped on Deal
            const overDeal = dragStartDeals.find(d => d.id === overId);
            if (overDeal) {
                targetStageId = overDeal.stageId;

                // Same calculation logic as before...
                const stageDeals = dragStartDeals
                    .filter(d => d.stageId === targetStageId && d.id !== activeId)
                    .sort((a, b) => (a.position || 0) - (b.position || 0));

                const overIndex = stageDeals.findIndex(d => d.id === overId);

                // Same midpoint logic...
                if (overIndex !== -1) {
                    const next = stageDeals[overIndex];
                    const prev = stageDeals[overIndex - 1];
                    const nextPos = next.position || 0;
                    const prevPos = prev ? (prev.position || 0) : (nextPos - 2048);

                    newPos = (prevPos + nextPos) / 2;
                    shouldUpdate = true;
                }
            }
        }

        if (shouldUpdate) {
            moveDeal(activeId, targetStageId, newPos);
        }
    }

    function onDragOver(_event: DragOverEvent) {
        // Empty
    }
}

export default KanbanBoard;
