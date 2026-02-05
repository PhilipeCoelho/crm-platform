import { Activity } from '@/types/schema';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RotateCcw } from 'lucide-react';

interface Props {
    activities: Activity[];
    onReopen?: (id: string) => void;
}

export default function Timeline({ activities, onReopen }: Props) {
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
                        <div>
                            <span className="font-medium text-foreground">{activity.title}</span>
                            <span className="text-muted-foreground mx-1">•</span>
                            <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: ptBR })}
                            </span>
                        </div>

                        {onReopen && (
                            <button
                                onClick={() => onReopen(activity.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-primary hover:underline flex items-center gap-1 bg-background px-2 -mt-1"
                                title="Reabrir atividade"
                            >
                                <RotateCcw size={12} /> Reabrir
                            </button>
                        )}
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                        {activity.type === 'call' && 'Chamada realizada'}
                        {activity.type === 'email' && 'Email enviado'}
                        {activity.type === 'meeting' && 'Reunião'}
                        {activity.type === 'task' && 'Tarefa concluída'}
                        {activity.type === 'note' && 'Nota adicionada'}
                        {activity.duration && <span className="ml-1">• Duração: {activity.duration}</span>}
                        {activity.result && <span className="block mt-1 text-foreground italic">"{activity.result}"</span>}
                    </div>
                </div>
            ))}
        </div>
    );
}
