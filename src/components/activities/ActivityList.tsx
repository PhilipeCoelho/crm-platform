import { Activity } from '@/types/schema';
import {
    CheckCircle2, Circle, Calendar, Phone, Mail, Users, FileText,
    StickyNote, Paperclip, Trash2, Clock, Pencil, MessageSquare,
    History, Instagram, BarChart3, Video, XCircle, Copy
} from 'lucide-react';
import { ActivityScriptPopover } from './ActivityScriptPopover';
import { getScriptByTitle, formatScript } from '@/services/cadence';
import { useCRM } from '@/contexts/CRMContext';
import { format, isBefore, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
    activities: Activity[];
    onToggle: (id: string) => void;
    onDelete?: (id: string) => void;
    onEdit?: (activity: Activity) => void;
    onItemClick?: (activity: Activity) => void;
}

const typeIcons: Record<string, any> = {
    call: Phone,
    meeting: Users,
    email: Mail,
    task: CheckCircle2,
    followup: Calendar,
    note: StickyNote,
    fileUpload: Paperclip,
    message: MessageSquare,
    instagram: Instagram,
    analysis: BarChart3,
    audit: Video,
    status_change: History,
};

const getActivityStatus = (dateString?: string) => {
    if (!dateString) return 'future';

    const date = parseISO(dateString);
    const now = new Date();

    // If it's today (local), it's 'today'
    if (isToday(date)) return 'today';

    // If it's before today, it's 'late'
    // We use startOfDay to ensure we only mark as late if the day is actually in the past
    // unless the activity specifically has time today and that time has passed.
    if (isBefore(date, now)) {
        // Check if it's actually a past day
        const isPastDay = isBefore(date, new Date(now.getFullYear(), now.getMonth(), now.getDate()));
        if (isPastDay) return 'late';

        // If it is today (but not caught by isToday somehow? should not happen), it's today
        if (isToday(date)) return 'today';

        // If it's currently earlier in the day than the activity? No, isBefore(date, now) is true.
        // If the activity is for 10:00 AM and it's 11:00 AM, it's 'late'.
        return 'late';
    }

    return 'future';
};

const statusStyles = {
    late: {
        bg: 'bg-destructive/10',
        text: 'text-destructive',
        border: 'border-destructive/20',
        dot: 'bg-destructive',
        label: 'Atrasada'
    },
    today: {
        bg: 'bg-primary/10',
        text: 'text-primary',
        border: 'border-primary/20',
        dot: 'bg-primary',
        label: 'Para hoje'
    },
    future: {
        bg: 'bg-muted/40',
        text: 'text-muted-foreground',
        border: 'border-border',
        dot: 'bg-muted',
        label: 'Planejado'
    }
};

