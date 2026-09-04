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

    const getItemDate = (item: any) => {
        if (item.itemType === 'activity' && item.completed && item.completedAt) {
            return new Date(item.completedAt);
        }
        return new Date(item.createdAt);
    };

    // Combine and Sort by completedAt (for completed activities) or createdAt (for logs / pending activities)
    // Filter out logs that are linked to an activity to avoid duplicate separate entries
    const items = [
        ...activities.map(a => ({ ...a, itemType: 'activity' as const })),
        ...logs.filter(l => {
            // Hide logs that have an activityId (they show inside activities), unless they are manual notes
            if (l.activityId && l.logType !== 'manual_note') return false;
            // Hide system "no notes" logs that somehow lost their link - they clutter the UI
            if (l.logType === 'system' && l.content === 'Atividade concluída sem observações.') return false;
            return true;
        }).map(l => ({ 
            ...l, 
            itemType: 'log' as const, 
            type: l.logType === 'brevo_campaign' ? ('brevo_campaign' as const) : ('note' as const), 
            title: l.logType === 'brevo_campaign' ? 'Campanha Brevo' : 'Nota' 
        }))
    ].sort((a, b) => getItemDate(b).getTime() - getItemDate(a).getTime());

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
            brevo_campaign: { icon: Mail, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
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
                const date = getItemDate(item);

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
                                        {isLog ? (log?.logType === 'system' ? 'Sistema' : log?.logType === 'brevo_campaign' ? 'Campanha Brevo' : 'Nota') : (
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
                                     log?.logType === 'brevo_campaign' ? (() => {
                                         try {
                                             const data = JSON.parse(log.content);
                                             return (
                                                 <div className="pl-1">
                                                     <div className="flex items-baseline justify-between flex-wrap gap-2">
                                                         <h4 className="text-sm font-bold text-foreground/90 flex items-center gap-1.5">
                                                             {data.campaignName}
                                                             <span className="text-[10px] font-normal text-muted-foreground/50 font-mono">(ID: {data.campaignId})</span>
                                                         </h4>
                                                         {data.sentAt && (
                                                             <span className="text-[10px] text-muted-foreground/50 font-mono">
                                                                 Enviado: {new Date(data.sentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                             </span>
                                                         )}
                                                     </div>

                                                     <div className="mt-1 text-xs text-foreground/80 bg-muted/20 p-2 rounded-md border border-border/30 max-w-xl space-y-1.5">
                                                         <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground/90">
                                                             <div className="flex items-center gap-1">
                                                                 <span className="font-semibold text-foreground/75">Status:</span>
                                                                 {data.bounce ? (
                                                                     <span className="font-bold text-red-500">❌ Bounce</span>
                                                                 ) : data.deliveryStatus === 'delivered' ? (
                                                                     <span className="font-semibold text-emerald-600 dark:text-emerald-400">✅ Entregue</span>
                                                                 ) : (
                                                                     <span className="font-semibold text-foreground/80">🕒 Pendente</span>
                                                                 )}
                                                             </div>
                                                             <span className="text-muted-foreground/30">•</span>
                                                             <div className="flex items-center gap-1">
                                                                 <span className="font-semibold text-foreground/75">Aberturas:</span>
                                                                 {data.opensCount > 0 ? (
                                                                     <span className="font-semibold text-foreground/90">👀 {data.opensCount} {data.opensCount === 1 ? 'vez' : 'vezes'}</span>
                                                                 ) : (
                                                                     <span className="text-muted-foreground/60 font-medium">Nunca aberto</span>
                                                                 )}
                                                             </div>
                                                             <span className="text-muted-foreground/30">•</span>
                                                             <div className="flex items-center gap-1">
                                                                 <span className="font-semibold text-foreground/75">Cliques:</span>
                                                                 {data.clicksCount > 0 ? (
                                                                     <span className="font-semibold text-indigo-600 dark:text-indigo-400">🔗 {data.clicksCount} {data.clicksCount === 1 ? 'clique' : 'cliques'}</span>
                                                                 ) : (
                                                                     <span className="text-muted-foreground/60 font-medium">Nenhum clique</span>
                                                                 )}
                                                             </div>
                                                         </div>

                                                         {(data.lastOpenedAt || data.unsubscribed || data.spam) && (
                                                             <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground/70 pt-1 border-t border-border/10">
                                                                 {data.lastOpenedAt && (
                                                                     <div>
                                                                         <span className="font-medium text-foreground/60">Última interação:</span>{' '}
                                                                         {new Date(data.lastOpenedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                     </div>
                                                                 )}
                                                                 {data.lastOpenedAt && (data.unsubscribed || data.spam) && <span className="text-muted-foreground/30">•</span>}
                                                                 {data.unsubscribed && (
                                                                     <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-semibold uppercase tracking-wide text-[8px]">
                                                                         ❌ Descadastrado
                                                                     </span>
                                                                 )}
                                                                 {data.spam && (
                                                                     <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 font-semibold uppercase tracking-wide text-[8px]">
                                                                         ⚠️ Spam
                                                                     </span>
                                                                 )}
                                                             </div>
                                                         )}

                                                         {data.clickedLinks && data.clickedLinks.length > 0 && (
                                                             <div className="pt-1.5 border-t border-border/20">
                                                                 <span className="font-semibold text-[9px] uppercase text-muted-foreground/60 tracking-wider block mb-1">Links Clicados:</span>
                                                                 <ul className="space-y-1 pl-0.5">
                                                                     {data.clickedLinks.map((link: any, idx: number) => (
                                                                         <li key={idx} className="flex justify-between items-center text-[10px] text-foreground/80 hover:text-primary transition-colors">
                                                                             <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 truncate max-w-[85%] text-indigo-600 dark:text-indigo-400 font-medium">
                                                                                 🔗 {link.anchor || link.url}
                                                                             </a>
                                                                             <span className="text-[9px] text-muted-foreground shrink-0 font-mono">({link.clicks}x)</span>
                                                                         </li>
                                                                     ))}
                                                                 </ul>
                                                             </div>
                                                         )}
                                                     </div>
                                                 </div>
                                             );
                                         } catch (e) {
                                             return (
                                                 <div className="bg-muted/30 dark:bg-muted/10 p-1.5 rounded-lg border border-border/50 shadow-sm">
                                                     <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                                                 </div>
                                             );
                                         }
                                     })() : (
                                         <div className="bg-muted/30 dark:bg-muted/10 p-1.5 rounded-lg border border-border/50 shadow-sm">
                                             <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                                 {log?.content}
                                             </p>
                                         </div>
                                     )
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

                                        {/* Display notes and/or linked observation below the activity title */}
                                        {(() => {
                                            const observation = logs.find(l => l.activityId === activity?.id && l.logType !== 'manual_note');
                                            const textToShow = observation?.content || activity?.notes;
                                            if (!textToShow) return null;
                                            return (
                                                <div className="mt-1 text-xs text-foreground/80 bg-muted/20 p-2 rounded-md border border-border/30 whitespace-pre-wrap">
                                                    {textToShow}
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
