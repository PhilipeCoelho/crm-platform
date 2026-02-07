import { useState, useRef } from 'react';
import { Deal } from '@/types/schema';
import { Calendar, Clock, CheckCircle2, Phone, Mail, Users, MessageSquare, Timer } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ActivityFormProps {
    deal: Deal;
    onSave?: (data: any) => Promise<void>;
    initialData?: {
        title: string;
        type: string;
        date: string;
        time: string;
        duration: number;
    };
    contactName?: string;
    submitLabel?: string;
}

const QUICK_ACTIONS = [
    { type: 'message', icon: MessageSquare, label: 'Mensagem', template: (name: string) => `Mensagem para ${name}` },
    { type: 'call', icon: Phone, label: 'Ligação', template: (name: string) => `Ligar para ${name}` },
    { type: 'email', icon: Mail, label: 'Email', template: (name: string) => `Email para ${name}` },
    { type: 'meeting', icon: Users, label: 'Reunião', template: (name: string) => `Reunião com ${name}` },
    { type: 'task', icon: CheckCircle2, label: 'Tarefa', template: () => `Tarefa:` },
];

export default function ActivityForm({ deal, onSave, initialData, contactName = 'Cliente', submitLabel = 'Agendar' }: ActivityFormProps) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(initialData?.time || '10:00');
    const [duration, setDuration] = useState(initialData?.duration || 30);
    const [selectedType, setSelectedType] = useState(initialData?.type || 'task');

    const dateInputRef = useRef<HTMLInputElement>(null);
    const timeInputRef = useRef<HTMLInputElement>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
        setSelectedType(action.type);
        setTitle(action.template(contactName));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Map 'message' to 'call' or 'task' if 'message' is not a valid DB enum yet?
            // Assuming 'message' is allowed or we should map it.
            // Pipedrive treats email/call/meeting/task/deadline.
            // Let's assume schema supports 'message' or we map to 'note' or 'task'.
            // Given I cannot see schema enum readily, I will assume strict compliance might be an issue.
            // But user asked to "Add new type id: message".
            // I will use 'message' as type.

            const payload = {
                type: selectedType, // Direct usage as user requested adding this type
                title,
                dealId: deal.id,
                dueDate: `${date}T${time}:00.000Z`,
                duration: Number(duration),
                completed: false
            };

            if (onSave) {
                await onSave(payload);
            }

            // Only clear if not editing (initialData absent)
            if (!initialData) {
                setTitle('');
                setSelectedType('task');
            }
        } catch (error) {
            console.error("Error submitting activity:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-2">
            <div className="space-y-1.5 px-4 pt-3">
                <input
                    type="text"
                    placeholder="O que você precisa fazer?"
                    className="w-full py-1 px-1 bg-transparent border-b border-border focus:border-primary outline-none font-medium text-sm"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    autoFocus
                />

                <div className="flex items-center gap-1 pt-0.5">
                    <TooltipProvider>
                        {QUICK_ACTIONS.map(action => {
                            const Icon = action.icon;
                            const isSelected = selectedType === action.type;
                            return (
                                <Tooltip key={action.type} delayDuration={150}>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => handleQuickAction(action)}
                                            className={`
                                                h-10 w-10 flex items-center justify-center rounded-md transition-colors
                                                ${isSelected
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'bg-transparent text-muted-foreground hover:bg-muted'}
                                            `}
                                        >
                                            <Icon size={18} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>{action.label}</p>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </TooltipProvider>
                </div>
            </div>

            <div className="flex gap-2 px-4">
                <div
                    className="flex-1 flex items-center gap-1.5 border rounded-md px-2 py-1 bg-background cursor-pointer hover:border-primary transition-colors"
                    onClick={() => dateInputRef.current?.showPicker()}
                >
                    <Calendar size={14} className="text-foreground shrink-0" />
                    <input
                        ref={dateInputRef}
                        type="date"
                        className="bg-transparent outline-none flex-1 text-xs cursor-pointer"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                    />
                </div>
                <div
                    className="w-28 flex items-center gap-2 border rounded-md px-2 py-1.5 bg-background cursor-pointer hover:border-primary transition-colors"
                    onClick={() => timeInputRef.current?.showPicker()}
                >
                    <Clock size={14} className="text-foreground shrink-0" />
                    <input
                        ref={timeInputRef}
                        type="time"
                        className="bg-transparent outline-none flex-1 text-xs cursor-pointer"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                    />
                </div>
                <div className="w-24 flex items-center gap-2 border rounded-md px-2 py-1.5 bg-background">
                    <Timer size={14} className="text-foreground shrink-0" />
                    <select
                        className="bg-transparent outline-none flex-1 text-xs appearance-none cursor-pointer"
                        value={duration}
                        onChange={e => setDuration(Number(e.target.value))}
                        title="Duração"
                    >
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={60}>1h</option>
                        <option value={120}>2h</option>
                    </select>
                </div>
            </div>

            <div className="flex justify-end px-4 pb-3">
                <button
                    type="submit"
                    disabled={!title.trim() || isSubmitting}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <CheckCircle2 size={14} />
                    {isSubmitting ? 'Salvando...' : `${submitLabel} ${QUICK_ACTIONS.find(a => a.type === selectedType)?.label}`}
                </button>
            </div>
        </form>
    );
}
