import React, { useState, useEffect } from 'react';
import { ContentIdea, ContentProposal, ContentFormat, ProposalApprovalStatus } from '@/types/contentIntelligence';
import { contentIntelligenceService } from '@/services/contentIntelligenceService';
import { EditorialGridTable } from './EditorialGridTable';
import { ProposalDetailModal } from './ProposalDetailModal';
import { 
    Sparkles, Lightbulb, Loader2, AlertCircle, 
    Trash2, ChevronRight
} from 'lucide-react';

interface ContentIdeasAreaProps {
    userId?: string;
    onGoToKanban?: () => void;
}

export function ContentIdeasArea({ userId, onGoToKanban }: ContentIdeasAreaProps) {
    const [ideas, setIdeas] = useState<ContentIdea[]>([]);
    const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
    const [_isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Form States
    const [rawIdea, setRawIdea] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [personalContext, setPersonalContext] = useState('');
    const [goal] = useState('');
    const [preferredFormat, setPreferredFormat] = useState<ContentFormat>('aberto');

    // Modal de Detalhe da Proposta
    const [selectedProposal, setSelectedProposal] = useState<ContentProposal | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const list = await contentIntelligenceService.loadIdeas(userId);
            setIdeas(list);
            if (list.length > 0 && !selectedIdeaId) {
                setSelectedIdeaId(list[0].id);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [userId]);

    const activeIdea = ideas.find(i => i.id === selectedIdeaId) || ideas[0] || null;

    const handleSubmitIdea = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rawIdea.trim()) return;

        setErrorMsg(null);
        setIsAnalyzing(true);

        // 1. Guardar o registo inicial da ideia como "processando"
        const newIdea = await contentIntelligenceService.saveIdea({
            rawIdea: rawIdea.trim(),
            targetAudience: targetAudience.trim(),
            personalContext: personalContext.trim(),
            goal: goal.trim(),
            preferredFormat,
            status: 'processando'
        }, userId);

        setSelectedIdeaId(newIdea.id);
        setIdeas(prev => [newIdea, ...prev.filter(i => i.id !== newIdea.id)]);

        try {
            // 2. Carregar ganchos da biblioteca para alimentar o prompt
            const hooks = await contentIntelligenceService.loadHooks(userId);

            // 3. Chamar backend com IA real
            const response = await fetch('/api/content-intelligence/analyze-idea', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idea: newIdea.rawIdea,
                    targetAudience: newIdea.targetAudience,
                    personalContext: newIdea.personalContext,
                    goal: newIdea.goal,
                    preferredFormat: newIdea.preferredFormat,
                    hookLibrary: hooks.map(h => ({ text: h.text, category: h.category }))
                })
            });

            let resJson: any = null;
            try {
                const text = await response.text();
                resJson = text ? JSON.parse(text) : {};
            } catch (jsonErr) {
                console.warn('Erro ao processar JSON da ideia:', jsonErr);
            }

            if (!response.ok) {
                const errMsg = resJson?.error || `Erro de resposta do servidor (${response.status}).`;
                throw new Error(errMsg);
            }

            const rawProposals = resJson?.data?.propostas || [];

            // 4. Salvar as propostas associadas a esta ideia
            const savedProposals: ContentProposal[] = [];
            for (const p of rawProposals) {
                const saved = await contentIntelligenceService.saveProposal({
                    ideaId: newIdea.id,
                    angulo: p.angulo || 'Ângulo Estratégico',
                    ideiaMelhorada: p.ideia_melhorada || newIdea.rawIdea,
                    ganchoBase: p.gancho_base || '',
                    retencaoHook: p.retencao_hook || '',
                    titulo: p.titulo || 'Proposta de Conteúdo',
                    formato: p.formato || 'Reel',
                    objetivo: p.objetivo || newIdea.goal,
                    publicoAlvo: p.publico_alvo || newIdea.targetAudience,
                    ganchoVerbal: p.gancho_verbal || p.gancho_base,
                    ganchoVisual: p.gancho_visual || '',
                    roteiroSlides: p.roteiro_slides || '',
                    sugestoesCenas: p.sugestoes_cenas || '',
                    sugestoesEnquadramento: p.sugestoes_enquadramento || '',
                    sugestoesEdicao: p.sugestoes_edicao || '',
                    textoTela: p.texto_tela || '',
                    cta: p.cta || '',
                    justificativaEstrategica: p.justificativa_estrategica || '',
                    limitacoesHipoteses: p.limitacoes_hipoteses || '',
                    ganchosUtilizados: p.ganchos_utilizados || [],
                    statusAprovacao: 'rascunho'
                }, userId);
                savedProposals.push(saved);
            }

            // 5. Atualizar ideia para concluída
            newIdea.status = 'concluido';
            newIdea.proposals = savedProposals;
            await contentIntelligenceService.saveIdea(newIdea, userId);

            // Limpar formulário de entrada
            setRawIdea('');
            setPersonalContext('');
            await loadData();
        } catch (err: any) {
            console.error('Erro ao analisar ideia:', err);
            newIdea.status = 'erro';
            newIdea.errorMessage = err.message || 'Falha na conexão com a IA.';
            await contentIntelligenceService.saveIdea(newIdea, userId);
            setErrorMsg(err.message);
            await loadData();
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDeleteIdea = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Eliminar esta ideia e as propostas associadas?')) return;
        await contentIntelligenceService.deleteIdea(id, userId);
        if (selectedIdeaId === id) setSelectedIdeaId(null);
        loadData();
    };

    const handleSendProposalToKanban = async (proposalId: string) => {
        const res = await contentIntelligenceService.sendProposalToKanban(proposalId, userId);
        if (res.alreadyExisted) {
            alert('Esta proposta já está no Kanban de Produção.');
        } else {
            alert('✅ Proposta enviada com sucesso para a etapa de Ideias no Kanban!');
        }
        loadData();
    };

    const handleUpdateProposalStatus = async (proposalId: string, status: ProposalApprovalStatus) => {
        await contentIntelligenceService.updateProposalStatus(proposalId, status, userId);
        if (selectedProposal && selectedProposal.id === proposalId) {
            setSelectedProposal(prev => prev ? { ...prev, statusAprovacao: status } : null);
        }
        loadData();
    };

    const handleSaveFullProposal = async (updated: ContentProposal) => {
        await contentIntelligenceService.saveProposal(updated, userId);
        setSelectedProposal(updated);
        loadData();
    };

    return (
        <div className="flex flex-col lg:flex-row h-full w-full bg-background overflow-hidden">
            {/* Coluna Esquerda: Formulário de Entrada + Histórico de Ideias */}
            <div className="w-full lg:w-[420px] lg:border-r border-border/70 flex flex-col h-full bg-card/40 shrink-0 overflow-y-auto custom-scrollbar">
                {/* Form de Nova Ideia */}
                <div className="p-4 sm:p-5 border-b border-border/60 space-y-3.5">
                    <div>
                        <h2 className="text-sm sm:text-base font-medium text-foreground flex items-center gap-2">
                            <Lightbulb size={16} className="text-amber-500" />
                            Área A: Desenvolver Ideia Própria
                        </h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-normal">
                            Insere uma ideia, observação ou dor real para a IA desenvolver ângulos originais.
                        </p>
                    </div>

                    <form onSubmit={handleSubmitIdea} className="space-y-3 text-xs">
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                Ideia ou Observação Comercial *
                            </label>
                            <textarea
                                required
                                rows={3}
                                placeholder="Ex: Muitos empresários investem em anúncios, mas demoram 4 horas a responder aos leads no WhatsApp..."
                                value={rawIdea}
                                onChange={e => setRawIdea(e.target.value)}
                                className="w-full p-2.5 bg-background border border-border rounded-xl text-xs font-normal outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 resize-y"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10.5px] font-medium text-muted-foreground uppercase">
                                    Público (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Clínicas, Donos de PMEs..."
                                    value={targetAudience}
                                    onChange={e => setTargetAudience(e.target.value)}
                                    className="p-2 bg-background border border-border rounded-lg text-xs font-normal outline-none focus:border-primary"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10.5px] font-medium text-muted-foreground uppercase">
                                    Formato
                                </label>
                                <select
                                    value={preferredFormat}
                                    onChange={e => setPreferredFormat(e.target.value as ContentFormat)}
                                    className="p-2 bg-background border border-border rounded-lg text-xs font-normal outline-none"
                                >
                                    <option value="aberto">Recomendação IA</option>
                                    <option value="Reel">Reel (Vídeo)</option>
                                    <option value="Carrossel">Carrossel</option>
                                    <option value="TikTok">TikTok</option>
                                    <option value="Vídeo Curto">Vídeo 15s</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10.5px] font-medium text-muted-foreground uppercase">
                                Contexto Pessoal ou Objetivo (Opcional)
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: Aconteceu numa reunião ontem / Quero gerar contactos"
                                value={personalContext}
                                onChange={e => setPersonalContext(e.target.value)}
                                className="p-2 bg-background border border-border rounded-lg text-xs font-normal outline-none"
                            />
                        </div>

                        {errorMsg && (
                            <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-center gap-1.5 font-normal">
                                <AlertCircle size={13} />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isAnalyzing || !rawIdea.trim()}
                            className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>A consultar ganchos e desenvolver...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} />
                                    <span>Desenvolver com IA</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Lista de Ideias Já Analisadas */}
                <div className="p-4 space-y-2 flex-1">
                    <span className="text-[10.5px] uppercase font-medium text-muted-foreground tracking-wider block">
                        Ideias Registadas ({ideas.length})
                    </span>

                    {ideas.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center font-normal">
                            Nenhuma ideia registada ainda.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {ideas.map(item => {
                                const isSelected = item.id === activeIdea?.id;
                                const propCount = item.proposals?.length || 0;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedIdeaId(item.id)}
                                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${
                                            isSelected 
                                                ? 'bg-primary/10 border-primary/40 text-foreground' 
                                                : 'bg-card hover:bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="line-clamp-2 font-normal text-foreground leading-snug">
                                                {item.rawIdea}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                                <span>{propCount} {propCount === 1 ? 'proposta' : 'propostas'}</span>
                                                <span>•</span>
                                                <span className={`capitalize ${
                                                    item.status === 'concluido' ? 'text-emerald-500 font-medium' :
                                                    item.status === 'processando' ? 'text-amber-500 font-medium' :
                                                    item.status === 'erro' ? 'text-destructive' : ''
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteIdea(item.id, e)}
                                            className="p-1 hover:text-destructive opacity-40 hover:opacity-100 transition-opacity"
                                            title="Eliminar ideia"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Coluna Direita: Grelha Editorial Oficial da Ideia Ativa */}
            <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-5 space-y-4">
                {activeIdea ? (
                    <>
                        <div className="flex items-center justify-between gap-3 shrink-0 pb-2 border-b border-border/50">
                            <div>
                                <span className="text-[10px] uppercase font-medium text-primary tracking-wider">
                                    Ideia Selecionada
                                </span>
                                <h3 className="text-sm font-medium text-foreground leading-snug mt-0.5">
                                    "{activeIdea.rawIdea}"
                                </h3>
                            </div>

                            {onGoToKanban && (
                                <button
                                    type="button"
                                    onClick={onGoToKanban}
                                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-1 shrink-0"
                                >
                                    <span>Ver no Kanban</span>
                                    <ChevronRight size={13} />
                                </button>
                            )}
                        </div>

                        {/* Tabela com a Grelha Oficial das 4 Colunas */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <EditorialGridTable
                                proposals={activeIdea.proposals || []}
                                onOpenProposal={p => setSelectedProposal(p)}
                                onSendToKanban={handleSendProposalToKanban}
                            />
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground text-xs space-y-2">
                        <Lightbulb size={32} className="text-muted-foreground/40" />
                        <p className="font-medium text-foreground">Nenhuma ideia selecionada</p>
                        <p className="max-w-xs font-normal">
                            Insere uma ideia no formulário ao lado para a IA analisar o problema, consultar a biblioteca de ganchos e gerar a grelha editorial oficial.
                        </p>
                    </div>
                )}
            </div>

            {/* Modal de Detalhe Completo da Proposta */}
            <ProposalDetailModal
                isOpen={Boolean(selectedProposal)}
                proposal={selectedProposal}
                onClose={() => setSelectedProposal(null)}
                onUpdateStatus={handleUpdateProposalStatus}
                onSaveProposal={handleSaveFullProposal}
                onSendToKanban={handleSendProposalToKanban}
            />
        </div>
    );
}
