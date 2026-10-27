import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { ContentColumn, ContentCard } from '@/types/contentKanban';
import { contentKanbanService } from '@/services/contentKanbanService';
import { ContentKanbanColumn } from '@/components/content-kanban/ContentKanbanColumn';
import { ContentKanbanCardBase } from '@/components/content-kanban/ContentKanbanCard';
import { ContentCardModal } from '@/components/content-kanban/ContentCardModal';
import { NewColumnModal } from '@/components/content-kanban/NewColumnModal';
import { DeleteColumnModal } from '@/components/content-kanban/DeleteColumnModal';
import {
    Plus,
    Search,
    Loader2,
    Sparkles,
    Columns3,
    AlertCircle,
    CheckCircle2,
    CheckSquare,
    Eye,
    Lightbulb,
    Film,
    Bookmark,
    Wand2
} from 'lucide-react';
import { ContentIdeasArea } from '@/components/content-intelligence/ContentIdeasArea';
import { ContentReferencesArea } from '@/components/content-intelligence/ContentReferencesArea';
import { ContentHookLibrary } from '@/components/content-intelligence/ContentHookLibrary';
import { ContentIdeaImproverArea } from '@/components/content-intelligence/ContentIdeaImproverArea';

export type ContentSubArea = 'kanban' | 'melhorador' | 'ideias' | 'reels' | 'ganchos';

