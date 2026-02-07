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
    // const company = deal.companyId ? companies.find(c => c.id === deal.companyId) : undefined; // Removed as unused
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
            className={`group relative bg-muted/40 dark:bg-muted/20 backdrop-blur-sm p-2.5 xl:p-3 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-200 ease-out cursor-pointer touch-none select-none border border-border/50 hover:-translate-y-[2px] hover:border-primary/50
                ${!hasNextAction ? 'border-l-4 border-l-red-500/80 dark:border-l-red-500' : ''}
            `}
        >
            {/* Title */}
            <div className="mb-1 pr-4 relative">
                <h4 className="font-semibold text-[14px] text-card-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 pr-4">
                    {deal.title}
                </h4>

                {/* Delete Button (Hover only) */}
                <button
                    onClick={handleDelete}
                    className="absolute top-[-2px] right-[-8px] p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Excluir"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Subtitle */}
            <div className="flex flex-col gap-0.5 mb-3">
                {contact ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground" title={contact.name}>
                        <User size={12} className="shrink-0" />
                        <span className="text-[12px] truncate">{contact.name}</span>
                    </div>
                ) : null}
            </div>

            {/* Next Activity Text (Action Oriented) */}
            <div className={`text-xs mb-2 py-1 px-1.5 rounded flex items-center gap-1.5 
                ${!hasNextAction ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium' : isOverdue ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' : 'bg-muted text-muted-foreground'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${!hasNextAction ? 'bg-red-500' : isOverdue ? 'bg-orange-500' : 'bg-green-500'}`} />
                <span className="truncate max-w-[180px]">
                    {!hasNextAction ? "⚠️ Definir próxima ação" : nextActivity.title}
                </span>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border mt-1">
                <div className="flex items-center gap-2">
                    {/* Avatar removed as requested */}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-card-foreground">
                        {new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(deal.value)}
                    </span>
                </div>
            </div>

            {/* Remove old indicator logic since we integrated it above */}
        </div>
    );
}

// Removed ActivityIndicator component as logic is now inline

export default DealCard;
