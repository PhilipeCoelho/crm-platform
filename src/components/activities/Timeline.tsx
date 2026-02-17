import { Activity, DealLog } from '@/types/schema';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, MessageSquare, Phone, Mail, Calendar, Info, BarChart3, Video, Instagram, CheckCircle2, StickyNote, History } from 'lucide-react';

interface Props {
    activities: Activity[];
    logs?: DealLog[];
    onReopen?: (id: string) => void;
    onEdit?: (id: string, newTitle: string) => Promise<void> | void;
    onDelete?: (id: string) => void;
}

export default function Timeline({ activities, logs = [], onReopen, onEdit, onDelete }: Props) {
    // Combine and Sort by createdAt descending
    // Filter out logs that are linked to an activity to avoid duplicate separate entries
    const items = [
        ...activities.map(a => ({ ...a, itemType: 'activity' as const })),
        ...logs.filter(l => !l.activityId).map(l => ({ ...l, itemType: 'log' as const, type: 'note' as const, title: 'Nota' }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (items.length === 0) {
        return <div className="text-sm text-muted-foreground text-center py-8 bg-muted/10 rounded-xl border border-dashed border-border/50">Nenhum histórico ainda.</div>;
    }

    const getIcon = (itemType: string, type: string) => {
        const config: Record<string, { icon: any, color: string, bg: string }> = {
            call: { icon: Phone, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
            email: { icon: Mail, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
            meeting: { icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
            message: { icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
            instagram: { icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30' },
            analysis: { icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
            audit: { icon: Video, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30' },
            task: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
            note: { icon: StickyNote, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-900/30' },
            manual_note: { icon: StickyNote, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-900/30' },
            activity_note: { icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
            system: { icon: Info, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-900/30' },
            status_change: { icon: History, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-900/30' },
        };

        const { icon: Icon, color, bg } = config[type] || config.task;
        return (
            <div className={`w-full h-full rounded-full flex items-center justify-center ${bg}`}>
                <Icon size={12} className={color} />
            </div>
        );
    };

    return (
        <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-8 py-2">
            {items.map((item) => {
                const isLog = item.itemType === 'log';
                const log = isLog ? (item as any as DealLog) : null;
                const activity = !isLog ? (item as any as Activity) : null;
                const date = new Date(item.createdAt);

                return (
                    <div key={item.id} className="relative group">
                        {/* Timeline Dot with Icon */}
                        <div className="absolute -left-[38px] sm:-left-[47px] top-0.5 h-6 w-6 rounded-full border-2 border-background bg-white dark:bg-slate-900 shadow-sm z-10 transition-transform group-hover:scale-110 overflow-hidden">
                            {getIcon(item.itemType, isLog ? log?.logType || 'note' : activity?.type || 'task')}
                        </div>

                        <div className="flex flex-col gap-2">
                            {/* Header Row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        {isLog ? (log?.logType === 'system' ? 'Sistema' : 'Nota') : (
                                            activity?.type === 'call' ? 'Chamada' :
                                                activity?.type === 'email' ? 'Email' :
                                                    activity?.type === 'meeting' ? 'Reunião' :
                                                        activity?.type === 'message' ? 'Mensagem' : 'Atividade'
                                        )}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/60 dark:text-slate-600 font-medium">
                                        • {formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}
                                    </span>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!isLog && onReopen && (
                                        <button onClick={() => onReopen(item.id)} className="h-6 px-2 text-[9px] font-bold uppercase text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/5 rounded transition-all">Reabrir</button>
                                    )}
                                    {onDelete && (
                                        <button onClick={() => onDelete(item.id)} className="h-6 px-2 text-[9px] font-bold uppercase text-slate-400 hover:text-red-500 hover:bg-red-500/5 rounded transition-all">Excluir</button>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="w-full">
                                {isLog ? (
                                    <div className="bg-muted/30 dark:bg-slate-800/20 p-4 rounded-xl border border-border/50 shadow-sm">
                                        <p className="text-sm text-foreground/90 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                            {log?.content}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="pl-1">
                                        <h4 className="text-sm font-bold text-foreground/90">{activity?.title}</h4>

                                        {/* Display linked observation below the activity title */}
                                        {(() => {
                                            const observation = logs.find(l => l.activityId === activity?.id);
                                            if (!observation) return null;
                                            return (
                                                <div className="mt-2 text-sm text-foreground/80 bg-muted/20 p-3 rounded-lg border border-border/30 whitespace-pre-wrap">
                                                    {observation.content}
                                                </div>
                                            );
                                        })()}

                                        {activity?.notes && (
                                            <p className="mt-2 text-xs text-muted-foreground italic">"{activity.notes}"</p>
                                        )}
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
