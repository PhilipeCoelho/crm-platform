import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Deal } from '@/types/schema';
import { Users, Calendar, Clock, MapPin } from 'lucide-react';

interface MeetingTabProps {
    deal: Deal;
    onSave?: () => void;
}

export default function MeetingTab({ deal, onSave }: MeetingTabProps) {
    const { addActivity } = useCRM();
    const [subject, setSubject] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('10:00');
    const [duration, setDuration] = useState('60'); // Minutes
    const [location, setLocation] = useState('');

    const handleSave = () => {
        if (!subject.trim()) return;

        addActivity({
            type: 'meeting',
            title: subject,
            description: `Local: ${location || 'Online'}. Duração: ${duration} min`,
            dealId: deal.id,
            dueDate: `${date}T${startTime}:00.000Z`,
            completed: false
        });
        setSubject('');
        setLocation('');
        if (onSave) onSave();
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-card/50">
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Assunto da Reunião</label>
                <input
                    type="text"
                    className="w-full p-2 rounded border bg-background focus:border-primary outline-none"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Ex: Apresentação de Proposta"
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
                <div className="w-1/4 space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Início</label>
                    <div className="flex items-center gap-2 border rounded p-2 bg-background">
                        <Clock size={16} className="text-muted-foreground" />
                        <input
                            type="time"
                            className="bg-transparent outline-none flex-1 text-sm"
                            value={startTime}
                            onChange={e => setStartTime(e.target.value)}
                        />
                    </div>
                </div>
                <div className="w-1/4 space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Duração (min)</label>
                    <input
                        type="number"
                        className="w-full p-2 rounded border bg-background focus:border-primary outline-none"
                        value={duration}
                        onChange={e => setDuration(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Local</label>
                <div className="flex items-center gap-2 border rounded p-2 bg-background">
                    <MapPin size={16} className="text-muted-foreground" />
                    <input
                        type="text"
                        className="w-full bg-transparent outline-none"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="Endereço ou Link (Zoom/Meet)"
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
                >
                    <Users size={16} />
                    Agendar Reunião
                </button>
            </div>
        </div>
    );
}
