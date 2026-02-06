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
        <div className="relative pl-4 border-l border-border space-y-6 ml-2">
            {sorted.map(activity => (
                <div key={activity.id} className="relative group">
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground/30 ring-4 ring-background group-hover:bg-primary group-hover:ring-primary/20 transition-all" />

                    <div className="text-sm flex justify-between items-start">
                        <div className="flex-1">
                            <span className="font-medium text-foreground">{activity.type === 'note' && editingId !== activity.id ? 'Nota' : activity.title}</span>
                            {/* Keep date for non-notes or if title is generic */}
                            {activity.type !== 'note' && (
                                <>
                                    <span className="text-muted-foreground mx-1">•</span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: ptBR })}
                                    </span>
                                </>
                            )}
                            {/* For notes, show date always */}
                            {activity.type === 'note' && (
                                <span className="text-xs text-muted-foreground ml-2">
                                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: ptBR })}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background px-2 -mt-1 shadow-sm border rounded">
                            {/* Edit Button for Notes */}
                            {onEdit && activity.type === 'note' && editingId !== activity.id && (
                                <button
                                    onClick={() => handleStartEdit(activity)}
                                    className="p-1 hover:bg-muted rounded text-xs text-muted-foreground hover:text-primary transition-colors"
                                    title="Editar nota"
                                >
                                    <Pencil size={12} />
                                </button>
                            )}

                            {onReopen && activity.type !== 'note' && (
                                <button
                                    onClick={() => onReopen(activity.id)}
                                    className="p-1 hover:bg-muted rounded text-xs text-primary hover:underline flex items-center gap-1"
                                    title="Reabrir atividade"
                                >
                                    <RotateCcw size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                        {activity.type === 'note' ? (
                            editingId === activity.id ? (
                                <div className="mt-2 space-y-2">
                                    <textarea
                                        value={editContent}
                                        onChange={e => setEditContent(e.target.value)}
                                        className="w-full p-2 text-sm border rounded-md focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-background text-foreground min-h-[80px]"
                                        autoFocus
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={handleCancelEdit} className="p-1 px-2 hover:bg-muted rounded text-muted-foreground flex items-center gap-1">
                                            <X size={14} /> Cancelar
                                        </button>
                                        <button onClick={() => handleSaveEdit(activity.id)} className="p-1 px-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-1">
                                            <Check size={14} /> Salvar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-2 p-3 bg-yellow-50/50 border border-yellow-100 rounded text-foreground/90 whitespace-pre-wrap font-normal">
                                    {activity.title}
                                </div>
                            )
                        ) : (
                            <>
                                {activity.type === 'call' && 'Chamada realizada'}
                                {activity.type === 'email' && 'Email enviado'}
                                {activity.type === 'meeting' && 'Reunião'}
                                {activity.type === 'task' && 'Tarefa concluída'}
                                {activity.duration && <span className="ml-1">• Duração: {activity.duration} minutos</span>}
                                {activity.result && <span className="block mt-1 text-foreground italic">"{activity.result}"</span>}
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
