import { useState } from 'react';
import { CheckCircle2, X, MessageSquare } from 'lucide-react';
import { Activity } from '@/types/schema';
import { useCRM } from '@/contexts/CRMContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    activity: Activity | null;
}

export default function CompleteActivityModal({ isOpen, onClose, activity }: Props) {
    const { completeActivityWithLog } = useCRM();
    const [notes, setNotes] = useState('');
    const [houveResposta, setHouveResposta] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !activity) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await completeActivityWithLog(activity.id, notes, houveResposta);
            setNotes('');
            onClose();
        } catch (error) {
            console.error('Error completing activity:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-background w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                    <div className="flex items-center gap-2">
                        <div className="bg-emerald-500/10 p-1.5 rounded-lg">
                            <CheckCircle2 size={20} className="text-emerald-500" />
                        </div>
                        <h3 className="font-bold text-foreground">Concluir Atividade</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Activity Title (Read-only) */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Atividade</label>
                        <div className="p-4 bg-muted/30 border border-border/50 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {activity.title}
                        </div>
                    </div>

                    {/* Sugestão de Cadência */}
                    {activity.notes && (
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <MessageSquare size={40} className="text-primary" />
                            </div>
                            <label className="block text-[10px] uppercase font-bold text-primary mb-2 tracking-widest flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                Sugestão da Cadência
                            </label>
                            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {activity.notes.split('Ex:').map((part, i) => (
                                    i === 0 ? (
                                        <p key={i} className="mb-2 font-medium">{part.trim()}</p>
                                    ) : (
                                        <div key={i} className="mt-2 p-3 bg-white dark:bg-card/50 rounded-lg border border-primary/10 shadow-sm italic text-primary dark:text-primary/90 font-medium">
                                            <span className="not-italic text-[10px] font-bold block mb-1 text-primary/60 uppercase">Dica:</span>
                                            "{part.trim()}"
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completion Notes */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-widest">Resumo do que foi feito</label>
                        <textarea
                            className="w-full text-sm border border-input bg-background text-foreground rounded-xl p-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[140px] resize-none placeholder:text-muted-foreground/50 shadow-sm transition-all"
                            placeholder="Ex: Enviei mensagem via Instagram perguntando como estão captando pacientes atualmente."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            autoFocus
                        />
                        <p className="text-[10px] text-muted-foreground mt-2 italic">* Opcional: Deixe em branco para um registro automático.</p>
                    </div>

                    {/* Houve Resposta? */}
                    <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                        <input
                            type="checkbox"
                            id="houve_resposta"
                            checked={houveResposta}
                            onChange={(e) => setHouveResposta(e.target.checked)}
                            className="w-5 h-5 rounded border-primary/20 text-primary focus:ring-primary cursor-pointer"
                        />
                        <label htmlFor="houve_resposta" className="text-sm font-medium text-foreground cursor-pointer select-none">
                            O contato respondeu durante esta atividade?
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 text-sm font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted rounded-xl transition-all disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Concluir"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
