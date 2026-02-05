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
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`bg-card rounded-lg shadow-lg w-full ${maxWidth} border border-border flex flex-col max-h-[90vh]`}>
                <div className="flex justify-between items-center p-4 border-b border-border">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
