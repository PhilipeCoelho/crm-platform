import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ContentColumn, ContentCard } from '@/types/contentKanban';
import { ContentKanbanCard } from './ContentKanbanCard';
import { Plus, MoreHorizontal, ArrowLeft, ArrowRight, Edit2, Trash2, Check, X } from 'lucide-react';

interface ContentKanbanColumnProps {
    column: ContentColumn;
    cards: ContentCard[];
    isFirst: boolean;
    isLast: boolean;
    onAddCard: (columnId: string) => void;
    onEditCard: (card: ContentCard) => void;
    onDeleteCard: (card: ContentCard) => void;
    onToggleCardComplete: (cardId: string) => void;
    onRenameColumn: (columnId: string, newName: string) => void;
    onMoveColumnLeft: (columnId: string) => void;
    onMoveColumnRight: (columnId: string) => void;
    onRequestDeleteColumn: (column: ContentColumn) => void;
}

export function ContentKanbanColumn({
    column,
    cards,
    isFirst,
    isLast,
    onAddCard,
    onEditCard,
    onDeleteCard,
    onToggleCardComplete,
    onRenameColumn,
    onMoveColumnLeft,
    onMoveColumnRight,
    onRequestDeleteColumn
}: ContentKanbanColumnProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState(column.name);
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
        data: {
            type: 'Column',
            column
        }
    });

    const cardIds = React.useMemo(() => cards.map(c => c.id), [cards]);

    useEffect(() => {
        setTitleInput(column.name);
    }, [column.name]);

    useEffect(() => {
        if (isEditingTitle && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditingTitle]);

    // Fechar menu ao clicar fora
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const handleSaveTitle = () => {
        const trimmed = titleInput.trim();
        if (trimmed && trimmed !== column.name) {
            onRenameColumn(column.id, trimmed);
        } else {
            setTitleInput(column.name);
        }
        setIsEditingTitle(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveTitle();
        } else if (e.key === 'Escape') {
            setTitleInput(column.name);
            setIsEditingTitle(false);
        }
    };

    return (
        <div
            ref={setNodeRef}
            className={`
                group/col flex flex-col h-full min-w-[240px] w-[75vw] sm:w-[270px] sm:min-w-[270px] shrink-0
                bg-secondary/20 dark:bg-muted/10 border border-border/60 rounded-xl transition-all duration-200
                ${isOver ? 'bg-primary/[0.06] ring-2 ring-primary/30 border-primary/40' : ''}
            `}
        >
            {/* Header da Coluna com Nome, Contador, Botão "+" e Botão "..." */}
            <div className="p-2.5 pb-1.5 flex flex-col gap-1.5 shrink-0 border-b border-border/40">
                <div className="flex items-center justify-between gap-1.5">
                    {isEditingTitle ? (
                        <div className="flex items-center gap-1 w-full animate-in fade-in duration-150">
                            <input
                                ref={inputRef}
                                type="text"
                                value={titleInput}
                                onChange={(e) => setTitleInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleSaveTitle}
                                className="w-full text-xs font-medium bg-background text-foreground px-2 py-0.5 rounded border border-primary outline-none shadow-xs"
                                maxLength={50}
                            />
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSaveTitle();
                                }}
                                className="p-0.5 text-primary hover:bg-primary/10 rounded transition-colors"
                                title="Guardar nome"
                            >
                                <Check size={13} />
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setTitleInput(column.name);
                                    setIsEditingTitle(false);
                                }}
                                className="p-0.5 text-muted-foreground hover:bg-muted rounded transition-colors"
                                title="Cancelar"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <div
                                onClick={() => setIsEditingTitle(true)}
                                className="flex items-center gap-1 cursor-pointer group/title min-w-0"
                                title="Clica para alterar o nome da coluna"
                            >
                                <h3 className="font-medium text-xs text-foreground tracking-tight truncate group-hover/title:text-primary transition-colors uppercase">
                                    {column.name}
                                </h3>
                                <Edit2
                                    size={11}
                                    className="text-muted-foreground/40 opacity-0 group-hover/col:opacity-100 group-hover/title:text-primary transition-all shrink-0"
                                />
                            </div>
                            <span className="text-[10px] font-medium text-muted-foreground bg-muted/80 dark:bg-muted px-1.5 py-0.2 rounded-full shrink-0">
                                {cards.length}
                            </span>
                        </div>
                    )}

                    {/* Botão "+" e Botão "..." lado a lado à frente do nome da coluna */}
                    <div className="flex items-center gap-0.5 shrink-0" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => onAddCard(column.id)}
                            className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors border border-transparent hover:border-primary/20"
                            title="Adicionar conteúdo a esta coluna"
                        >
                            <Plus size={14} strokeWidth={2.5} />
                        </button>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                                title="Opções da coluna"
                            >
                                <MoreHorizontal size={14} />
                            </button>

                            {isMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-popover text-popover-foreground border border-border shadow-xl rounded-xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            setIsEditingTitle(true);
                                        }}
                                        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted transition-colors"
                                    >
                                        <Edit2 size={12} className="text-muted-foreground" />
                                        <span>Alterar nome</span>
                                    </button>

                                    {!isFirst && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                onMoveColumnLeft(column.id);
                                            }}
                                            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted transition-colors"
                                        >
                                            <ArrowLeft size={12} className="text-muted-foreground" />
                                            <span>Mover para a esquerda</span>
                                        </button>
                                    )}

                                    {!isLast && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                onMoveColumnRight(column.id);
                                            }}
                                            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-muted transition-colors"
                                        >
                                            <ArrowRight size={12} className="text-muted-foreground" />
                                            <span>Mover para a direita</span>
                                        </button>
                                    )}

                                    <div className="my-1 border-t border-border/50" />

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            onRequestDeleteColumn(column);
                                        }}
                                        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors font-medium"
                                    >
                                        <Trash2 size={12} />
                                        <span>Eliminar coluna</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Linha decorativa no topo */}
                <div className="h-[2px] w-full rounded-full bg-primary/30" />
            </div>

            {/* Lista de Cartões (Scroll Vertical Interno) */}
            <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-[140px]">
                <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
                    {cards.map((card) => (
                        <ContentKanbanCard
                            key={card.id}
                            card={card}
                            onClick={() => onEditCard(card)}
                            onDelete={(e) => {
                                e.stopPropagation();
                                onDeleteCard(card);
                            }}
                            onToggleComplete={() => onToggleCardComplete(card.id)}
                        />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
}
