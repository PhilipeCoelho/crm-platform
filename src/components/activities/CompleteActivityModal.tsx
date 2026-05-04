import { useState, useMemo } from 'react';
import { 
    CheckCircle2, X, MessageSquare, Phone, Mail, 
    Clock, BarChart3, Video, Calendar,
    Sparkles, Check
} from 'lucide-react';
import { Activity, ActivityType } from '@/types/schema';
import { useCRM } from '@/contexts/CRMContext';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, any> = {
    call: Phone,
    email: Mail,
    meeting: Clock,
    message: MessageSquare,
    instagram: MessageSquare,
    analysis: BarChart3,
    audit: Video,
    task: Calendar,
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    activity: Activity | null;
    onCompleted?: () => void;
    initialNotes?: string;
}

export default function CompleteActivityModal({ isOpen, onClose, activity, onCompleted, initialNotes }: Props) {
    const { 
        completeActivityWithLog, 
        cadenceTemplates, 
        cadenceStages, 
        deals, 
        pipelines,
        addActivity,
        activities
    } = useCRM();

    const [notes, setNotes] = useState(initialNotes || '');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const deal = useMemo(() => 
        activity?.dealId ? deals.find(d => d.id === activity.dealId) : null, 
    [deals, activity]);

    const suggestions = useMemo(() => {
        if (!deal || cadenceStages.length === 0) return [];

        // 1. Determine active tag (Prioritize current activity, then last activity, then stage fallback)
        let tag = activity?.originStage;

        if (!tag) {
            const lastWithTag = activities
                .filter(a => a.dealId === deal.id && a.completed && a.originStage)
                .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0];
            tag = lastWithTag?.originStage;
        }

        if (!tag) {
            const stages = Object.values(pipelines).flatMap((p: any) => p.stages || []);
            const currentStage = stages.find((s: any) => s.id === deal.stageId);
            const stageTitle = currentStage?.title?.toUpperCase() || '';
            
            let matchedStage = cadenceStages.find((cs: any) => 
                stageTitle.includes(cs.name.toUpperCase()) || 
                cs.name.toUpperCase().includes(stageTitle) ||
                stageTitle.includes(cs.id.toUpperCase())
            );

            if (!matchedStage) {
                if (stageTitle.includes('ENGAJADO')) matchedStage = cadenceStages.find((cs: any) => cs.id === 'ENGAJADO');
                else if (stageTitle.includes('DIAGN') || stageTitle.includes('REUNI') || stageTitle.includes('AGENDA')) matchedStage = cadenceStages.find((cs: any) => cs.id === 'DIAGNOSTICO');
                else if (stageTitle.includes('FECHAMENTO') || stageTitle.includes('PROPOSTA')) matchedStage = cadenceStages.find((cs: any) => cs.id === 'FECHAMENTO');
                else if (stageTitle.includes('LEAD')) matchedStage = cadenceStages.find((cs: any) => cs.id === 'LEAD');
            }
            tag = matchedStage?.id || 'LEAD';
        }

        // 2. Identify already executed steps for this deal and stage
        const executedSteps = new Set(
            activities
                .filter((a: any) => a.dealId === deal.id && a.originStage === tag)
                .map((a: any) => a.sequenceStep)
                .filter((step: any) => step !== undefined && step !== null)
        );

        // 3. Get Templates and filter out executed ones AND strictly check for isActive
        return cadenceTemplates
            .filter((t: any) => t.tag === tag && t.isActive === true && !executedSteps.has(t.step))
            .sort((a: any, b: any) => a.step - b.step);
    }, [deal, cadenceTemplates, cadenceStages, pipelines, activities]);

    if (!isOpen || !activity) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // 1. Complete Current Activity
            await completeActivityWithLog(activity.id, notes, false);

            // 2. Schedule Next Activity if selected
            if (selectedTemplateId && deal) {
                const template = suggestions.find((t: any) => t.id === selectedTemplateId);
                if (template) {
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + template.days);

                    await addActivity({
                        dealId: deal.id,
                        type: template.type as ActivityType,
                        title: template.title,
                        description: template.description,
                        tooltipScript: template.script,
                        status: 'pending',
                        completed: false,
                        dueDate: dueDate.toISOString(),
                        sequenceStep: template.step,
                        suggestedDelay: template.days,
                        originStage: template.tag,
                        isAutomatic: true
                    });
                }
            }

            setNotes('');
            setSelectedTemplateId(null);
            onClose();
            if (onCompleted) onCompleted();
        } catch (error) {
            console.error('Error in completion flow:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden border border-border animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/10 p-2 rounded-xl">
                            <CheckCircle2 size={20} className="text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground">Concluir Atividade</h3>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{activity.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                    {/* Completion Notes */}
                    <div className="space-y-3">
                        <label className="block text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Resumo do que foi feito</label>
                        <textarea
                            className="w-full text-sm border border-input bg-muted/20 text-foreground rounded-2xl p-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[120px] resize-none placeholder:text-muted-foreground/30 shadow-sm transition-all"
                            placeholder="Ex: Enviei mensagem via Instagram perguntando como estão captando pacientes atualmente."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Next Steps (Cadence) */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-primary" />
                            <label className="block text-[10px] uppercase font-bold text-primary tracking-widest">O que faremos agora?</label>
                        </div>

                        <div className="grid gap-3">
                            {suggestions.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic bg-muted/20 p-4 rounded-xl border border-dashed border-border">
                                    Nenhuma sugestão configurada para esta etapa.
                                </p>
                            ) : (
                                suggestions.map((template) => {
                                    const Icon = ICON_MAP[template.type] || Clock;
                                    const isSelected = selectedTemplateId === template.id;

                                    return (
                                        <button
                                            key={template.id}
                                            type="button"
                                            onClick={() => setSelectedTemplateId(isSelected ? null : template.id)}
                                            className={cn(
                                                "flex items-center gap-4 p-4 rounded-2xl border text-left transition-all",
                                                isSelected 
                                                    ? "bg-primary/5 border-primary shadow-md ring-1 ring-primary/10" 
                                                    : "bg-muted/10 border-transparent hover:border-border hover:bg-muted/30"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                                isSelected ? "bg-primary text-white" : "bg-card text-muted-foreground border border-border"
                                            )}>
                                                <Icon size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-bold text-foreground truncate">{template.title}</h4>
                                                    <span className="text-[9px] font-bold text-muted-foreground">+{template.days}d</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground truncate">{template.description}</p>
                                            </div>
                                            {isSelected && (
                                                <div className="bg-primary/10 p-1 rounded-full text-primary">
                                                    <Check size={14} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted rounded-2xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-[2] px-6 py-4 text-[11px] font-black uppercase tracking-widest text-white bg-emerald-500 hover:bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Check size={16} />
                                    Concluir {selectedTemplateId ? "& Agendar Próxima" : ""}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
