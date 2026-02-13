import { useState } from 'react';
import { Activity } from '@/types/schema';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X } from 'lucide-react';

interface Props {
    activities: Activity[];
    onReopen?: (id: string) => void;
    onEdit?: (id: string, newTitle: string) => Promise<void> | void;
    onDelete?: (id: string) => void;
}

export default function Timeline({ activities, onReopen, onEdit, onDelete }: Props) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');

    const handleStartEdit = (activity: Activity) => {
        setEditingId(activity.id);
        setEditContent(activity.title);
    };

    const handleSaveEdit = async (id: string) => {
        if (!editContent.trim() || !onEdit) return;
        await onEdit(id, editContent);
        setEditingId(null);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditContent('');
    };

    // Sort by created/completed date descending
    const sorted = [...activities].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (sorted.length === 0) {
        return <div className="text-sm text-muted-foreground text-center py-4">Nenhum histórico ainda.</div>;
    }

    return (
        <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-12 sm:space-y-8 py-2">
            {sorted.map(activity => (
                <div key={activity.id} className="relative group">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[32px] sm:-left-[41px] top-1.5 sm:top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-slate-200 dark:bg-slate-700 ring-4 ring-background group-hover:bg-indigo-500 group-hover:ring-indigo-500/10 transition-all" />

                    <div className="flex flex-col gap-3 sm:gap-2">
                        {/* Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-xs font-bold text-foreground dark:text-slate-300 uppercase tracking-wider">
                                    {activity.type === 'note' ? 'Nota' :
                                        activity.type === 'call' ? 'Chamada' :
                                            activity.type === 'email' ? 'Email' :
                                                activity.type === 'meeting' ? 'Reunião' : 'Atividade'}
                                </span>
                                <span className="text-[10px] text-muted-foreground dark:text-slate-500 font-bold uppercase">
                                    • {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: ptBR })}
                                </span>
                            </div>

                            {/* Actions (Edit/Reopen/Delete) */}
                            <div className="flex items-center gap-2 sm:gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                {onEdit && activity.type === 'note' && editingId !== activity.id && (
                                    <button
                                        onClick={() => handleStartEdit(activity)}
                                        className="h-9 sm:h-auto px-3 sm:px-2 flex items-center justify-center bg-muted/30 sm:bg-transparent hover:bg-muted dark:hover:bg-slate-800 rounded px-2 text-muted-foreground dark:text-slate-500 hover:text-indigo-500 transition-colors text-[10px] sm:text-[10px] font-bold uppercase"
                                    >
                                        Editar
                                    </button>
                                )}
                                {onReopen && activity.type !== 'note' && (
                                    <button
                                        onClick={() => onReopen(activity.id)}
                                        className="h-9 sm:h-auto px-3 sm:px-2 flex items-center justify-center bg-muted/30 sm:bg-transparent hover:bg-muted dark:hover:bg-slate-800 rounded px-2 text-muted-foreground dark:text-slate-500 hover:text-indigo-500 transition-colors text-[10px] sm:text-[10px] font-bold uppercase"
                                    >
                                        Reabrir
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm('Excluir este item do histórico?')) {
                                                onDelete(activity.id);
                                            }
                                        }}
                                        className="h-9 sm:h-auto px-3 sm:px-2 flex items-center justify-center bg-rose-500/5 sm:bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-2 text-muted-foreground dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors text-[10px] sm:text-[10px] font-bold uppercase"
                                    >
                                        Excluir
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content Card */}
                        <div className="w-full">
                            {activity.type === 'note' ? (
                                editingId === activity.id ? (
                                    <div className="space-y-3 sm:space-y-2">
                                        <textarea
                                            value={editContent}
                                            onChange={e => setEditContent(e.target.value)}
                                            className="w-full p-4 text-base sm:text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-background text-foreground min-h-[120px] sm:min-h-[100px] shadow-inner"
                                            style={{ fontSize: '16px' }}
                                            autoFocus
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={handleCancelEdit} className="h-10 sm:h-auto px-4 sm:px-3 text-[10px] font-bold uppercase hover:bg-muted dark:hover:bg-slate-800 rounded-md text-muted-foreground flex items-center gap-1.5 transition-all">
                                                <X size={14} /> Cancelar
                                            </button>
                                            <button onClick={() => handleSaveEdit(activity.id)} className="h-10 sm:h-auto px-4 sm:px-3 text-[10px] font-bold uppercase bg-indigo-500 text-white rounded-md hover:bg-indigo-600 flex items-center gap-1.5 shadow-sm transition-all">
                                                <Check size={14} /> Salvar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 sm:p-4 bg-muted/30 dark:bg-slate-800/50 border border-border/50 dark:border-slate-700/60 rounded-xl text-sm text-foreground/90 dark:text-slate-300 whitespace-pre-wrap leading-relaxed shadow-sm max-w-full sm:max-w-[95%]">
                                        {activity.title}
                                    </div>
                                )
                            ) : (
                                <div className="text-sm text-foreground dark:text-slate-200 pl-1">
                                    <span className="font-bold sm:font-semibold bg-transparent">{activity.title}</span>
                                    {activity.duration && <span className="text-muted-foreground dark:text-slate-500 ml-2 text-xs">({activity.duration} min)</span>}
                                    {activity.result && (
                                        <div className="mt-3 p-4 bg-muted/20 dark:bg-slate-800/30 rounded-xl border border-border/30 dark:border-slate-700/40 text-sm italic text-muted-foreground dark:text-slate-400">
                                            "{activity.result}"
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
