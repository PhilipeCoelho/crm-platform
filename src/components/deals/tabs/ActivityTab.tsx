import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Deal } from '@/types/schema';
import { Calendar, Clock, CheckCircle2, Phone, Mail, Users, Utensils, Flag } from 'lucide-react';

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
    const [selectedType, setSelectedType] = useState('task');

    const contact = contacts.find(c => c.id === deal.contactId);
    const contactName = contact?.name || 'Cliente';

    const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
        setSelectedType(action.type);
        // Only override title if empty or looks like a template
        // Actually user request: "ao clicar exemplo, no telefone, abaixo aparece 'realizar ligação'"
        // This implies explicit text change.
        setTitle(action.template(contactName));

        // Auto-focus logic could go here
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        addActivity({
            type: selectedType as any,
            title,
            dealId: deal.id,
            dueDate: `${date}T${time}:00.000Z`,
            completed: false
        });
        setTitle('');
        setSelectedType('task'); // Reset to task or keep? Keep is usually better workflow but resetting to default is safer.
        if (onSave) onSave();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-card/50">
            <div className="space-y-2">
                <input
                    type="text"
                    placeholder="O que você precisa fazer?"
                    className="w-full p-2 bg-transparent border-b border-border focus:border-primary outline-none font-medium text-lg"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    autoFocus
                />

                {/* Quick Actions Icons */}
                <div className="flex items-center gap-2 pt-1">
                    {QUICK_ACTIONS.map(action => {
                        const Icon = action.icon;
                        const isSelected = selectedType === action.type;
                        return (
                            <button
                                key={action.type}
                                type="button"
                                onClick={() => handleQuickAction(action)}
                                className={`
                                    p-2 rounded-full border transition-all flex items-center justify-center
                                    ${isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-105'
                                        : 'bg-background text-muted-foreground border-transparent hover:bg-muted hover:scale-110'}
                                `}
                                title={action.label}
                            >
                                <Icon size={16} />
                            </button>
                        );
                    })}
                    <span className="text-xs text-muted-foreground ml-2">
                        {QUICK_ACTIONS.find(a => a.type === selectedType)?.label}
                    </span>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="flex-1 flex items-center gap-2 border rounded-md p-2 bg-background">
                    <Calendar size={16} className="text-muted-foreground" />
                    <input
                        type="date"
                        className="bg-transparent outline-none flex-1 text-sm"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                    />
                </div>
                <div className="flex-1 flex items-center gap-2 border rounded-md p-2 bg-background">
                    <Clock size={16} className="text-muted-foreground" />
                    <input
                        type="time"
                        className="bg-transparent outline-none flex-1 text-sm"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={!title.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-sm flex items-center gap-2 shadow-sm"
                >
                    <CheckCircle2 size={16} />
                    Agendar {QUICK_ACTIONS.find(a => a.type === selectedType)?.label}
                </button>
            </div>
        </form>
    );
}
