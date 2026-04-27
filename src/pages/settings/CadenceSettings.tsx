import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { CadenceTemplate } from '@/types/schema';
import {
    ArrowLeft, MessageSquare, Mail, Phone,
    Video, BarChart3, CheckCircle2,
    Clock, AlertCircle, Instagram, Plus, Trash2,
    Pencil, GripVertical, Settings2,
    PlusCircle, Check, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

function SortableActivityItem({ 
    template, 
    isEditing, 
    isExpanded, 
    onEdit, 
    onDelete, 
    onToggleStatus, 
    onExpand 
}: { 
    template: CadenceTemplate; 
    isEditing: boolean;
    isExpanded: boolean;
    onEdit: (t: CadenceTemplate) => void;
    onDelete: (id: string) => void;
    onToggleStatus: (t: CadenceTemplate) => void;
    onExpand: (id: string | null) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: template.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 1,
    };

    const Icon = ICON_MAP[template.type] || Clock;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group bg-white dark:bg-card rounded-xl border transition-all duration-200",
                !template.isActive && !isEditing && "opacity-50",
                isEditing ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border/50 hover:border-border",
                isDragging && "shadow-2xl ring-2 ring-primary border-primary"
            )}
        >
            {/* Header do Item */}
            <div className="flex items-center gap-3 px-4 py-3">
                {/* Drag Handle */}
                <div 
                    {...attributes} 
                    {...listeners}
                    className="p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground"
                >
                    <GripVertical size={16} />
                </div>

                <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-border/50 bg-muted/20",
                    template.isActive ? "text-primary" : "text-muted-foreground"
                )}>
                    <Icon size={18} />
                </div>

                <div className="flex-1 min-w-0" onClick={() => !isEditing && onExpand(isExpanded ? null : template.id)}>
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground/60 tracking-wider">{template.type}</span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-[9px] font-bold text-primary bg-primary/5 px-1.5 rounded">Dia {template.days}</span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors">
                        {template.title}
                    </h4>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <button 
                        onClick={() => onToggleStatus(template)}
                        className={cn(
                            "text-[9px] font-black uppercase px-2 py-1 rounded-md transition-all",
                            template.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                        )}
                    >
                        {template.isActive ? 'Ativo' : 'Pausado'}
                    </button>

                    {!isEditing && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onEdit(template)}
                                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary"
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                onClick={() => onDelete(template.id)}
                                className="p-1.5 hover:bg-red-500/10 rounded-md text-muted-foreground hover:text-red-500"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Expansão para Script */}
            {isExpanded && !isEditing && (
                <div className="px-10 pb-4 pt-1 border-t border-border/30 animate-in slide-in-from-top-1 duration-200">
                    <div className="pt-3 space-y-3">
                        {template.description && <p className="text-[11px] text-muted-foreground italic">Orientação: {template.description}</p>}
                        <div className="bg-muted/20 p-3 rounded-lg border border-border/30">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1.5">Script Sugerido:</p>
                            <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{template.script || "Sem script configurado."}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CadenceSettings() {
    const { 
        cadenceTemplates, updateCadenceTemplate, addCadenceTemplate, deleteCadenceTemplate,
        cadenceStages, updateCadenceStage, addCadenceStage, deleteCadenceStage
    } = useCRM();
    
    const navigate = useNavigate();
    const [selectedTag, setSelectedTag] = useState<string>('LEAD');
    const [editingTemplate, setEditingTemplate] = useState<CadenceTemplate | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Stage Management
    const [isEditingStages, setIsEditingStages] = useState(false);
    const [newStageName, setNewStageName] = useState('');

    const filteredTemplates = useMemo(() => cadenceTemplates
        .filter(t => t.tag === selectedTag)
        .sort((a, b) => a.step - b.step),
    [cadenceTemplates, selectedTag]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = filteredTemplates.findIndex(t => t.id === active.id);
        const newIndex = filteredTemplates.findIndex(t => t.id === over.id);

        const newOrder = arrayMove(filteredTemplates, oldIndex, newIndex);
        
        // Update all affected steps sequentially to avoid constraint issues
        // We'll use a high base and then re-normalize
        const base = 5000;
        for (let i = 0; i < newOrder.length; i++) {
            await updateCadenceTemplate(newOrder[i].id, { step: base + i });
        }
        for (let i = 0; i < newOrder.length; i++) {
            await updateCadenceTemplate(newOrder[i].id, { step: i + 1 });
        }
    };

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
                type: editingTemplate.type,
                isActive: editingTemplate.isActive,
                step: editingTemplate.step
            });
            setEditingTemplate(null);
        } catch (error) {
            console.error('Failed to save template', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdd = async () => {
        setIsSaving(true);
        try {
            const nextStep = filteredTemplates.length + 1;
            const newT = await addCadenceTemplate({
                tag: selectedTag,
                step: nextStep,
                type: 'message',
                title: 'Nova Atividade',
                description: '',
                script: '',
                days: 0,
                isActive: true
            });
            setEditingTemplate(newT);
        } catch (error) {
            console.error('Failed to add template', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminar esta etapa da cadência?')) return;
        try {
            await deleteCadenceTemplate(id);
        } catch (error) {
            console.error('Failed to delete template', error);
        }
    };

    const toggleStatus = async (template: CadenceTemplate) => {
        await updateCadenceTemplate(template.id, { isActive: !template.isActive });
    };

    const handleAddStage = async () => {
        if (!newStageName.trim()) return;
        await addCadenceStage({
            name: newStageName,
            order: cadenceStages.length
        });
        setNewStageName('');
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-background overflow-hidden animate-in fade-in duration-500">
            {/* Header Compacto */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-white dark:bg-card/80 sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-all">
                        <ArrowLeft size={18} className="text-muted-foreground" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                            Cadências Estratégicas
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] uppercase font-black">Beta</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsEditingStages(!isEditingStages)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all",
                            isEditingStages ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <Settings2 size={14} />
                        Gerir Etapas
                    </button>
                    <button
                        onClick={handleAdd}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-sm hover:bg-primary/90 transition-all active:scale-95"
                    >
                        <Plus size={14} />
                        Novo Passo
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Minimalista */}
                <div className="w-64 border-r border-border bg-white/50 dark:bg-muted/5 p-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                    {isEditingStages ? (
                        <div className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                            <div className="px-2 mb-2">
                                <h3 className="text-[10px] font-bold uppercase text-muted-foreground">Etapas do Funil</h3>
                            </div>
                            {cadenceStages.map((stage) => (
                                <div key={stage.id} className="flex items-center gap-1 group">
                                    <input 
                                        className="flex-1 bg-transparent border-none text-xs font-medium focus:ring-0 p-1 rounded hover:bg-muted/50"
                                        value={stage.name}
                                        onChange={(e) => updateCadenceStage(stage.id, { name: e.target.value })}
                                    />
                                    <button 
                                        onClick={() => deleteCadenceStage(stage.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <div className="pt-2 flex items-center gap-2">
                                <input 
                                    className="flex-1 text-xs bg-muted/50 border border-border rounded px-2 py-1.5 outline-none focus:border-primary"
                                    placeholder="Nova etapa..."
                                    value={newStageName}
                                    onChange={(e) => setNewStageName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                                />
                                <button onClick={handleAddStage} className="text-primary hover:scale-110 transition-transform">
                                    <PlusCircle size={18} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {cadenceStages.map((stage) => (
                                <button
                                    key={stage.id}
                                    onClick={() => { setSelectedTag(stage.id); setEditingTemplate(null); }}
                                    className={cn(
                                        "flex items-center justify-between px-4 py-2.5 rounded-lg transition-all text-left",
                                        selectedTag === stage.id
                                            ? "bg-primary/10 text-primary font-bold"
                                            : "hover:bg-muted text-muted-foreground"
                                    )}
                                >
                                    <span className="text-xs">{stage.name}</span>
                                    {selectedTag === stage.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                </button>
                            ))}
                        </>
                    )}

                    {!isEditingStages && (
                        <div className="mt-auto p-4 bg-muted/30 rounded-xl border border-border/50">
                            <p className="text-[10px] text-muted-foreground leading-tight italic">
                                Arraste os passos para mudar a ordem. O sistema sugerirá estas atividades em sequência.
                            </p>
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="max-w-3xl mx-auto">
                        {editingTemplate ? (
                            <div className="animate-in zoom-in-95 duration-300">
                                <div className="flex items-center gap-2 mb-6">
                                    <button onClick={() => setEditingTemplate(null)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                                        <ArrowLeft size={16} />
                                    </button>
                                    <h2 className="text-lg font-bold">Editar Passo</h2>
                                </div>

                                <form onSubmit={handleSave} className="bg-white dark:bg-card border border-border rounded-2xl p-8 shadow-xl space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block tracking-widest">Nome do Passo</label>
                                            <input
                                                className="w-full text-sm bg-muted/20 border border-border rounded-xl px-4 py-3 outline-none focus:border-primary transition-all"
                                                value={editingTemplate.title}
                                                onChange={e => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                                                placeholder="Ex: WhatsApp Inicial"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block tracking-widest">Tipo de Atividade</label>
                                            <select
                                                className="w-full text-sm bg-muted/20 border border-border rounded-xl px-4 py-3 outline-none focus:border-primary appearance-none cursor-pointer"
                                                value={editingTemplate.type}
                                                onChange={e => setEditingTemplate({ ...editingTemplate, type: e.target.value as any })}
                                            >
                                                {Object.keys(ICON_MAP).map(type => (
                                                    <option key={type} value={type}>{type.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block tracking-widest">Delay Sugerido (Dias)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    className="w-full text-sm bg-muted/20 border border-border rounded-xl pl-4 pr-12 py-3 outline-none focus:border-primary"
                                                    value={editingTemplate.days}
                                                    onChange={e => setEditingTemplate({ ...editingTemplate, days: parseInt(e.target.value) || 0 })}
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">DIAS</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block tracking-widest">Objetivo do Passo (Opcional)</label>
                                        <input
                                            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-4 py-3 outline-none focus:border-primary"
                                            value={editingTemplate.description}
                                            onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                                            placeholder="Ex: Tentar contato inicial ou marcar reunião"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Script / Sugestão de Texto</label>
                                            <span className="text-[9px] text-primary font-bold">Variáveis: [Nome], [Nome da Clínica]</span>
                                        </div>
                                        <textarea
                                            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-4 py-4 outline-none focus:border-primary min-h-[250px] font-mono leading-relaxed resize-none"
                                            value={editingTemplate.script}
                                            onChange={e => setEditingTemplate({ ...editingTemplate, script: e.target.value })}
                                            placeholder="Olá [Nome], sou o Philipe..."
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                type="button"
                                                onClick={() => setEditingTemplate({ ...editingTemplate, isActive: !editingTemplate.isActive })}
                                                className={cn(
                                                    "w-10 h-5 rounded-full relative transition-colors",
                                                    editingTemplate.isActive ? "bg-primary" : "bg-muted"
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                                                    editingTemplate.isActive ? "right-0.5" : "left-0.5"
                                                )} />
                                            </button>
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Ativar Sugestão</span>
                                        </div>

                                        <div className="flex gap-3">
                                            <button type="button" onClick={() => setEditingTemplate(null)} className="px-6 py-3 text-xs font-bold uppercase text-muted-foreground hover:bg-muted rounded-xl transition-all">Descartar</button>
                                            <button type="submit" disabled={isSaving} className="flex items-center gap-2 bg-primary text-white text-xs font-black uppercase px-8 py-3 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                                                <Check size={16} />
                                                Salvar Alterações
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredTemplates.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                                        <AlertCircle size={32} className="mb-2" />
                                        <p className="text-xs font-medium">Nenhum passo definido para esta etapa.</p>
                                        <button onClick={handleAdd} className="mt-4 text-[10px] font-bold uppercase text-primary hover:underline">Adicionar Primeiro Passo</button>
                                    </div>
                                ) : (
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={filteredTemplates.map(t => t.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-2">
                                                {filteredTemplates.map((template, index) => (
                                                    <SortableActivityItem 
                                                        key={template.id}
                                                        template={template}
                                                        index={index}
                                                        isEditing={false}
                                                        isExpanded={expandedId === template.id}
                                                        onEdit={setEditingTemplate}
                                                        onDelete={handleDelete}
                                                        onToggleStatus={toggleStatus}
                                                        onExpand={setExpandedId}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
