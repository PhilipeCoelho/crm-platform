import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ContentCard } from '@/types/contentKanban';
import { Calendar, Trash2, Edit3, FileText, Check, AlertCircle, Clock } from 'lucide-react';
import { format, parseISO, startOfDay, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContentKanbanCardProps {
    card: ContentCard;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
    onToggleComplete?: (e: React.MouseEvent) => void;
}

export function ContentKanbanCardBase({
    card,
    onClick,
    onDelete,
    onToggleComplete,
    isOverlay = false
}: ContentKanbanCardProps & { isOverlay?: boolean }) {
    // Cálculo inteligente de prazo/atraso baseado na data de produção/vencimento
    const dueDateInfo = React.useMemo(() => {
        if (!card.dueDate) return null;
        try {
            const raw = card.dueDate.includes('T') ? card.dueDate : `${card.dueDate}T00:00:00`;
            const dueDay = startOfDay(parseISO(raw));
            const today = startOfDay(new Date());
            const diffDays = differenceInCalendarDays(dueDay, today);
            const dateStr = format(dueDay, "d 'de' MMM", { locale: ptBR });

            if (card.completed) {
                return {
                    label: dateStr,
                    subtext: 'Concluído',
                    isOverdue: false,
                    className: 'text-muted-foreground/60 bg-muted/40 border-border/40'
                };
            }

            if (diffDays < 0) {
                const daysLate = Math.abs(diffDays);
                return {
                    label: dateStr,
                    subtext: daysLate === 1 ? '1 dia de atraso' : `${daysLate} dias de atraso`,
                    isOverdue: true,
                    className: 'text-destructive bg-destructive/10 border-destructive/30 font-medium'
                };
            } else if (diffDays === 0) {
                return {
                    label: 'Hoje',
                    subtext: 'Produção hoje',
                    isOverdue: false,
                    className: 'text-amber-500 bg-amber-500/10 border-amber-500/30 font-medium'
                };
            } else if (diffDays === 1) {
                return {
                    label: dateStr,
                    subtext: 'Amanhã',
                    isOverdue: false,
                    className: 'text-primary bg-primary/10 border-primary/25 font-normal'
                };
            } else {
                return {
                    label: dateStr,
                    subtext: `em ${diffDays} dias`,
                    isOverdue: false,
                    className: 'text-muted-foreground bg-muted/40 border-border/50 font-normal'
                };
            }
        } catch {
            return null;
        }
    }, [card.dueDate, card.completed]);

    return (
        <div
            onClick={onClick}
            className={`
                group relative bg-card text-card-foreground border rounded-lg p-2.5
                shadow-xs hover:shadow-md transition-all duration-150 select-none
                flex flex-col gap-1.5 cursor-grab active:cursor-grabbing
                ${card.completed ? 'border-border/40 opacity-70 bg-muted/20' : 'border-border/70 hover:border-primary/40'}
                ${isOverlay ? 'shadow-2xl ring-2 ring-primary/40 rotate-1 scale-[1.02] cursor-grabbing' : ''}
            `}
        >
            {/* Header: Caixa de Seleção + Título e Lixeira Rápida */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                    {/* Caixa de Seleção antes do conteúdo */}
                    <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleComplete?.(e);
                        }}
                        className={`
                            mt-0.5 w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-all duration-150 cursor-pointer
                            ${card.completed
                                ? 'bg-primary border-primary text-primary-foreground shadow-xs'
                                : 'border-muted-foreground/45 hover:border-primary bg-background hover:bg-primary/5'}
                        `}
                        title={card.completed ? "Desmarcar para reexibir na lista" : "Marcar como concluído"}
                    >
                        {card.completed && <Check size={10} strokeWidth={3} />}
                    </button>

                    <h4 className={`font-normal text-xs sm:text-[13px] text-foreground line-clamp-2 leading-snug tracking-normal pointer-events-none ${
                        card.completed ? 'line-through text-muted-foreground/60' : ''
                    }`}>
                        {card.title}
                    </h4>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(e);
                        }}
                        className="p-0.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                        title="Eliminar conteúdo"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Description preview se houver */}
            {card.description && card.description.trim().length > 0 && (
                <div className="flex items-start gap-1 text-[11px] text-muted-foreground pointer-events-none pl-4.5">
                    <FileText size={11} className="shrink-0 mt-0.5 opacity-60" />
                    <p className="line-clamp-2 text-[11px] leading-snug break-words">
                        {card.description}
                    </p>
                </div>
            )}

            {/* Footer: Exibição da Data de Produção / Vencimento (apenas se definida) */}
            {dueDateInfo ? (
                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] pointer-events-none pl-4.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${dueDateInfo.className}`}>
                        {dueDateInfo.isOverdue ? (
                            <AlertCircle size={10} className="shrink-0 text-destructive" />
                        ) : dueDateInfo.label === 'Hoje' ? (
                            <Clock size={10} className="shrink-0 opacity-80" />
                        ) : (
                            <Calendar size={10} className="shrink-0 opacity-75" />
                        )}
                        <span>{dueDateInfo.label}</span>
                        {dueDateInfo.subtext && (
                            <span className="opacity-80 text-[9.5px]">({dueDateInfo.subtext})</span>
                        )}
                    </span>

                    <span className="text-[9.5px] font-medium opacity-0 group-hover:opacity-100 text-primary transition-opacity flex items-center gap-1">
                        <Edit3 size={9} />
                        Editar
                    </span>
                </div>
            ) : (
                <div className="flex items-center justify-end text-[9.5px] text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none pr-0.5">
                    <span className="flex items-center gap-1 font-medium">
                        <Edit3 size={9} />
                        Editar
                    </span>
                </div>
            )}
        </div>
    );
}

export function ContentKanbanCard({ card, onClick, onDelete, onToggleComplete }: ContentKanbanCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: card.id,
        data: {
            type: 'Card',
            card
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="touch-none"
        >
            <ContentKanbanCardBase
                card={card}
                onClick={onClick}
                onDelete={onDelete}
                onToggleComplete={onToggleComplete}
            />
        </div>
    );
}
