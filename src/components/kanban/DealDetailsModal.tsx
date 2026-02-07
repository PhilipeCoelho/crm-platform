import DealDetails from "@/pages/DealDetails";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";

interface DealDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    dealId: string | null;
}

export default function DealDetailsModal({ isOpen, onClose, dealId }: DealDetailsModalProps) {
    if (!dealId) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl w-full h-[90vh] p-0 overflow-hidden flex flex-col gap-0 rounded-xl shadow-2xl border border-border bg-background">
                <DealDetails dealId={dealId} onClose={onClose} isModal={true} />
            </DialogContent>
        </Dialog>
    );
}
