import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Deal } from '@/types/schema';
import { CheckCircle2, Phone, Mail, Users, Utensils, Flag } from 'lucide-react';

interface ActivityTabProps {
    deal: Deal;
    onSave?: () => void;
}

const QUICK_ACTIONS = [
    { type: 'call', icon: Phone, label: 'Ligação', template: (name: string) => `Ligar para ${name}` },
    { type: 'email', icon: Mail, label: 'Email', template: (name: string) => `Email para ${name}` },
    { type: 'meeting', icon: Users, label: 'Reunião', template: (name: string) => `Reunião com ${name}` },
    { type: 'lunch', icon: Utensils, label: 'Almoço', template: (name: string) => `Almoço com ${name}` },
    { type: 'task', icon: CheckCircle2, label: 'Tarefa', template: () => `Tarefa:` },
    { type: 'deadline', icon: Flag, label: 'Prazo', template: () => `Prazo de entrega` },
];

export default function ActivityTab({ deal, onSave }: ActivityTabProps) {
    const { addActivity, contacts } = useCRM();
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('10:00');
    const [duration, setDuration] = useState(30);
    const [selectedType, setSelectedType] = useState('task');

    const contact = contacts.find(c => c.id === deal.contactId);
    const contactName = contact?.name || 'Cliente';

    const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
        setSelectedType(action.type);
        setTitle(action.template(contactName));
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            let validType = selectedType;
            if (selectedType === 'lunch') validType = 'meeting';
            if (selectedType === 'deadline') validType = 'task';

            await addActivity({
                type: validType as any,
                title,
                dealId: deal.id,
                dueDate: `${date}T${time}:00.000Z`,
                duration: duration,
                completed: false
            });
            setTitle('');
            setSelectedType('task');
            if (onSave) onSave();
        } catch (error) {
            console.error("Error creating activity:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ... render return ...

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card/50">
            {/* ... title input ... */}
            <div className="w-32 flex items-center gap-2 border rounded-md p-2 bg-background">
                <select
                    className="bg-transparent outline-none flex-1 text-sm appearance-none cursor-pointer"
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    title="Duração"
                >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={60}>1 hora</option>
                    <option value={120}>2 horas</option>
                </select>
            </div>
            {/* ... submit button ... */}

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={!title.trim() || isSubmitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-sm flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <CheckCircle2 size={16} />
                    {isSubmitting ? 'Agendando...' : `Agendar ${QUICK_ACTIONS.find(a => a.type === selectedType)?.label}`}
                </button>
            </div>
        </form>
    );
}
