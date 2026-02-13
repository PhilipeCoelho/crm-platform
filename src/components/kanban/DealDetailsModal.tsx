import DealDetails from "@/pages/DealDetails";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Currency } from "@/data/currencies";

interface DealDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    dealId: string | null;
    currency: Currency;
}

export default function DealDetailsModal({ isOpen, onClose, dealId, currency }: DealDetailsModalProps) {
    if (!dealId) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                hideCloseButton
                className="max-w-5xl w-full h-[100dvh] sm:h-[95vh] p-0 overflow-hidden flex flex-col gap-0 sm:rounded-xl shadow-2xl border-x-0 border-b-0 sm:border border-border bg-background fixed bottom-0 top-auto translate-y-0 sm:top-[50%] sm:translate-y-[-50%] left-0 translate-x-0 sm:left-[50%] sm:translate-x-[-50%] rounded-t-[20px] sm:rounded-b-xl"
            >
                <DealDetails dealId={dealId} onClose={onClose} isModal={true} currency={currency} />
            </DialogContent>
        </Dialog>
    );
}
