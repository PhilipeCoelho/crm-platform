import { useState } from 'react';
import { Activity } from '@/types/schema';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RotateCcw, Pencil, Check, X } from 'lucide-react';

interface Props {
    activities: Activity[];
    onReopen?: (id: string) => void;
    onEdit?: (id: string, newTitle: string) => Promise<void> | void;
}

export default function Timeline({ activities, onReopen, onEdit }: Props) {
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
        <div className="relative pl-6 sm:pl-8 border-l border-border/60 ml-3 space-y-8 py-2">
            {sorted.map(activity => (
                <div key={activity.id} className="relative group">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground/30 ring-4 ring-background group-hover:bg-primary group-hover:ring-primary/10 transition-all" />

                    <div className="flex flex-col gap-2">
                        {/* Header Row */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                    {activity.type === 'note' ? 'Nota' :
                                        activity.type === 'call' ? 'Chamada' :
                                            activity.type === 'email' ? 'Email' :
                                                activity.type === 'meeting' ? 'Reunião' : 'Atividade'}
                                </span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: ptBR })}
                                </span>
                            </div>

                            {/* Actions (Edit/Reopen) */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {onEdit && activity.type === 'note' && editingId !== activity.id && (
                                    <button
                                        onClick={() => handleStartEdit(activity)}
                                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary transition-colors"
                                        title="Editar nota"
                                    >
                                        <Pencil size={12} />
                                    </button>
                                )}
                                {onReopen && activity.type !== 'note' && (
                                    <button
                                        onClick={() => onReopen(activity.id)}
                                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary transition-colors"
                                        title="Reabrir"
                                    >
                                        <RotateCcw size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content Card */}
                        <div className="w-full">
                            {activity.type === 'note' ? (
                                editingId === activity.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editContent}
                                            onChange={e => setEditContent(e.target.value)}
                                            className="w-full p-3 text-sm border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-background text-foreground min-h-[80px]"
                                            autoFocus
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={handleCancelEdit} className="text-xs px-2 py-1 hover:bg-muted rounded text-muted-foreground flex items-center gap-1">
                                                <X size={12} /> Cancelar
                                            </button>
                                            <button onClick={() => handleSaveEdit(activity.id)} className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1">
                                                <Check size={12} /> Salvar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-muted/40 border border-border/50 rounded-lg text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed shadow-sm">
                                        {activity.title}
                                    </div>
                                )
                            ) : (
                                <div className="text-sm text-foreground">
                                    <span className="font-medium bg-transparent">{activity.title}</span>
                                    {activity.duration && <span className="text-muted-foreground ml-2 text-xs">({activity.duration} min)</span>}
                                    {activity.result && (
                                        <div className="mt-1.5 p-2 bg-muted/30 rounded border border-border/40 text-xs italic text-muted-foreground">
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
