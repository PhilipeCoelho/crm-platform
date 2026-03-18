import { useState } from 'react';
import { CheckCircle2, ChevronLeft, Save, Copy, LayoutTemplate, X, Edit3 } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { DEFAULT_TEMPLATES, renderTemplateHTML, TemplateCategory, TEMPLATE_CATEGORIES, TemplateStructure } from './templatesData';

export default function EmailTemplates() {
    const { emailTemplates, addEmailTemplate, deleteEmailTemplate } = useCRM();

    const [isEditing, setIsEditing] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateStructure | null>(null);
    const [editData, setEditData] = useState<Record<string, any>>({});
    const [editName, setEditName] = useState('');
    const [editSubject, setEditSubject] = useState('');
    const [editCategory, setEditCategory] = useState<TemplateCategory>('Newsletter');

    const dbTemplates = emailTemplates;

    const startEditing = (template: TemplateStructure | any, isDbTemplate = false) => {
        setIsEditing(true);

        if (isDbTemplate) {
            const json = typeof template.jsonContent === 'string' ? JSON.parse(template.jsonContent) : template.jsonContent;
            setSelectedTemplate({
                id: template.id,
                name: template.name,
                category: template.category || 'Newsletter',
                subject: template.subject || '',
                thumbnail: template.thumbnail || '',
                defaultData: json || {}
            });
            setEditName(template.name);
            setEditSubject(template.subject || '');
            setEditCategory(template.category || 'Newsletter');
            setEditData(json || {});
        } else {
            setSelectedTemplate(template);
            setEditName(`${template.name} (Cópia)`);
            setEditSubject(template.subject);
            setEditCategory(template.category);
            setEditData({ ...template.defaultData });
        }
    };

    const handleSave = async () => {
        if (!selectedTemplate) return;

        const htmlContent = renderTemplateHTML(editCategory, editData);
        
        await addEmailTemplate({
            name: editName,
            subject: editSubject,
            category: editCategory,
            htmlContent,
            jsonContent: JSON.stringify(editData),
            thumbnail: selectedTemplate.thumbnail || '',
            isPublic: true
        });

        setIsEditing(false);
        setSelectedTemplate(null);
    };

    const handleDeleteDbTemplate = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir este modelo salvo?')) {
            await deleteEmailTemplate(id);
        }
    };

    if (isEditing && selectedTemplate) {
        return (
            <div className="flex flex-col h-full bg-[#F9FAFB] dark:bg-background/20 overflow-hidden">
                <div className="bg-white dark:bg-card border-b border-border p-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsEditing(false)}
                            className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h1 className="text-xl font-bold text-foreground">Construtor de Modelo de Conversão</h1>
                    </div>
                    <button 
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition-all shadow-md active:scale-95"
                    >
                        <Save size={18} />
                        Salvar Modelo
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-[400px] bg-white dark:bg-card border-r border-border flex flex-col h-full overflow-y-auto custom-scrollbar">
                        <div className="p-5 space-y-6">
                            <div className="space-y-4 border-b border-border pb-6">
                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <LayoutTemplate size={16}/> Configurações Gerais
                                </h3>
                                <div>
                                    <label className="text-xs font-semibold text-foreground mb-1 block">Nome do Modelo (Interno)</label>
                                    <input 
                                        type="text" 
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="w-full p-2.5 bg-muted/40 border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-foreground mb-1 block">Assunto Padrão</label>
                                    <input 
                                        type="text" 
                                        value={editSubject}
                                        onChange={e => setEditSubject(e.target.value)}
                                        className="w-full p-2.5 bg-muted/40 border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="Ex: Como faturar 3x mais"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-foreground mb-1 block">Categoria Estrutural</label>
                                    <select 
                                        value={editCategory}
                                        onChange={e => {
                                            const newCat = e.target.value as TemplateCategory;
                                            setEditCategory(newCat);
                                        }}
                                        className="w-full p-2.5 bg-muted/40 border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        {TEMPLATE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Edit3 size={16}/> Conteúdo da Mensagem
                                </h3>
                                
                                {Object.keys(editData).map(key => {
                                    if(key === 'insights' || key === 'benefits') {
                                        return (
                                            <div key={key}>
                                                <label className="text-xs font-semibold text-foreground mb-1 block capitalize">{key} (Itens separados por vírgula)</label>
                                                <textarea 
                                                    value={(editData[key] || []).join(', ')}
                                                    onChange={e => setEditData({...editData, [key]: e.target.value.split(',').map(s => s.trim())})}
                                                    className="w-full p-2.5 bg-muted/40 border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[60px]"
                                                />
                                            </div>
                                        )
                                    }
                                    return (
                                        <div key={key}>
                                            <label className="text-xs font-semibold text-foreground mb-1 block capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                                            <textarea 
                                                value={editData[key] || ''}
                                                onChange={e => setEditData({...editData, [key]: e.target.value})}
                                                className="w-full p-2.5 bg-muted/40 border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[40px]"
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 bg-[#F1F5F9] dark:bg-card/50 p-8 flex flex-col items-center overflow-y-auto">
                        <div className="w-full max-w-[650px] space-y-4">
                            <div className="bg-white dark:bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
                                <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Preview em Tempo Real</span>
                                <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded">{editCategory}</span>
                            </div>

                            <div 
                                className="bg-white border border-border rounded-xl shadow-xl overflow-hidden min-h-[500px]"
                                dangerouslySetInnerHTML={{ __html: renderTemplateHTML(editCategory, editData) }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="bg-white dark:bg-card border-b border-border p-6 flex flex-row justify-between items-center shrink-0">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-foreground">Modelos de e-mail</h1>
                    <p className="text-muted-foreground text-sm font-medium">Use estruturas de alta conversão comprovadas ou crie as suas.</p>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-[#F9FAFB] dark:bg-background/20 p-8 space-y-12">
                <div className="space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        Meus Modelos Salvos
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{dbTemplates.length}</span>
                    </h2>
                    
                    {dbTemplates.length === 0 ? (
                        <div className="p-8 border border-dashed border-border rounded-2xl bg-white/50 dark:bg-card/50 text-center">
                            <p className="text-muted-foreground text-sm">Você ainda não tem modelos salvos. Escolha um dos modelos premium abaixo e clique em Salvar para criar a sua biblioteca.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {dbTemplates.map(template => (
                                <div 
                                    key={template.id} 
                                    onClick={() => startEditing(template, true)}
                                    className="group cursor-pointer bg-white dark:bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/50 transition-all flex flex-col"
                                >
                                    <div className="h-[140px] bg-muted/20 relative overflow-hidden flex items-center justify-center border-b border-border">
                                        {template.thumbnail ? (
                                            <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <LayoutTemplate size={32} className="text-muted-foreground/30" />
                                        )}
                                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors" />
                                    </div>
                                    <div className="p-4 flex flex-col gap-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-foreground truncate text-sm">{template.name}</h4>
                                            <button 
                                                onClick={(e) => handleDeleteDbTemplate(template.id, e)}
                                                className="text-muted-foreground hover:text-red-500 transition-colors bg-white dark:bg-card z-10 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                        <div className="text-[11px] font-semibold text-primary">{template.category || 'Personalizado'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold">Biblioteca Alta Conversão</h2>
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] uppercase font-bold tracking-wider rounded">Recomendado</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                        {DEFAULT_TEMPLATES.map(template => (
                            <div 
                                key={template.id} 
                                className="group bg-white dark:bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all h-[280px] flex flex-col relative"
                            >
                                <div className="absolute top-3 right-3 z-10">
                                    <span className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded shadow-sm">{template.category}</span>
                                </div>
                                <div className="flex-1 relative overflow-hidden flex items-center justify-center border-b border-border bg-[#141414]">
                                    <img 
                                        src={template.thumbnail} 
                                        alt={template.name} 
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" 
                                    />
                                    <div className="absolute inset-0    " />
                                    
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                        <button 
                                            onClick={() => startEditing(template, false)}
                                            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold text-sm hover:scale-105 transition-transform shadow-xl flex items-center gap-2"
                                        >
                                            <Copy size={16} />
                                            Usar e Editar
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 bg-card h-[80px]">
                                    <h4 className="font-bold text-foreground text-sm line-clamp-1">{template.name}</h4>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1" title={template.subject}>Assunto: {template.subject}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
