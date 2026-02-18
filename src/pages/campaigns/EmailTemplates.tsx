import { Plus, FileText, Type, Image as ImageIcon, Star, List, Code, Trash2 } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';

export default function EmailTemplates() {
    const { emailTemplates, addEmailTemplate, deleteEmailTemplate } = useCRM();

    const handleCreateTemplate = async () => {
        const name = prompt('Nome do modelo:');
        if (name) {
            await addEmailTemplate({
                name,
                htmlContent: '<h1>Seu Novo Modelo</h1>',
                isPublic: true
            });
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Page Header */}
            <div className="bg-white dark:bg-card border-b border-border p-6 flex flex-row justify-between items-center shrink-0">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-foreground">Modelos de e-mail</h1>
                    <p className="text-muted-foreground text-sm font-medium">Gerencie e crie designs para suas campanhas.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCreateTemplate}
                        className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#1eb054] text-white px-4 py-2 rounded font-bold text-sm transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
                    >
                        <Plus size={18} />
                        Modelo
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-[#F9FAFB] dark:bg-slate-950/20">
                {emailTemplates.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                        <div className="w-full max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Illustration Container */}
                            <div className="relative mx-auto w-full max-w-sm aspect-[4/3] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-border p-6 flex flex-col gap-4 overflow-hidden">
                                {/* Fake Toolbar */}
                                <div className="flex items-center justify-between border-b border-border pb-4">
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-muted-foreground" />
                                        <div className="h-2 w-24 bg-muted rounded" />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="p-1 px-2 border border-border rounded text-[10px] font-bold text-muted-foreground">Preview</div>
                                        <div className="p-1 px-2 bg-emerald-500 rounded text-[10px] font-bold text-white">Save</div>
                                    </div>
                                </div>

                                {/* Editor Canvas Placeholder */}
                                <div className="flex-1 bg-muted/20 rounded-lg border border-dashed border-border flex flex-col p-4 gap-4">
                                    <div className="h-8 w-2/3 bg-white dark:bg-slate-800 rounded mx-auto shadow-sm" />
                                    <div className="h-24 w-full bg-white dark:bg-slate-800 rounded shadow-sm" />
                                    <div className="h-10 w-1/3 bg-emerald-500 rounded-lg mx-auto shadow-md" />
                                </div>

                                {/* Floating Tool Icons Overlay */}
                                <div className="absolute top-1/4 -right-2 space-y-2 translate-x-1/2">
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-border flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        <Type size={20} />
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-border flex items-center justify-center text-emerald-500">
                                        <ImageIcon size={20} />
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-border flex items-center justify-center text-amber-500">
                                        <Star size={20} />
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-border flex items-center justify-center text-purple-500">
                                        <List size={20} />
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-border flex items-center justify-center text-slate-500">
                                        <Code size={20} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h2 className="text-3xl font-bold text-foreground">Crie modelos de e-mail personalizados</h2>
                                <p className="text-slate-500 text-lg max-w-lg mx-auto leading-relaxed">
                                    Use o poder do editor do Pipedrive de arrastar e soltar para criar designs incríveis que convertem.
                                </p>
                            </div>

                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={handleCreateTemplate}
                                    className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#1eb054] text-white px-10 py-4 rounded-xl font-bold transition-all shadow-xl shadow-emerald-500/20 active:scale-95 text-lg"
                                >
                                    <Plus size={24} />
                                    Criar modelo
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {emailTemplates.map(template => (
                            <div key={template.id} className="group bg-white dark:bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all h-[360px] flex flex-col">
                                <div className="flex-1 bg-muted/20 relative overflow-hidden flex items-center justify-center border-b border-border">
                                    {template.thumbnail ? (
                                        <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <FileText size={48} className="opacity-20" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Sem Visualização</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                        <button className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-50">Editar</button>
                                        <button className="bg-white text-slate-900 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-50">Preview</button>
                                    </div>
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-foreground truncate max-w-[160px]">{template.name}</h4>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase mt-0.5">Criado em {new Date(template.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <button
                                        onClick={() => deleteEmailTemplate(template.id)}
                                        className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
