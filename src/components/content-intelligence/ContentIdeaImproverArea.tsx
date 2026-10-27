import React, { useState, useEffect, useMemo } from 'react';
import {
    GridApproach,
    FormatOption,
    DevelopedProposal,
    ImprovedIdeaSession
} from '@/types/contentIntelligence';
import { contentIntelligenceService } from '@/services/contentIntelligenceService';
import {
    Wand2,
    Sparkles,
    Check,
    ArrowRight,
    ArrowLeft,
    Edit3,
    Trash2,
    RefreshCw,
    Plus,
    Send,
    History,
    CheckCircle2,
    AlertCircle,
    Lightbulb,
    Film,
    FileText,
    Star,
    Layers,
    X,
    ExternalLink
} from 'lucide-react';

interface ContentIdeaImproverAreaProps {
    userId?: string;
    onGoToKanban?: () => void;
}

export function ContentIdeaImproverArea({ userId, onGoToKanban }: ContentIdeaImproverAreaProps) {
    // Lista de sessões salvas
    const [sessions, setSessions] = useState<ImprovedIdeaSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // Estados da Sessão Ativa
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
    const [rawIdea, setRawIdea] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [goal, setGoal] = useState('');
    const [context, setContext] = useState('');

    // Etapa 1: Grelha Oficial (Exatamente as 4 Colunas)
    const [gridProposals, setGridProposals] = useState<GridApproach[]>([]);
    const [selectedApproachId, setSelectedApproachId] = useState<string | null>(null);
    const [isImprovingIdea, setIsImprovingIdea] = useState(false);
    const [isAddingMoreAngles, setIsAddingMoreAngles] = useState(false);

    // Edição de Linha da Grelha
    const [editingRow, setEditingRow] = useState<GridApproach | null>(null);
    const [editForm, setEditForm] = useState({
        angulo: '',
        ideiaMelhorada: '',
        ganchoBase: '',
        retencaoHook: ''
    });

    // Etapa 2: Formatos
    const [formatProposals, setFormatProposals] = useState<FormatOption[]>([]);
    const [selectedFormatId, setSelectedFormatId] = useState<string | null>(null);
    const [isExploringFormats, setIsExploringFormats] = useState(false);
    const [isAddingMoreFormats, setIsAddingMoreFormats] = useState(false);

    // Etapa 3: Proposta Desenvolvida
    const [developedProposal, setDevelopedProposal] = useState<DevelopedProposal | null>(null);
    const [isDevelopingProposal, setIsDevelopingProposal] = useState(false);
    const [isEditingProposal, setIsEditingProposal] = useState(false);
    const [editProposalForm, setEditProposalForm] = useState<Partial<DevelopedProposal>>({});

    // Envio para Kanban
    const [isSendingToKanban, setIsSendingToKanban] = useState(false);
    const [kanbanSuccessCardId, setKanbanSuccessCardId] = useState<string | null>(null);

    // Feedback UI
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Carregar sessões persistidas ao montar
    useEffect(() => {
        loadSavedSessions();
    }, [userId]);

    const loadSavedSessions = async () => {
        try {
            const list = await contentIntelligenceService.loadImprovedSessions(userId);
            setSessions(list);
            if (list.length > 0 && !activeSessionId) {
                // Recupera a sessão mais recente
                loadSessionIntoState(list[0]);
            }
        } catch (err) {
            console.error('Erro ao carregar sessões:', err);
        }
    };

    const loadSessionIntoState = (session: ImprovedIdeaSession) => {
        setActiveSessionId(session.id);
        setCurrentStep(session.currentStep || 1);
        setRawIdea(session.rawIdea || '');
        setTargetAudience(session.targetAudience || '');
        setGoal(session.goal || '');
        setContext(session.context || '');
        setGridProposals(session.gridProposals || []);
        setSelectedApproachId(session.selectedApproachId || null);
        setFormatProposals(session.formatProposals || []);
        setSelectedFormatId(session.selectedFormatId || null);
        setDevelopedProposal(session.developedProposal || null);
        setKanbanSuccessCardId(session.developedProposal?.cardId || null);
    };

    // Salvar sessão ativa
    const persistCurrentSession = async (updates?: Partial<ImprovedIdeaSession>) => {
        const id = activeSessionId || `session-${Date.now()}`;
        if (!activeSessionId) setActiveSessionId(id);

        const currentSession: ImprovedIdeaSession = {
            id,
            userId: userId || 'default',
            currentStep: updates?.currentStep !== undefined ? updates.currentStep : currentStep,
            rawIdea: updates?.rawIdea !== undefined ? updates.rawIdea : rawIdea,
            targetAudience: updates?.targetAudience !== undefined ? updates.targetAudience : targetAudience,
            goal: updates?.goal !== undefined ? updates.goal : goal,
            context: updates?.context !== undefined ? updates.context : context,
            gridProposals: updates?.gridProposals !== undefined ? updates.gridProposals : gridProposals,
            selectedApproachId: updates?.selectedApproachId !== undefined ? updates.selectedApproachId : selectedApproachId || undefined,
            formatProposals: updates?.formatProposals !== undefined ? updates.formatProposals : formatProposals,
            selectedFormatId: updates?.selectedFormatId !== undefined ? updates.selectedFormatId : selectedFormatId || undefined,
            developedProposal: updates?.developedProposal !== undefined ? updates.developedProposal : developedProposal || undefined,
            status: updates?.status || (developedProposal?.cardId ? 'enviado_kanban' : gridProposals.length > 0 ? 'concluido' : 'rascunho'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            await contentIntelligenceService.saveImprovedSession(currentSession, userId);
            setSessions(prev => {
                const filtered = prev.filter(s => s.id !== id);
                return [currentSession, ...filtered];
            });
        } catch (e) {
            console.warn('Erro ao persistir sessão:', e);
        }
    };

    // Nova Sessão Limpa
    const handleStartNewSession = () => {
        setActiveSessionId(null);
        setCurrentStep(1);
        setRawIdea('');
        setTargetAudience('');
        setGoal('');
        setContext('');
        setGridProposals([]);
        setSelectedApproachId(null);
        setFormatProposals([]);
        setSelectedFormatId(null);
        setDevelopedProposal(null);
        setKanbanSuccessCardId(null);
        showToast('Nova sessão iniciada.');
    };

    // Objeto da abordagem selecionada
    const selectedApproach = useMemo(() => {
        return gridProposals.find(p => p.id === selectedApproachId) || null;
    }, [gridProposals, selectedApproachId]);

    // Objeto do formato selecionado
    const selectedFormat = useMemo(() => {
        return formatProposals.find(f => f.id === selectedFormatId) || null;
    }, [formatProposals, selectedFormatId]);

    // =========================================================================
    // ETAPA 1 — GERAR / MELHORAR IDEIA
    // =========================================================================
    const handleImproveIdea = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!rawIdea.trim()) {
            showToast('Por favor, introduz uma ideia bruta.', 'error');
            return;
        }

        setIsImprovingIdea(true);
        try {
            const res = await contentIntelligenceService.improveIdea({
                idea: rawIdea,
                targetAudience,
                goal,
                context,
                userId
            });

            setGridProposals(res.grid);
            const autoSelectId = res.grid[0]?.id || null;
            setSelectedApproachId(autoSelectId);

            await persistCurrentSession({
                rawIdea,
                targetAudience,
                goal,
                context,
                gridProposals: res.grid,
                selectedApproachId: autoSelectId || undefined,
                currentStep: 1
            });

            showToast(`Grelha gerada com ${res.grid.length} abordagens estratégicas.`);
        } catch (err: any) {
            showToast(err.message || 'Falha ao gerar ângulos da ideia.', 'error');
        } finally {
            setIsImprovingIdea(false);
        }
    };

    const handleGenerateMoreAngles = async () => {
        if (!rawIdea.trim()) return;
        setIsAddingMoreAngles(true);
        try {
            const existingAngles = gridProposals.map(p => p.angulo);
            const res = await contentIntelligenceService.improveIdea({
                idea: rawIdea,
                targetAudience,
                goal,
                context,
                existingAngles,
                userId
            });

            const combined = [...gridProposals, ...res.grid];
            setGridProposals(combined);
            await persistCurrentSession({ gridProposals: combined });
            showToast(`+${res.grid.length} novos ângulos adicionados à grelha!`);
        } catch (err: any) {
            showToast(err.message || 'Erro ao gerar mais ângulos.', 'error');
        } finally {
            setIsAddingMoreAngles(false);
        }
    };

    // Edição de linha da grelha
    const handleOpenEditRow = (row: GridApproach) => {
        setEditingRow(row);
        setEditForm({
            angulo: row.angulo,
            ideiaMelhorada: row.ideiaMelhorada,
            ganchoBase: row.ganchoBase,
            retencaoHook: row.retencaoHook
        });
    };

    const handleSaveEditRow = async () => {
        if (!editingRow) return;
        const updated = gridProposals.map(p => {
            if (p.id === editingRow.id) {
                return {
                    ...p,
                    angulo: editForm.angulo.trim() || p.angulo,
                    ideiaMelhorada: editForm.ideiaMelhorada.trim() || p.ideiaMelhorada,
                    ganchoBase: editForm.ganchoBase.trim() || p.ganchoBase,
                    retencaoHook: editForm.retencaoHook.trim() || p.retencaoHook,
                    isEdited: true
                };
            }
            return p;
        });

        setGridProposals(updated);
        setEditingRow(null);
        await persistCurrentSession({ gridProposals: updated });
        showToast('Abordagem editada e guardada.');
    };

    const handleDeleteRow = async (rowId: string) => {
        if (!confirm('Eliminar esta proposta da grelha?')) return;
        const updated = gridProposals.filter(p => p.id !== rowId);
        setGridProposals(updated);
        if (selectedApproachId === rowId) {
            setSelectedApproachId(updated[0]?.id || null);
        }
        await persistCurrentSession({
            gridProposals: updated,
            selectedApproachId: (selectedApproachId === rowId ? updated[0]?.id : selectedApproachId) || undefined
        });
        showToast('Proposta eliminada.');
    };

    // =========================================================================
    // ETAPA 2 — EXPLORAR FORMATOS
    // =========================================================================
    const handleProceedToStep2 = async (approachToUse?: GridApproach) => {
        const approach = approachToUse || selectedApproach;
        if (!approach) {
            showToast('Seleciona uma linha da grelha antes de avançar.', 'error');
            return;
        }

        setSelectedApproachId(approach.id);
        setCurrentStep(2);

        // Se ainda não gerou formatos para esta abordagem ou se a lista estiver vazia, gera automaticamente
        if (formatProposals.length === 0) {
            await fetchFormatsForApproach(approach);
        } else {
            await persistCurrentSession({ currentStep: 2, selectedApproachId: approach.id });
        }
    };

    const fetchFormatsForApproach = async (approach: GridApproach) => {
        setIsExploringFormats(true);
        try {
            const formats = await contentIntelligenceService.exploreFormats({
                idea: rawIdea,
                selectedApproach: approach,
                targetAudience,
                goal,
                context,
                userId
            });

            setFormatProposals(formats);
            const recommended = formats.find(f => f.isRecomendado) || formats[0];
            setSelectedFormatId(recommended?.id || null);

            await persistCurrentSession({
                currentStep: 2,
                selectedApproachId: approach.id,
                formatProposals: formats,
                selectedFormatId: recommended?.id
            });
            showToast(`${formats.length} formatos estratégicos explorados.`);
        } catch (err: any) {
            showToast(err.message || 'Erro ao explorar formatos.', 'error');
        } finally {
            setIsExploringFormats(false);
        }
    };

    const handleGenerateMoreFormats = async () => {
        if (!selectedApproach) return;
        setIsAddingMoreFormats(true);
        try {
            const existing = formatProposals.map(f => f.nome);
            const moreFormats = await contentIntelligenceService.exploreFormats({
                idea: rawIdea,
                selectedApproach,
                targetAudience,
                goal,
                context,
                existingFormats: existing,
                userId
            });

            const combined = [...formatProposals, ...moreFormats];
            setFormatProposals(combined);
            await persistCurrentSession({ formatProposals: combined });
            showToast(`+${moreFormats.length} novos formatos adicionados.`);
        } catch (err: any) {
            showToast(err.message || 'Erro ao gerar novos formatos.', 'error');
        } finally {
            setIsAddingMoreFormats(false);
        }
    };

    // =========================================================================
    // ETAPA 3 — DESENVOLVER PROPOSTA
    // =========================================================================
    const handleProceedToStep3 = async (formatToUse?: FormatOption) => {
        const fmt = formatToUse || selectedFormat;
        if (!selectedApproach || !fmt) {
            showToast('Seleciona uma abordagem e um formato antes de avançar.', 'error');
            return;
        }

        setSelectedFormatId(fmt.id);
        setCurrentStep(3);

        // Se ainda não desenvolveu ou se trocou o formato, gera a proposta completa
        if (!developedProposal || developedProposal.formato !== fmt.nome) {
            await generateFullProposal(selectedApproach, fmt);
        } else {
            await persistCurrentSession({ currentStep: 3, selectedFormatId: fmt.id });
        }
    };

    const generateFullProposal = async (approach: GridApproach, fmt: FormatOption) => {
        setIsDevelopingProposal(true);
        try {
            const prop = await contentIntelligenceService.developProposal({
                idea: rawIdea,
                selectedApproach: approach,
                selectedFormat: fmt,
                targetAudience,
                goal,
                context,
                userId
            });

            setDevelopedProposal(prop);
            setEditProposalForm(prop);
            setKanbanSuccessCardId(prop.cardId || null);

            await persistCurrentSession({
                currentStep: 3,
                selectedApproachId: approach.id,
                selectedFormatId: fmt.id,
                developedProposal: prop
            });

            showToast('Guião e proposta de produção desenvolvidos com sucesso!');
        } catch (err: any) {
            showToast(err.message || 'Erro ao desenvolver proposta.', 'error');
        } finally {
            setIsDevelopingProposal(false);
        }
    };

    const handleSaveEditedProposal = async () => {
        if (!developedProposal) return;
        const updated: DevelopedProposal = {
            ...developedProposal,
            ...editProposalForm
        };
        setDevelopedProposal(updated);
        setIsEditingProposal(false);
        await persistCurrentSession({ developedProposal: updated });
        showToast('Alterações no guião guardadas.');
    };

    // Enviar para o Kanban de Produção
    const handleSendProposalToKanban = async () => {
        if (!developedProposal) return;
        setIsSendingToKanban(true);
        try {
            const res = await contentIntelligenceService.sendImprovedProposalToKanban({
                proposal: {
                    titulo: developedProposal.titulo,
                    formato: developedProposal.formato,
                    angulo: selectedApproach?.angulo,
                    ganchoVerbal: developedProposal.ganchoVerbal,
                    ganchoVisual: developedProposal.ganchoVisual,
                    roteiro: developedProposal.sequenciaCenas,
                    cta: developedProposal.cta,
                    publicoAlvo: developedProposal.publicoEMensagemCentral,
                    objetivo: developedProposal.conceitoEObjetivo
                },
                userId
            });

            const updatedProp = { ...developedProposal, cardId: res.cardId };
            setDevelopedProposal(updatedProp);
            setKanbanSuccessCardId(res.cardId);

            await persistCurrentSession({
                developedProposal: updatedProp,
                status: 'enviado_kanban'
            });

            showToast('Conteúdo enviado com sucesso para a coluna do Kanban!');
        } catch (err: any) {
            showToast(err.message || 'Erro ao enviar para o Kanban.', 'error');
        } finally {
            setIsSendingToKanban(false);
        }
    };

    // Ação direta de enviar uma linha da grelha (Etapa 1) para o Kanban
    const handleSendApproachDirectToKanban = async (approach: GridApproach) => {
        if (!confirm(`Enviar a abordagem "${approach.angulo}" para o Kanban?`)) return;
        try {
            await contentIntelligenceService.sendImprovedProposalToKanban({
                proposal: {
                    titulo: `${approach.angulo}: ${approach.ideiaMelhorada.slice(0, 45)}`,
                    formato: 'Reel / Vídeo Curto',
                    angulo: approach.angulo,
                    ganchoVerbal: approach.ganchoBase,
                    ganchoVisual: approach.retencaoHook,
                    roteiro: `Ideia Melhorada: ${approach.ideiaMelhorada}\nGancho Base: ${approach.ganchoBase}\nRetenção: ${approach.retencaoHook}`,
                    cta: 'CTA a definir no desenvolvimento'
                },
                userId
            });
            showToast('Abordagem enviada para o Kanban!');
        } catch (err: any) {
            showToast(err.message || 'Erro ao enviar abordagem.', 'error');
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
            {/* Header da Ferramenta & Stepper das 3 Etapas */}
            <div className="p-3.5 sm:px-5 sm:py-3 border-b border-border/70 bg-card/70 backdrop-blur-xs shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                        <Wand2 size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">
                                Melhorador de Ideias
                            </h2>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                Grelha Oficial Vamuss
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground hidden sm:block">
                            Transforma ideias brutas em abordagens estratégicas, explora formatos e desenvolve guiões de alta conversão.
                        </p>
                    </div>
                </div>

                {/* Stepper Interativo (Preserva o Trabalho nas 3 Etapas) */}
                <div className="flex items-center gap-1.5 self-start md:self-auto bg-muted/40 p-1 rounded-xl border border-border/50 text-xs">
                    <button
                        type="button"
                        onClick={() => {
                            setCurrentStep(1);
                            persistCurrentSession({ currentStep: 1 });
                        }}
                        className={`h-7 px-3 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
                            currentStep === 1
                                ? 'bg-background text-foreground shadow-xs border border-border/60'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${
                            currentStep === 1 ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'
                        }`}>1</span>
                        <span>Melhorar Ideia</span>
                    </button>

                    <button
                        type="button"
                        disabled={!selectedApproach && gridProposals.length === 0}
                        onClick={() => {
                            if (selectedApproach) {
                                setCurrentStep(2);
                                persistCurrentSession({ currentStep: 2 });
                                if (formatProposals.length === 0) fetchFormatsForApproach(selectedApproach);
                            }
                        }}
                        className={`h-7 px-3 rounded-lg flex items-center gap-1.5 font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                            currentStep === 2
                                ? 'bg-background text-foreground shadow-xs border border-border/60'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${
                            currentStep === 2 ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'
                        }`}>2</span>
                        <span>Explorar Formatos</span>
                    </button>

                    <button
                        type="button"
                        disabled={!selectedApproach || !selectedFormat}
                        onClick={() => {
                            if (selectedApproach && selectedFormat) {
                                setCurrentStep(3);
                                persistCurrentSession({ currentStep: 3 });
                                if (!developedProposal) generateFullProposal(selectedApproach, selectedFormat);
                            }
                        }}
                        className={`h-7 px-3 rounded-lg flex items-center gap-1.5 font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                            currentStep === 3
                                ? 'bg-background text-foreground shadow-xs border border-border/60'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${
                            currentStep === 3 ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'
                        }`}>3</span>
                        <span>Desenvolver Proposta</span>
                    </button>

                    <div className="h-4 w-px bg-border/60 mx-1" />

                    {/* Botão de Histórico de Sessões */}
                    <button
                        type="button"
                        onClick={() => setIsHistoryOpen(prev => !prev)}
                        className={`h-7 px-2.5 rounded-lg flex items-center gap-1 text-xs transition-colors ${
                            isHistoryOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title="Histórico de Sessões Salvas"
                    >
                        <History size={13} />
                        <span className="hidden lg:inline">Histórico ({sessions.length})</span>
                    </button>

                    {/* Botão de Nova Sessão */}
                    <button
                        type="button"
                        onClick={handleStartNewSession}
                        className="h-7 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 flex items-center gap-1 transition-colors"
                        title="Iniciar Nova Ideia Limpa"
                    >
                        <Plus size={13} />
                        <span className="hidden sm:inline">Nova Ideia</span>
                    </button>
                </div>
            </div>

            {/* Painel Dropdown do Histórico */}
            {isHistoryOpen && (
                <div className="border-b border-border/80 bg-muted/20 p-3 sm:px-5 shrink-0 animate-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <History size={13} className="text-primary" />
                            <span>Sessões Salvas Anteriores</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsHistoryOpen(false)}
                            className="text-muted-foreground hover:text-foreground text-xs"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {sessions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma sessão anterior salva ainda.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {sessions.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => {
                                        loadSessionIntoState(s);
                                        setIsHistoryOpen(false);
                                        showToast('Sessão carregada.');
                                    }}
                                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors flex items-start justify-between gap-2 ${
                                        s.id === activeSessionId
                                            ? 'bg-primary/5 border-primary/30 text-foreground'
                                            : 'bg-card border-border/60 hover:border-border text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-foreground truncate">
                                            {s.rawIdea || 'Sem título'}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                                            <span>Etapa {s.currentStep}</span>
                                            <span>•</span>
                                            <span>{s.gridProposals?.length || 0} ângulos</span>
                                            {s.status === 'enviado_kanban' && (
                                                <span className="text-emerald-500 font-medium">✓ No Kanban</span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (confirm('Eliminar esta sessão do histórico?')) {
                                                await contentIntelligenceService.deleteImprovedSession(s.id, userId);
                                                setSessions(prev => prev.filter(x => x.id !== s.id));
                                                if (s.id === activeSessionId) handleStartNewSession();
                                            }
                                        }}
                                        className="text-muted-foreground/60 hover:text-destructive p-1 rounded transition-colors"
                                        title="Eliminar sessão"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Toast de Notificação */}
            {toastMessage && (
                <div className={`fixed bottom-4 right-4 z-50 px-3.5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-2 fade-in duration-200 border ${
                    toastMessage.type === 'error'
                        ? 'bg-destructive text-destructive-foreground border-destructive/30'
                        : 'bg-primary text-primary-foreground border-primary/30'
                }`}>
                    {toastMessage.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* Conteúdo Principal Rolável */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-5">

                    {/* ========================================================= */}
                    {/* ETAPA 1 — FORMULÁRIO E GRELHA OFICIAL DAS 4 COLUNAS      */}
                    {/* ========================================================= */}
                    {currentStep === 1 && (
                        <div className="space-y-5">
                            {/* Formulário de Entrada */}
                            <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
                                <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                                    <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                                        <Lightbulb size={14} className="text-primary" />
                                        <span>Etapa 1 — Entrada da Ideia e Contexto</span>
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                        * Campo obrigatório
                                    </span>
                                </div>

                                <form onSubmit={handleImproveIdea} className="space-y-3.5">
                                    {/* Ideia Bruta (Obrigatório) */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-foreground flex items-center justify-between">
                                            <span>Ideia Bruta ou Observação Comercial *</span>
                                            <span className="text-[10px] text-muted-foreground font-normal">
                                                Curta ou longa (ex: tema, dor de cliente, objeção em vendas)
                                            </span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            required
                                            value={rawIdea}
                                            onChange={e => setRawIdea(e.target.value)}
                                            placeholder="Ex: Donos de clínicas continuam a depender de indicações e acham que investir em anúncios no Instagram é perda de dinheiro..."
                                            className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-normal outline-none focus:border-primary placeholder:text-muted-foreground/60 resize-y"
                                        />
                                    </div>

                                    {/* Campos Opcionais em Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-muted-foreground">
                                                Público-alvo (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                value={targetAudience}
                                                onChange={e => setTargetAudience(e.target.value)}
                                                placeholder="Ex: Donos de clínicas e PMEs em Portugal"
                                                className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary placeholder:text-muted-foreground/60"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-muted-foreground">
                                                Objetivo do Conteúdo (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                value={goal}
                                                onChange={e => setGoal(e.target.value)}
                                                placeholder="Ex: Gerar autoridade e mensagens no WhatsApp"
                                                className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary placeholder:text-muted-foreground/60"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-muted-foreground">
                                                Contexto ou Observações (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                value={context}
                                                onChange={e => setContext(e.target.value)}
                                                placeholder="Ex: Reunião de diagnóstico onde o lead reclamou de custo por clique"
                                                className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary placeholder:text-muted-foreground/60"
                                            />
                                        </div>
                                    </div>

                                    {/* Botão Principal de Submissão */}
                                    <div className="flex items-center justify-between pt-1">
                                        <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                            A IA consulta a biblioteca de ganchos e gera abordagens em Português europeu.
                                        </span>

                                        <button
                                            type="submit"
                                            disabled={!rawIdea.trim() || isImprovingIdea}
                                            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-xs flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-2xs ml-auto"
                                        >
                                            {isImprovingIdea ? (
                                                <>
                                                    <RefreshCw size={13} className="animate-spin" />
                                                    <span>A gerar ângulos e ganchos...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={14} />
                                                    <span>Gerar ângulos e ganchos</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* GRELHA OFICIAL COM EXATAMENTE AS 4 COLUNAS OFICIAIS */}
                            {gridProposals.length > 0 && (
                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                                        <div>
                                            <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <Layers size={14} className="text-primary" />
                                                <span>Grelha Editorial Oficial ({gridProposals.length} abordagens)</span>
                                            </span>
                                            <p className="text-[11px] text-muted-foreground">
                                                Clica numa linha para selecionar a abordagem e avançar para os formatos.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleGenerateMoreAngles}
                                                disabled={isAddingMoreAngles}
                                                className="h-7 px-3 rounded-lg border border-border text-foreground hover:bg-muted font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                            >
                                                {isAddingMoreAngles ? (
                                                    <RefreshCw size={12} className="animate-spin" />
                                                ) : (
                                                    <Plus size={12} />
                                                )}
                                                <span>+ Gerar Mais Alternativas</span>
                                            </button>

                                            {selectedApproach && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleProceedToStep2()}
                                                    className="h-7 px-3 rounded-lg bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-2xs"
                                                >
                                                    <span>Explorar Formatos ({selectedApproach.angulo})</span>
                                                    <ArrowRight size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* TABELA DE 4 COLUNAS STRICT */}
                                    <div className="border border-border/80 rounded-xl overflow-hidden bg-card shadow-xs">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs border-collapse">
                                                <thead>
                                                    <tr className="border-b border-border/70 bg-muted/40 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground select-none">
                                                        <th className="py-2.5 px-3.5 w-[16%]">Ângulo</th>
                                                        <th className="py-2.5 px-3.5 w-[36%]">Ideia melhorada</th>
                                                        <th className="py-2.5 px-3.5 w-[26%]">Gancho / Base</th>
                                                        <th className="py-2.5 px-3.5 w-[22%]">Retenção / Hook</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/40 font-normal">
                                                    {gridProposals.map((row) => {
                                                        const isSelected = row.id === selectedApproachId;

                                                        return (
                                                            <tr
                                                                key={row.id}
                                                                onClick={() => {
                                                                    setSelectedApproachId(row.id);
                                                                    persistCurrentSession({ selectedApproachId: row.id });
                                                                }}
                                                                className={`cursor-pointer transition-colors group relative ${
                                                                    isSelected
                                                                        ? 'bg-primary/5 hover:bg-primary/10'
                                                                        : 'hover:bg-muted/40'
                                                                }`}
                                                            >
                                                                {/* 1. Ângulo */}
                                                                <td className="py-3 px-3.5 align-top">
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <span className={`font-semibold ${
                                                                                isSelected ? 'text-primary' : 'text-foreground'
                                                                            }`}>
                                                                                {row.angulo}
                                                                            </span>
                                                                            {isSelected && (
                                                                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary text-primary-foreground uppercase">
                                                                                    Selecionado
                                                                                </span>
                                                                            )}
                                                                            {row.isEdited && (
                                                                                <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                                                                                    Editado
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {row.fonteGancho && (
                                                                            <span className="text-[10px] text-muted-foreground">
                                                                                {row.fonteGancho}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                {/* 2. Ideia melhorada */}
                                                                <td className="py-3 px-3.5 align-top">
                                                                    <p className="text-foreground leading-relaxed">
                                                                        {row.ideiaMelhorada}
                                                                    </p>
                                                                </td>

                                                                {/* 3. Gancho / Base */}
                                                                <td className="py-3 px-3.5 align-top">
                                                                    <p className="text-foreground/90 italic leading-relaxed">
                                                                        "{row.ganchoBase}"
                                                                    </p>
                                                                </td>

                                                                {/* 4. Retenção / Hook */}
                                                                <td className="py-3 px-3.5 align-top">
                                                                    <div className="flex flex-col justify-between h-full gap-2">
                                                                        <p className="text-muted-foreground leading-relaxed">
                                                                            {row.retencaoHook}
                                                                        </p>

                                                                        {/* Ações Rápidas integradas na linha */}
                                                                        <div
                                                                            className="flex items-center gap-1.5 pt-1.5 border-t border-border/30"
                                                                            onClick={e => e.stopPropagation()}
                                                                        >
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleOpenEditRow(row)}
                                                                                className="px-2 py-0.5 rounded text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-muted font-medium flex items-center gap-1 transition-colors"
                                                                                title="Editar os 4 campos"
                                                                            >
                                                                                <Edit3 size={11} />
                                                                                <span>Editar</span>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleProceedToStep2(row)}
                                                                                className="px-2 py-0.5 rounded text-[10.5px] text-primary hover:bg-primary/10 font-medium flex items-center gap-1 transition-colors"
                                                                                title="Explorar formatos com este ângulo"
                                                                            >
                                                                                <Film size={11} />
                                                                                <span>Formatos</span>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleSendApproachDirectToKanban(row)}
                                                                                className="px-2 py-0.5 rounded text-[10.5px] text-muted-foreground hover:text-foreground hover:bg-muted font-medium flex items-center gap-1 transition-colors"
                                                                                title="Enviar proposta para o Kanban"
                                                                            >
                                                                                <Send size={11} />
                                                                                <span>Kanban</span>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDeleteRow(row.id)}
                                                                                className="p-1 rounded text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                                                                                title="Eliminar linha"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* ETAPA 2 — EXPLORAR FORMATOS                              */}
                    {/* ========================================================= */}
                    {currentStep === 2 && (
                        <div className="space-y-5">
                            {/* Card de Resumo da Abordagem Escolhida na Etapa 1 */}
                            {selectedApproach && (
                                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                                                Abordagem Selecionada (Etapa 1)
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary text-primary-foreground">
                                                {selectedApproach.angulo}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCurrentStep(1);
                                                persistCurrentSession({ currentStep: 1 });
                                            }}
                                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                        >
                                            <ArrowLeft size={13} />
                                            <span>Mudar abordagem</span>
                                        </button>
                                    </div>

                                    <p className="text-xs text-foreground font-medium">
                                        {selectedApproach.ideiaMelhorada}
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px]">
                                        <div className="bg-background/80 p-2 rounded-lg border border-border/50">
                                            <span className="text-muted-foreground font-medium">Gancho Base:</span>
                                            <p className="text-foreground italic">"{selectedApproach.ganchoBase}"</p>
                                        </div>
                                        <div className="bg-background/80 p-2 rounded-lg border border-border/50">
                                            <span className="text-muted-foreground font-medium">Retenção Inicial:</span>
                                            <p className="text-foreground">{selectedApproach.retencaoHook}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Controles de Formato */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                                <div>
                                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Film size={14} className="text-primary" />
                                        <span>Formatos Recomendados ({formatProposals.length})</span>
                                    </span>
                                    <p className="text-[11px] text-muted-foreground">
                                        A IA analisa a mensagem e recomenda os melhores formatos audiovisuais para parar o feed.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleGenerateMoreFormats}
                                        disabled={isAddingMoreFormats || isExploringFormats}
                                        className="h-7 px-3 rounded-lg border border-border text-foreground hover:bg-muted font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                    >
                                        {isAddingMoreFormats ? (
                                            <RefreshCw size={12} className="animate-spin" />
                                        ) : (
                                            <Plus size={12} />
                                        )}
                                        <span>+ Gerar Mais Formatos</span>
                                    </button>

                                    {selectedFormat && (
                                        <button
                                            type="button"
                                            onClick={() => handleProceedToStep3()}
                                            className="h-7 px-3.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-2xs"
                                        >
                                            <span>Desenvolver Proposta ({selectedFormat.nome})</span>
                                            <ArrowRight size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Estado de Carregamento dos Formatos */}
                            {isExploringFormats ? (
                                <div className="p-12 text-center text-muted-foreground bg-card border border-border/60 rounded-xl flex flex-col items-center justify-center gap-2">
                                    <RefreshCw size={20} className="animate-spin text-primary" />
                                    <span className="text-xs font-medium">A analisar a mensagem e a explorar os melhores formatos de vídeo...</span>
                                </div>
                            ) : (
                                /* Cards de Formatos */
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {formatProposals.map(f => {
                                        const isSelected = f.id === selectedFormatId;

                                        return (
                                            <div
                                                key={f.id}
                                                onClick={() => {
                                                    setSelectedFormatId(f.id);
                                                    persistCurrentSession({ selectedFormatId: f.id });
                                                }}
                                                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-3 relative ${
                                                    isSelected
                                                        ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/40'
                                                        : 'bg-card border-border/70 hover:border-border'
                                                }`}
                                            >
                                                <div className="space-y-2.5">
                                                    {/* Header do Card */}
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-semibold text-xs text-foreground">
                                                                {f.nome}
                                                            </h4>
                                                            {f.isRecomendado && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                                                                    <Star size={11} className="fill-amber-500 text-amber-500" />
                                                                    <span>Recomendado pela Vamuss</span>
                                                                </span>
                                                            )}
                                                        </div>

                                                        <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/60 shrink-0">
                                                            {f.recursosDificuldade}
                                                        </span>
                                                    </div>

                                                    {/* Motivo da recomendação se houver */}
                                                    {f.motivoRecomendacao && (
                                                        <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/5 p-2 rounded-lg border border-amber-500/15">
                                                            <strong>Por que recomendamos:</strong> {f.motivoRecomendacao}
                                                        </p>
                                                    )}

                                                    {/* Conceito */}
                                                    <div className="text-xs text-foreground/90 space-y-1">
                                                        <p className="leading-relaxed">{f.conceito}</p>
                                                        <p className="text-muted-foreground text-[11px]">
                                                            <strong>Por que funciona:</strong> {f.porQueFunciona}
                                                        </p>
                                                    </div>

                                                    {/* Ganchos Verbal e Visual */}
                                                    <div className="space-y-1.5 pt-1 text-[11px]">
                                                        <div className="p-2 rounded-lg bg-background border border-border/50">
                                                            <span className="font-medium text-muted-foreground">Gancho Verbal (0-3s):</span>
                                                            <p className="text-foreground italic">"{f.ganchoVerbal}"</p>
                                                        </div>
                                                        <div className="p-2 rounded-lg bg-background border border-border/50">
                                                            <span className="font-medium text-muted-foreground">Gancho Visual:</span>
                                                            <p className="text-foreground">{f.ganchoVisual}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Footer do Card com Botão de Seleção */}
                                                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedFormatId(f.id);
                                                            persistCurrentSession({ selectedFormatId: f.id });
                                                        }}
                                                        className={`h-7 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                                            isSelected
                                                                ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                                                                : 'bg-muted hover:bg-muted/80 text-foreground'
                                                        }`}
                                                    >
                                                        {isSelected ? (
                                                            <>
                                                                <Check size={13} />
                                                                <span>Formato Selecionado</span>
                                                            </>
                                                        ) : (
                                                            <span>Selecionar este Formato</span>
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleProceedToStep3(f)}
                                                        className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                                                    >
                                                        <span>Desenvolver agora</span>
                                                        <ArrowRight size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Barra de Navegação Inferior */}
                            <div className="flex items-center justify-between pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCurrentStep(1);
                                        persistCurrentSession({ currentStep: 1 });
                                    }}
                                    className="h-8 px-3 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                    <ArrowLeft size={13} />
                                    <span>Voltar à Grelha (Etapa 1)</span>
                                </button>

                                {selectedFormat && (
                                    <button
                                        type="button"
                                        onClick={() => handleProceedToStep3()}
                                        className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-2xs"
                                    >
                                        <span>Avançar para Desenvolver Proposta</span>
                                        <ArrowRight size={13} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* ETAPA 3 — DESENVOLVER PROPOSTA COMPLETA                   */}
                    {/* ========================================================= */}
                    {currentStep === 3 && (
                        <div className="space-y-5">
                            {/* Resumo do Ângulo e Formato Selecionados */}
                            <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                        <FileText size={16} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-foreground">
                                                {selectedApproach?.angulo}
                                            </span>
                                            <span className="text-muted-foreground">•</span>
                                            <span className="text-xs text-muted-foreground font-medium">
                                                {selectedFormat?.nome}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground truncate max-w-md">
                                            {selectedApproach?.ideiaMelhorada}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCurrentStep(2);
                                            persistCurrentSession({ currentStep: 2 });
                                        }}
                                        className="h-7 px-2.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                    >
                                        <ArrowLeft size={12} />
                                        <span>Mudar Formato</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedApproach && selectedFormat) {
                                                generateFullProposal(selectedApproach, selectedFormat);
                                            }
                                        }}
                                        disabled={isDevelopingProposal}
                                        className="h-7 px-2.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted flex items-center gap-1 transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={12} className={isDevelopingProposal ? 'animate-spin' : ''} />
                                        <span>Regerar Guião</span>
                                    </button>
                                </div>
                            </div>

                            {/* Estado de Carregamento da Proposta */}
                            {isDevelopingProposal ? (
                                <div className="p-16 text-center text-muted-foreground bg-card border border-border/60 rounded-xl flex flex-col items-center justify-center gap-2">
                                    <RefreshCw size={22} className="animate-spin text-primary" />
                                    <span className="text-xs font-medium">A estruturar o guião cena a cena e a aplicar as técnicas de retenção da Vamuss...</span>
                                </div>
                            ) : developedProposal ? (
                                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-6 shadow-xs space-y-5">
                                    {/* Cabeçalho da Proposta */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm sm:text-base font-bold text-foreground">
                                                    {developedProposal.titulo}
                                                </h3>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                                                    {developedProposal.formato}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {developedProposal.conceitoEObjetivo}
                                            </p>
                                        </div>

                                        {/* Ações: Editar ou Enviar para Kanban */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditProposalForm(developedProposal);
                                                    setIsEditingProposal(prev => !prev);
                                                }}
                                                className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors"
                                            >
                                                <Edit3 size={13} />
                                                <span>{isEditingProposal ? 'Cancelar Edição' : 'Editar Proposta'}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleSendProposalToKanban}
                                                disabled={isSendingToKanban}
                                                className={`h-8 px-4 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs ${
                                                    kanbanSuccessCardId
                                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                }`}
                                            >
                                                {isSendingToKanban ? (
                                                    <>
                                                        <RefreshCw size={13} className="animate-spin" />
                                                        <span>A enviar...</span>
                                                    </>
                                                ) : kanbanSuccessCardId ? (
                                                    <>
                                                        <CheckCircle2 size={14} />
                                                        <span>Atualizar no Kanban</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send size={13} />
                                                        <span>Enviar para o Kanban</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Aviso se já enviado ao Kanban */}
                                    {kanbanSuccessCardId && (
                                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between">
                                            <div className="flex items-center gap-2 font-medium">
                                                <CheckCircle2 size={15} />
                                                <span>Este conteúdo está sincronizado com o Kanban de Produção da Vamuss!</span>
                                            </div>
                                            {onGoToKanban && (
                                                <button
                                                    type="button"
                                                    onClick={onGoToKanban}
                                                    className="font-bold underline hover:opacity-80 flex items-center gap-1 text-[11px]"
                                                >
                                                    <span>Abrir no Kanban</span>
                                                    <ExternalLink size={12} />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* MODO EDIÇÃO DA PROPOSTA */}
                                    {isEditingProposal ? (
                                        <div className="space-y-4 pt-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-foreground">Título do Conteúdo</label>
                                                    <input
                                                        type="text"
                                                        value={editProposalForm.titulo || ''}
                                                        onChange={e => setEditProposalForm(p => ({ ...p, titulo: e.target.value }))}
                                                        className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-foreground">Público & Mensagem Central</label>
                                                    <input
                                                        type="text"
                                                        value={editProposalForm.publicoEMensagemCentral || ''}
                                                        onChange={e => setEditProposalForm(p => ({ ...p, publicoEMensagemCentral: e.target.value }))}
                                                        className="w-full h-8 px-2.5 bg-background border border-border rounded-lg text-xs"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-foreground">Gancho Verbal (0-3s)</label>
                                                    <textarea
                                                        rows={2}
                                                        value={editProposalForm.ganchoVerbal || ''}
                                                        onChange={e => setEditProposalForm(p => ({ ...p, ganchoVerbal: e.target.value }))}
                                                        className="w-full p-2 bg-background border border-border rounded-lg text-xs resize-y"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-foreground">Gancho Visual & Cena Inicial</label>
                                                    <textarea
                                                        rows={2}
                                                        value={editProposalForm.ganchoVisual || ''}
                                                        onChange={e => setEditProposalForm(p => ({ ...p, ganchoVisual: e.target.value }))}
                                                        className="w-full p-2 bg-background border border-border rounded-lg text-xs resize-y"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-foreground">Sequência de Cenas e Roteiro Completo</label>
                                                <textarea
                                                    rows={6}
                                                    value={editProposalForm.sequenciaCenas || ''}
                                                    onChange={e => setEditProposalForm(p => ({ ...p, sequenciaCenas: e.target.value }))}
                                                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-mono resize-y"
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-foreground">Texto no Ecrã / Falado</label>
                                                    <textarea
                                                        rows={2}
                                                        value={editProposalForm.textoFaladoOuTela || ''}
                                                        onChange={e => setEditProposalForm(p => ({ ...p, textoFaladoOuTela: e.target.value }))}
                                                        className="w-full p-2 bg-background border border-border rounded-lg text-xs"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-xs font-medium text-foreground">Chamada para Ação (CTA)</label>
                                                    <textarea
                                                        rows={2}
                                                        value={editProposalForm.cta || ''}
                                                        onChange={e => setEditProposalForm(p => ({ ...p, cta: e.target.value }))}
                                                        className="w-full p-2 bg-background border border-border rounded-lg text-xs"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingProposal(false)}
                                                    className="h-8 px-3 rounded-lg border border-border text-xs"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveEditedProposal}
                                                    className="h-8 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-xs"
                                                >
                                                    Guardar Alterações
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* MODO VISUALIZAÇÃO DA PROPOSTA COMPLETA */
                                        <div className="space-y-4">
                                            {/* Ganchos Verbal e Visual de Destaque */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                                                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                                                        Gancho Verbal (0-3s)
                                                    </span>
                                                    <p className="text-xs font-medium text-foreground italic leading-relaxed">
                                                        "{developedProposal.ganchoVerbal}"
                                                    </p>
                                                </div>

                                                <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                                                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                                                        Gancho Visual / Cena Inicial
                                                    </span>
                                                    <p className="text-xs text-foreground leading-relaxed">
                                                        {developedProposal.ganchoVisual}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Roteiro Cena a Cena */}
                                            <div className="p-4 rounded-xl bg-background border border-border/80 space-y-2">
                                                <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                    <Film size={13} className="text-primary" />
                                                    <span>Sequência de Cenas & Roteiro</span>
                                                </span>
                                                <div className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed font-normal bg-card p-3 rounded-lg border border-border/40">
                                                    {developedProposal.sequenciaCenas}
                                                </div>
                                            </div>

                                            {/* Detalhes de Produção: Enquadramentos, Pacing e Edição */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                                <div className="p-3 rounded-xl bg-background border border-border/60 space-y-1">
                                                    <span className="font-semibold text-foreground text-[11px]">Enquadramento & Ações:</span>
                                                    <p className="text-muted-foreground leading-relaxed">
                                                        {developedProposal.enquadramentosEAcoes}
                                                    </p>
                                                </div>

                                                <div className="p-3 rounded-xl bg-background border border-border/60 space-y-1">
                                                    <span className="font-semibold text-foreground text-[11px]">Texto no Ecrã:</span>
                                                    <p className="text-muted-foreground leading-relaxed">
                                                        {developedProposal.textoFaladoOuTela}
                                                    </p>
                                                </div>

                                                <div className="p-3 rounded-xl bg-background border border-border/60 space-y-1">
                                                    <span className="font-semibold text-foreground text-[11px]">Dicas de Edição:</span>
                                                    <p className="text-muted-foreground leading-relaxed">
                                                        {developedProposal.sugestoesEdicao}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Chamada para Ação (CTA) */}
                                            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                                                <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                                                    Chamada para Ação (CTA)
                                                </span>
                                                <p className="text-xs font-semibold text-foreground">
                                                    {developedProposal.cta}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            {/* Barra de Navegação Inferior da Etapa 3 */}
                            <div className="flex items-center justify-between pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCurrentStep(2);
                                        persistCurrentSession({ currentStep: 2 });
                                    }}
                                    className="h-8 px-3 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                    <ArrowLeft size={13} />
                                    <span>Voltar aos Formatos (Etapa 2)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setCurrentStep(1);
                                        persistCurrentSession({ currentStep: 1 });
                                    }}
                                    className="h-8 px-3 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-medium flex items-center gap-1.5 transition-colors"
                                >
                                    <span>Voltar à Grelha (Etapa 1)</span>
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Modal de Edição de Linha da Grelha Oficial (Etapa 1) */}
            {editingRow && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-card border border-border rounded-xl w-full max-w-xl p-5 shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-border/60 pb-3">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Edit3 size={15} className="text-primary" />
                                <span>Editar Abordagem na Grelha Oficial</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEditingRow(null)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="space-y-1">
                                <label className="font-medium text-foreground">1. Ângulo Estratégico</label>
                                <input
                                    type="text"
                                    value={editForm.angulo}
                                    onChange={e => setEditForm(p => ({ ...p, angulo: e.target.value }))}
                                    className="w-full h-8 px-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-foreground">2. Ideia Melhorada</label>
                                <textarea
                                    rows={3}
                                    value={editForm.ideiaMelhorada}
                                    onChange={e => setEditForm(p => ({ ...p, ideiaMelhorada: e.target.value }))}
                                    className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary resize-y"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-foreground">3. Gancho / Base</label>
                                <textarea
                                    rows={2}
                                    value={editForm.ganchoBase}
                                    onChange={e => setEditForm(p => ({ ...p, ganchoBase: e.target.value }))}
                                    className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary resize-y italic"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-foreground">4. Retenção / Hook</label>
                                <textarea
                                    rows={2}
                                    value={editForm.retencaoHook}
                                    onChange={e => setEditForm(p => ({ ...p, retencaoHook: e.target.value }))}
                                    className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary resize-y"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                            <button
                                type="button"
                                onClick={() => setEditingRow(null)}
                                className="h-8 px-3.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEditRow}
                                className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                            >
                                Guardar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
