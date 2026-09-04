import { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, X } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { Activity } from '@/types/schema';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    preselectedContactId?: string;
    preselectedDealId?: string;
}

export default function NewActivityModal({ isOpen, onClose, preselectedContactId, preselectedDealId }: Props) {
    const { addActivity, deals, contacts } = useCRM();
    const [title, setTitle] = useState('');
    const [type, setType] = useState<Activity['type']>('message');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [dealId, setDealId] = useState(preselectedDealId || '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setType('message');
            setDate(new Date().toISOString().split('T')[0]);
            setNotes('');
            setDealId(preselectedDealId || '');
        }
    }, [isOpen, preselectedDealId]);

    // Derived State for filtering deals
    const availableDeals = preselectedContactId
        ? deals.filter(d => d.contactId === preselectedContactId)
        : deals;

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const now = new Date();
            const isToday = date === now.toISOString().split('T')[0];
            let timeString = "12:00:00";
            if (isToday) {
                const hourAhead = new Date();
                hourAhead.setHours(now.getHours() + 1);
                timeString = `${String(hourAhead.getHours()).padStart(2, '0')}:${String(hourAhead.getMinutes()).padStart(2, '0')}:00`;
            }

            await addActivity({
                title,
                type,
                dealId: dealId || undefined,
                contactId: preselectedContactId || undefined,
                date: date,
                dueDate: `${date}T${timeString}.000Z`,
                notes,
                duration: 30,
                status: 'pending',
                completed: false
            } as any);

            onClose();
        } catch (error) {
            console.error('Error adding activity:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-border">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                    <div>
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-primary" />
                            Nova Atividade
                        </h3>
                        {preselectedContactId && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Para: {contacts.find(c => c.id === preselectedContactId)?.name || 'Contato'}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">O que deve ser feito?</label>
                        <input
                            type="text"
                            required
                            className="w-full text-sm border border-input bg-background text-foreground rounded-md p-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/50"
                            placeholder="Ex: Ligar para cliente, Enviar proposta..."
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Tipo</label>
                            <select
                                className="w-full text-sm border border-input rounded-md p-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background text-foreground"
                                value={type}
                                onChange={e => setType(e.target.value as any)}
                            >
                                <option value="message">💬 Mensagem</option>
                                <option value="email">📧 E-mail</option>
                                <option value="call">📞 Ligação</option>
                                <option value="task">✅ Tarefa</option>
                                <option value="meeting">📅 Reunião</option>
                                <option value="analysis">📊 Análise</option>
                                <option value="audit">🎥 Auditoria</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Data</label>
                            <input
                                type="date"
                                required
                                className="w-full text-sm border border-input bg-background text-foreground rounded-md p-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Vincular a Negócio (Opcional)</label>
                        <select
                            className="w-full text-sm border border-input rounded-md p-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background text-foreground"
                            value={dealId}
                            onChange={e => setDealId(e.target.value)}
                        >
                            <option value="">-- Sem vínculo --</option>
                            {availableDeals.map(deal => (
                                <option key={deal.id} value={deal.id}>
                                    {deal.title}
                                </option>
                            ))}
                        </select>
                        {preselectedContactId && availableDeals.length === 0 && (
                            <p className="text-[10px] text-muted-foreground mt-1">Este contato não possui negócios abertos.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Notas</label>
                        <textarea
                            className="w-full text-sm border border-input bg-background text-foreground rounded-md p-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[80px] placeholder:text-muted-foreground/50"
                            placeholder="Detalhes adicionais..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            <Calendar size={16} />
                            {isSubmitting ? 'Salvando...' : 'Agendar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
