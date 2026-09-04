import { useCRM } from '@/contexts/CRMContext';
import { 
    X, Sparkles, Calendar, MessageSquare, 
    Phone, Mail, BarChart3, Video, Clock, 
    AlertCircle, Info, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActivityType, CadenceTemplate } from '@/types/schema';
import { useState, useMemo } from 'react';

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

export default function ActivitySuggestionModal() {
    const { 
        suggestionModalDealId, 
        setSuggestionModalDealId, 
        deals, 
        cadenceTemplates, 
        cadenceStages,
        activities,
        addActivity,
        pipelines
    } = useCRM();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const deal = useMemo(() => 
        deals.find(d => d.id === suggestionModalDealId), 
    [deals, suggestionModalDealId]);

    const suggestions = useMemo(() => {
        if (!deal || cadenceStages.length === 0) return [];

        // 1. Find Stage Tag
        const stages = Object.values(pipelines).flatMap(p => p.stages || []);
        const currentStage = stages.find(s => s.id === deal.stageId);
        const stageTitle = currentStage?.title?.toUpperCase() || '';
        
        let matchedStage = cadenceStages.find(cs => 
            stageTitle.includes(cs.name.toUpperCase()) || 
            cs.name.toUpperCase().includes(stageTitle) ||
            stageTitle.includes(cs.id.toUpperCase())
        );

        if (!matchedStage) {
            if (stageTitle.includes('ENGAJADO')) matchedStage = cadenceStages.find(cs => cs.id === 'ENGAJADO');
            else if (stageTitle.includes('DIAGN') || stageTitle.includes('REUNI') || stageTitle.includes('AGENDA')) matchedStage = cadenceStages.find(cs => cs.id === 'DIAGNOSTICO');
            else if (stageTitle.includes('FECHAMENTO') || stageTitle.includes('PROPOSTA')) matchedStage = cadenceStages.find(cs => cs.id === 'FECHAMENTO');
            else if (stageTitle.includes('LEAD')) matchedStage = cadenceStages.find(cs => cs.id === 'LEAD');
        }

        const tag = matchedStage?.id || 'LEAD';

        // 2. Identify executed steps
        const executedSteps = new Set(
            activities
                .filter((a: any) => a.dealId === deal.id && a.originStage === tag)
                .map((a: any) => a.sequenceStep)
                .filter(Boolean)
        );

        // 3. Get Templates and filter out executed ones + MUST BE ACTIVE
        return cadenceTemplates
            .filter((t: any) => t.tag === tag && t.isActive === true && !executedSteps.has(t.step))
            .sort((a: any, b: any) => a.step - b.step);
    }, [deal, cadenceTemplates, cadenceStages, pipelines, activities]);

    if (!suggestionModalDealId || !deal) return null;

    const handleCreateActivity = async (template: CadenceTemplate) => {
        setIsCreating(true);
        try {
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
                isAutomatic: true,
                isOptimistic: true
            });
            setSuggestionModalDealId(null);
        } catch (error) {
            console.error('Failed to create suggested activity', error);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-lg rounded-[32px] border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="relative p-8 pb-4">
                    <button 
                        onClick={() => setSuggestionModalDealId(null)}
                        className="absolute top-6 right-6 p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <X size={20} className="text-muted-foreground" />
                    </button>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Sparkles size={20} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Próximo Passo</span>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-foreground">
                        O que faremos agora?
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Selecione a primeira ação da cadência para <span className="font-bold text-foreground">{deal.title}</span>.
                    </p>
                </div>

                {/* Suggestions List */}
                <div className="px-6 pb-6 max-h-[400px] overflow-y-auto custom-scrollbar space-y-3">
                    {suggestions.length === 0 ? (
                        <div className="py-8 text-center space-y-3">
                            <Info size={32} className="mx-auto text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground italic">Nenhuma sugestão ativa para esta etapa.</p>
                            <button 
                                onClick={() => setSuggestionModalDealId(null)}
                                className="text-xs font-bold text-primary hover:underline uppercase"
                            >
                                Definir manualmente depois
                            </button>
                        </div>
                    ) : (
                        suggestions.map((template) => {
                            const Icon = ICON_MAP[template.type] || Clock;
                            const isSelected = selectedId === template.id;

                            return (
                                <button 
                                    key={template.id}
                                    onClick={() => setSelectedId(template.id)}
                                    className={cn(
                                        "w-full group relative flex items-start gap-4 p-5 rounded-2xl border transition-all text-left",
                                        isSelected 
                                            ? "bg-primary/5 border-primary shadow-lg ring-1 ring-primary/20" 
                                            : "bg-muted/30 border-transparent hover:border-border hover:bg-muted/50"
                                    )}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                        isSelected ? "bg-primary text-white" : "bg-card text-muted-foreground border border-border"
                                    )}>
                                        <Icon size={20} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black uppercase text-primary tracking-tighter">Passo {template.step}</span>
                                            <span className="text-[10px] font-bold text-muted-foreground">+{template.days} dias</span>
                                        </div>
                                        <h4 className="font-bold text-foreground truncate">{template.title}</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{template.description}</p>
                                        
                                        {isSelected && (
                                            <div className="mt-4 pt-4 border-t border-primary/10 animate-in slide-in-from-top-2 duration-300">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCreateActivity(template);
                                                    }}
                                                    disabled={isCreating}
                                                    className="w-full py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                                >
                                                    {isCreating ? "Agendando..." : "Agendar Agora"}
                                                    <Check size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 flex items-center justify-between border-t border-border bg-muted/5">
                    <button 
                        onClick={() => setSuggestionModalDealId(null)}
                        className="text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Ignorar por enquanto
                    </button>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <AlertCircle size={12} />
                        <span>Respeita a cadência configurada</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
