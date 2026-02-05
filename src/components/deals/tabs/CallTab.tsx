import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Deal } from '@/types/schema';
import { Phone, Calendar, Clock } from 'lucide-react';

interface CallTabProps {
    deal: Deal;
    onSave?: () => void;
}

export default function CallTab({ deal, onSave }: CallTabProps) {
    const { addActivity } = useCRM();
    const [subject, setSubject] = useState('Chamada de acompanhamento');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('14:00');
    const [outcome, setOutcome] = useState('');

    const handleSave = () => {
        if (!subject.trim()) return;

        addActivity({
            type: 'call',
            title: subject,
            description: outcome ? `Resultado: ${outcome}` : undefined,
            dealId: deal.id,
            dueDate: `${date}T${time}:00.000Z`,
            completed: !!outcome // If outcome is set, assume completed? Or let user decide. Let's assume scheduled if no outcome.
        });
        // Reset defaults
        setSubject('Chamada de acompanhamento');
        setOutcome('');
        if (onSave) onSave();
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-card/50">
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Assunto da Chamada</label>
                <input
                    type="text"
                    className="w-full p-2 rounded border bg-background focus:border-primary outline-none"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                />
            </div>

            <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Data</label>
                    <div className="flex items-center gap-2 border rounded p-2 bg-background">
                        <Calendar size={16} className="text-muted-foreground" />
                        <input
                            type="date"
                            className="bg-transparent outline-none flex-1 text-sm"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Hora</label>
                    <div className="flex items-center gap-2 border rounded p-2 bg-background">
                        <Clock size={16} className="text-muted-foreground" />
                        <input
                            type="time"
                            className="bg-transparent outline-none flex-1 text-sm"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Resultado (Opcional)</label>
                <textarea
                    className="w-full p-2 rounded border bg-background focus:border-primary outline-none h-20 resize-none"
                    placeholder="Descreva o resultado da chamada se já foi realizada..."
                    value={outcome}
                    onChange={e => setOutcome(e.target.value)}
                />
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
                >
                    <Phone size={16} />
                    Agendar / Registrar
                </button>
            </div>
        </div>
    );
}
