import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Stage, Id, Deal } from "@/types/schema";
import KanbanCard from "./KanbanCard"; // This is actually DealCard
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Currency } from "@/data/currencies";
import InlineEditableField from "@/components/ui/InlineEditableField";

interface Props {
    column: Stage; // Renamed from Column to Stage conceptually, but keeping prop name for less churn if possible or adapting
    // Actually let's accept Stage type but map it to column-like structure if needed, or just use Stage.
    // In KanbanBoard we passed 'col' which is a Stage-like object {id, title...}

    tasks: Deal[]; // Replaced Task[] with Deal[]
    updateColumn: (id: Id, title: string) => void;
    onAdd: (columnId: Id) => void;
    currency: Currency;
    initialEditMode?: boolean;
    onPreview?: (dealId: string, position: { x: number; y: number }) => void;
}

function KanbanColumn({ column, tasks, updateColumn, onAdd, currency, initialEditMode, onPreview }: Props) {
    const [editMode] = useState(initialEditMode || false);

    const tasksIds = useMemo(() => {
        return tasks.map((task) => task.id);
    }, [tasks]);

    const {
        setNodeRef,
        attributes,
        listeners,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: column.id,
        data: {
            type: "Column",
            column,
        },
        disabled: editMode,
    });

    const style = {
        transition,
        transform: CSS.Transform.toString(transform),
    };

    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="bg-muted/50 w-[260px] h-[500px] max-h-[500px] rounded-lg border-2 border-primary opacity-40 shrink-0"
            />
        );
    }

    const totalValue = useMemo(() => {
        return tasks.reduce((acc, task) => acc + (task.value || 0), 0);
    }, [tasks]);

    const formatDynamicCurrency = (value: number) => {
        return new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(value);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex flex-col rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] transition-colors h-full min-w-[260px] w-[260px] shrink-0 overflow-hidden"
        >
            <div
                {...attributes}
                {...listeners}
                className="p-2 px-3 flex flex-col gap-1 shrink-0 cursor-grab group/header bg-slate-100/50 dark:bg-transparent border-b border-transparent dark:border-white/[0.05]"
            >
                {/* Header Row: Title & Count */}
                <div className="flex items-center justify-between w-full">
                    <InlineEditableField
                        value={column.title}
                        onSave={(val) => updateColumn(column.id, val)}
                        className="text-[13px] font-semibold text-foreground w-full truncate"
                        placeholder="Nome da etapa"
                    />
                    <span className="text-[11px] font-medium text-muted-foreground/70 bg-background/80 px-1.5 py-0.5 rounded-md border border-border/40">
                        {tasks.length}
                    </span>
                </div>

                {/* SubHeader: Value */}
                <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground/80">
                        {formatDynamicCurrency(totalValue)}
                    </span>
                </div>

                {/* Progress Bar / Color Indicator */}
                <div className={`h-[2px] w-full mt-2 rounded-full ${tasks.length > 0 ? 'bg-primary/70' : 'bg-muted-foreground/10'}`} />
            </div>

            {/* Task List */}
            <div className="flex-grow flex flex-col gap-2 p-2 overflow-x-hidden overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                <SortableContext items={tasksIds}>
                    {tasks.map((task) => (
                        <KanbanCard key={task.id} deal={task} currency={currency} onPreview={onPreview} />
                    ))}
                </SortableContext>
            </div>

            {/* Quick Add Button Footer */}
            <div className="p-2 pt-0 shrink-0">
                <button
                    className="w-full flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-md transition-all text-xs font-medium"
                    onClick={() => {
                        onAdd(column.id);
                    }}
                    title="Adicionar negócio"
                >
                    <Plus size={14} />
                    <span>Novo</span>
                </button>
            </div>
        </div>
    );
}

export default KanbanColumn;
