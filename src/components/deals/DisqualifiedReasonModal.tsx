import { useState } from 'react';
import { X } from 'lucide-react';

interface DisqualifiedReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

const PREDEFINED_REASONS = [
    'Sem orçamento',
    'Fora do perfil',
    'Não respondeu',
    'Timing incorreto',
    'Lead inválido',
];

export default function DisqualifiedReasonModal({ isOpen, onClose, onConfirm }: DisqualifiedReasonModalProps) {
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [customReason, setCustomReason] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        const finalReason = selectedReason === 'Outro' || !selectedReason ? customReason : selectedReason;
        if (!finalReason.trim()) {
            alert('Por favor, informe o motivo da desqualificação.');
            return;
        }
        onConfirm(finalReason);
        // Reset state for next use
        setSelectedReason(null);
        setCustomReason('');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-background w-full max-w-md rounded-t-[24px] sm:rounded-2xl shadow-2xl border-t sm:border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-foreground">Desqualificar Negócio</h2>
                            <p className="text-sm text-muted-foreground">Selecione o motivo da desqualificação (obrigatório)</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors hidden sm:block">
                            <X size={20} className="text-muted-foreground" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {PREDEFINED_REASONS.map((r) => (
                            <button
                                key={r}
                                onClick={() => setSelectedReason(r)}
                                className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left ${selectedReason === r
                                        ? 'bg-primary/10 border-primary text-primary shadow-sm'
                                        : 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted'
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                        <button
                            onClick={() => setSelectedReason('Outro')}
                            className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left ${selectedReason === 'Outro'
                                    ? 'bg-primary/10 border-primary text-primary shadow-sm'
                                    : 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted'
                                }`}
                        >
                            Outro
                        </button>
                    </div>

                    {(selectedReason === 'Outro' || selectedReason === null) && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <textarea
                                className="w-full h-24 p-4 text-sm bg-muted/30 border border-border rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                                placeholder="Descreva o motivo..."
                                value={customReason}
                                style={{ fontSize: '16px' }}
                                onChange={(e) => setCustomReason(e.target.value)}
                                autoFocus={selectedReason === 'Outro'}
                            />
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="h-12 sm:h-auto w-full sm:flex-1 px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl sm:rounded-lg transition-all order-2 sm:order-1"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedReason && !customReason.trim()}
                            className="h-12 sm:h-auto w-full sm:flex-1 px-4 py-2 text-sm font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 rounded-xl sm:rounded-lg shadow-lg transition-all order-1 sm:order-2 active:scale-95"
                        >
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
