import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
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
