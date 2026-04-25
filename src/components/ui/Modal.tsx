import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-2 animate-in fade-in duration-200">
            <div
                className={`
                    bg-card shadow-2xl w-full ${maxWidth} border border-border flex flex-col 
                    h-full sm:h-auto sm:max-h-[98vh] sm:rounded-xl overflow-hidden
                    animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300
                `}
            >
                <div className="flex justify-between items-center p-4 border-b border-border shrink-0">
                    <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-0">
                    {children}
                </div>
            </div>
        </div>
    );

}
