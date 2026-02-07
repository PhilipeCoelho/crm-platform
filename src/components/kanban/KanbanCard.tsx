import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Deal } from "@/types/schema";
import { User, Trash2 } from "lucide-react";

import { Currency } from "@/data/currencies";
import { useCRM } from "@/contexts/CRMContext";
import { useNavigate } from "react-router-dom";


interface Props {
    deal: Deal;
    currency: Currency;
    onPreview?: (dealId: string, position: { x: number; y: number }) => void;
}

function DealCard({ deal, currency, onPreview }: Props) {
    const { contacts, activities, deleteDeal } = useCRM();
    const navigate = useNavigate();

    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: deal.id,
        data: {
            type: "Deal",
            deal,
        },
    });

    // Activity Logic
    const openActivities = activities.filter(a => a.dealId === deal.id && !a.completed);
    // Sort by date (asc) to find the immediate next one
    const nextActivity = openActivities.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
    })[0];

    const hasNextAction = !!nextActivity;
    const isOverdue = nextActivity?.dueDate && nextActivity.dueDate < new Date().toISOString().split('T')[0];

    const style = {
        transition,
        transform: CSS.Transform.toString(transform),
    };

    // Resolve Relations
    const contact = deal.contactId ? contacts.find(c => c.id === deal.contactId) : undefined;

    const handleClick = (e: React.MouseEvent) => {
        if (onPreview) {
            const rect = e.currentTarget.getBoundingClientRect();
            onPreview(deal.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        } else {
            navigate(`/deals/${deal.id}`);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Tem certeza que deseja excluir este negócio?')) {
            deleteDeal(deal.id);
        }
    };

    if (isDragging) return <div ref={setNodeRef} style={style} className="bg-muted/20 p-3 rounded-lg border-2 border-primary opacity-30 h-[100px]" />;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={handleClick}
            className={`group relative bg-white dark:bg-card p-3 rounded-lg border border-border/60 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer touch-none select-none border-l-[3px] hover:-translate-y-0.5
                ${!hasNextAction ? 'border-l-red-500' : isOverdue ? 'border-l-orange-500' : 'border-l-primary/40'}
            `}
        >
            {/* Title */}
            <div className="mb-2 pr-5 relative">
                <h4 className="font-semibold text-[14px] text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {deal.title}
                </h4>

                {/* Delete Button (Hover only) */}
                <button
                    onClick={handleDelete}
                    className="absolute top-[-2px] right-[-6px] p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Excluir"
                >
                    <Trash2 size={13} />
                </button>
            </div>

            {/* Contact */}
            {contact && (
                <div className="flex items-center gap-1.5 text-muted-foreground mb-3 pl-0.5" title={contact.name}>
                    <User size={13} className="shrink-0" />
                    <span className="text-[12px] truncate">{contact.name}</span>
                </div>
            )}

            {/* Footer: Action & Value */}
            <div className="flex items-center justify-between pt-2.5 mt-auto border-t border-dashed border-border/40">
                {/* Left: Action Indicator */}
                <div className={`flex items-center gap-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded
                    ${!hasNextAction ? 'text-red-600 bg-red-50 dark:bg-red-900/20' :
                        isOverdue ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' :
                            'text-muted-foreground bg-muted/50'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${!hasNextAction ? 'bg-red-500' : isOverdue ? 'bg-orange-500' : 'hidden'}`} />
                    <span className="truncate max-w-[100px]">
                        {!hasNextAction ? "Definir ação" : isOverdue ? "Atrasado" : nextActivity.title}
                    </span>
                </div>

                {/* Right: Value */}
                <span className="text-[13px] font-bold text-foreground">
                    {new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(deal.value)}
                </span>
            </div>
        </div>
    );
}

export default DealCard;
