import { useState, useRef } from 'react';
import { Deal } from '@/types/schema';
import { Calendar, CheckCircle2, Phone, MessageSquare, Users } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import TimePicker from '../ui/TimePicker';


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
    { type: 'call', icon: Phone, label: 'Ligação', template: (name: string) => `Ligar para ${name}` },
    { type: 'message', icon: MessageSquare, label: 'Mensagem', template: (name: string) => `Mensagem para ${name}` },
    { type: 'meeting', icon: Users, label: 'Reunião', template: (name: string) => `Reunião com ${name}` },
    { type: 'task', icon: CheckCircle2, label: 'Tarefa', template: () => `Tarefa:` },
];

export default function ActivityForm({ deal, onSave, initialData, contactName = 'Cliente', submitLabel = 'Agendar' }: ActivityFormProps) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(initialData?.time || '10:00');
    const [selectedType, setSelectedType] = useState(initialData?.type || 'task');

    const dateInputRef = useRef<HTMLInputElement>(null);


    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
        setSelectedType(action.type);
        if (!title.trim() || QUICK_ACTIONS.some(a => title.startsWith(a.template(contactName)))) {
            setTitle(action.template(contactName));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const payload = {
                type: selectedType,
                title,
                dealId: deal.id,
                dueDate: `${date}T${time}:00.000Z`,
                duration: 30,
                completed: false
            };

            if (onSave) {
                await onSave(payload);
            }

            if (!initialData) {
                setTitle('');
            }
        } catch (error) {
            console.error("Error submitting activity:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="space-y-3">
                <input
                    type="text"
                    placeholder="O que precisa fazer?"
                    className="w-full py-2 bg-transparent border-b border-border focus:border-primary outline-none font-medium text-base transition-colors"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    autoFocus
                />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
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
                                                    h-8 w-8 flex items-center justify-center rounded transition-colors
                                                    ${isSelected
                                                        ? 'bg-primary text-white shadow-sm'
                                                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}
                                                `}
                                            >
                                                <Icon size={14} />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p className="text-[10px]">{action.label}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </TooltipProvider>
                    </div>

                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-primary transition-colors pr-2 border-r border-border/50"
                            onClick={() => dateInputRef.current?.showPicker()}
                        >
                            <Calendar size={14} />
                            <input
                                ref={dateInputRef}
                                type="date"
                                className="bg-transparent outline-none text-[11px] font-bold cursor-pointer w-[90px]"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>

                        <TimePicker
                            value={time}
                            onChange={setTime}
                        />

                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <button
                    type="submit"
                    disabled={!title.trim() || isSubmitting}
                    className="h-8 px-4 bg-primary text-white rounded-md hover:bg-primary/90 font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all active:scale-95"
                >
                    <CheckCircle2 size={14} />
                    {isSubmitting ? 'Salvando...' : submitLabel}
                </button>
            </div>
        </form>
    );
}
