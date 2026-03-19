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

    // Pre-calculate activity data for all tasks in this column (Optimized)
    const dealActivityData = useMemo(() => {
        const now = new Date();
        const dataMap = new Map<string, { nextActivity?: { title: string; dueDate?: string }; priority: number; date?: Date }>();

        tasks.forEach(task => {
            const dealActivities = activities.filter(act => act.dealId === task.id && !act.completed);
            let nextActivity;
            let date;

            if (dealActivities.length > 0) {
                const earliest = dealActivities.reduce((prev, curr) => {
                    if (!prev.dueDate) return curr;
                    if (!curr.dueDate) return prev;
                    return curr.dueDate < prev.dueDate ? curr : prev;
                });
                nextActivity = earliest;
                date = earliest.dueDate ? parseISO(earliest.dueDate) : undefined;
            }

            const getPriority = (d: Date | undefined) => {
                if (!d) return 3; // No activity (Yellow)
                if (isBefore(d, now)) return 1; // Overdue (Red)
                if (isToday(d)) return 2; // Today (Green)
                return 4; // Future (White)
            };

            const priority = getPriority(date);
            dataMap.set(task.id, { nextActivity, priority, date });
        });

        return dataMap;
    }, [tasks, activities]);

    const sortedTasks = useMemo(() => {
        return [...tasks].sort((a, b) => {
            const dataA = dealActivityData.get(a.id);
            const dataB = dealActivityData.get(b.id);

            if (!dataA || !dataB) return 0;

            if (dataA.priority !== dataB.priority) return dataA.priority - dataB.priority;
            if (dataA.date && dataB.date) return dataA.date.getTime() - dataB.date.getTime();

            const posA = a.position || 0;
            const posB = b.position || 0;
            if (posA !== posB) return posA - posB;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [tasks, dealActivityData]);

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
            className={`group/column flex flex-col h-full min-w-[300px] w-[300px] shrink-0
                ${isOver ? 'bg-primary/[0.04] ring-2 ring-primary/20' : 'bg-secondary/30 dark:bg-transparent'}
                rounded-2xl transition-all duration-300
                `}
        >
            {/* Header - Modern SaaS Style */}
            <div className="pt-5 px-4 pb-4 flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 overflow-hidden flex-1 cursor-pointer group/title" onClick={onEditStage}>
                        <span className="text-sm font-bold tracking-tight text-foreground truncate group-hover/title:text-primary transition-colors uppercase" title={column.title}>
                            {column.title}
                        </span>
                        <Settings2 size={13} className="text-muted-foreground/30 opacity-0 group-hover/column:opacity-100 group-hover/title:text-primary transition-all" />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground/80">
                        {formatDynamicCurrency(totalValue)}
                    </span>
                    <span className="text-[11px] font-bold text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded">
                        {tasks.length}
                    </span>
                </div>

                {/* Thin line separator */}
                <div className="h-[2px] w-full rounded-full bg-primary/40" />
            </div>

            {/* Cards Area */}
            <div className="flex-grow flex flex-col gap-4 px-3 overflow-x-hidden overflow-y-auto custom-scrollbar">
                <SortableContext items={tasksIds}>
                    {sortedTasks.map((task) => (
                        <KanbanCard
                            key={task.id}
                            deal={task}
                            currency={currency}
                            onPreview={onPreview}
                            searchTerm={searchTerm}
                            nextActivityData={dealActivityData.get(task.id)?.nextActivity}
                        />
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

