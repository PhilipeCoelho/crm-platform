import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Deal } from "@/types/schema";
import { User, Trash2, ChevronRight, AlertTriangle, Clock, Building2, DollarSign, ArrowRightLeft } from "lucide-react";

import { Currency } from "@/data/currencies";
import { useCRM } from "@/contexts/CRMContext";
import { useNavigate } from "react-router-dom";
import { parseISO, isBefore, isToday } from "date-fns";
import { PrivacyText } from "../ui/PrivacyMask";

interface Props {
    deal: Deal;
    currency: Currency;
    onPreview?: (dealId: string, position: { x: number; y: number }) => void;
    searchTerm?: string;
    nextActivityData?: { title: string; dueDate?: string };
}

// Interface for the Base component that handles rendering logic
export interface DealCardBaseProps extends Props {
    dndProps?: {
        setNodeRef?: (node: HTMLElement | null) => void;
        attributes?: any;
        listeners?: any;
        transform?: any;
        transition?: any;
        isDragging?: boolean;
    };
    style?: React.CSSProperties; // Allow overriding style
}

export function DealCardBase({ deal, currency, onPreview, searchTerm, dndProps, style: propStyle, nextActivityData }: DealCardBaseProps) {
    const { contacts, companies, deleteDeal, moveDeal, pipelines } = useCRM();
    const navigate = useNavigate();

    // Activity Logic
    const hasNextAction = !!nextActivityData;

    const now = new Date();
    const rawActivityDate = nextActivityData?.dueDate;
    const dueDate = rawActivityDate ? parseISO(rawActivityDate) : undefined;

    // Priority Status Determination (Time-sensitive)
    // Preference: Today always trumps Overdue for same-day items
    const isTodayActivity = dueDate && isToday(dueDate);
    const isOverdue = dueDate && isBefore(dueDate, now) && !isTodayActivity;
    const noActivity = !hasNextAction;

    // Color System (Clean Pipedrive Style - Discrete Indicators Only)
    const getStatusIndicator = () => {
        if (isOverdue) {
            return {
                dot: 'bg-red-500',
                text: 'text-red-600 dark:text-red-400',
                icon: Clock,
                label: 'Atrasado'
            };
        }
        if (isTodayActivity) {
            return {
                dot: 'bg-emerald-500',
                icon: ChevronRight,
                label: 'Hoje'
            };
        }
        if (noActivity) {
            return {
                dot: 'bg-amber-400',
                icon: AlertTriangle,
                label: 'Sem atividade'
            };
        }
        // Future (neutral)
        return {
            dot: 'bg-muted-foreground/40',
            icon: ChevronRight,
            label: nextActivityData?.title || 'Futuro'
        };
    };

    const status = getStatusIndicator();
    const StatusIcon = status.icon;

    // Dnd Props
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging
    } = dndProps || {};

    const style = {
        transition,
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        ...propStyle
    };

    // Resolve Relations
    const contact = deal.contactId ? contacts.find(c => c.id === deal.contactId) : undefined;
    const company = deal.companyId ? companies.find(c => c.id === deal.companyId) : undefined;

    // Search Logic
    const normalizeText = (text: string) =>
        text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

    const normalizeDigits = (text: string) => text.replace(/\D/g, "");

    const searchNorm = searchTerm ? normalizeText(searchTerm) : "";
    const isSearching = !!searchTerm && searchTerm.length > 0;
    const searchDigits = normalizeDigits(searchTerm || "");

    const matchesTitle = isSearching && normalizeText(deal.title).includes(searchNorm);
    const matchesPerson = isSearching && contact && (
        normalizeText(contact.name).includes(searchNorm) ||
        (contact.email && contact.email.toLowerCase().includes(searchNorm)) ||
        (searchDigits.length >= 7 && normalizeDigits(contact.phone || "").includes(searchDigits))
    );
    const matchesCompany = isSearching && company && normalizeText(company.name).includes(searchNorm);

    const handleClick = (e: React.MouseEvent) => {
        if (onPreview) {
            const rect = e.currentTarget.getBoundingClientRect();
            onPreview(deal.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        } else {
            navigate(`/deals/${deal.id}`);
        }
    };

    const handleMovePipeline = (e: React.MouseEvent) => {
        e.stopPropagation();
        const otherPipelineId = deal.pipelineId === 'sales' ? 'cold_leads' : 'sales';
        const otherPipeline = pipelines[otherPipelineId];
        if (!otherPipeline) return;

        const firstStageId = otherPipeline.stages[0]?.id;
        if (!firstStageId) {
            alert(`O funil "${otherPipeline.name}" não possui etapas configuradas.`);
            return;
        }

        if (window.confirm(`Mover este negócio para o funil "${otherPipeline.name}"?`)) {
            moveDeal(deal.id, firstStageId, 0, otherPipelineId);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Tem certeza que deseja excluir este negócio?')) {
            deleteDeal(deal.id);
        }
    };

    // Hide original card while dragging (Ghost)
    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-0 pointer-events-none h-[100px] bg-transparent"
            />
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={handleClick}
            className="group relative p-2.5 rounded-[10px] border transition-all duration-[120ms] ease-out cursor-pointer touch-none select-none hover:-translate-y-[1px] bg-card dark:bg-card border-border shadow-sm hover:shadow-md"
        >
            {/* Status Icon - Bottom Right Corner */}
            {status.icon === AlertTriangle ? (
                <div
                    className="absolute bottom-1 right-1 p-0.5 flex items-center justify-center"
                    title={status.label}
                >
                    <AlertTriangle size={18} className="text-amber-500 fill-amber-500/10" strokeWidth={2.5} />
                </div>
            ) : (
                <div
                    className={`absolute bottom-2 right-2 w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center ${status.dot} shadow-sm`}
                    title={status.label}
                >
                    <StatusIcon size={11} strokeWidth={3} className="text-white" />
                </div>
            )}

            {/* Title Area */}
            <div className="mb-2 pr-5 relative">
                <h4 className="font-semibold text-[13px] leading-snug group-hover:text-primary transition-colors line-clamp-2 text-foreground">
                    <PrivacyText text={deal.title} type="text" />
                </h4>

                {/* Match Indicators (Search specific) */}
                {isSearching && (
                    <div className="flex flex-wrap gap-1 mt-1.5 leading-none">
                        {matchesTitle && (
                            <div className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold" title="Título correspondente">
                                <DollarSign size={8} />
                                NEGÓCIO
                            </div>
                        )}
                        {matchesPerson && (
                            <div className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-bold" title="Pessoa correspondente">
                                <User size={8} />
                                PESSOA
                            </div>
                        )}
                        {matchesCompany && (
                            <div className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-bold" title="Empresa correspondente">
                                <Building2 size={8} />
                                EMPRESA
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons (Hover only) */}
                <div className="absolute top-[-2px] right-[-6px] flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all z-10">
                    <button
                        onClick={handleMovePipeline}
                        className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded"
                        title="Mover de Funil"
                    >
                        <ArrowRightLeft size={13} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                        title="Excluir"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {/* Contact */}
            {contact && (
                <div className="flex items-center gap-1.5 mb-1 pl-0.5 text-muted-foreground/50" title={contact.name}>
                    <User size={12} className="shrink-0" />
                    <span className="text-[11px] truncate">
                        <PrivacyText text={contact.name} type="name" />
                    </span>
                </div>
            )}


            {/* Value - Bottom Row */}
            <div className="pl-0.5 mt-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground/50">
                    {new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(deal.value)}
                </span>
            </div>
        </div>
    );
}

function DealCard(props: Props) {
    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: props.deal.id,
        data: {
            type: "Deal",
            deal: props.deal,
        },
    });

    return (
        <DealCardBase
            {...props}
            dndProps={{
                setNodeRef,
                attributes,
                listeners,
                transform,
                transition,
                isDragging
            }}
        />
    );
}

export default DealCard;
