import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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
import { SortableContext } from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import DealCard from "./KanbanCard";
import NewDealModal from "./NewDealModal";
import SuggestionModal from "./SuggestionModal";
import { Filter, Search, DollarSign, Plus } from "lucide-react";
import { Currency } from "@/data/currencies";
import DealDetailsModal from "./DealDetailsModal";

interface KanbanBoardProps {
    currency: Currency;
}

function KanbanBoard({ currency }: KanbanBoardProps) {
    const { deals, pipelines, updateDeal, moveDeal, activities, refresh } = useCRM();
    // Default to 'sales' pipeline for now, can be dynamic
    const [currentPipelineId] = useState('sales');

    const currentPipeline = pipelines[currentPipelineId];
    // Helper to get columns (stages)
    const columns = currentPipeline?.stages || [];
    const columnsId = columns.map(col => col.id);

    // --- Filters State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [minValue, setMinValue] = useState<string>('');

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
    const filteredDeals = pipelineDeals.filter(deal => {
        const matchesSearch = deal.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesValue = minValue ? deal.value >= Number(minValue) : true;

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
        return matchesSearch && matchesValue && matchesView && matchesStatus;
    }).sort((a, b) => {
        const posA = a.position || 0;
        const posB = b.position || 0;
        if (posA !== posB) return posA - posB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
    const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

    // New Deal Modal State
    const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);
    const [newDealStageId, setNewDealStageId] = useState<string | null>(null);

    // Suggestion Modal State
    const [dragStartStageId, setDragStartStageId] = useState<string | null>(null);
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

    const openNewDealModal = (stageId: string) => {
        setNewDealStageId(stageId);
        setIsNewDealModalOpen(true);
    };

    const handleDealClick = (dealId: string) => {
        setSelectedDealId(dealId);
    };

    const activeColumn = columns.find(c => c.id === activeColumnId);

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            {/* Single Line Toolbar (Pipedrive Style) - Responsive Wrapper */}
            <div className="min-h-[3.5rem] py-2 border-b border-border flex flex-wrap items-center justify-between px-4 bg-transparent shrink-0 gap-2 z-40">
                {/* Left: Pipeline Title/Selector */}
                <div className="flex items-center gap-2 mr-auto mb-1 sm:mb-0">
                    <h1 className="text-lg font-bold text-foreground flex items-center gap-2 cursor-pointer hover:bg-muted/50 px-2 py-1 rounded-md transition-colors whitespace-nowrap">
                        {currentPipeline?.name}
                    </h1>
                </div>

                {/* Right: Controls */}
                <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">

                    {/* Status Filter */}
                    <div className="flex items-center gap-2 mr-2 bg-muted/50 rounded-md px-2 border border-transparent hover:border-border transition-all">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                            className={`bg-transparent text-sm font-medium outline-none cursor-pointer py-1 border-none focus:ring-0 ${statusFilter === 'won' ? 'text-green-600' :
                                statusFilter === 'lost' ? 'text-red-600' : 'text-muted-foreground'
                                }`}
                        >
                            <option value="open">🟢 Abertos</option>
                            <option value="won">🏆 Ganhos</option>
                            <option value="lost">❌ Perdidos</option>
                            <option value="all">📑 Todos</option>
                        </select>
                    </div>

                    {/* Saved Views Selector */}
                    <div className="flex items-center gap-2 mr-2 bg-muted/50 rounded-md px-2 border border-transparent hover:border-border transition-all">
                        <select
                            value={viewMode}
                            onChange={(e) => setViewMode(e.target.value as ViewMode)}
                            className="bg-transparent text-sm font-medium text-muted-foreground outline-none cursor-pointer py-1 border-none focus:ring-0"
                            title="Filtrar por Visão"
                        >
                            <option value="all">Todas as Oportunidades</option>
                            <option value="today">📅 Para Hoje</option>
                            <option value="overdue">🚨 Atrasados</option>
                            <option value="no-action">⚠️ Sem Próximo Passo</option>
                            <option value="high-value">🔥 Alto Valor ({'>'} 10k)</option>
                        </select>
                    </div>

                    {/* Search Inline */}
                    <div className="relative group w-48 transition-all focus-within:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-9 w-full pl-9 pr-4 rounded-md bg-muted/50 border border-transparent focus:bg-background focus:border-primary/30 focus:ring-2 focus:ring-primary/20 focus:outline-none text-sm transition-all placeholder:text-muted-foreground/60 text-foreground"
                        />
                    </div>

                    <div className="h-6 w-px bg-border mx-2" />

                    {/* Filter Toggle (with indicator if active) */}
                    <div className="relative">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${showFilters || minValue ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                        >
                            <Filter size={16} />
                            <span>Filtros</span>
                        </button>

                        {/* Absolute Filter Popover */}
                        {showFilters && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-popover border border-border shadow-lg rounded-lg p-4 z-50 animate-in fade-in zoom-in-95">
                                <div className="space-y-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase">Valor Mínimo</label>
                                        <div className="relative">
                                            <DollarSign size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                type="number"
                                                value={minValue}
                                                onChange={(e) => setMinValue(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-transparent border border-border rounded-md focus:ring-2 focus:ring-primary/50 outline-none text-foreground"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-2 border-t border-border">
                                        <button
                                            onClick={() => { setMinValue(''); setShowFilters(false); }}
                                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                                        >
                                            Limpar e Fechar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Add Deal Button (Primary Action) */}
                    <button
                        onClick={() => openNewDealModal(columns[0]?.id)}
                        className="ml-2 bg-[#00875A] hover:bg-[#00704a] text-white px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-1 shadow-sm transition-all"
                    >
                        <Plus size={16} />
                        <span>Novo Negócio</span>
                    </button>
                </div>
            </div>

            {/* Kanban Content */}
            <div className="flex-1 w-full h-full overflow-hidden bg-transparent relative">
                <DndContext
                    sensors={sensors}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDragOver={onDragOver}
                >
                    <div className="h-full w-full overflow-x-auto overflow-y-hidden">
                        <div className="flex h-full min-w-max px-6 pb-4 pt-4 gap-6 mx-auto max-w-[1600px]">
                            <SortableContext items={columnsId}>
                                {columns.map((col) => (
                                    <KanbanColumn
                                        key={col.id}
                                        column={col}
                                        tasks={filteredDeals.filter(d => d.stageId === col.id)}
                                        updateColumn={() => { }}
                                        onAdd={openNewDealModal}
                                        currency={currency}
                                        onPreview={handleDealClick}
                                    />
                                ))}
                            </SortableContext>
                        </div>
                    </div>

                    {createPortal(
                        <DragOverlay>
                            {activeColumn && (
                                <KanbanColumn
                                    column={activeColumn!}
                                    tasks={filteredDeals.filter(d => d.stageId === activeColumn.id)}
                                    updateColumn={() => { }}
                                    onAdd={() => { }}
                                    currency={currency}
                                />
                            )}
                            {activeDeal && <DealCard deal={activeDeal!} currency={currency} />}
                        </DragOverlay>,
                        document.body
                    )}
                </DndContext>

                <NewDealModal
                    isOpen={isNewDealModalOpen}
                    onClose={() => setIsNewDealModalOpen(false)}
                    initialColumnId={newDealStageId || undefined}
                    currency={currency.code}
                />

                <SuggestionModal
                    isOpen={suggestionModal.isOpen}
                    onClose={() => setSuggestionModal(prev => ({ ...prev, isOpen: false }))}
                    deal={suggestionModal.deal!}
                    newStageTitle={suggestionModal.stageName}
                />

                {/* Deal Details Modal (Full View) */}
                <DealDetailsModal
                    isOpen={!!selectedDealId}
                    dealId={selectedDealId}
                    onClose={() => setSelectedDealId(null)}
                />
            </div>
        </div>
    );

    function onDragStart(event: DragStartEvent) {
        if (event.active.data.current?.type === "Column") {
            setActiveColumnId(event.active.id as string);
            return;
        }

        if (event.active.data.current?.type === "Deal") {
            const dealId = event.active.id as string;
            const deal = deals.find(d => d.id === dealId);

            // Capture snapshot of ALL deals at start of drag
            // This ensures onDragEnd calculations use original positions
            setDragStartDeals(deals);

            setActiveDeal(deal || null);
            setDragStartStageId(deal?.stageId || null);
        }
    }

    function onDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveColumnId(null);
        setActiveDeal(null);

        // Detect Stage Change based on Drag Start
        if (dragStartStageId && active.data.current?.type === "Deal" && over) {
            let potentialNewStageId = null;
            if (over.data.current?.type === "Column") potentialNewStageId = over.id as string;
            else if (over.data.current?.type === "Deal") {
                const overD = deals.find(d => d.id === over.id);
                if (overD) potentialNewStageId = overD.stageId;
            }

            if (potentialNewStageId && potentialNewStageId !== dragStartStageId) {
                // const newStage = columns.find(c => c.id === potentialNewStageId);
                // Optional: Trigger suggestion (commented out or kept if useful)
                // setSuggestionModal({ isOpen: true, deal: deals.find(d => d.id === active.id)!, stageName: newStage?.title || '' });
            }
        }
        setDragStartStageId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        // Use SNAPSHOT for calculations to avoid optimistic state pollution
        const sourceDeal = dragStartDeals.find(d => d.id === activeId);
        if (!sourceDeal) return;

        let targetStageId = sourceDeal.stageId; // Start with original stage
        let newPos = sourceDeal.position || 0;
        let shouldUpdate = false;

        // 1. Determine Target & Position (Using Snapshot Neighbors)
        if (over.data.current?.type === "Column") {
            // Dropped on Column -> Move to End
            targetStageId = over.id as string;
            // Filter neighbors from SNAPSHOT to get stable positions
            const targetDeals = dragStartDeals.filter(d => d.stageId === targetStageId && d.id !== activeId);
            const maxPos = targetDeals.length > 0 ? Math.max(...targetDeals.map(d => d.position || 0)) : 0;
            newPos = maxPos + 1024;
            // Always update if dropped on different column or forced move
            shouldUpdate = true;
        } else if (over.data.current?.type === "Deal") {
            // Dropped on Deal -> Calculate relative to snapshot neighbors
            const overDeal = dragStartDeals.find(d => d.id === overId);

            if (overDeal) {
                targetStageId = overDeal.stageId;

                const stageDeals = dragStartDeals
                    .filter(d => d.stageId === targetStageId && d.id !== activeId)
                    .sort((a, b) => (a.position || 0) - (b.position || 0));

                const overIndex = stageDeals.findIndex(d => d.id === overId);

                if (overIndex !== -1) {
                    const next = stageDeals[overIndex];
                    const prev = stageDeals[overIndex - 1];

                    const nextPos = next.position || 0;
                    const prevPos = prev ? (prev.position || 0) : (nextPos - 2048);

                    if (Math.abs(nextPos - prevPos) < 0.01) {
                        // Collision logic remains similar but triggers re-index
                        // For collision, we might want to use current deals or snapshot? 
                        // Snapshot is safer for calculation, but update needs to affect current DB.
                        console.log('⚠️ Collision/Tight Gap based on snapshot. Triggering re-index...');

                        // We re-index the CURRENT list effectively by updating everyone
                        // But finding "everyone" from snapshot is safer order.
                        const fullList = [...stageDeals];
                        fullList.splice(overIndex, 0, sourceDeal);

                        const updates = fullList.map((d, idx) => {
                            const cleanPos = (idx + 1) * 1024;
                            return updateDeal(d.id, { position: cleanPos, stageId: targetStageId });
                        });
                        Promise.all(updates);
                        shouldUpdate = false;
                    } else {
                        newPos = (prevPos + nextPos) / 2;
                        shouldUpdate = true;
                    }
                }
            }
        }

        if (shouldUpdate) {
            console.log(`💾 Persisting Update -> ID: ${activeId}, Stage: ${targetStageId}, Pos: ${newPos}`);

            // DIRECT SUPABASE UPDATE FOR DEBUGGING
            supabase.from('deals').update({
                stage_id: targetStageId,
                position: newPos
            }).eq('id', activeId).then(({ error }) => {
                if (error) {
                    console.error('Direct Update Error:', error);
                    alert(`Erro direto no banco: ${error.message}`);
                } else {
                    console.log('✅ Direct Update Success');
                    // No local optimistic update. Force DB sync.
                    setTimeout(refresh, 200);
                }
            });
        } else {
            console.warn('⚠️ DragEnd detected but no update required?', { activeId, overId: over.id, overType: over.data.current?.type });
        }
    }

    function onDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        const isActiveDeal = active.data.current?.type === "Deal";
        const isOverColumn = over.data.current?.type === "Column";

        if (!isActiveDeal) return;

        // Find the active deal in current state
        const activeDeal = deals.find(d => d.id === activeId);
        if (!activeDeal) return;

        // 1. Moving over a Column (Empty space)
        if (isOverColumn) {
            if (activeDeal.stageId !== overId) {
                // Move to that column (preserve position for now, standard auto-sort handles placement)
                moveDeal(activeId, overId, activeDeal.position);
            }
        }
        // 2. Moving over another Deal
        else {
            const overDeal = deals.find(d => d.id === overId);
            if (overDeal && activeDeal.stageId !== overDeal.stageId) {
                // If crossing stages, adopt the new stage immediately for visual feedback
                moveDeal(activeId, overDeal.stageId, overDeal.position);
            }
            // Note: Intra-column reordering (same stage) is handled by dnd-kit's SortableContext?
            // Actually, for dnd-kit to show the gap properly, we often need arrayMove.
            // But changing stageId is the most critical visual feedback for the user (The "Blue Line" inverted issue).
        }
    }
}

export default KanbanBoard;
