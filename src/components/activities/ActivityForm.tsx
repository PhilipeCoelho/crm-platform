import { useState } from 'react';
import { Deal } from '@/types/schema';
import { CheckCircle2, Phone, Mail, MessageSquare, Users } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import TimePicker from '../ui/TimePicker';
import { DatePicker } from '../ui/DatePicker';


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
    { type: 'email', icon: Mail, label: 'E-mail', template: (name: string) => `Enviar e-mail para ${name}` },
    { type: 'call', icon: Phone, label: 'Ligação', template: (name: string) => `Ligar para ${name}` },
    { type: 'task', icon: CheckCircle2, label: 'Tarefa', template: () => `Tarefa:` },
    { type: 'meeting', icon: Users, label: 'Reunião', template: (name: string) => `Reunião com ${name}` },
];

export default function ActivityForm({ deal, onSave, initialData, contactName = 'Cliente', submitLabel = 'Agendar' }: ActivityFormProps) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(() => {
        if (initialData?.time) return initialData.time;
        const now = new Date();
        now.setHours(now.getHours() + 1);
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    const [selectedType, setSelectedType] = useState(initialData?.type || 'task');


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
                dueDate: `${date}T${time}:00.000`,
                duration: 30,
                completed: false,
                status: 'pending'
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
        <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-3">
            {/* ROW 1: Textarea */}
            <textarea
                placeholder="O que precisa fazer?"
                className="w-full min-h-[72px] max-h-[88px] p-2 bg-transparent border border-border/60 focus:border-indigo-500/50 rounded-lg outline-none text-sm transition-all resize-none font-medium custom-scrollbar"
                style={{ fontSize: '13px' }}
                value={title}
                onChange={e => setTitle(e.target.value)}
            />

            {/* ROW 2: Icons and Metadata */}
            <div className="flex items-center justify-between gap-4">
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
                                                h-7 w-7 flex items-center justify-center rounded-md transition-all
                                                ${isSelected
                                                    ? 'bg-indigo-500 text-white shadow-sm'
                                                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-600'}
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
                    <DatePicker
                        value={date}
                        onChange={setDate}
                        className="w-[125px]"
                    />

                    <div className="w-[85px]">
                        <TimePicker
                            value={time}
                            onChange={setTime}
                        />
                    </div>
                </div>
            </div>

            {/* ROW 3: Submit Button */}
            <div className="flex justify-end pt-1">
                <button
                    type="submit"
                    disabled={!title.trim() || isSubmitting}
                    className="h-8 px-5 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/10 disabled:opacity-50 transition-all active:scale-95"
                >
                    {isSubmitting ? 'Salvando...' : submitLabel}
                </button>
            </div>
        </form>
    );
}
