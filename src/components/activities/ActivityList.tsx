import { Activity } from '@/types/schema';
import { CheckCircle2, Circle, Calendar, Phone, Mail, Users, FileText, StickyNote, Paperclip, Trash2, Clock } from 'lucide-react';
import { format, isBefore, isToday, startOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
    activities: Activity[];
    onToggle: (id: string) => void;
    onDelete?: (id: string) => void;
}

const typeIcons = {
    call: Phone,
    meeting: Users,
    email: Mail,
    task: CheckCircle2,
    followup: Calendar,
    note: StickyNote,
    fileUpload: Paperclip,
};

const getActivityStatus = (dateString?: string) => {
    if (!dateString) return 'future'; // Default fallback

    const date = parseISO(dateString);
    const today = startOfDay(new Date());
    const activityDate = startOfDay(date);

    if (isBefore(activityDate, today)) return 'late';
    if (isToday(activityDate)) return 'today';
    return 'future';
};

const statusStyles = {
    late: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500',
        label: 'Atrasada'
    },
    today: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500',
        label: 'Para hoje'
    },
    future: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
        label: 'Agendada'
    }
};

export default function ActivityList({ activities, onToggle, onDelete }: Props) {
    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText size={48} className="mb-2 opacity-20" />
                <p>Nenhuma atividade encontrada.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {activities.map(activity => {
                const Icon = typeIcons[activity.type] || FileText;
                const status = getActivityStatus(activity.dueDate);
                const style = statusStyles[status];

                // If completed, we override visual urgency
                const isCompleted = activity.completed;

                return (
                    <div
                        key={activity.id}
                        className={`group/item relative flex items-start gap-3 p-3 rounded-lg border bg-card transition-all hover:shadow-sm
                            ${isCompleted ? 'opacity-60 border-border' : `border-l-4 ${style.border.replace('border', 'border-l')}`}`}
                        // Note: Using border-l-4 for clear visual indication status if not completed
                        style={!isCompleted ? { borderLeftColor: status === 'late' ? '#ef4444' : status === 'today' ? '#22c55e' : undefined } : {}}
                    >
                        <button
                            onClick={() => onToggle(activity.id)}
                            className={`mt-0.5 shrink-0 ${isCompleted ? 'text-primary' : 'text-muted-foreground hover:text-primary'} transition-colors`}
                        >
                            {isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h4 className={`text-sm font-medium ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {activity.title}
                                </h4>
                                <div className="flex items-center gap-2">
                                    {activity.dueDate && (
                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${!isCompleted ? `${style.bg} ${style.text} ${style.border}` : 'bg-muted text-muted-foreground border-transparent'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${!isCompleted ? style.dot : 'bg-muted-foreground'}`} />
                                            <span>
                                                {status === 'today' ? 'Hoje' : format(parseISO(activity.dueDate), "dd MMM", { locale: ptBR })}
                                            </span>
                                        </div>
                                    )}
                                    {onDelete && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete(activity.id); }}
                                            className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded text-muted-foreground transition-all"
                                            title="Excluir atividade"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {activity.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {activity.description}
                                </p>
                            )}

                            <div className="flex items-center gap-3 mt-2">
                                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    <Icon size={10} />
                                    {activity.type}
                                </span>

                                {activity.duration && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <Clock size={10} />
                                        {activity.duration} min
                                    </span>
                                )}

                                {!isCompleted && (
                                    <span className={`text-[10px] font-medium ${style.text}`}>
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
