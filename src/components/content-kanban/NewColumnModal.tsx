import React, { useState, useEffect } from 'react';
import { Columns3, Plus, X } from 'lucide-react';

interface NewColumnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateColumn: (name: string) => Promise<void>;
}

export function NewColumnModal({ isOpen, onClose, onCreateColumn }: NewColumnModalProps) {
    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            await onCreateColumn(name.trim());
            onClose();
        } catch (err: any) {
            alert(`Erro ao criar coluna: ${err?.message || 'Tenta novamente.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div
                className="bg-card text-card-foreground border border-border w-full max-w-sm rounded-2xl shadow-2xl p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <Columns3 size={18} className="text-primary" />
                        <h3 className="font-medium text-sm text-foreground">Nova Coluna</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Nome da Etapa
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: Em revisão, Roteiro aprovado..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={50}
                            className="bg-background text-foreground text-sm font-normal border border-border rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                            autoFocus
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
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
                            disabled={isSaving || !name.trim()}
                            className="px-4 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Plus size={14} />
                            <span>{isSaving ? 'A criar...' : 'Criar Coluna'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
