import { Activity } from '@/types/schema';
import { CheckCircle2, Circle, Calendar, Phone, Mail, Users, FileText, StickyNote, Paperclip, Trash2, Clock, Pencil, MessageSquare } from 'lucide-react';
import { format, isBefore, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
    activities: Activity[];
    onToggle: (id: string) => void;
    onDelete?: (id: string) => void;
    onEdit?: (activity: Activity) => void;
}

const typeIcons = {
    call: Phone,
    meeting: Users,
    email: Mail,
    task: CheckCircle2,
    followup: Calendar,
    note: StickyNote,
    fileUpload: Paperclip,
    message: MessageSquare,
};

const getActivityStatus = (dateString?: string) => {
    if (!dateString) return 'future';

    const date = parseISO(dateString);
    const now = new Date();

    if (isBefore(date, now)) return 'late';
    if (isToday(date)) return 'today';
    return 'future';
};

const statusStyles = {
    late: {
        bg: 'bg-red-500/10 dark:bg-red-500/20',
        text: 'text-red-600 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
        dot: 'bg-red-500',
        label: 'Atrasada'
    },
    today: {
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
        dot: 'bg-emerald-500',
        label: 'Para hoje'
    },
    future: {
        bg: 'bg-white dark:bg-slate-800/40',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-slate-100 dark:border-slate-800',
        dot: 'bg-slate-300 dark:bg-slate-600',
        label: 'Planejado'
    }
};

export default function ActivityList({ activities, onToggle, onDelete, onEdit }: Props) {
    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText size={48} className="mb-2 opacity-20" />
                <p>Nenhuma atividade encontrada.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-3">
            {activities.map(activity => {
                const Icon = typeIcons[activity.type] || FileText;
                const status = getActivityStatus(activity.dueDate);
                const style = statusStyles[status];

                // If completed, we override visual urgency
                const isCompleted = activity.completed;

                return (
                    <div
                        key={activity.id}
                        className={`group/item relative flex items-start gap-4 sm:gap-3 p-4 sm:p-3 rounded-xl sm:rounded-lg border bg-card transition-all hover:shadow-sm
                            ${isCompleted ? 'opacity-60 border-border' : `border-l-4 ${style.border.replace('border', 'border-l')}`}`}
                        // Note: Using border-l-4 for clear visual indication status if not completed
                        style={!isCompleted ? { borderLeftColor: status === 'late' ? '#ef4444' : status === 'today' ? '#22c55e' : undefined } : {}}
                    >
                        <button
                            onClick={() => onToggle(activity.id)}
                            className={`mt-0.5 shrink-0 h-11 w-11 sm:h-auto sm:w-auto flex items-center justify-center sm:block ${isCompleted ? 'text-primary' : 'text-muted-foreground hover:text-primary'} transition-colors`}
                        >
                            {isCompleted ? <CheckCircle2 size={24} className="sm:w-5 sm:h-5" /> : <Circle size={24} className="sm:w-5 sm:h-5" />}
                        </button>

                        <div className="flex-1 min-w-0 pt-2 sm:pt-0">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                <h4 className={`text-base sm:text-sm font-bold sm:font-medium ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {activity.title}
                                </h4>
                                <div className="flex items-center gap-4 sm:gap-2">
                                    {activity.dueDate && (
                                        <div className={`flex items-center gap-1.5 px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-full text-[10px] sm:text-[10px] font-bold sm:font-medium border ${!isCompleted ? `${style.bg} ${style.text} ${style.border}` : 'bg-muted text-muted-foreground border-transparent'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${!isCompleted ? style.dot : 'bg-muted-foreground'}`} />
                                            <span>
                                                {status === 'today' ? 'Hoje' : format(parseISO(activity.dueDate), "dd MMM", { locale: ptBR })}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        {onEdit && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(activity); }}
                                                className="sm:opacity-0 sm:group-hover/item:opacity-100 p-2.5 sm:p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 rounded-md text-muted-foreground transition-all"
                                                title="Editar atividade"
                                            >
                                                <Pencil size={18} className="sm:w-3.5 sm:h-3.5" />
                                            </button>
                                        )}
                                        {onDelete && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(activity.id); }}
                                                className="sm:opacity-0 sm:group-hover/item:opacity-100 p-2.5 sm:p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-md text-muted-foreground transition-all"
                                                title="Excluir atividade"
                                            >
                                                <Trash2 size={18} className="sm:w-3.5 sm:h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {activity.description && (
                                <p className="text-sm sm:text-xs text-muted-foreground mt-2 sm:mt-1 line-clamp-3 sm:line-clamp-2">
                                    {activity.description}
                                </p>
                            )}

                            <div className="flex items-center gap-4 sm:gap-3 mt-3 sm:mt-2">
                                <span className="inline-flex items-center gap-1.5 sm:gap-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-2 py-1 sm:px-1.5 sm:py-0.5 rounded">
                                    <Icon size={12} className="sm:w-2.5 sm:h-2.5" />
                                    {activity.type}
                                </span>

                                {activity.duration && (
                                    <span className="inline-flex items-center gap-1.5 sm:gap-1 text-[10px] text-muted-foreground">
                                        <Clock size={12} className="sm:w-2.5 sm:h-2.5" />
                                        {activity.duration} min
                                    </span>
                                )}

                                {!isCompleted && (
                                    <span className={`text-[10px] font-bold sm:font-medium ${style.text}`}>
                                        {style.label}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
