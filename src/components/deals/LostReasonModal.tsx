import { useState } from 'react';

interface LostReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

const PREDEFINED_REASONS = [
    'Desqualificado',
    'Já anuncia',
    'Não teve interesse',
    'Não respondeu',
    'Outro'
];

export default function LostReasonModal({ isOpen, onClose, onConfirm }: LostReasonModalProps) {
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [note, setNote] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        let finalReason = selectedReason;
        if (selectedReason === 'Outro') {
            finalReason = note.trim();
        } else if (note.trim()) {
            finalReason = `${selectedReason} - ${note.trim()}`;
        }
        onConfirm(finalReason);
        // Reset state after confirm
        setTimeout(() => {
            setSelectedReason('');
            setNote('');
        }, 300);
    };

    const isConfirmDisabled = !selectedReason || (selectedReason === 'Outro' && !note.trim());

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
            <div className="bg-background w-full max-w-md rounded-t-[24px] sm:rounded-2xl shadow-2xl border-t sm:border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
                <div className="p-6 sm:p-6 space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-2xl sm:text-xl font-bold text-foreground">Motivo da Perda</h2>
                        <p className="text-sm text-muted-foreground">Por que este negócio não foi fechado?</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Selecione o motivo *</label>
                            <div className="grid grid-cols-2 gap-2">
                                {PREDEFINED_REASONS.map(reason => (
                                    <button
                                        key={reason}
                                        onClick={() => setSelectedReason(reason)}
                                        className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all text-left ${selectedReason === reason
                                            ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                            : 'border-border bg-transparent text-foreground hover:bg-muted/50'
                                        }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {selectedReason === 'Outro' ? 'Descreva o motivo *' : 'Anotação adicional (opcional)'}
                            </label>
                            <textarea
                                className="w-full h-24 p-3 text-sm bg-muted/30 border border-border rounded-xl focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all resize-none"
                                placeholder={selectedReason === 'Outro' ? "Especifique o motivo..." : "Detalhes extras..."}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            onClick={() => {
                                onClose();
                                setTimeout(() => {
                                    setSelectedReason('');
                                    setNote('');
                                }, 300);
                            }}
                            className="h-12 sm:h-auto w-full sm:flex-1 px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl sm:rounded-lg transition-all order-2 sm:order-1"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isConfirmDisabled}
                            className="h-12 sm:h-auto w-full sm:flex-1 px-4 py-2 text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 rounded-xl sm:rounded-lg shadow-lg shadow-rose-500/20 transition-all order-1 sm:order-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Confirmar Perda
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
