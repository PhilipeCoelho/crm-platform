import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { CadenceTemplate } from '@/types/schema';
import {
    Zap, Save, ArrowLeft, MessageSquare, Mail, Phone,
    Video, BarChart3, CheckCircle2, ChevronRight,
    Clock, AlertCircle, Info, Instagram
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TAG_LABELS: Record<string, string> = {
    'LEAD': 'Lead Novo',
    'ENGAJADO': 'Lead Engajado',
    'DIAGNOSTICO': 'Reunião de Diagnóstico',
    'FECHAMENTO': 'Fechamento'
};

const ICON_MAP: Record<string, any> = {
    call: Phone,
    email: Mail,
    meeting: Clock,
    message: MessageSquare,
    instagram: Instagram,
    analysis: BarChart3,
    audit: Video,
    task: CheckCircle2,
};

export default function CadenceSettings() {
    const { cadenceTemplates, updateCadenceTemplate } = useCRM();
    const navigate = useNavigate();
    const [selectedTag, setSelectedTag] = useState<string>('LEAD');
    const [editingTemplate, setEditingTemplate] = useState<CadenceTemplate | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const filteredTemplates = cadenceTemplates.filter(t => t.tag === selectedTag);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTemplate) return;

        setIsSaving(true);
        try {
            await updateCadenceTemplate(editingTemplate.id, {
                title: editingTemplate.title,
                description: editingTemplate.description,
                script: editingTemplate.script,
                days: editingTemplate.days,
                type: editingTemplate.type
            });
            setEditingTemplate(null);
        } catch (error) {
            console.error('Failed to save template', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-border bg-card/80 sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-muted rounded-full transition-all hover:scale-105 active:scale-95"
                    >
                        <ArrowLeft size={20} className="text-muted-foreground" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            Configurações de Cadência
                            <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] uppercase tracking-widest font-black border border-primary/20">
                                Automação
                            </div>
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Defina os scripts e intervalos de tempo padrão para cada etapa do funil.</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar - Etapas */}
                <div className="w-72 border-r border-border bg-muted/5 p-6 flex flex-col gap-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-4 block">Etapas do Funil</label>
                    {Object.entries(TAG_LABELS).map(([tag, label]) => (
                        <button
                            key={tag}
                            onClick={() => setSelectedTag(tag)}
                            className={cn(
                                "flex items-center justify-between px-4 py-3 rounded-xl transition-all group",
                                selectedTag === tag
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span className="text-sm font-semibold">{label}</span>
                            <ChevronRight size={14} className={cn(
                                "transition-transform duration-300",
                                selectedTag === tag ? "translate-x-1" : "opacity-0 group-hover:opacity-100"
                            )} />
                        </button>
                    ))}

                    <div className="mt-auto p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <div className="flex items-center gap-2 text-primary mb-2">
                            <Info size={16} />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Atenção</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                            Alterações nos scripts serão refletidas imediatamente em todas as atividades <b>pendentes</b> e futuras. Alterações nos dias afetam apenas <b>novas</b> atividades criadas.
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-muted/5">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {filteredTemplates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-muted/30 rounded-3xl border border-dashed border-border">
                                <AlertCircle size={40} className="text-muted-foreground/30" />
                                <p className="text-muted-foreground font-medium">Nenhum template encontrado para esta etapa.</p>
                            </div>
                        ) : (
                            filteredTemplates.map((template) => {
                                const Icon = ICON_MAP[template.type] || Clock;
                                const isEditing = editingTemplate?.id === template.id;

                                return (
                                    <div
                                        key={template.id}
                                        className={cn(
                                            "bg-card rounded-2xl border transition-all duration-300 overflow-hidden",
                                            isEditing
                                                ? "border-primary shadow-2xl ring-4 ring-primary/5 scale-[1.01]"
                                                : "border-border/50 hover:border-border hover:shadow-xl hover:translate-y-[-2px]"
                                        )}
                                    >
                                        <div className="p-6 flex items-start gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                                isEditing ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                            )}>
                                                <Icon size={24} />
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black text-primary uppercase tracking-tighter">PASSO {template.step}</span>
                                                            <span className="text-xs text-muted-foreground">•</span>
                                                            <span className="text-xs font-bold text-muted-foreground uppercase">{template.type}</span>
                                                        </div>
                                                        <h3 className="text-lg font-bold text-foreground">{template.title}</h3>
                                                    </div>

                                                    {!isEditing && (
                                                        <button
                                                            onClick={() => setEditingTemplate({ ...template })}
                                                            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-white rounded-lg transition-all active:scale-95"
                                                        >
                                                            Editar Template
                                                        </button>
                                                    )}
                                                </div>

                                                {isEditing ? (
                                                    <form onSubmit={handleSave} className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block tracking-widest">Título da Atividade</label>
                                                                <input
                                                                    className="w-full text-sm bg-muted/30 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                                                    value={editingTemplate.title}
                                                                    onChange={e => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                                                                    placeholder="Ex: Mensagem inicial"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block tracking-widest">Intervalo (Dias após passo anterior)</label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full text-sm bg-muted/30 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                                                        value={editingTemplate.days}
                                                                        onChange={e => setEditingTemplate({ ...editingTemplate, days: parseInt(e.target.value) || 0 })}
                                                                    />
                                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">Dia(s)</div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block tracking-widest">Nota de Instrução (Curta)</label>
                                                            <input
                                                                className="w-full text-sm bg-muted/30 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                                                value={editingTemplate.description}
                                                                onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                                                                placeholder="Ex: Objetivo: Abertura de 70%+"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block tracking-widest flex items-center justify-between">
                                                                Script de Sugestão (O que copiar)
                                                                <span className="text-[9px] font-normal lowercase opacity-60">Use [Nome] e [Nome da Clínica] para preenchimento automático</span>
                                                            </label>
                                                            <textarea
                                                                className="w-full text-sm bg-muted/30 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[200px] font-mono leading-relaxed"
                                                                value={editingTemplate.script}
                                                                onChange={e => setEditingTemplate({ ...editingTemplate, script: e.target.value })}
                                                                placeholder="Digite o script aqui..."
                                                            />
                                                        </div>

                                                        <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingTemplate(null)}
                                                                className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted rounded-xl transition-all"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                type="submit"
                                                                disabled={isSaving}
                                                                className="px-8 py-3 text-xs font-bold uppercase tracking-wider text-white bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                                                            >
                                                                {isSaving ? <Zap size={14} className="animate-spin" /> : <Save size={14} />}
                                                                Salvar Alterações
                                                            </button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-6">
                                                            <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/50">
                                                                <Clock size={14} />
                                                                <span className="text-xs font-semibold">Dia {template.days}</span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground font-medium italic">"{template.description}"</p>
                                                        </div>

                                                        {template.script && (
                                                            <div className="relative group/script mt-4">
                                                                <div className="absolute top-2 right-2 flex items-center gap-2">
                                                                    <div className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-bold uppercase">Template</div>
                                                                </div>
                                                                <div className="bg-muted/30 p-4 rounded-xl border border-border/50 text-xs font-medium text-foreground/70 whitespace-pre-wrap leading-relaxed max-h-32 overflow-hidden relative">
                                                                    {template.script}
                                                                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
