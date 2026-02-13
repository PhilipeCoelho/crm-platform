import { useState } from 'react';

interface LostReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

export default function LostReasonModal({ isOpen, onClose, onConfirm }: LostReasonModalProps) {
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-background w-full max-w-md rounded-t-[24px] sm:rounded-2xl shadow-2xl border-t sm:border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
                <div className="p-6 sm:p-6 space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-2xl sm:text-xl font-bold text-foreground">Motivo da Perda</h2>
                        <p className="text-sm text-muted-foreground">Por que este negócio não foi fechado?</p>
                    </div>

                    <textarea
                        className="w-full h-40 sm:h-32 p-4 text-base sm:text-sm bg-muted/30 border border-border rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder="Ex: Preço muito alto, falta de features..."
                        value={reason}
                        style={{ fontSize: '16px' }}
                        onChange={(e) => setReason(e.target.value)}
                        autoFocus
                    />

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="h-12 sm:h-auto w-full sm:flex-1 px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl sm:rounded-lg transition-all order-2 sm:order-1"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => onConfirm(reason)}
                            className="h-12 sm:h-auto w-full sm:flex-1 px-4 py-2 text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 rounded-xl sm:rounded-lg shadow-lg shadow-rose-500/20 transition-all order-1 sm:order-2 active:scale-95"
                        >
                            Confirmar Perda
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
