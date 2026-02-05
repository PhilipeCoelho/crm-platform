import { useState } from 'react';
import Modal from '@/components/ui/Modal';

interface LostReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

export default function LostReasonModal({ isOpen, onClose, onConfirm }: LostReasonModalProps) {
    const [reason, setReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(reason);
        setReason(''); // Reset
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Marcar como Perdido">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Por favor, informe o motivo da perda para ajudar em análises futuras.
                </p>

                <textarea
                    className="w-full p-3 rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-destructive/50 min-h-[100px]"
                    placeholder="Ex: Preço muito alto, optou pelo concorrente..."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    autoFocus
                />

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-destructive hover:bg-destructive/90 rounded-md"
                    >
                        Confirmar Perda
                    </button>
                </div>
            </form>
        </Modal>
    );
}