export default function ActivityList({ activities, onToggle, onDelete, onEdit, onItemClick }: Props) {
    const { contacts, companies, deals } = useCRM();
    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText size={48} className="mb-2 opacity-20" />
                <p>Nenhuma atividade encontrada.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {activities.map(activity => {
                const Icon = typeIcons[activity.type] || FileText;
                const status = getActivityStatus(activity.dueDate);
                const style = statusStyles[status];

                // If completed or canceled, we override visual urgency
                const isCompleted = activity.completed;
                const isCanceled = activity.status === 'canceled';

                return (
                    <div
                        key={activity.id}
                        onClick={() => onItemClick?.(activity)}
                        className={`group/item relative flex items-start gap-2 p-1.5 sm:p-1.5 rounded-lg border bg-card/40 transition-all hover:shadow-sm
                            ${onItemClick ? 'cursor-pointer' : ''}
                            ${(isCompleted || isCanceled) ? 'opacity-60 border-border' : `border-l-[3px] ${style.border.replace('border', 'border-l')}`}`}
                        // Note: Using border-l-3 for subtler indicator status if not completed
                        style={(!isCompleted && !isCanceled) ? { borderLeftColor: status === 'late' ? 'hsl(var(--destructive))' : status === 'today' ? 'hsl(var(--primary))' : undefined } : {}}
                    >
                        <button
                            onClick={(e) => { e.stopPropagation(); !isCanceled && onToggle(activity.id); }}
                            className={`mt-0.5 shrink-0 h-9 w-9 sm:h-auto sm:w-auto flex items-center justify-center sm:block ${isCompleted ? 'text-primary' : isCanceled ? 'text-muted-foreground cursor-not-allowed' : 'text-muted-foreground hover:text-primary'} transition-colors`}
                            disabled={isCanceled}
                        >
                            {isCompleted ? <CheckCircle2 size={20} className="sm:w-4 sm:h-4" /> : isCanceled ? <XCircle size={20} className="sm:w-4 sm:h-4" /> : <Circle size={20} className="sm:w-4 sm:h-4" />}
                        </button>

                        <div className="flex-1 min-w-0 pt-2 sm:pt-0">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                <h4 className={`text-[12px] sm:text-[11px] font-bold sm:font-semibold flex items-center gap-1.5 ${(isCompleted || isCanceled) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {activity.title}
                                    {(activity.tooltipScript || activity.notes || getScriptByTitle(activity.title)) && !isCompleted && !isCanceled && (() => {
                                        const rawScript = activity.tooltipScript || getScriptByTitle(activity.title);
                                        const contact = contacts.find(c => c.id === activity.contactId);
                                        const company = companies.find(c => c.id === activity.companyId);
                                        const deal = deals.find(d => d.id === activity.dealId);

                                        const formattedScript = rawScript ? formatScript(rawScript, {
                                            contactName: contact?.name,
                                            companyName: company?.name,
                                            dealTitle: deal?.title
                                        }) : undefined;

                                        return (
                                            <ActivityScriptPopover
                                                suggestion={activity.notes}
                                                script={formattedScript}
                                            />
                                        );
                                    })()}
                                    {isCanceled && <span className="ml-1 text-[9px] line-through font-normal">(Cancelada)</span>}
                                </h4>
                                <div className="flex items-center gap-4 sm:gap-2">
                                    {activity.dueDate && (
                                        <div className={`flex items-center gap-1.5 px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-full text-[10px] sm:text-[10px] font-bold sm:font-medium border ${(!isCompleted && !isCanceled) ? `${style.bg} ${style.text} ${style.border}` : 'bg-muted text-muted-foreground border-transparent'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${(!isCompleted && !isCanceled) ? style.dot : 'bg-muted-foreground'}`} />
                                            <span>
                                                {status === 'today' ? 'Hoje' : format(parseISO(activity.dueDate), "dd MMM", { locale: ptBR })}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        {!isCanceled && onEdit && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(activity); }}
                                                className="sm:opacity-0 sm:group-hover/item:opacity-100 p-2.5 sm:p-1.5 hover:bg-muted dark:hover:bg-muted/30 hover:text-foreground rounded-md text-muted-foreground transition-all"
                                                title="Editar atividade"
                                            >
                                                <Pencil size={15} className="sm:w-3 sm:h-3" />
                                            </button>
                                        )}
                                        {onDelete && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(activity.id); }}
                                                className="sm:opacity-0 sm:group-hover/item:opacity-100 p-2.5 sm:p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md text-muted-foreground transition-all"
                                                title="Excluir atividade"
                                            >
                                                <Trash2 size={15} className="sm:w-3 sm:h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {activity.notes && (
                                <div className="mt-2 space-y-1">
                                    <div className="flex items-center gap-1.5 opacity-80">
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-primary bg-primary/5 px-1 rounded">Objetivo</span>
                                        <p className="text-[11px] leading-snug text-foreground/80 font-medium">
                                            {activity.notes}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {(activity.tooltipScript || getScriptByTitle(activity.title)) && !isCompleted && !isCanceled && (
                                (() => {
                                    const rawScript = activity.tooltipScript || getScriptByTitle(activity.title);
                                    const contact = contacts.find(c => c.id === activity.contactId);
                                    const company = companies.find(c => c.id === activity.companyId);
                                    const deal = deals.find(d => d.id === activity.dealId);

                                    const formattedScript = rawScript ? formatScript(rawScript, {
                                        contactName: contact?.name,
                                        companyName: company?.name,
                                        dealTitle: deal?.title
                                    }) : undefined;

                                    if (!formattedScript) return null;

                                    return (
                                        <div className="mt-3 p-2 rounded-lg bg-primary/[0.03] border border-primary/10 relative group/script">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[8px] font-bold uppercase tracking-tighter text-primary/60">Ação Esperada: Enviar Mensagem</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(formattedScript);
                                                        const btn = e.currentTarget;
                                                        const originalText = btn.innerHTML;
                                                        btn.innerHTML = 'Copiado!';
                                                        btn.classList.add('bg-emerald-500', 'text-white');
                                                        setTimeout(() => {
                                                            btn.innerHTML = originalText;
                                                            btn.classList.remove('bg-emerald-500', 'text-white');
                                                        }, 2000);
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold uppercase transition-all hover:bg-primary hover:text-white active:scale-95"
                                                >
                                                    <Copy size={9} />
                                                    Copiar Mensagem
                                                </button>
                                            </div>
                                            <p className="text-[11px] text-foreground italic leading-relaxed whitespace-pre-wrap">
                                                {formattedScript}
                                            </p>
                                        </div>
                                    );
                                })()
                            )}

                            <div className="flex items-center gap-3 sm:gap-2 mt-2">
                                <span className="inline-flex items-center gap-1 sm:gap-0.5 text-[8px] uppercase font-bold tracking-wider text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded">
                                    <Icon size={10} className="sm:w-1.5 sm:h-1.5" />
                                    {activity.type === 'message' ? 'Mensagem' :
                                        activity.type === 'call' ? 'Ligação' :
                                            activity.type === 'meeting' ? 'Reunião' :
                                                activity.type === 'task' ? 'Tarefa' :
                                                    activity.type === 'email' ? 'E-mail' :
                                                        activity.type === 'analysis' ? 'Análise' :
                                                            activity.type === 'audit' ? 'Auditoria' :
                                                                activity.type}
                                </span>
                                {activity.duration && (
                                    <span className="inline-flex items-center gap-1.5 sm:gap-1 text-[9px] text-muted-foreground">
                                        <Clock size={11} className="sm:w-2 sm:h-2" />
                                        {activity.duration} min
                                    </span>
                                )}

                                {!isCompleted && (
                                    <span className={`text-[9px] font-bold sm:font-medium ${style.text}`}>
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
