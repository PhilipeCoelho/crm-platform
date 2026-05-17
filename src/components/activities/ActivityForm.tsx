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
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription';
import { VoiceMicButton } from '@/components/shared/VoiceMicButton';


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

    const {
        isRecording,
        toggleRecording,
        interimTranscript
    } = useVoiceTranscription({
        lang: 'pt-PT',
        onResult: (text, isFinal) => {
            if (isFinal) {
                setTitle(prev => prev + (prev ? ' ' : '') + text);
            }
        }
    });

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
        <form onSubmit={handleSubmit} className="p-2 sm:p-2.5 space-y-2">
            {/* ROW 1: Textarea */}
            <div className="relative">
                <textarea
                    placeholder="O que precisa fazer?"
                    className="w-full min-h-[40px] max-h-[60px] p-2 pr-10 bg-transparent border border-border/60 focus:border-primary/50 rounded-lg outline-none text-sm transition-all resize-none font-medium custom-scrollbar"
                    style={{ fontSize: '13px' }}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                />
                <div className="absolute top-2 right-2">
                    <VoiceMicButton 
                        isRecording={isRecording}
                        onToggle={toggleRecording}
                        size="xs"
                        variant="minimal"
                    />
                </div>
                {isRecording && interimTranscript && (
                    <div className="absolute inset-x-2 bottom-2 p-1.5 bg-primary/5 border border-primary/10 rounded text-[11px] text-primary animate-pulse z-10">
                        {interimTranscript}
                    </div>
                )}
            </div>

            {/* ROW 2: Icons and Metadata */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-0.5">
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
                                                h-5 w-5 flex items-center justify-center rounded-md transition-all
                                                ${isSelected
                                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                                    : 'text-muted-foreground/60 dark:text-muted-foreground/40 hover:bg-muted dark:hover:bg-muted/10 hover:text-foreground dark:hover:text-foreground/80'}
                                            `}
                                        >
                                            <Icon size={11} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="text-[9px]">{action.label}</p>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </TooltipProvider>
                </div>

                <div className="flex items-center gap-1.5">
                    <DatePicker
                        value={date}
                        onChange={setDate}
                        className="w-[100px]"
                    />

                    <div className="w-[70px]">
                        <TimePicker
                            value={time}
                            onChange={setTime}
                        />
                    </div>
                </div>
            </div>

            {/* ROW 3: Submit Button */}
            <div className="flex justify-end pt-0.5">
                <button
                    type="submit"
                    disabled={!title.trim() || isSubmitting}
                    className="h-7 px-4 bg-primary text-primary-foreground rounded-md hover:opacity-90 font-bold text-[10px] flex items-center justify-center gap-1.5 shadow-sm shadow-primary/10 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-wider"
                >
                    {isSubmitting ? '...' : submitLabel}
                </button>
            </div>
        </form>
    );
}
