import { Activity, DealLog } from '@/types/schema';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Phone, Mail, Calendar, Info, BarChart3, Video, Instagram, CheckCircle2, StickyNote, History } from 'lucide-react';
import { ActivityScriptPopover } from './ActivityScriptPopover';
import { getScriptByTitle, formatScript } from '@/services/cadence';
import { useCRM } from '@/contexts/CRMContext';

interface Props {
    activities: Activity[];
    logs?: DealLog[];
    onReopen?: (id: string) => void;
    onEdit?: (id: string, newTitle: string) => Promise<void> | void;
    onDelete?: (id: string) => void;
}

export default function Timeline({ activities, logs = [], onReopen, onEdit, onDelete }: Props) {
    const { contacts, companies, deals } = useCRM();
    // Combine and Sort by createdAt descending
    // Filter out logs that are linked to an activity to avoid duplicate separate entries
    const items = [
        ...activities.map(a => ({ ...a, itemType: 'activity' as const })),
        ...logs.filter(l => !l.activityId).map(l => ({ ...l, itemType: 'log' as const, type: 'note' as const, title: 'Nota' }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (items.length === 0) {
        return <div className="text-sm text-muted-foreground text-center py-8 bg-muted/10 rounded-xl border border-dashed border-border/50">Nenhum histórico ainda.</div>;
    }

    const getIcon = (_itemType: string, type: string) => {
        const config: Record<string, { icon: any, color: string, bg: string }> = {
            call: { icon: Phone, color: 'text-primary', bg: 'bg-primary/10 dark:bg-primary/20' },
            email: { icon: Mail, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
            meeting: { icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
            message: { icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/10 dark:bg-primary/20' },
            instagram: { icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30' },
            analysis: { icon: BarChart3, color: 'text-primary', bg: 'bg-primary/10 dark:bg-primary/20' },
            audit: { icon: Video, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30' },
            task: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
            note: { icon: StickyNote, color: 'text-muted-foreground', bg: 'bg-muted dark:bg-muted/10' },
            manual_note: { icon: StickyNote, color: 'text-muted-foreground', bg: 'bg-muted dark:bg-muted/10' },
            activity_note: { icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
            system: { icon: Info, color: 'text-muted-foreground/60', bg: 'bg-muted dark:bg-muted/10' },
            status_change: { icon: History, color: 'text-muted-foreground/60', bg: 'bg-muted dark:bg-muted/10' },
        };

        const { icon: Icon, color, bg } = config[type] || config.task;
        return (
            <div className={`w-full h-full rounded-full flex items-center justify-center ${bg}`}>
                <Icon size={12} className={color} />
            </div>
        );
    };

    return (
        <div className="relative pl-6 sm:pl-8 border-l-2 border-border dark:border-border/30 ml-3 space-y-2 py-1">
            {items.map((item) => {
                const isLog = item.itemType === 'log';
                const log = isLog ? (item as any as DealLog) : null;
                const activity = !isLog ? (item as any as Activity) : null;
                const date = new Date(item.createdAt);

                return (
                    <div key={item.id} className="relative group">
                        {/* Timeline Dot with Icon */}
                        <div className="absolute -left-[38px] sm:-left-[47px] top-0.5 h-6 w-6 rounded-full border-2 border-background bg-card shadow-sm z-10 transition-transform group-hover:scale-110 overflow-hidden">
                            {getIcon(item.itemType, isLog ? log?.logType || 'note' : activity?.type || 'task')}
                        </div>

                        <div className="flex flex-col gap-1">
                            {/* Header Row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] sm:text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                        {isLog ? (log?.logType === 'system' ? 'Sistema' : 'Nota') : (
                                            activity?.type === 'call' ? 'Chamada' :
                                                activity?.type === 'email' ? 'Email' :
                                                    activity?.type === 'meeting' ? 'Reunião' :
                                                        activity?.type === 'message' ? 'Mensagem' : 'Atividade'
                                        )}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground/40 font-medium">
                                        • {formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}
                                    </span>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {onEdit && !isLog && (
                                        <button
                                            onClick={() => {
                                                const newTitle = prompt('Novo título da atividade:', activity?.title);
                                                if (newTitle && newTitle !== activity?.title) {
                                                    onEdit(item.id, newTitle);
                                                }
                                            }}
                                            className="h-5 px-1.5 text-[8px] font-bold uppercase text-muted-foreground/40 hover:text-primary transition-all"
                                        >
                                            Editar
                                        </button>
                                    )}
                                    {!isLog && onReopen && (
                                        <button onClick={() => onReopen(item.id)} className="h-5 px-1.5 text-[8px] font-bold uppercase text-muted-foreground/40 hover:text-primary transition-all">Reabrir</button>
                                    )}
                                    {onDelete && (
                                        <button onClick={() => onDelete(item.id)} className="h-5 px-1.5 text-[8px] font-bold uppercase text-muted-foreground/40 hover:text-destructive transition-all">Excluir</button>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="w-full">
                                {isLog ? (
                                    <div className="bg-muted/30 dark:bg-muted/10 p-1.5 rounded-lg border border-border/50 shadow-sm">
                                        <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                            {log?.content}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="pl-1">
                                        <h4 className="text-sm font-bold text-foreground/90 flex items-center gap-1.5">
                                            {activity?.title}
                                            {(activity?.tooltipScript || activity?.notes || (activity?.title && getScriptByTitle(activity.title))) && activity?.status !== 'completed' && (() => {
                                                const rawScript = activity?.tooltipScript || (activity?.title ? getScriptByTitle(activity.title) : undefined);
                                                const contact = contacts.find(c => c.id === activity?.contactId);
                                                const company = companies.find(c => c.id === activity?.companyId);
                                                const deal = deals.find(d => d.id === activity?.dealId);

                                                const formattedScript = rawScript ? formatScript(rawScript, {
                                                    contactName: contact?.name,
                                                    companyName: company?.name,
                                                    dealTitle: deal?.title
                                                }) : undefined;

                                                return (
                                                    <ActivityScriptPopover
                                                        suggestion={activity?.notes}
                                                        script={formattedScript}
                                                    />
                                                );
                                            })()}
                                        </h4>

                                        {/* Display linked observation below the activity title */}
                                        {(() => {
                                            const observation = logs.find(l => l.activityId === activity?.id);
                                            if (!observation) return null;
                                            return (
                                                <div className="mt-1 text-xs text-foreground/80 bg-muted/20 p-2 rounded-md border border-border/30 whitespace-pre-wrap">
                                                    {observation.content}
                                                </div>
                                            );
                                        })()}

                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
