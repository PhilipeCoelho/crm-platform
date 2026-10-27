import React, { useState, useEffect } from 'react';
import { ContentCard, ContentColumn } from '@/types/contentKanban';
import { X, Trash2, Calendar, FileText, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContentCardModalProps {
    isOpen: boolean;
    card: ContentCard | null;
    defaultColumnId: string;
    columns: ContentColumn[];
    onClose: () => void;
    onSave: (data: { id?: string; title: string; description: string; columnId: string; completed?: boolean; dueDate?: string }) => Promise<void>;
    onDelete?: (cardId: string) => Promise<void>;
}

export function ContentCardModal({
    isOpen,
    card,
    defaultColumnId,
    columns,
    onClose,
    onSave,
    onDelete
}: ContentCardModalProps) {
    if (!isOpen) return null;

    const isEditMode = !!card;

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [columnId, setColumnId] = useState('');
    const [completed, setCompleted] = useState(false);
    const [dueDate, setDueDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    useEffect(() => {
        if (card) {
            setTitle(card.title || '');
            setDescription(card.description || '');
            setColumnId(card.columnId || defaultColumnId || columns[0]?.id || '');
            setCompleted(!!card.completed);
            setDueDate(card.dueDate ? card.dueDate.slice(0, 10) : '');
        } else {
            setTitle('');
            setDescription('');
            setColumnId(defaultColumnId || columns[0]?.id || '');
            setCompleted(false);
            setDueDate('');
        }
        setIsConfirmingDelete(false);
    }, [card, defaultColumnId, columns, isOpen]);

    const formattedCreationDate = React.useMemo(() => {
        if (!card?.createdAt) return null;
        try {
            const date = parseISO(card.createdAt);
            return format(date, "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
        } catch {
            return null;
        }
    }, [card?.createdAt]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            alert('Por favor, indica um título para o conteúdo.');
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                id: card?.id,
                title: title.trim(),
                description: description.trim(),
                columnId: columnId || columns[0]?.id,
                completed,
                dueDate: dueDate || undefined
            });
            onClose();
        } catch (err: any) {
            alert(`Erro ao guardar conteúdo: ${err?.message || 'Tenta novamente.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!card?.id || !onDelete) return;
        setIsSaving(true);
        try {
            await onDelete(card.id);
            onClose();
        } catch (err: any) {
            alert(`Erro ao eliminar conteúdo: ${err?.message || 'Tenta novamente.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div
                className="bg-card text-card-foreground border border-border w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText size={18} className="text-primary" />
                        <h3 className="font-medium text-base text-foreground">
                            {isEditMode ? 'Detalhes do Conteúdo' : 'Novo Conteúdo'}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        title="Fechar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto p-6 gap-4 custom-scrollbar">
                    {/* Título */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Título do Conteúdo <span className="text-destructive">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: 5 erros comuns ao escalar vendas outbound"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-background text-foreground text-sm font-normal border border-border rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Coluna / Etapa */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Etapa do Processo
                        </label>
                        <select
                            value={columnId}
                            onChange={(e) => setColumnId(e.target.value)}
                            className="bg-background text-foreground text-sm font-normal border border-border rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                        >
                            {columns.map((col) => (
                                <option key={col.id} value={col.id}>
                                    {col.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Data de Produção / Vencimento (Opcional) */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar size={13} className="text-primary" />
                                Data de Produção / Vencimento
                            </label>
                            <span className="text-[11px] text-muted-foreground font-normal">Opcional</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="flex-1 bg-background text-foreground text-sm font-medium border border-border rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                            />
                            {dueDate && (
                                <button
                                    type="button"
                                    onClick={() => setDueDate('')}
                                    className="px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-xl transition-colors shrink-0"
                                    title="Remover data de vencimento"
                                >
                                    Limpar data
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Se definida, calcula automaticamente o tempo de atraso ou prazo previsto para a gravação/produção. Pode ficar em branco.
                        </p>
                    </div>

                    {/* Status de Conclusão */}
                    <div className="flex items-center gap-2 pt-0.5">
                        <label className="flex items-center gap-2 text-xs font-normal text-foreground cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={completed}
                                onChange={(e) => setCompleted(e.target.checked)}
                                className="w-4 h-4 rounded text-primary focus:ring-primary/40 border-border cursor-pointer"
                            />
                            <span>Marcar conteúdo como concluído</span>
                        </label>
                    </div>

                    {/* Descrição / Notas */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Descrição, Notas ou Referências
                        </label>
                        <textarea
                            rows={5}
                            placeholder="Adiciona detalhes, ganchos, referências, pontos-chave ou notas de produção..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-background text-foreground text-sm font-normal border border-border rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-y custom-scrollbar"
                        />
                    </div>

                    {/* Data de Criação (se em modo de edição) */}
                    {isEditMode && formattedCreationDate && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/80 pt-2 border-t border-border/40">
                            <Calendar size={13} className="shrink-0 opacity-70" />
                            <span>Criado em: <strong className="text-foreground font-medium">{formattedCreationDate}</strong></span>
                        </div>
                    )}

                    {/* Confirmação de exclusão dentro do modal */}
                    {isConfirmingDelete && (
                        <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
                            <span className="text-destructive font-medium">
                                Tens a certeza de que queres eliminar este conteúdo?
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isSaving}
                                    className="px-3 py-1 bg-destructive text-destructive-foreground font-medium rounded-lg text-xs hover:bg-destructive/90 transition-all shadow-sm"
                                >
                                    Sim, eliminar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsConfirmingDelete(false)}
                                    className="px-2.5 py-1 text-muted-foreground hover:bg-muted rounded-lg text-xs"
                                >
                                    Não
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto shrink-0">
                        <div>
                            {isEditMode && !isConfirmingDelete && (
                                <button
                                    type="button"
                                    onClick={() => setIsConfirmingDelete(true)}
                                    className="px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors flex items-center gap-1.5"
                                >
                                    <Trash2 size={14} />
                                    <span>Eliminar</span>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-5 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <Check size={14} />
                                <span>{isSaving ? 'A guardar...' : isEditMode ? 'Guardar Alterações' : 'Criar Conteúdo'}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
