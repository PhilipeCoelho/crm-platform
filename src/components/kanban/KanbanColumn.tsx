import { useDroppable } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { Stage, Id, Deal } from "@/types/schema";
import KanbanCard from "./KanbanCard";
import { useMemo } from "react";
import { parseISO, isBefore, isToday } from "date-fns";
import { Plus, Settings2 } from "lucide-react";
import { Currency } from "@/data/currencies";
import { useCRM } from "@/contexts/CRMContext";

interface Props {
    column: Stage;
    tasks: Deal[];
    updateColumn?: (id: Id, title: string) => void;
    onAdd: (columnId: Id) => void;
    currency: Currency;
    onPreview?: (dealId: string) => void;
    onEditStage?: () => void;
    searchTerm?: string;
}

export default function KanbanColumn({ column, tasks, onAdd, currency, onPreview, onEditStage, searchTerm }: Props) {
    const { activities } = useCRM();

    // Sort tasks by priority
    const sortedTasks = useMemo(() => {
        const now = new Date();

        return [...tasks].sort((a, b) => {
            // Get next activity for each deal
            const getNextActivity = (dealId: string) => {
                const openActivities = activities.filter(act => act.dealId === dealId && !act.completed);
                return openActivities.sort((x, y) => {
                    if (!x.dueDate) return 1;
                    if (!y.dueDate) return -1;
                    return x.dueDate.localeCompare(y.dueDate);
                })[0];
            };

            const activityA = getNextActivity(a.id);
            const activityB = getNextActivity(b.id);

            const dateA = activityA?.dueDate ? parseISO(activityA.dueDate) : undefined;
            const dateB = activityB?.dueDate ? parseISO(activityB.dueDate) : undefined;

            // Priority calculation (lower number = higher priority)
            const getPriority = (date: Date | undefined) => {
                if (!date) return 3; // No activity (Amarela)
                if (isBefore(date, now)) return 1; // Overdue (Vermelha)
                if (isToday(date)) return 2; // Today (Verde)
                return 4; // Future (Branca)
            };

            const priorityA = getPriority(dateA);
            const priorityB = getPriority(dateB);

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            if (dateA && dateB) {
                return dateA.getTime() - dateB.getTime();
            }

            return 0;
        });
    }, [tasks, activities]);

    const tasksIds = useMemo(() => {
        return sortedTasks.map((task) => task.id);
    }, [sortedTasks]);

    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
        data: {
            type: "Column",
            column: column,
        },
    });

    const totalValue = useMemo(() => {
        return tasks.reduce((acc, task) => acc + (task.value || 0), 0);
    }, [tasks]);

    const formatDynamicCurrency = (value: number) => {
        return new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(value);
    };

    return (
        <div
            ref={setNodeRef}
            className={`group/column flex flex-col h-full min-w-[280px] w-[280px] shrink-0
                ${isOver ? 'bg-primary/[0.02] ring-1 ring-primary/20 ring-inset rounded-lg' : 'bg-transparent'}
                border-r border-black/[0.06] dark:border-white/[0.05]
                `}
        >
            {/* Header - Clean Pipedrive Style */}
            <div className="pt-3 px-2 pb-3 flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 overflow-hidden flex-1 cursor-pointer group/title" onClick={onEditStage}>
                        <span className="text-sm font-semibold tracking-tight text-foreground truncate group-hover/title:text-primary transition-colors" title={column.title}>
                            {column.title}
                        </span>
                        <Settings2 size={12} className="text-muted-foreground/40 opacity-0 group-hover/column:opacity-100 group-hover/title:text-primary transition-all" />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground/60">
                        {tasks.length}
                    </span>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground/60">
                        {formatDynamicCurrency(totalValue)}
                    </span>
                </div>

                {/* Thin line separator */}
                <div className="h-[2px] w-full rounded-full bg-primary/40" />
            </div>

            {/* Cards Area */}
            <div className="flex-grow flex flex-col gap-3 px-2 overflow-x-hidden overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                <SortableContext items={tasksIds}>
                    {sortedTasks.map((task) => (
                        <KanbanCard key={task.id} deal={task} currency={currency} onPreview={onPreview} searchTerm={searchTerm} />
                    ))}
                </SortableContext>

                {tasks.length === 0 && (
                    <div className="h-full flex items-center justify-center opacity-0">
                        <span className="text-xs text-muted-foreground">Arraste aqui</span>
                    </div>
                )}
            </div>

            {/* Footer - Ghost Add Button */}
            <div className="shrink-0 px-2 pb-2">
                <button
                    onClick={() => onAdd(column.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all duration-200 rounded-md bg-transparent text-muted-foreground hover:text-foreground opacity-0 group-hover/column:opacity-100"
                    title="Adicionar novo negócio"
                >
                    <Plus size={14} strokeWidth={2} />
                    <span>Adicionar</span>
                </button>
            </div>
        </div>
    );
}

