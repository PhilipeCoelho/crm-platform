import { useState } from 'react';
import { ContentColumn } from '@/types/contentKanban';
import { AlertTriangle, Trash2, ArrowRight } from 'lucide-react';

interface DeleteColumnModalProps {
    isOpen: boolean;
    column: ContentColumn | null;
    allColumns: ContentColumn[];
    cardCount: number;
    onClose: () => void;
    onConfirmDelete: (columnId: string, targetColumnId?: string) => Promise<void>;
}

export function DeleteColumnModal({
    isOpen,
    column,
    allColumns,
    cardCount,
    onClose,
    onConfirmDelete
}: DeleteColumnModalProps) {
    if (!isOpen || !column) return null;

    const isLastColumn = allColumns.length <= 1;
    const availableTargetColumns = allColumns.filter(c => c.id !== column.id);

    const [targetColumnId, setTargetColumnId] = useState<string>(
        availableTargetColumns[0]?.id || ''
    );
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        if (isLastColumn) return;
        setIsDeleting(true);
        try {
            if (cardCount > 0) {
                if (!targetColumnId) {
                    alert('Por favor, seleciona uma coluna de destino para os cartões.');
                    setIsDeleting(false);
                    return;
                }
                await onConfirmDelete(column.id, targetColumnId);
            } else {
                await onConfirmDelete(column.id);
            }
            onClose();
        } catch (e: any) {
            alert(`Erro ao eliminar coluna: ${e?.message || 'Tenta novamente.'}`);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-card text-card-foreground border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${isLastColumn ? 'bg-amber-500/10 text-amber-500' : 'bg-destructive/10 text-destructive'}`}>
                        <AlertTriangle size={22} />
                    </div>
                    <div>
                        <h3 className="text-base font-medium text-foreground">
                            {isLastColumn ? 'Não é possível eliminar a coluna' : `Eliminar coluna "${column.name}"?`}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 font-normal">
                            {isLastColumn
                                ? 'O quadro Kanban deve ter sempre pelo menos uma coluna ativa.'
                                : 'Esta ação irá remover a coluna do quadro de conteúdos.'}
                        </p>
                    </div>
                </div>

                {/* Content */}
                {!isLastColumn && cardCount > 0 && (
                    <div className="bg-muted/40 border border-border/70 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                            <span>Esta coluna contém</span>
                            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                                {cardCount} {cardCount === 1 ? 'conteúdo' : 'conteúdos'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-normal">
                            Para não perder os teus conteúdos, escolhe para qual coluna queres transferi-los antes de eliminar:
                        </p>

                        <div className="flex flex-col gap-1.5 mt-1">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                Coluna de Destino:
                            </label>
                            <select
                                value={targetColumnId}
                                onChange={(e) => setTargetColumnId(e.target.value)}
                                className="bg-background text-foreground text-xs font-normal border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40"
                            >
                                {availableTargetColumns.map((col) => (
                                    <option key={col.id} value={col.id}>
                                        {col.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {!isLastColumn && cardCount === 0 && (
                    <p className="text-xs text-muted-foreground font-normal">
                        Esta coluna está vazia e será removida com segurança.
                    </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                    >
                        {isLastColumn ? 'Fechar' : 'Cancelar'}
                    </button>

                    {!isLastColumn && (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isDeleting}
                            className="px-4 py-2 text-xs font-medium bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {cardCount > 0 ? (
                                <>
                                    <ArrowRight size={14} />
                                    <span>{isDeleting ? 'A transferir...' : 'Transferir e Eliminar'}</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 size={14} />
                                    <span>{isDeleting ? 'A eliminar...' : 'Eliminar Coluna'}</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
