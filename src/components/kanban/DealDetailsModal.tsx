import DealDetails from "@/pages/DealDetails";

interface DealDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    dealId: string | null;
}

export default function DealDetailsModal({ isOpen, onClose, dealId }: DealDetailsModalProps) {
    if (!isOpen || !dealId) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-background rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] border border-border flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close overlay on click outside is handled by parent div if we add onClick there, 
                    but here we just want the content. 
                    Actually, checking Modal.tsx, it doesn't seem to close on backdrop click by default?
                    Let's add backdrop click to close.
                */}
                <DealDetails dealId={dealId} onClose={onClose} isModal={true} />
            </div>

            {/* Backdrop Click Handler */}
            <div className="absolute inset-0 z-[-1]" onClick={onClose} />
        </div>
    );
}
