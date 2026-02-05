import { Activity } from '@/types/schema';
import { CheckCircle2, Circle, Calendar, Phone, Mail, Users, FileText, StickyNote, Paperclip, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
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
                const isOverdue = !activity.completed && activity.dueDate && new Date(activity.dueDate) < new Date();

                return (
                    <div
                        key={activity.id}
                        className={`group/item flex items-start gap-3 p-3 rounded-lg border border-border bg-card transition-all hover:shadow-sm ${activity.completed ? 'opacity-60' : ''}`}
                    >
                        <button
                            onClick={() => onToggle(activity.id)}
                            className={`mt-0.5 shrink-0 ${activity.completed ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                        >
                            {activity.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h4 className={`text-sm font-medium ${activity.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {activity.title}
                                </h4>
                                <div className="flex items-center gap-2">
                                    {activity.dueDate && (
                                        <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                            <Calendar size={12} />
                                            {format(new Date(activity.dueDate), "dd MMM", { locale: ptBR })}
                                        </span>
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

                            <div className="flex items-center gap-2 mt-2">
                                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    <Icon size={10} />
                                    {activity.type}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