export default function ContentKanban() {
    const { user } = useSupabaseAuth();
    const userId = user?.id || '';

    const [columns, setColumns] = useState<ContentColumn[]>([]);
    const [cards, setCards] = useState<ContentCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Navegação nas 4 Áreas Funcionais Integradas
    const [activeArea, setActiveArea] = useState<ContentSubArea>(() => {
        const saved = localStorage.getItem('vamuss_content_active_area');
        return (saved as ContentSubArea) || 'kanban';
    });

    const handleSelectArea = (area: ContentSubArea) => {
        setActiveArea(area);
        localStorage.setItem('vamuss_content_active_area', area);
        if (area === 'kanban') {
            loadBoardData();
        }
    };

    // Filtros e busca
    const [searchTerm, setSearchTerm] = useState('');

    // Controle de conteúdos concluídos (por padrão oculta)
    const [hideCompleted, setHideCompleted] = useState<boolean>(() => {
        const saved = localStorage.getItem('vamuss_content_hide_completed');
        return saved !== null ? saved === 'true' : true;
    });

    const toggleHideCompleted = () => {
        setHideCompleted(prev => {
            const next = !prev;
            localStorage.setItem('vamuss_content_hide_completed', String(next));
            return next;
        });
    };

    // Modais
    const [isNewColumnModalOpen, setIsNewColumnModalOpen] = useState(false);
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [selectedCardForModal, setSelectedCardForModal] = useState<ContentCard | null>(null);
    const [targetColumnForNewCard, setTargetColumnForNewCard] = useState<string>('');

    // Modal de eliminação de coluna
    const [columnToDelete, setColumnToDelete] = useState<ContentColumn | null>(null);
    const [isDeleteColumnModalOpen, setIsDeleteColumnModalOpen] = useState(false);

    // Drag and Drop State
    const [activeCard, setActiveCard] = useState<ContentCard | null>(null);

    // Toast de Notificação
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => {
            setNotification(null);
        }, 3000);
    }, []);

    // Configuração dos sensores do Dnd-kit (5px de movimento para iniciar drag)
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    // Carregamento inicial de dados
    const loadBoardData = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await contentKanbanService.loadData(userId);
            setColumns(result.columns);
            setCards(result.cards);
        } catch (err: any) {
            console.error('[ContentKanban] Erro ao carregar dados:', err);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadBoardData();
    }, [loadBoardData]);

    // Quantidade total de conteúdos concluídos
    const completedCardsCount = useMemo(() => {
        return cards.filter(c => c.completed).length;
    }, [cards]);

    // Filtro de cartões por busca e por status de conclusão
    const filteredCards = useMemo(() => {
        return cards.filter(c => {
            // Se hideCompleted estiver ativado e o cartão for concluído, oculta da lista
            if (hideCompleted && c.completed) {
                return false;
            }
            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase();
            return (
                c.title.toLowerCase().includes(term) ||
                (c.description && c.description.toLowerCase().includes(term))
            );
        });
    }, [cards, searchTerm, hideCompleted]);

    // Mapeamento de cartões por coluna com proteção total contra cartões órfãos
    const cardsByColumn = useMemo(() => {
        const map: Record<string, ContentCard[]> = {};
        columns.forEach(col => {
            map[col.id] = [];
        });

        const validColIds = new Set(columns.map(c => c.id));
        const fallbackColId = columns[0]?.id;

        filteredCards.forEach(card => {
            const targetColId = validColIds.has(card.columnId) ? card.columnId : fallbackColId;
            if (targetColId && map[targetColId]) {
                map[targetColId].push(card);
            }
        });

        // Ordenar cartões por orderIndex
        Object.keys(map).forEach(colId => {
            map[colId].sort((a, b) => a.orderIndex - b.orderIndex);
        });

        return map;
    }, [columns, filteredCards]);

    // ==========================================
    // OPERAÇÕES DE COLUNA
    // ==========================================

    const handleCreateColumn = async (name: string) => {
        try {
            const nextOrderIndex = columns.length;
            const newCol = await contentKanbanService.createColumn(userId, name, nextOrderIndex, cards, columns);
            setColumns(prev => [...prev, newCol]);
            showNotification(`Coluna "${name}" criada e salva!`);
        } catch (err: any) {
            showNotification(err?.message || 'Falha ao criar coluna', 'error');
            throw err;
        }
    };

    const handleRenameColumn = async (columnId: string, newName: string) => {
        const updated = columns.map(c => c.id === columnId ? { ...c, name: newName } : c);
        setColumns(updated);
        await contentKanbanService.updateColumnName(columnId, newName, columns, cards, userId);
        showNotification('Nome da coluna atualizado e salvo');
    };

    const handleMoveColumn = async (columnId: string, direction: 'left' | 'right') => {
        const index = columns.findIndex(c => c.id === columnId);
        if (index === -1) return;
        const targetIndex = direction === 'left' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= columns.length) return;

        const updated = arrayMove(columns, index, targetIndex).map((col, idx) => ({
            ...col,
            orderIndex: idx
        }));
        setColumns(updated);
        await contentKanbanService.reorderColumns(updated.map(c => ({ id: c.id, orderIndex: c.orderIndex })), updated, cards, userId);
    };

    const handleRequestDeleteColumn = (col: ContentColumn) => {
        setColumnToDelete(col);
        setIsDeleteColumnModalOpen(true);
    };

    const handleConfirmDeleteColumn = async (columnId: string, targetColumnId?: string) => {
        let updatedCards = cards;
        if (targetColumnId) {
            updatedCards = cards.map(c => c.columnId === columnId ? { ...c, columnId: targetColumnId } : c);
            setCards(updatedCards);
        }
        const updatedCols = columns.filter(c => c.id !== columnId).map((col, idx) => ({ ...col, orderIndex: idx }));
        setColumns(updatedCols);

        await contentKanbanService.deleteColumn(columnId, targetColumnId, columns, cards, userId);
        showNotification('Coluna eliminada');
    };

    // ==========================================
    // OPERAÇÕES DE CARTÃO
    // ==========================================

    const handleOpenNewCardModal = (columnId?: string) => {
        setSelectedCardForModal(null);
        setTargetColumnForNewCard(columnId || columns[0]?.id || '');
        setIsCardModalOpen(true);
    };

    const handleOpenEditCardModal = (card: ContentCard) => {
        setSelectedCardForModal(card);
        setTargetColumnForNewCard(card.columnId);
        setIsCardModalOpen(true);
    };

    const handleSaveCard = async (data: { id?: string; title: string; description: string; columnId: string; completed?: boolean; dueDate?: string }) => {
        if (data.id) {
            // Edição
            const updated = cards.map(c => c.id === data.id ? {
                ...c,
                title: data.title,
                description: data.description,
                columnId: data.columnId,
                completed: data.completed !== undefined ? data.completed : c.completed,
                dueDate: data.dueDate !== undefined ? data.dueDate : c.dueDate,
                updatedAt: new Date().toISOString()
            } : c);
            setCards(updated);

            await contentKanbanService.updateCard(data.id, {
                title: data.title,
                description: data.description,
                columnId: data.columnId,
                completed: data.completed,
                dueDate: data.dueDate
            }, columns, updated, userId);

            showNotification('Conteúdo atualizado e salvo');
        } else {
            // Criação
            const colCards = cardsByColumn[data.columnId] || [];
            const nextOrder = colCards.length;

            const newCard = await contentKanbanService.createCard(userId, {
                columnId: data.columnId,
                title: data.title,
                description: data.description,
                completed: data.completed ?? false,
                dueDate: data.dueDate,
                orderIndex: nextOrder
            }, columns, cards);

            setCards(prev => [...prev, newCard]);
            showNotification('Conteúdo adicionado e salvo!');
        }
    };

    const handleToggleCardComplete = async (cardId: string) => {
        const updated = await contentKanbanService.toggleCardCompleted(cardId, columns, cards, userId);
        setCards(updated);
        const target = updated.find(c => c.id === cardId);
        if (target?.completed) {
            showNotification('Conteúdo concluído e ocultado da lista');
        } else {
            showNotification('Conteúdo reativado na lista');
        }
    };

    const handleDeleteCard = async (cardId: string) => {
        setCards(prev => prev.filter(c => c.id !== cardId));
        await contentKanbanService.deleteCard(cardId, columns, cards, userId);
        showNotification('Conteúdo eliminado');
    };

    // ==========================================
    // DRAG AND DROP HANDLERS
    // ==========================================

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const card = cards.find(c => c.id === active.id);
        if (card) {
            setActiveCard(card);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        const activeCardItem = cards.find(c => c.id === activeId);
        if (!activeCardItem) return;

        const isOverColumn = columns.some(c => c.id === overId);
        const overCardItem = cards.find(c => c.id === overId);

        let targetColId = activeCardItem.columnId;

        if (isOverColumn) {
            targetColId = overId;
        } else if (overCardItem) {
            targetColId = overCardItem.columnId;
        }

        if (activeCardItem.columnId !== targetColId) {
            setCards(prevCards => {
                const targetCards = prevCards.filter(c => c.columnId === targetColId);
                const newOrderIndex = overCardItem
                    ? overCardItem.orderIndex
                    : targetCards.length;

                return prevCards.map(c => {
                    if (c.id === activeId) {
                        return { ...c, columnId: targetColId, orderIndex: newOrderIndex };
                    }
                    return c;
                });
            });
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveCard(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const activeCardItem = cards.find(c => c.id === activeId);
        if (!activeCardItem) return;

        const isOverColumn = columns.some(c => c.id === overId);
        const overCardItem = cards.find(c => c.id === overId);

        const targetColumnId = isOverColumn ? overId : overCardItem?.columnId || activeCardItem.columnId;

        const colCards = cards
            .filter(c => c.columnId === targetColumnId && c.id !== activeId)
            .sort((a, b) => a.orderIndex - b.orderIndex);

        let newCardsInCol: ContentCard[] = [];

        if (isOverColumn || !overCardItem) {
            newCardsInCol = [...colCards, { ...activeCardItem, columnId: targetColumnId }];
        } else {
            const overIndex = colCards.findIndex(c => c.id === overId);
            const insertIndex = overIndex >= 0 ? overIndex : colCards.length;
            newCardsInCol = [...colCards];
            newCardsInCol.splice(insertIndex, 0, { ...activeCardItem, columnId: targetColumnId });
        }

        const cardOrdersToUpdate: { id: string; columnId: string; orderIndex: number }[] = [];
        const finalColCards = newCardsInCol.map((c, idx) => {
            cardOrdersToUpdate.push({ id: c.id, columnId: targetColumnId, orderIndex: idx });
            return { ...c, orderIndex: idx, columnId: targetColumnId };
        });

        const otherCards = cards.filter(c => c.columnId !== targetColumnId && c.id !== activeId);
        const updatedAllCards = [...otherCards, ...finalColCards];

        setCards(updatedAllCards);
        await contentKanbanService.reorderCards(cardOrdersToUpdate, columns, updatedAllCards, userId);
    };

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
            {/* Topbar Compacta: Título e Navegação nas 4 Áreas Funcionais */}
            <div className="px-4 py-2 sm:px-5 sm:py-2.5 border-b border-border/60 bg-card/60 backdrop-blur-sm shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Sparkles size={15} />
                        </div>
                        <h1 className="text-base sm:text-lg font-medium tracking-tight text-foreground">
                            Conteúdo
                        </h1>
                    </div>

                    <span className="hidden xl:inline text-border/80">|</span>

                    {/* Selector de Abas das 4 Áreas Funcionais Integradas */}
                    <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 shrink-0">
                        <button
                            type="button"
                            onClick={() => handleSelectArea('kanban')}
                            className={`h-7 px-2.5 rounded-md text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                activeArea === 'kanban'
                                    ? 'bg-background text-foreground font-medium shadow-2xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Columns3 size={13} />
                            <span>Kanban</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSelectArea('melhorador')}
                            className={`h-7 px-2.5 rounded-md text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                activeArea === 'melhorador'
                                    ? 'bg-background text-foreground font-medium shadow-2xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Wand2 size={13} className="text-primary" />
                            <span>Melhorador de Ideias</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSelectArea('ideias')}
                            className={`h-7 px-2.5 rounded-md text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                activeArea === 'ideias'
                                    ? 'bg-background text-foreground font-medium shadow-2xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Lightbulb size={13} />
                            <span>Ideias Próprias</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSelectArea('reels')}
                            className={`h-7 px-2.5 rounded-md text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                activeArea === 'reels'
                                    ? 'bg-background text-foreground font-medium shadow-2xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Film size={13} />
                            <span>Reels & Referências</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSelectArea('ganchos')}
                            className={`h-7 px-2.5 rounded-md text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                activeArea === 'ganchos'
                                    ? 'bg-background text-foreground font-medium shadow-2xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Bookmark size={13} />
                            <span>Ganchos</span>
                        </button>
                    </div>
                </div>

                {/* Ações Contextuais da Topbar (Exibidas no Kanban) */}
                {activeArea === 'kanban' ? (
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                        {/* Campo de Busca Rápida */}
                        <div className="relative flex-1 sm:w-44">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar no kanban..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background text-foreground text-xs font-normal pl-7.5 pr-2.5 h-8 rounded-lg border border-border focus:ring-1.5 focus:ring-primary/40 focus:border-primary outline-none transition-all"
                            />
                        </div>

                        {/* Botão de Alternar Visualização de Concluídas */}
                        <button
                            type="button"
                            onClick={toggleHideCompleted}
                            className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                                hideCompleted
                                    ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border/80'
                                    : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                            }`}
                            title={hideCompleted ? "Mostrar conteúdos concluídos" : "Esconder conteúdos concluídos"}
                        >
                            {hideCompleted ? <CheckSquare size={13} className="text-primary" /> : <Eye size={13} />}
                            <span className="hidden sm:inline text-xs">
                                {hideCompleted ? 'Esconder concluídas' : 'A mostrar concluídas'}
                            </span>
                            {completedCardsCount > 0 && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-muted dark:bg-muted/80 text-muted-foreground">
                                    {completedCardsCount}
                                </span>
                            )}
                        </button>

                        {/* Botão Adicionar Coluna */}
                        <button
                            type="button"
                            onClick={() => setIsNewColumnModalOpen(true)}
                            className="h-8 px-2.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border/80 transition-all shadow-2xs cursor-pointer"
                            title="Adicionar nova etapa ao processo"
                        >
                            <Columns3 size={13} />
                            <span className="hidden sm:inline text-xs">Nova Coluna</span>
                        </button>

                        {/* Botão Adicionar Novo Conteúdo */}
                        <button
                            type="button"
                            onClick={() => handleOpenNewCardModal()}
                            disabled={columns.length === 0}
                            className="h-8 px-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                            title="Criar novo cartão de conteúdo"
                        >
                            <Plus size={14} />
                            <span>Novo Conteúdo</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleSelectArea('kanban')}
                            className="h-8 px-3 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5"
                        >
                            <Columns3 size={13} />
                            <span>Voltar ao Kanban</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Toast Flutuante de Notificação */}
            {notification && (
                <div className={`fixed bottom-4 right-4 z-[100] px-3.5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2 fade-in duration-200 border ${
                    notification.type === 'error'
                        ? 'bg-destructive text-destructive-foreground border-destructive/30'
                        : 'bg-primary text-primary-foreground border-primary/30'
                }`}>
                    {notification.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Renderização Condicional da Área Ativa */}
            {activeArea === 'melhorador' && (
                <div className="flex-1 w-full h-full overflow-hidden">
                    <ContentIdeaImproverArea userId={userId} onGoToKanban={() => handleSelectArea('kanban')} />
                </div>
            )}

            {activeArea === 'ideias' && (
                <div className="flex-1 w-full h-full overflow-hidden">
                    <ContentIdeasArea userId={userId} onGoToKanban={() => handleSelectArea('kanban')} />
                </div>
            )}

            {activeArea === 'reels' && (
                <div className="flex-1 w-full h-full overflow-hidden">
                    <ContentReferencesArea userId={userId} onGoToKanban={() => handleSelectArea('kanban')} />
                </div>
            )}

            {activeArea === 'ganchos' && (
                <div className="flex-1 w-full h-full overflow-hidden">
                    <ContentHookLibrary userId={userId} />
                </div>
            )}

            {activeArea === 'kanban' && (
                <div className="flex-1 w-full h-full overflow-hidden p-2.5 sm:p-3 sm:px-4 bg-transparent relative">
                {isLoading ? (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-7 h-7 animate-spin text-primary" />
                        <span className="text-xs font-medium">A carregar conteúdos...</span>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        {/* Container de Scroll Horizontal Suave */}
                        <div className="h-full w-full overflow-x-auto overflow-y-hidden pb-2 custom-scrollbar">
                            <div className="flex h-full min-w-max gap-2.5 sm:gap-3 pr-4">
                                {columns.map((col, index) => (
                                    <ContentKanbanColumn
                                        key={col.id}
                                        column={col}
                                        cards={cardsByColumn[col.id] || []}
                                        isFirst={index === 0}
                                        isLast={index === columns.length - 1}
                                        onAddCard={handleOpenNewCardModal}
                                        onEditCard={handleOpenEditCardModal}
                                        onDeleteCard={(c) => handleDeleteCard(c.id)}
                                        onToggleCardComplete={handleToggleCardComplete}
                                        onRenameColumn={handleRenameColumn}
                                        onMoveColumnLeft={(id) => handleMoveColumn(id, 'left')}
                                        onMoveColumnRight={(id) => handleMoveColumn(id, 'right')}
                                        onRequestDeleteColumn={handleRequestDeleteColumn}
                                    />
                                ))}

                                {/* Botão Rápido "+ Nova Coluna" no final do Quadro Compacto */}
                                <div className="h-full min-w-[130px] w-[130px] flex items-center justify-center shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setIsNewColumnModalOpen(true)}
                                        className="w-full h-24 border border-dashed border-border/70 hover:border-primary/60 text-muted-foreground hover:text-primary rounded-xl flex flex-col items-center justify-center gap-1.5 p-3 transition-all group cursor-pointer bg-muted/10 hover:bg-primary/5"
                                        title="Adicionar nova coluna"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            <Plus size={13} />
                                        </div>
                                        <span className="text-[11px] font-bold">Nova Coluna</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Drag Overlay para o Cartão em Movimento */}
                        <DragOverlay>
                            {activeCard ? (
                                <div className="w-[270px]">
                                    <ContentKanbanCardBase
                                        card={activeCard}
                                        onClick={() => {}}
                                        onDelete={() => {}}
                                        isOverlay={true}
                                    />
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>
            )}

            {/* Modais do Sistema */}
            <NewColumnModal
                isOpen={isNewColumnModalOpen}
                onClose={() => setIsNewColumnModalOpen(false)}
                onCreateColumn={handleCreateColumn}
            />

            <ContentCardModal
                isOpen={isCardModalOpen}
                card={selectedCardForModal}
                defaultColumnId={targetColumnForNewCard}
                columns={columns}
                onClose={() => {
                    setIsCardModalOpen(false);
                    setSelectedCardForModal(null);
                }}
                onSave={handleSaveCard}
                onDelete={handleDeleteCard}
            />

            <DeleteColumnModal
                isOpen={isDeleteColumnModalOpen}
                column={columnToDelete}
                allColumns={columns}
                cardCount={columnToDelete ? (cardsByColumn[columnToDelete.id]?.length || 0) : 0}
                onClose={() => {
                    setIsDeleteColumnModalOpen(false);
                    setColumnToDelete(null);
                }}
                onConfirmDelete={handleConfirmDeleteColumn}
            />
        </div>
    );
}
