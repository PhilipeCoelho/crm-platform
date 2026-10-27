import React, { useState, useEffect, useMemo } from 'react';
import { ContentHook } from '@/types/contentIntelligence';
import { contentIntelligenceService } from '@/services/contentIntelligenceService';
import { 
    Search, Plus, Upload, Trash2, Edit2, 
    Check, X, AlertCircle
} from 'lucide-react';

interface ContentHookLibraryProps {
    userId?: string;
    onSelectHook?: (hook: ContentHook) => void;
}

export function ContentHookLibrary({ userId }: ContentHookLibraryProps) {
    const [hooks, setHooks] = useState<ContentHook[]>([]);
    const [_isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

    // Inputs para adição rápida (individual ou lista)
    const [quickInputText, setQuickInputText] = useState('');
    const [quickInputCategory, setQuickInputCategory] = useState('Auto');
    const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
    const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

    // Modais
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingHook, setEditingHook] = useState<ContentHook | null>(null);

    // Form Add / Edit
    const [formText, setFormText] = useState('');
    const [formCategory, setFormCategory] = useState('Contradição');
    const [formMechanism, setFormMechanism] = useState('Quebra de padrão');
    const [formContext, setFormContext] = useState('');
    const [formExample, setFormExample] = useState('');

    // Import CSV State
    const [csvInput, setCsvInput] = useState('');
    const [importFeedback, setImportFeedback] = useState<string | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Remoção de todos os existentes solicitada pelo utilizador
            if (!localStorage.getItem('vamuss_ci_hooks_cleaned_v2')) {
                await contentIntelligenceService.clearAllHooks(userId);
                localStorage.setItem('vamuss_ci_hooks_cleaned_v2', 'true');
                setHooks([]);
                return;
            }

            const list = await contentIntelligenceService.loadHooks(userId);
            setHooks(list);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [userId]);

    // Detetar número de ganchos na entrada rápida
    const detectedCount = useMemo(() => {
        if (!quickInputText.trim()) return 0;
        return quickInputText
            .split('\n')
            .map(l => l.replace(/^(\d+[\.\)\-:]|\*|\-|•|\>|–|—)\s*/, '').replace(/^["'«“]|["'»”]$/g, '').trim())
            .filter(l => l.length >= 3 && !/^(gancho|ganchos|hook|hooks|lista de ganchos|título|titulo)$/i.test(l)).length;
    }, [quickInputText]);

    const handleBatchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickInputText.trim()) return;

        setIsBatchSubmitting(true);
        setBatchSuccessMsg(null);
        try {
            const res = await contentIntelligenceService.batchSaveHooks(quickInputText, quickInputCategory, userId);
            setQuickInputText('');
            setBatchSuccessMsg(`✅ ${res.added} ${res.added === 1 ? 'gancho adicionado' : 'ganchos adicionados'} à biblioteca com sucesso!`);
            setTimeout(() => setBatchSuccessMsg(null), 4000);
            await loadData();
        } finally {
            setIsBatchSubmitting(false);
        }
    };

    const handleClearAllHooks = async () => {
        if (!confirm('Tens a certeza que queres eliminar TODOS os ganchos da biblioteca?')) return;
        await contentIntelligenceService.clearAllHooks(userId);
        setHooks([]);
        setBatchSuccessMsg('Todos os ganchos existentes foram eliminados.');
        setTimeout(() => setBatchSuccessMsg(null), 3000);
    };

    const categories = useMemo(() => {
        const set = new Set<string>();
        hooks.forEach(h => {
            if (h.category) set.add(h.category);
        });
        return ['Todas', ...Array.from(set)];
    }, [hooks]);

    const filteredHooks = useMemo(() => {
        return hooks.filter(h => {
            if (h.isArchived) return false;
            const matchesCat = selectedCategory === 'Todas' || h.category === selectedCategory;
            const matchesSearch = !searchTerm.trim() || 
                h.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                h.mechanism.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (h.context && h.context.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesCat && matchesSearch;
        });
    }, [hooks, selectedCategory, searchTerm]);

    const handleOpenAddModal = (hookToEdit?: ContentHook) => {
        if (hookToEdit) {
            setEditingHook(hookToEdit);
            setFormText(hookToEdit.text);
            setFormCategory(hookToEdit.category);
            setFormMechanism(hookToEdit.mechanism);
            setFormContext(hookToEdit.context || '');
            setFormExample(hookToEdit.example || '');
        } else {
            setEditingHook(null);
            setFormText('');
            setFormCategory('Contradição');
            setFormMechanism('Quebra de padrão');
            setFormContext('');
            setFormExample('');
        }
        setIsAddModalOpen(true);
    };

    const handleSaveHook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formText.trim()) return;

        await contentIntelligenceService.saveHook({
            id: editingHook?.id,
            text: formText.trim(),
            category: formCategory,
            mechanism: formMechanism,
            context: formContext.trim(),
            example: formExample.trim()
        }, userId);

        setIsAddModalOpen(false);
        loadData();
    };

    const handleDeleteHook = async (id: string) => {
        if (!confirm('Tens a certeza de que queres eliminar este gancho?')) return;
        await contentIntelligenceService.deleteHook(id, userId);
        loadData();
    };

    const handleImportCSV = async () => {
        if (!csvInput.trim()) return;
        const res = await contentIntelligenceService.importHooksFromCSV(csvInput, userId);
        setImportFeedback(`Sucesso! ${res.imported} ganchos importados, ${res.skippedDuplicates} duplicados ignorados.`);
        setTimeout(() => {
            setIsImportModalOpen(false);
            setCsvInput('');
            setImportFeedback(null);
            loadData();
        }, 2000);
    };

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden p-4 sm:p-5 space-y-4">
            {/* Header com Estatísticas e Ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                    <h2 className="text-base sm:text-lg font-medium text-foreground tracking-tight flex items-center gap-2">
                        🪝 Biblioteca Central de Ganchos
                        <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                            {hooks.length} {hooks.length === 1 ? 'gancho' : 'ganchos'}
                        </span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 font-normal">
                        Mecanismos de atenção e frases comprovadas para parar o scroll, consultados pela IA.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {hooks.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearAllHooks}
                            className="h-8 px-2.5 rounded-lg text-xs font-medium border border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-destructive flex items-center gap-1.5 transition-colors"
                            title="Eliminar todos os ganchos da biblioteca"
                        >
                            <Trash2 size={13} />
                            <span>Limpar Todos</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setIsImportModalOpen(true)}
                        className="h-8 px-2.5 rounded-lg text-xs font-medium border border-border bg-card hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors"
                        title="Importar ganchos via CSV ou texto"
                    >
                        <Upload size={13} />
                        <span>Importar CSV</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleOpenAddModal()}
                        className="h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                        <Plus size={14} />
                        <span>Novo Detalhado</span>
                    </button>
                </div>
            </div>

            {/* Campo Rápido para Enviar Lista ou 1 Gancho */}
            <div className="p-3.5 bg-card border border-border/80 rounded-xl space-y-2.5 shadow-2xs shrink-0">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Plus size={13} className="text-primary" />
                        <span>Adicionar Ganchos (1 ou em Lista)</span>
                    </span>
                    {detectedCount > 0 && (
                        <span className="text-[11px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                            {detectedCount} {detectedCount === 1 ? 'gancho detetado' : 'ganchos detetados'}
                        </span>
                    )}
                </div>

                <form onSubmit={handleBatchSubmit} className="space-y-2.5">
                    <textarea
                        rows={3}
                        value={quickInputText}
                        onChange={e => setQuickInputText(e.target.value)}
                        placeholder="Digita 1 gancho ou cola uma lista de ganchos (ex: 1 por linha, com ou sem números 1. 2. ou traços -)..."
                        className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-normal outline-none focus:border-primary placeholder:text-muted-foreground/60 resize-y min-h-[72px]"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                            <label className="text-[11px] text-muted-foreground font-normal">Categoria:</label>
                            <select
                                value={quickInputCategory}
                                onChange={e => setQuickInputCategory(e.target.value)}
                                className="h-7 px-2 bg-background border border-border rounded-md text-[11px] font-normal outline-none focus:border-primary"
                            >
                                <option value="Auto">Auto-detetar (Recomendado)</option>
                                <option value="Contradição">Contradição</option>
                                <option value="Erro Comum">Erro Comum</option>
                                <option value="Pergunta">Pergunta</option>
                                <option value="Estratégia Prática">Estratégia Prática</option>
                                <option value="Se... Então">Se... Então</option>
                                <option value="Lista / Número">Lista / Número</option>
                                <option value="História / Confissão">História / Confissão</option>
                                <option value="Geral">Geral</option>
                            </select>
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                O sistema divide por linhas, remove marcadores e grava cada gancho automaticamente.
                            </span>
                        </div>

                        <button
                            type="submit"
                            disabled={!quickInputText.trim() || isBatchSubmitting}
                            className="h-7 px-3.5 bg-primary text-primary-foreground font-medium rounded-lg text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-2xs"
                        >
                            <Plus size={13} />
                            <span>
                                {isBatchSubmitting
                                    ? 'A gravar...'
                                    : detectedCount > 1
                                        ? `Gravar ${detectedCount} Ganchos`
                                        : 'Gravar Gancho'}
                            </span>
                        </button>
                    </div>
                </form>

                {batchSuccessMsg && (
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[11px] flex items-center gap-1.5 font-medium animate-in fade-in">
                        <Check size={13} className="shrink-0" />
                        <span>{batchSuccessMsg}</span>
                    </div>
                )}
            </div>

            {/* Barra de Filtros e Pesquisa */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shrink-0">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Pesquisar por texto, mecanismo ou nicho..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-card text-foreground text-xs font-normal pl-7.5 pr-2.5 h-8 rounded-lg border border-border focus:ring-1 focus:ring-primary/40 focus:border-primary outline-none"
                    />
                </div>

                {/* Categorias Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar text-xs">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-normal transition-colors whitespace-nowrap shrink-0 border ${
                                selectedCategory === cat
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card text-muted-foreground border-border/70 hover:border-border hover:text-foreground'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid de Ganchos */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredHooks.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground bg-card border border-border/60 rounded-xl text-xs space-y-2">
                        <AlertCircle size={24} className="mx-auto text-muted-foreground/60" />
                        <p>Nenhum gancho encontrado com os filtros atuais.</p>
                        <button
                            type="button"
                            onClick={() => { setSearchTerm(''); setSelectedCategory('Todas'); }}
                            className="text-primary hover:underline text-xs"
                        >
                            Limpar filtros
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredHooks.map(hook => (
                            <div
                                key={hook.id}
                                className="bg-card text-card-foreground border border-border/70 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all group"
                            >
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                            {hook.category}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-normal">
                                            {hook.mechanism}
                                        </span>
                                    </div>
                                    <p className="text-xs text-foreground font-normal leading-relaxed italic">
                                        "{hook.text}"
                                    </p>
                                    {hook.example && (
                                        <p className="text-[11px] text-muted-foreground bg-secondary/15 p-1.5 rounded border border-border/40 font-normal">
                                            💡 Ex: {hook.example}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                                    <span>{hook.context || 'Geral'}</span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenAddModal(hook)}
                                            className="p-1 hover:text-foreground rounded"
                                            title="Editar gancho"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteHook(hook.id)}
                                            className="p-1 hover:text-destructive rounded"
                                            title="Eliminar gancho"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Criação / Edição de Gancho */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                            <h3 className="text-sm font-medium text-foreground">
                                {editingHook ? 'Editar Gancho' : 'Novo Gancho na Biblioteca'}
                            </h3>
                            <button type="button" onClick={() => setIsAddModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveHook} className="flex flex-col gap-3 text-xs">
                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase">Frase do Gancho *</label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Ex: A maioria dos empresários acredita que X, quando na verdade é Y..."
                                    value={formText}
                                    onChange={e => setFormText(e.target.value)}
                                    className="p-2 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase">Categoria</label>
                                    <input
                                        type="text"
                                        value={formCategory}
                                        onChange={e => setFormCategory(e.target.value)}
                                        placeholder="Ex: Contradição, Erro..."
                                        className="p-2 bg-background border border-border rounded-lg text-xs outline-none"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase">Mecanismo</label>
                                    <input
                                        type="text"
                                        value={formMechanism}
                                        onChange={e => setFormMechanism(e.target.value)}
                                        placeholder="Ex: Quebra de crença..."
                                        className="p-2 bg-background border border-border rounded-lg text-xs outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase">Contexto / Nicho (Opcional)</label>
                                <input
                                    type="text"
                                    value={formContext}
                                    onChange={e => setFormContext(e.target.value)}
                                    placeholder="Ex: Anúncios em Portugal, Clínicas, B2B..."
                                    className="p-2 bg-background border border-border rounded-lg text-xs outline-none"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase">Exemplo de Aplicação (Opcional)</label>
                                <input
                                    type="text"
                                    value={formExample}
                                    onChange={e => setFormExample(e.target.value)}
                                    placeholder="Ex: Se demoras 2h a responder no WhatsApp..."
                                    className="p-2 bg-background border border-border rounded-lg text-xs outline-none"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-xs"
                                >
                                    {editingHook ? 'Guardar Alterações' : 'Adicionar Gancho'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Importação em Lote via CSV */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl p-5 flex flex-col gap-3.5">
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                            <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                <Upload size={15} className="text-primary" />
                                Importar Biblioteca de Ganchos (CSV ou Texto)
                            </h3>
                            <button type="button" onClick={() => setIsImportModalOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-xs text-muted-foreground font-normal">
                            Cola abaixo as linhas do teu CSV ou ficheiro exportado. Formato esperado por linha:
                            <br />
                            <code className="text-[11px] bg-muted px-1 py-0.5 rounded text-foreground font-mono">
                                "Texto do gancho";"Categoria";"Mecanismo";"Contexto"
                            </code>
                        </p>

                        <textarea
                            rows={8}
                            placeholder={`"O erro de 500€ que vejo toda a semana";"Erro Comum";"Alerta de perda";"Portugal"\n"Porque é que recebes cliques e zero vendas";"Pergunta";"Tensão";"Vendas"`}
                            value={csvInput}
                            onChange={e => setCsvInput(e.target.value)}
                            className="w-full p-2.5 bg-background border border-border rounded-xl text-xs font-mono outline-none focus:border-primary custom-scrollbar"
                        />

                        {importFeedback && (
                            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                                <Check size={14} />
                                <span>{importFeedback}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                            <span className="text-[11px] text-muted-foreground">
                                Duplicados existentes são ignorados automaticamente.
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleImportCSV}
                                    disabled={!csvInput.trim()}
                                    className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-xs disabled:opacity-50"
                                >
                                    Importar Agora
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
