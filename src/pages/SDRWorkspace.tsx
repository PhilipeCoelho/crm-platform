import { useState, useEffect, useMemo } from 'react';
import {
    Zap, Search, Phone, Clock, ShieldAlert, ShieldCheck,
    CheckCircle2, Copy, RefreshCw,
    MessageSquare, FileText, Ban, Sparkles, Info,
    Brain, Award, AlertTriangle, ChevronDown,
    ChevronUp, ArrowRight, UserCheck, HelpCircle,
    X, Check, Edit3, DollarSign, TrendingUp,
    AlertOctagon, Lightbulb, CheckSquare, XCircle, RotateCcw,
    Rocket, Target, QrCode
} from 'lucide-react';
import {
    SDRWorkQueueItem,
    SDRQueueCounts,
    SDRDiagnosisResponse,
    SDRLearningMetrics,
    FullLearningData,
    fetchSDRWorkQueueWithCounts,
    fetchSDRDiagnosis,
    recordSDROutcome,
    fetchSDRLearningMetrics,
    fetchSDRAdvancedLearning,
    approveLearningRecommendation,
    rejectLearningRecommendation,
    revertLearningRule,
    triggerLearningTick,
    getWhatsAppIntegrationStatus,
    saveApprovedStatus,
    isApprovedLocally,
    saveCustomMessage,
    getCustomMessage,
    suppressContactInCRM,
    sendWhatsAppCloudMessage
} from '@/services/sdrService';
import SDRRecoveryKanban from '@/components/sdr/SDRRecoveryKanban';

type FilterTabKey =
    | 'todos'
    | 'perdidos_qualificados'
    | 'mensagem_enviada'
    | 'em_conversa'
    | 'pronto_reabrir'
    | 'nao_reativado';

export default function SDRWorkspace() {
    // Modo de vista: Kanban é a vista soberana definitiva
    const [workspaceView, setWorkspaceView] = useState<'kanban' | 'posto'>('kanban');
    const [candidates, setCandidates] = useState<SDRWorkQueueItem[]>([]);
    const [counts, setCounts] = useState<SDRQueueCounts>({
        proximaAcao: 0,
        revisaoHumana: 0,
        prontos: 0,
        aguardamResposta: 0,
        closerQualificacao: 0,
        reuniaoConfirmada: 0,
        pausaComercial: 0,
        bloqueados: 0,
        perdidos_qualificados: 0,
        mensagem_enviada: 0,
        em_conversa: 0,
        pronto_reabrir: 0,
        nao_reativado: 0,
        todos: 0
    });
    const [loading, setLoading] = useState(true);
    const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<FilterTabKey>('todos');

    // Estado do Diagnóstico Factual Enriquecido do Negócio Selecionado
    const [diagnosis, setDiagnosis] = useState<SDRDiagnosisResponse | null>(null);
    const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);

    // Estado de Edição de Mensagem (Copy)
    const [messageDraft, setMessageDraft] = useState('');
    const [isEditingDraft, setIsEditingDraft] = useState(false);
    const [selectedCopyVariant, setSelectedCopyVariant] = useState<'recomendada' | 'alternativa'>('recomendada');
    const [copiedToast, setCopiedToast] = useState(false);

    // Estado de Envio WhatsApp Cloud API
    const [whatsAppStatus, setWhatsAppStatus] = useState<any>(null);
    const [legalGateStatus, setLegalGateStatus] = useState<string>('LIVE_AUTHORIZED');
    const [showMetaGuideModal, setShowMetaGuideModal] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendFeedback, setSendFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Estado de Registo de Desfecho Comercial
    const [selectedOutcome, setSelectedOutcome] = useState<string>('EXECUTADA');
    const [outcomeNotes, setOutcomeNotes] = useState<string>('');
    const [isRecordingOutcome, setIsRecordingOutcome] = useState(false);
    const [recordOutcomeSuccess, setRecordOutcomeSuccess] = useState<string | null>(null);

    // Painel / Modal de Métricas de Aprendizagem (B.14.1.5)
    const [showLearningModal, setShowLearningModal] = useState(false);
    const [learningMetrics, setLearningMetrics] = useState<SDRLearningMetrics | null>(null);
    const [fullLearningData, setFullLearningData] = useState<FullLearningData | null>(null);
    const [loadingLearning, setLoadingLearning] = useState(false);
    const [learningTab, setLearningTab] = useState<'piloto' | 'kpis' | 'estrategias' | 'ineficiencias' | 'memoria'>('piloto');
    const [learningPeriod, setLearningPeriod] = useState<number>(30);
    const [learningActionFeedback, setLearningActionFeedback] = useState<string | null>(null);

    // Expansão de secções opcionais
    const [timelineExpanded, setTimelineExpanded] = useState(false);
    const [questionsExpanded, setQuestionsExpanded] = useState(false);

    // Carregar Fila de Trabalho com Contagens
    const loadQueueData = async () => {
        setLoading(true);
        try {
            const [queueRes, waStatus] = await Promise.all([
                fetchSDRWorkQueueWithCounts(150),
                getWhatsAppIntegrationStatus()
            ]);
            setCandidates(queueRes.candidates);
            setCounts(queueRes.counts);
            if (queueRes.legalGate) {
                setLegalGateStatus(queueRes.legalGate);
            }
            setWhatsAppStatus(waStatus);

            // Selecionar o primeiro da fila por defeito
            if (queueRes.candidates.length > 0 && !selectedDealId) {
                const firstReady = queueRes.candidates.find(c => c.isReadyForApproach) || queueRes.candidates[0];
                setSelectedDealId(firstReady.dealId);
            }
        } catch (err) {
            console.error('Erro ao carregar fila SDR:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadQueueData();
    }, []);

    // Negócio selecionado na fila
    const selectedCandidate = useMemo(() => {
        return candidates.find(c => c.dealId === selectedDealId) || null;
    }, [candidates, selectedDealId]);

    // Carregar Diagnóstico Factual do Negócio Selecionado
    const loadDealDiagnosis = async (dealId: string) => {
        setLoadingDiagnosis(true);
        setSendFeedback(null);
        setRecordOutcomeSuccess(null);
        setIsEditingDraft(false);
        try {
            const diag = await fetchSDRDiagnosis(dealId);
            setDiagnosis(diag);

            // Inicializar texto da mensagem
            const customSaved = getCustomMessage(dealId);
            if (customSaved) {
                setMessageDraft(customSaved);
            } else if (diag?.dualCopy?.texto_recomendado) {
                setMessageDraft(diag.dualCopy.texto_recomendado);
            } else if (diag?.gptDiagnosis?.mensagem_sdr_pt_pt?.texto) {
                setMessageDraft(diag.gptDiagnosis.mensagem_sdr_pt_pt.texto);
            } else {
                setMessageDraft('');
            }
        } finally {
            setLoadingDiagnosis(false);
        }
    };

    useEffect(() => {
        if (selectedDealId) {
            loadDealDiagnosis(selectedDealId);
        }
    }, [selectedDealId]);

    // Alternar entre mensagem recomendada e alternativa
    const handleSelectCopyVariant = (variant: 'recomendada' | 'alternativa') => {
        setSelectedCopyVariant(variant);
        if (!diagnosis?.dualCopy) return;
        const text = variant === 'recomendada'
            ? diagnosis.dualCopy.texto_recomendado
            : diagnosis.dualCopy.alternativa_comercial_relevante;
        setMessageDraft(text);
        if (selectedDealId) {
            saveCustomMessage(selectedDealId, text);
        }
    };

    // Filtros de Pesquisa e Abas da Fila de Trabalho (Área A)
    const filteredCandidates = useMemo(() => {
        const cleanQuery = searchQuery.toLowerCase().trim();
        const searchNoSpaces = cleanQuery.replace(/\s+/g, '');
        const searchDigits = cleanQuery.replace(/\D/g, '');

        return candidates.filter(c => {
            const candidatePhone = c.phone || '';
            const phoneNoSpaces = candidatePhone.replace(/\s+/g, '');
            const phoneDigits = candidatePhone.replace(/\D/g, '');

            const directMatch = !cleanQuery ||
                c.title.toLowerCase().includes(cleanQuery) ||
                c.clinicName.toLowerCase().includes(cleanQuery) ||
                c.contactPerson.toLowerCase().includes(cleanQuery) ||
                (candidatePhone && candidatePhone.toLowerCase().includes(cleanQuery)) ||
                (c.email && c.email.toLowerCase().includes(cleanQuery));

            const noSpacesMatch = searchNoSpaces.length > 0 && (
                c.title.toLowerCase().replace(/\s+/g, '').includes(searchNoSpaces) ||
                c.clinicName.toLowerCase().replace(/\s+/g, '').includes(searchNoSpaces) ||
                c.contactPerson.toLowerCase().replace(/\s+/g, '').includes(searchNoSpaces) ||
                (phoneNoSpaces && phoneNoSpaces.includes(searchNoSpaces))
            );

            const digitsMatch = searchDigits.length >= 2 && phoneDigits.length >= 2 && (
                phoneDigits.includes(searchDigits) ||
                (searchDigits.length >= 7 && searchDigits.includes(phoneDigits)) ||
                (phoneDigits.replace(/^(351|55)/, '').length >= 3 && searchDigits.replace(/^(351|55)/, '').length >= 3 &&
                 phoneDigits.replace(/^(351|55)/, '').includes(searchDigits.replace(/^(351|55)/, ''))) ||
                (searchDigits.replace(/^(351|55)/, '').length >= 3 && phoneDigits.replace(/^(351|55)/, '').length >= 3 &&
                 searchDigits.replace(/^(351|55)/, '').includes(phoneDigits.replace(/^(351|55)/, '')))
            );

            const matchesSearch = directMatch || noSpacesMatch || digitsMatch;

            if (!matchesSearch) return false;

            switch (activeTab) {
                case 'perdidos_qualificados':
                    return c.recoveryStage === 'perdidos_qualificados';
                case 'mensagem_enviada':
                    return c.recoveryStage === 'mensagem_enviada';
                case 'em_conversa':
                    return c.recoveryStage === 'em_conversa';
                case 'pronto_reabrir':
                    return c.recoveryStage === 'pronto_reabrir';
                case 'nao_reativado':
                    return c.recoveryStage === 'nao_reativado';
                case 'todos':
                default:
                    return true;
            }
        });
    }, [candidates, searchQuery, activeTab]);

    // Ações Operacionais
    const handleCopyDraft = () => {
        if (!messageDraft) return;
        navigator.clipboard.writeText(messageDraft);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 4500);
    };

    const handleToggleApproved = () => {
        if (!selectedCandidate) return;
        const currentApproved = isApprovedLocally(selectedCandidate.dealId);
        saveApprovedStatus(selectedCandidate.dealId, !currentApproved);
        setCandidates(prev => prev.map(c =>
            c.dealId === selectedCandidate.dealId ? { ...c } : c
        ));
    };

    const handleSuppressContact = async () => {
        if (!selectedCandidate) return;
        const confirmSuppression = window.confirm(
            `Confirma o registo de oposição / opt-out para "${selectedCandidate.clinicName}"?\n\n` +
            `Isto adicionará o contacto à lista duradoura de supressão no CRM e suspenderá abordagens futuras.`
        );
        if (!confirmSuppression) return;

        const success = await suppressContactInCRM(
            selectedCandidate.dealId,
            selectedCandidate.contactId,
            selectedCandidate.phone || '',
            'Oposição expressa registada via posto operacional SDR'
        );

        if (success) {
            alert('Contacto adicionado à lista de supressão com sucesso.');
            loadQueueData();
            if (selectedCandidate.dealId) loadDealDiagnosis(selectedCandidate.dealId);
        } else {
            alert('Erro ao registar supressão.');
        }
    };

    // Submissão do Registo de Desfecho Comercial (Etapa 7)
    const handleRegisterOutcome = async (outcomeToRecord?: string) => {
        if (!selectedCandidate) return;
        const outcome = outcomeToRecord || selectedOutcome;

        setIsRecordingOutcome(true);
        setRecordOutcomeSuccess(null);
        try {
            const res = await recordSDROutcome({
                dealId: selectedCandidate.dealId,
                contactId: selectedCandidate.contactId,
                outcome,
                channel: selectedCandidate.recommendedChannel,
                strategy: diagnosis?.gptDiagnosis?.estrategia_comercial?.abordagem_escolhida || 'CONSULTIVA',
                notes: outcomeNotes || `Resultado comercial [${outcome}] registado pelo operador.`,
                messageApproved: messageDraft,
                executedBy: 'Operador SDR / Closer'
            });

            if (res.success) {
                setRecordOutcomeSuccess(`Resultado [${outcome}] registado no CRM e aprendizagem atualizada!`);
                setOutcomeNotes('');
                loadQueueData();
                loadDealDiagnosis(selectedCandidate.dealId);
            } else {
                alert(`Erro ao registar resultado: ${res.error}`);
            }
        } finally {
            setIsRecordingOutcome(false);
        }
    };

    // Disparo Oficial WhatsApp Cloud API
    const handleSendCloudWhatsApp = async () => {
        if (!selectedCandidate || !selectedCandidate.phone) return;
        if (!isApprovedLocally(selectedCandidate.dealId)) {
            alert('Aprovação obrigatória: É necessário aprovar a mensagem antes de realizar o envio oficial.');
            return;
        }

        const confirmSend = window.confirm(
            `Confirmar envio via WhatsApp Cloud API para:\n\n` +
            `• Clínica: ${selectedCandidate.clinicName}\n` +
            `• Destinatário: ${selectedCandidate.contactPerson}\n` +
            `• Telemóvel: ${selectedCandidate.phone}\n\n` +
            `O envio será auditado e registado no CRM.`
        );
        if (!confirmSend) return;

        setIsSending(true);
        setSendFeedback(null);
        try {
            const res = await sendWhatsAppCloudMessage({
                dealId: selectedCandidate.dealId,
                contactId: selectedCandidate.contactId,
                phone: selectedCandidate.phone,
                messageText: messageDraft,
                isApproved: true
            });

            if (res.success) {
                setSendFeedback({
                    type: 'success',
                    message: `Mensagem enviada com sucesso via Cloud API! (ID: ${res.messageId})`
                });
                // Registar desfecho EXECUTADA automaticamente
                await handleRegisterOutcome('EXECUTADA');
            } else {
                setSendFeedback({
                    type: 'error',
                    message: res.message || res.error || 'Falha no envio via Meta Cloud API.'
                });
            }
        } catch (err: any) {
            setSendFeedback({
                type: 'error',
                message: err.message || 'Erro de comunicação de rede.'
            });
        } finally {
            setIsSending(false);
        }
    };

    // Abrir Modal de Métricas de Aprendizagem (B.14.1.5: enriquecido com custos e memória)
    const handleOpenLearningModal = async (period = learningPeriod) => {
        setShowLearningModal(true);
        setLoadingLearning(true);
        setLearningActionFeedback(null);
        try {
            const data = await fetchSDRAdvancedLearning(period);
            if (data) {
                setFullLearningData(data);
                setLearningMetrics(data.learning);
            } else {
                const metrics = await fetchSDRLearningMetrics();
                setLearningMetrics(metrics);
            }
        } finally {
            setLoadingLearning(false);
        }
    };

    const handleApproveRec = async (id: string, asRule: boolean) => {
        setLearningActionFeedback('A registar aprovação...');
        const res = await approveLearningRecommendation(id, asRule);
        if (res.success) {
            setLearningActionFeedback(asRule ? 'Recomendação aprovada e convertida em regra com sucesso.' : 'Recomendação aprovada.');
            handleOpenLearningModal(learningPeriod);
        } else {
            setLearningActionFeedback(`Erro: ${res.error || 'Falha ao aprovar.'}`);
        }
    };

    const handleRejectRec = async (id: string) => {
        setLearningActionFeedback('A registar recusa...');
        const res = await rejectLearningRecommendation(id, 'Rejeitado pelo operador no posto de trabalho');
        if (res.success) {
            setLearningActionFeedback('Recomendação rejeitada.');
            handleOpenLearningModal(learningPeriod);
        } else {
            setLearningActionFeedback(`Erro: ${res.error || 'Falha ao rejeitar.'}`);
        }
    };

    const handleRevertRule = async (id: string) => {
        setLearningActionFeedback('A reverter regra...');
        const res = await revertLearningRule(id, 'Revertida pelo operador');
        if (res.success) {
            setLearningActionFeedback('Regra revertida e arquivada.');
            handleOpenLearningModal(learningPeriod);
        } else {
            setLearningActionFeedback(`Erro: ${res.error || 'Falha ao reverter.'}`);
        }
    };

    const handleTriggerAnalysis = async () => {
        setLoadingLearning(true);
        setLearningActionFeedback('A executar análise qualitativa e quantitativa com GPT...');
        try {
            const res = await triggerLearningTick(learningPeriod);
            if (res.success) {
                setLearningActionFeedback('Análise concluída com sucesso!');
                handleOpenLearningModal(learningPeriod);
            } else {
                setLearningActionFeedback(`Erro: ${res.error || 'Falha na análise.'}`);
            }
        } finally {
            setLoadingLearning(false);
        }
    };

    const isCurrentDealApproved = selectedCandidate ? isApprovedLocally(selectedCandidate.dealId) : false;

    return (
        <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
            {/* CABEÇALHO DO WORKSPACE (Exibido no modo Posto de Triagem; no modo Kanban o cabeçalho é unificado e soberano no componente) */}
            {workspaceView === 'posto' && (
                <header className="px-6 py-3 border-b border-border bg-card/60 backdrop-blur shrink-0 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                            <Zap size={20} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold tracking-tight">Reaquecimento de Leads Perdidos</h1>
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    Posto de Triagem Manual
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Triagem e revisão individualizada de mensagens sugeridas antes do envio
                            </p>
                        </div>
                    </div>

                    {/* Alternador de Vista: Voltar ao Quadro Kanban */}
                    <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
                        <button
                            onClick={() => setWorkspaceView('kanban')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-background text-foreground shadow-xs border border-border/80 hover:bg-muted"
                        >
                            <TrendingUp size={14} className="text-indigo-500" />
                            <span>← Voltar ao Quadro Kanban</span>
                        </button>
                    </div>

                    {/* Badges e Ações Globais */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Botão de Métricas de Aprendizagem */}
                        <button
                            onClick={() => handleOpenLearningModal()}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 font-semibold hover:bg-purple-500/20 transition-all"
                            title="Ver ciclo de aprendizagem contínua e resultados acumulados"
                        >
                            <Brain size={13} />
                            <span>Métricas de Aprendizagem</span>
                        </button>

                        {/* WhatsApp Status */}
                        <button
                            onClick={() => setShowMetaGuideModal(true)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                                whatsAppStatus?.whatsappWeb?.isConnected
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 font-medium'
                                    : (whatsAppStatus?.configured
                                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 font-medium'
                                        : 'bg-amber-500/10 border-amber-500/20 text-amber-600 font-medium hover:bg-amber-500/20')
                            }`}
                            title="Conectar WhatsApp via QR Code ou Meta Cloud API"
                        >
                            <MessageSquare size={13} />
                            <span>
                                {whatsAppStatus?.whatsappWeb?.isConnected
                                    ? `WhatsApp Web: +${whatsAppStatus.whatsappWeb.connectedUser?.phone || 'Conectado'}`
                                    : (whatsAppStatus?.configured ? 'WhatsApp: Cloud API' : 'Conectar WhatsApp (QR Code)')}
                            </span>
                            <Info size={11} className="opacity-70" />
                        </button>

                        {/* Legal Gate */}
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium text-xs ${
                            legalGateStatus === 'LIVE_AUTHORIZED'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                            {legalGateStatus === 'LIVE_AUTHORIZED' ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                            <span>Gate Legal: {legalGateStatus === 'LIVE_AUTHORIZED' ? 'LIVE AUTHORIZED' : 'FAIL-CLOSED'}</span>
                        </div>

                        {/* Botão Recarregar */}
                        <button
                            onClick={loadQueueData}
                            disabled={loading}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Recarregar fila do CRM"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>
            )}

            {/* AVISO DE CÓPIA MANUAL */}
            {copiedToast && (
                <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between shrink-0 shadow-md">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        <span>Mensagem copiada para a área de transferência! <strong>Lembrete:</strong> A cópia manual não cria atividades fictícias de envio no CRM.</span>
                    </div>
                    <button onClick={() => setCopiedToast(false)} className="text-white/80 hover:text-white">✕</button>
                </div>
            )}

            {/* CORPO DO WORKSPACE: QUADRO KANBAN (5 ETAPAS) COMO VISTA PRINCIPAL E SOBERANA */}
            {workspaceView === 'kanban' ? (
                <div className="flex-1 overflow-hidden">
                    <SDRRecoveryKanban
                        onSelectDealForTriage={(dealId) => {
                            setSelectedDealId(dealId);
                            setWorkspaceView('posto');
                        }}
                        onSwitchToPosto={() => setWorkspaceView('posto')}
                        onOpenLearningMetrics={() => handleOpenLearningModal()}
                        onOpenWhatsAppSettings={() => setShowMetaGuideModal(true)}
                    />
                </div>
            ) : (
                /* VISTA SECUNDÁRIA: POSTO DE TRIAGEM CLÁSSICO */
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Botão de retorno rápido ao Kanban */}
                    <div className="px-4 py-2 border-b border-border bg-muted/40 flex items-center justify-between text-xs shrink-0">
                        <span className="text-muted-foreground font-medium">Modo Detalhado: Posto de Triagem Manual</span>
                        <button
                            onClick={() => setWorkspaceView('kanban')}
                            className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                        >
                            ← Voltar ao Quadro Kanban
                        </button>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                {/* ========================================================================= */}
                {/* ÁREA A — FILA DE TRABALHO (390px)                                         */}
                {/* ========================================================================= */}
                <div className="w-[390px] border-r border-border bg-card/20 flex flex-col shrink-0">
                    {/* Barra de Pesquisa */}
                    <div className="p-3 border-b border-border bg-card/40">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Pesquisar clínica, interlocutor ou telefone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        {/* 5 Etapas Canónicas de Reaquecimento + Todos */}
                        <div className="flex items-center gap-1 mt-2.5 overflow-x-auto pb-1 text-[11px] custom-scrollbar">
                            <button
                                onClick={() => setActiveTab('todos')}
                                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
                                    activeTab === 'todos'
                                        ? 'bg-foreground text-background font-semibold shadow-xs'
                                        : 'text-muted-foreground hover:bg-muted'
                                }`}
                                title="Todos os negócios da base"
                            >
                                Todos ({counts.todos})
                            </button>

                            <button
                                onClick={() => setActiveTab('perdidos_qualificados')}
                                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
                                    activeTab === 'perdidos_qualificados'
                                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                                        : 'text-muted-foreground hover:bg-muted'
                                }`}
                                title="Leads perdidos com telemóvel e contexto aptos para nova abordagem"
                            >
                                1. Perdidos Qualificados ({counts.perdidos_qualificados || 0})
                            </button>

                            <button
                                onClick={() => setActiveTab('mensagem_enviada')}
                                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
                                    activeTab === 'mensagem_enviada'
                                        ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                                        : 'text-muted-foreground hover:bg-muted'
                                }`}
                                title="Mensagens enviadas via WhatsApp, aguardando retorno"
                            >
                                2. Mensagem Enviada ({counts.mensagem_enviada || 0})
                            </button>

                            <button
                                onClick={() => setActiveTab('em_conversa')}
                                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
                                    activeTab === 'em_conversa'
                                        ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                                        : 'text-muted-foreground hover:bg-muted'
                                }`}
                                title="O lead respondeu! SDR em diálogo ativo a responder dúvidas e aquecer"
                            >
                                3. Em Conversa ({counts.em_conversa || 0})
                            </button>

                            <button
                                onClick={() => setActiveTab('pronto_reabrir')}
                                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
                                    activeTab === 'pronto_reabrir'
                                        ? 'bg-amber-600 text-white font-semibold shadow-xs'
                                        : 'text-amber-600 font-semibold hover:bg-amber-500/10'
                                }`}
                                title="Lead quer agendar conversa! Notifica o Philipe para reabrir no funil"
                            >
                                ⭐ 4. Reunião Solicitada ({counts.pronto_reabrir || 0})
                            </button>

                            <button
                                onClick={() => setActiveTab('nao_reativado')}
                                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap font-medium ${
                                    activeTab === 'nao_reativado'
                                        ? 'bg-rose-600 text-white font-semibold shadow-xs'
                                        : 'text-muted-foreground hover:bg-muted'
                                }`}
                                title="Recusa expressa, desqualificado ou sem resposta"
                            >
                                5. Não Reativado ({counts.nao_reativado || 0})
                            </button>
                        </div>
                    </div>

                    {/* Lista de Itens da Fila */}
                    <div className="flex-1 overflow-y-auto divide-y divide-border/50 custom-scrollbar">
                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                                <RefreshCw size={18} className="animate-spin text-primary" />
                                <span>A carregar dados reais do CRM...</span>
                            </div>
                        ) : filteredCandidates.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-xs">
                                Nenhum negócio corresponde ao filtro ativo.
                            </div>
                        ) : (
                            filteredCandidates.map((c) => {
                                const isSelected = c.dealId === selectedDealId;
                                const isApproved = isApprovedLocally(c.dealId);

                                return (
                                    <div
                                        key={c.dealId}
                                        onClick={() => setSelectedDealId(c.dealId)}
                                        className={`p-3.5 cursor-pointer transition-all text-left relative ${
                                            isSelected
                                                ? 'bg-primary/10 border-l-4 border-l-primary shadow-xs'
                                                : 'hover:bg-muted/40'
                                        }`}
                                    >
                                        {/* Linha 1: Clínica e Badge de Aprovação */}
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold text-xs leading-snug line-clamp-1 text-foreground">
                                                {c.clinicName}
                                            </h3>
                                            {isApproved && (
                                                <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                                    <Check size={9} /> Aprovado
                                                </span>
                                            )}
                                        </div>

                                        {/* Linha 2: Pessoa de Contacto e Decisor */}
                                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                                            <span className="font-medium text-foreground/90 truncate max-w-[190px]">
                                                {c.contactPerson}
                                            </span>
                                            {c.isDecisionMakerConfirmed && (
                                                <span className="text-[9px] px-1 rounded bg-blue-500/10 text-blue-600 font-semibold" title="Decisor clínico identificado">
                                                    Decisor
                                                </span>
                                            )}
                                        </div>

                                        {/* Linha 3: Motivo da Perda */}
                                        <p className="text-[10px] text-muted-foreground/80 mt-1 line-clamp-1 italic">
                                            Perda: {c.lostReason || 'Silêncio comercial'}
                                        </p>

                                        {/* Linha 4: Próxima Ação Recomendada */}
                                        <div className="mt-2 text-[11px] font-medium text-primary flex items-center gap-1">
                                            <ArrowRight size={11} className="shrink-0" />
                                            <span className="line-clamp-1">{c.recommendedAction}</span>
                                        </div>

                                        {/* Linha 5: Badges de Canal, Estado Comercial e Bloqueio */}
                                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                            {/* Canal */}
                                            <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                                                c.recommendedChannel === 'WHATSAPP'
                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                                                    : c.recommendedChannel === 'CALL'
                                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                                                    : c.recommendedChannel === 'EMAIL'
                                                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                                                    : 'bg-muted border-border text-muted-foreground'
                                            }`}>
                                                {c.recommendedChannel}
                                            </span>

                                            {/* Badge da Etapa de Reaquecimento */}
                                            {c.recoveryStage === 'pronto_reabrir' && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 border border-amber-500/30">
                                                    ⭐ Reunião Solicitada
                                                </span>
                                            )}
                                            {c.recoveryStage === 'em_conversa' && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                                                    💬 Em Conversa
                                                </span>
                                            )}
                                            {c.recoveryStage === 'mensagem_enviada' && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-600 border border-cyan-500/30">
                                                    ✉️ Mensagem Enviada
                                                </span>
                                            )}
                                            {c.recoveryStage === 'perdidos_qualificados' && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 border border-blue-500/30">
                                                    🎯 Perdido Qualificado
                                                </span>
                                            )}
                                            {c.recoveryStage === 'nao_reativado' && (
                                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600">
                                                    Não Reativado
                                                </span>
                                            )}

                                            {/* Respiro Badge */}
                                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                                c.respiroCumprido
                                                    ? 'bg-emerald-500/10 text-emerald-600'
                                                    : 'bg-amber-500/10 text-amber-600'
                                            }`}>
                                                {c.daysSinceLost}d respiro
                                            </span>

                                            {/* Bloqueio / Suprimido */}
                                            {c.isSuppressed && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20">
                                                    Suprimido
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* ÁREA B — WORKSPACE DO NEGÓCIO SELECIONADO (7 ETAPAS FUNCIONAIS)           */}
                {/* ========================================================================= */}
                <div className="flex-1 flex flex-col overflow-y-auto bg-background p-6 custom-scrollbar">
                    {selectedCandidate ? (
                        <div className="max-w-4xl w-full mx-auto space-y-6">
                            {/* ALERTA DE ESTADO DO REAQUECIMENTO */}
                            {selectedCandidate.recoveryStage === 'pronto_reabrir' && (
                                <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-800 dark:text-amber-200 shadow-sm space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                            ⭐ REUNIÃO DE DIAGNÓSTICO SOLICITADA!
                                        </span>
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                            Ação Manual Requerida
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Este contacto manifestou interesse em agendar a Reunião de Diagnóstico de 20 min com a Vamuss. Foi emitido um alerta para o seu WhatsApp pessoal (<strong className="text-foreground">+351 964 094 865</strong>).
                                    </p>
                                    <div className="p-2.5 rounded-lg bg-background/80 border border-amber-500/30 flex items-center justify-between text-xs">
                                        <span className="font-medium text-foreground">
                                            👉 <strong>Próximo passo:</strong> Abra o <strong>Funil de Prospecção</strong> principal do CRM e <strong>reabra este negócio</strong> na coluna <strong>"Reunião Agendada"</strong>.
                                        </span>
                                    </div>
                                </div>
                            )}

                            {selectedCandidate.recoveryStage === 'em_conversa' && (
                                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-3">
                                    <MessageSquare className="text-emerald-500 shrink-0" size={20} />
                                    <div>
                                        <strong className="block text-emerald-600 dark:text-emerald-400 font-bold">💬 Em Diálogo Ativo com o Lead</strong>
                                        <span className="text-muted-foreground">O contacto respondeu via WhatsApp. O SDR / Closer autónomo está a conduzir a qualificação consultiva para agendar a reunião.</span>
                                    </div>
                                </div>
                            )}

                            {selectedCandidate.recoveryStage === 'mensagem_enviada' && (
                                <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-800 dark:text-cyan-200 text-xs flex items-center gap-3">
                                    <Clock className="text-cyan-500 shrink-0" size={20} />
                                    <div>
                                        <strong className="block text-cyan-600 dark:text-cyan-400 font-bold">✉️ Mensagem Enviada via WhatsApp Web</strong>
                                        <span className="text-muted-foreground">Aguardando resposta da clínica. Quando responder, o SDR retoma a conversa automaticamente para responder a dúvidas e objeções.</span>
                                    </div>
                                </div>
                            )}

                            {selectedCandidate.recoveryStage === 'perdidos_qualificados' && (
                                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-800 dark:text-blue-200 text-xs flex items-center gap-3">
                                    <Target className="text-blue-500 shrink-0" size={20} />
                                    <div>
                                        <strong className="block text-blue-600 dark:text-blue-400 font-bold">🎯 Lead Qualificado para Reaquecimento</strong>
                                        <span className="text-muted-foreground">Aprovado para reaquecimento. Pode disparar a abordagem consultiva abaixo ou aguardar o piloto automático.</span>
                                    </div>
                                </div>
                            )}

                            {/* ------------------------------------------------------------- */}
                            {/* ETAPA 1: Identificação do negócio e estado real no CRM        */}
                            {/* ------------------------------------------------------------- */}
                            <section className="p-5 rounded-xl border border-border bg-card/60 shadow-xs space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Etapa 1</span>
                                            <span className="text-muted-foreground">•</span>
                                            <span className="text-xs font-semibold text-primary">Identificação no CRM</span>
                                            {loadingDiagnosis && <RefreshCw size={11} className="animate-spin text-primary" />}
                                        </div>
                                        <h2 className="text-lg font-bold tracking-tight text-foreground mt-0.5">
                                            {selectedCandidate.clinicName}
                                        </h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Título do Negócio: <strong>{selectedCandidate.title}</strong> • Deal ID: <code className="text-[11px] font-mono">{selectedCandidate.dealId}</code>
                                        </p>
                                    </div>

                                    {/* Ações de Topo: Aprovação e Supressão */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleToggleApproved}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                isCurrentDealApproved
                                                    ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                                    : 'border border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <CheckCircle2 size={13} />
                                            <span>{isCurrentDealApproved ? 'Abordagem Aprovada' : 'Aprovar Abordagem'}</span>
                                        </button>

                                        <button
                                            onClick={handleSuppressContact}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold transition-colors"
                                            title="Registar oposição expressa (opt-out) no CRM"
                                        >
                                            <Ban size={13} />
                                            <span>Suprimir Contacto</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Badges de Estado Comercial e Técnico */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-border/60 text-xs">
                                    <div className="p-2.5 rounded-lg bg-background border border-border">
                                        <span className="text-[10px] text-muted-foreground block">Estado Comercial</span>
                                        <strong className="text-foreground text-[11px]">{selectedCandidate.commercialState}</strong>
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-background border border-border">
                                        <span className="text-[10px] text-muted-foreground block">Interlocutor</span>
                                        <strong className="text-foreground text-[11px] flex items-center gap-1">
                                            {selectedCandidate.contactPerson}
                                            {selectedCandidate.isDecisionMakerConfirmed && (
                                                <UserCheck size={11} className="text-blue-500" />
                                            )}
                                        </strong>
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-background border border-border">
                                        <span className="text-[10px] text-muted-foreground block">Respiro Comercial</span>
                                        <strong className={selectedCandidate.respiroCumprido ? 'text-emerald-600 text-[11px]' : 'text-amber-600 text-[11px]'}>
                                            {selectedCandidate.daysSinceLost}d decorridos ({selectedCandidate.respiroCumprido ? 'Apto ≥30d' : 'Em pausa'})
                                        </strong>
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-background border border-border">
                                        <span className="text-[10px] text-muted-foreground block">Score de Recuperabilidade</span>
                                        <strong className="text-foreground text-[11px]">
                                            {selectedCandidate.recoverabilityScore}/100 • Tier {selectedCandidate.priorityTier}
                                        </strong>
                                    </div>
                                </div>
                            </section>

                            {/* ------------------------------------------------------------- */}
                            {/* ETAPA 2: Resumo da relação comercial e motivo da perda        */}
                            {/* ------------------------------------------------------------- */}
                            <section className="p-5 rounded-xl border border-border bg-card/40 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Etapa 2</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-xs font-semibold text-primary">Relação Comercial e Motivo da Perda</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                    <div className="p-3 rounded-lg bg-background border border-border space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Motivo Registado</span>
                                        <p className="font-semibold text-foreground">{selectedCandidate.lostReason || 'Silêncio após contacto inicial'}</p>
                                        <span className="text-[10px] text-muted-foreground block">
                                            Classificação Canónica: <strong>{selectedCandidate.lostCategory}</strong>
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-lg bg-background border border-border space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Confirmação Factual</span>
                                        <p className="font-semibold text-foreground">
                                            {diagnosis?.gptDiagnosis?.reconstrucao_factual?.motivo_perda_confirmado === 'CONFIRMADO'
                                                ? '✅ Confirmado por Resposta/Atividade'
                                                : '⚠️ Hipótese baseada em silêncio'}
                                        </p>
                                        <span className="text-[10px] text-muted-foreground block">
                                            Confiança: <strong>{diagnosis?.gptDiagnosis?.reconstrucao_factual?.nivel_confianca || 'MÉDIA'}</strong>
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-lg bg-background border border-border space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Tentativas Anteriores</span>
                                        <p className="font-semibold text-foreground">{selectedCandidate.activitiesCount} ações no CRM</p>
                                        <span className="text-[10px] text-muted-foreground block">
                                            Última: {selectedCandidate.lastInteractionDate || 'Sem data'} ({selectedCandidate.lastInteractionChannel || 'N/A'})
                                        </span>
                                    </div>
                                </div>
                            </section>

                            {/* ------------------------------------------------------------- */}
                            {/* ETAPA 3: Linha temporal das interações reais                  */}
                            {/* ------------------------------------------------------------- */}
                            <section className="p-5 rounded-xl border border-border bg-card/40 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Etapa 3</span>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-xs font-semibold text-primary">Linha Temporal das Interações Reais</span>
                                        <span className="text-[11px] text-muted-foreground">({diagnosis?.activities?.length || selectedCandidate.activitiesCount} registos)</span>
                                    </div>

                                    <button
                                        onClick={() => setTimelineExpanded(!timelineExpanded)}
                                        className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                                    >
                                        <span>{timelineExpanded ? 'Recolher' : 'Expandir histórico completo'}</span>
                                        {timelineExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {diagnosis?.activities && diagnosis.activities.length > 0 ? (
                                        (timelineExpanded ? diagnosis.activities : diagnosis.activities.slice(0, 3)).map((act) => (
                                            <div
                                                key={act.id}
                                                className="p-3 rounded-lg bg-background border border-border text-xs flex items-start justify-between gap-3"
                                            >
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-[10px] text-muted-foreground">{act.date}</span>
                                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                            act.isInbound
                                                                ? 'bg-purple-500/10 text-purple-600'
                                                                : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                            {act.isInbound ? 'Inbound (Resposta)' : 'Outbound'}
                                                        </span>
                                                        <span className="font-semibold text-foreground">{act.title}</span>
                                                    </div>
                                                    {act.notes && (
                                                        <p className="text-muted-foreground text-[11px] mt-1 pl-2 border-l-2 border-border/80">
                                                            {act.notes}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-mono text-muted-foreground shrink-0 uppercase">
                                                    {act.channel || act.type}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-3 rounded-lg bg-background border border-border text-xs text-muted-foreground text-center">
                                            Sem atividades detalhadas registadas para este negócio.
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* ------------------------------------------------------------- */}
                            {/* ETAPA 4: Diagnóstico Factual (4 Quadrantes)                   */}
                            {/* ------------------------------------------------------------- */}
                            <section className="p-5 rounded-xl border border-border bg-card/40 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Etapa 4</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-xs font-semibold text-primary">Diagnóstico Factual (Grounding)</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    {/* Factos Confirmados */}
                                    <div className="p-3.5 rounded-lg bg-background border border-border space-y-1.5">
                                        <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                                            <CheckCircle2 size={13} className="text-emerald-500" />
                                            Factos Confirmados no CRM
                                        </h4>
                                        <ul className="text-muted-foreground space-y-1 text-[11px] list-disc list-inside">
                                            <li>Clínica: {selectedCandidate.clinicName}</li>
                                            <li>Histórico: {selectedCandidate.activitiesCount} tentativas de contacto registadas</li>
                                            <li>Respostas anteriores: {diagnosis?.factualHistory?.hasAnyResponse ? 'Sim, houve resposta' : 'Nenhuma resposta documentada'}</li>
                                            <li>Proposta formal: {diagnosis?.factualHistory?.hasProposal ? 'Apresentada anteriormente' : 'Não apresentada'}</li>
                                        </ul>
                                    </div>

                                    {/* Hipóteses Comerciais */}
                                    <div className="p-3.5 rounded-lg bg-background border border-border space-y-1.5">
                                        <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                                            <Sparkles size={13} className="text-purple-500" />
                                            Hipóteses Comerciais a Testar
                                        </h4>
                                        <ul className="text-muted-foreground space-y-1 text-[11px] list-disc list-inside">
                                            <li>Silêncio pode indicar momento de agenda inoportuno e não rejeição técnica</li>
                                            <li>Interesse potencial em tratamentos particulares de reabilitação e implantes</li>
                                            <li>Abordagem anterior pode ter sido generalista ou focada no canal incorreto</li>
                                        </ul>
                                    </div>

                                    {/* Informação em Falta */}
                                    <div className="p-3.5 rounded-lg bg-background border border-border space-y-1.5">
                                        <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                                            <HelpCircle size={13} className="text-amber-500" />
                                            Informação em Falta
                                        </h4>
                                        <ul className="text-muted-foreground space-y-1 text-[11px] list-disc list-inside">
                                            <li>Decisor clínico direto: {selectedCandidate.contactPerson}</li>
                                            <li>Prioridade estratégica no trimestre atual para consultas particulares</li>
                                            <li>Canal de comunicação preferencial da direção clínica</li>
                                        </ul>
                                    </div>

                                    {/* Condições de Execução */}
                                    <div className="p-3.5 rounded-lg bg-background border border-border space-y-1.5">
                                        <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                                            <ShieldAlert size={13} className="text-blue-500" />
                                            Condições de Execução
                                        </h4>
                                        <ul className="text-muted-foreground space-y-1 text-[11px] list-disc list-inside">
                                            <li>Respiro de 30 dias: {selectedCandidate.respiroCumprido ? 'Cumprido ✅' : 'Em curso ⏳'}</li>
                                            <li>Supressão / Oposição: {selectedCandidate.isSuppressed ? 'BLOQUEADO (Ativo)' : 'Livre ✅'}</li>
                                            <li>Elegibilidade de contacto: {selectedCandidate.phone || selectedCandidate.email ? 'Confirmada ✅' : 'Faltam dados'}</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* ------------------------------------------------------------- */}
                            {/* ETAPA 5: Próxima ação recomendada e justificação              */}
                            {/* ------------------------------------------------------------- */}
                            <section className="p-5 rounded-xl border border-border bg-card/60 shadow-xs space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Etapa 5</span>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-xs font-semibold text-primary">Próxima Ação Recomendada & Justificação</span>
                                    </div>

                                    {diagnosis?.analiseDecisaoPrevia && (
                                        <button
                                            onClick={() => setQuestionsExpanded(!questionsExpanded)}
                                            className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                                        >
                                            <span>{questionsExpanded ? 'Ocultar 10 Perguntas Factuais' : 'Ver 10 Perguntas Factuais'}</span>
                                            {questionsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        </button>
                                    )}
                                </div>

                                <div className="p-4 rounded-lg bg-background border border-border space-y-2 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                        <strong className="text-sm text-foreground flex items-center gap-2">
                                            <ArrowRight size={14} className="text-primary" />
                                            {selectedCandidate.recommendedAction}
                                        </strong>
                                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                                            Canal: {selectedCandidate.recommendedChannel}
                                        </span>
                                    </div>

                                    <p className="text-muted-foreground leading-relaxed">
                                        {selectedCandidate.recommendedChannelReason}
                                    </p>

                                    {/* 10 Perguntas Factuais Expandíveis */}
                                    {questionsExpanded && diagnosis?.analiseDecisaoPrevia && (() => {
                                        const q = diagnosis.analiseDecisaoPrevia as any;
                                        return (
                                            <div className="mt-3 pt-3 border-t border-border space-y-2 text-[11px] bg-muted/20 p-3 rounded-lg">
                                                <p><strong>1. Histórico:</strong> {q['1_o_que_aconteceu_historico'] || q.pergunta_1_historico_efetivo}</p>
                                                <p><strong>2. Vamuss comunicou:</strong> {q['2_o_que_vamuss_comunicou'] || q.pergunta_2_o_que_vamuss_comunicou}</p>
                                                <p><strong>3. Tentativas e canais:</strong> {q['3_tentativas_e_canais'] || q.pergunta_3_tentativas_e_canais}</p>
                                                <p><strong>4. Resposta real:</strong> {q['4_houve_resposta_real'] || q.pergunta_4_existiu_resposta_real}</p>
                                                <p><strong>5. Motivo de perda:</strong> {q['5_motivo_registado_perda'] || q.pergunta_5_motivo_perda_registado}</p>
                                                <p><strong>6. Interlocutor e decisor:</strong> {q['6_interlocutor_e_decisor_conhecido'] || q.pergunta_6_interlocutor_e_decisor}</p>
                                                <p><strong>7. O que não sabemos:</strong> {q['7_o_que_ainda_nao_sabemos'] || q.pergunta_7_o_que_nao_sabemos}</p>
                                                <p><strong>8. Obstáculo comercial:</strong> {q['8_obstaculo_comercial_provavel_factos_vs_hipoteses'] || q.pergunta_8_obstaculo_comercial_provavel}</p>
                                                <p><strong>9. Ação mínima:</strong> {q['9_proxima_acao_minima_recomendada'] || q.pergunta_9_proxima_acao_minima}</p>
                                                <p><strong>10. Porque superior:</strong> {q['10_porque_acao_superior_alternativas'] || q.pergunta_10_porque_superior_alternativas}</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </section>

                            {/* ------------------------------------------------------------- */}
                            {/* ETAPA 6: Área de Execução da Tarefa (TASK DRIVEN UI)          */}
                            {/* ------------------------------------------------------------- */}
                            <section className="p-5 rounded-xl border-2 border-primary/30 bg-card shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Etapa 6</span>
                                        <span className="text-muted-foreground">•</span>
                                        <h3 className="text-sm font-bold text-foreground">
                                            Executar Próxima Ação: Tarefa do Tipo [{selectedCandidate.taskType}]
                                        </h3>
                                    </div>

                                    {/* Feedback de Envio */}
                                    {sendFeedback && (
                                        <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                                            sendFeedback.type === 'success'
                                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                                : 'bg-red-500/10 text-red-600 border border-red-500/20'
                                        }`}>
                                            {sendFeedback.message}
                                        </span>
                                    )}
                                </div>

                                {/* CASO A: TAREFA = CALL (Chamada Telefónica) */}
                                {selectedCandidate.taskType === 'CALL' && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2">
                                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                                                <Phone size={14} />
                                                <span>Guião de Chamada Telefónica (Receção ou Direção Clínica)</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                <strong>Objetivo da Chamada:</strong> {diagnosis?.callScript?.objetivo || 'Identificar o médico dentista titular e recolher canal direto.'}
                                            </p>
                                        </div>

                                        {/* Guião Contextual */}
                                        <div className="p-4 rounded-lg bg-background border border-border space-y-2">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                                                Guião Sugerido em Português Europeu (pt-PT)
                                            </span>
                                            <p className="text-xs italic text-foreground leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/60">
                                                {diagnosis?.callScript?.guiao_contextual ||
                                                    `«Boa tarde, daqui fala Philipe Coelho da Vamuss. Gostaria de saber quem é o médico dentista responsável pela direção clínica da ${selectedCandidate.clinicName}, para endereçar uma breve comunicação sobre captação de pacientes particulares para tratamentos de reabilitação. Seria possível indicar o e-mail direto do doutor?»`}
                                            </p>

                                            {/* O que falta descobrir */}
                                            {diagnosis?.callScript?.o_que_falta_descobrir && (
                                                <div className="pt-2 text-xs text-muted-foreground">
                                                    <span className="font-semibold text-foreground">Perguntas a fazer na chamada:</span>
                                                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                                                        {diagnosis.callScript.o_que_falta_descobrir.map((f, i) => (
                                                            <li key={i}>{f}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Botões de Ação Rápida de Chamada */}
                                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                                            <button
                                                onClick={() => handleRegisterOutcome('RESPOSTA_POSITIVA')}
                                                disabled={isRecordingOutcome}
                                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                                            >
                                                <CheckCircle2 size={13} />
                                                <span>Registar Chamada com Sucesso (Decisor Identificado)</span>
                                            </button>

                                            <button
                                                onClick={() => handleRegisterOutcome('SEM_RESPOSTA')}
                                                disabled={isRecordingOutcome}
                                                className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-xs font-medium transition-colors"
                                            >
                                                Registar Chamada Não Atendida / Ocupado
                                            </button>

                                            <button
                                                onClick={() => handleRegisterOutcome('RESPOSTA_NEGATIVA')}
                                                disabled={isRecordingOutcome}
                                                className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-medium transition-colors"
                                            >
                                                Registar Recusa / Sem Interesse
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* CASO B: TAREFA = MESSAGE (WhatsApp ou E-mail) */}
                                {selectedCandidate.taskType === 'MESSAGE' && (
                                    <div className="space-y-4">
                                        {/* Seletor de Cópia Dupla */}
                                        {diagnosis?.dualCopy && (
                                            <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-lg border border-border w-fit text-xs">
                                                <button
                                                    onClick={() => handleSelectCopyVariant('recomendada')}
                                                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                                                        selectedCopyVariant === 'recomendada'
                                                            ? 'bg-background text-foreground shadow-xs'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                                >
                                                    1. Mensagem Recomendada
                                                </button>
                                                <button
                                                    onClick={() => handleSelectCopyVariant('alternativa')}
                                                    className={`px-3 py-1 rounded-md font-semibold transition-all ${
                                                        selectedCopyVariant === 'alternativa'
                                                            ? 'bg-background text-foreground shadow-xs'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                                >
                                                    2. Alternativa Estratégica
                                                </button>
                                            </div>
                                        )}

                                        {/* Contexto da Cópia */}
                                        {diagnosis?.dualCopy?.explicacao_diferenca_estrategica && selectedCopyVariant === 'alternativa' && (
                                            <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/60">
                                                <strong>Diferença Estratégica:</strong> {diagnosis.dualCopy.explicacao_diferenca_estrategica}
                                            </p>
                                        )}

                                        {/* Destinatário e Origem */}
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-card/40 p-2 rounded-lg border border-border">
                                            <span>Destinatário: <strong className="text-foreground">{selectedCandidate.contactPerson}</strong></span>
                                            <span>Canal: <strong className="text-foreground">{selectedCandidate.recommendedChannel}</strong></span>
                                            {selectedCandidate.phone && <span>Tel: <strong className="text-foreground font-mono">{selectedCandidate.phone}</strong></span>}
                                            {selectedCandidate.email && <span>Email: <strong className="text-foreground">{selectedCandidate.email}</strong></span>}
                                        </div>

                                        {/* Editor / Visualizador da Mensagem */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-semibold text-muted-foreground">
                                                    Texto da Mensagem (Português Europeu - pt-PT)
                                                </span>
                                                <button
                                                    onClick={() => setIsEditingDraft(!isEditingDraft)}
                                                    className="text-primary hover:underline flex items-center gap-1 font-medium"
                                                >
                                                    <Edit3 size={12} />
                                                    <span>{isEditingDraft ? 'Guardar edição' : 'Editar texto'}</span>
                                                </button>
                                            </div>

                                            {isEditingDraft ? (
                                                <textarea
                                                    value={messageDraft}
                                                    onChange={(e) => {
                                                        setMessageDraft(e.target.value);
                                                        saveCustomMessage(selectedCandidate.dealId, e.target.value);
                                                    }}
                                                    rows={6}
                                                    className="w-full p-3 text-xs rounded-lg border border-primary bg-background focus:outline-none focus:ring-1 focus:ring-primary font-sans leading-relaxed"
                                                />
                                            ) : (
                                                <div className="p-4 rounded-lg bg-muted/20 border border-border text-xs leading-relaxed whitespace-pre-line text-foreground">
                                                    {messageDraft || 'A gerar abordagem comercial...'}
                                                </div>
                                            )}
                                        </div>

                                        {/* Botões de Execução */}
                                        <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleCopyDraft}
                                                    className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                                    title="Copiar texto para colar no WhatsApp ou cliente de email"
                                                >
                                                    <Copy size={13} />
                                                    <span>Copiar Mensagem</span>
                                                </button>

                                                <button
                                                    onClick={() => handleRegisterOutcome('EXECUTADA')}
                                                    disabled={isRecordingOutcome}
                                                    className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                                    title="Registar que a mensagem foi enviada manualmente"
                                                >
                                                    <CheckCircle2 size={13} className="text-blue-500" />
                                                    <span>Registar Envio Manual</span>
                                                </button>
                                            </div>

                                            {/* Disparar Cloud API (Apenas se WhatsApp + Elegível) */}
                                            {selectedCandidate.recommendedChannel === 'WHATSAPP' && (
                                                <button
                                                    onClick={handleSendCloudWhatsApp}
                                                    disabled={
                                                        isSending ||
                                                        selectedCandidate.legalGateBlocked ||
                                                        !(whatsAppStatus?.configured || whatsAppStatus?.whatsappWeb?.isConnected) ||
                                                        !isCurrentDealApproved
                                                    }
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                                        !selectedCandidate.legalGateBlocked && (whatsAppStatus?.configured || whatsAppStatus?.whatsappWeb?.isConnected) && isCurrentDealApproved
                                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                                            : 'bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60'
                                                    }`}
                                                    title={
                                                        selectedCandidate.legalGateBlocked
                                                            ? `Bloqueado: ${selectedCandidate.legalGateBlockReason}`
                                                            : !isCurrentDealApproved
                                                            ? 'Marque como aprovado antes de disparar'
                                                            : !(whatsAppStatus?.configured || whatsAppStatus?.whatsappWeb?.isConnected)
                                                            ? 'Nenhum canal WhatsApp disponível'
                                                            : whatsAppStatus?.whatsappWeb?.isConnected
                                                            ? 'Disparar diretamente pelo seu WhatsApp Web (+351 964 094 865)'
                                                            : 'Disparar oficialmente via WhatsApp Cloud API'
                                                    }
                                                >
                                                    <MessageSquare size={13} />
                                                    <span>
                                                        {isSending
                                                            ? 'A enviar...'
                                                            : whatsAppStatus?.whatsappWeb?.isConnected
                                                            ? 'Enviar via WhatsApp Web'
                                                            : 'Disparar Cloud API (Oficial)'}
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* CASO C: TAREFA = PAUSE (Pausa Comercial / Respiro) */}
                                {selectedCandidate.taskType === 'PAUSE' && (
                                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2 text-xs">
                                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
                                            <Clock size={16} />
                                            <span>Pausa Comercial Ativa — Respiro de 30 Dias ou Oposição</span>
                                        </div>
                                        <p className="text-muted-foreground leading-relaxed">
                                            {diagnosis?.pauseDetails?.motivo ||
                                                `O negócio está dentro do período de respiro comercial de 30 dias (${selectedCandidate.daysSinceLost}/30 dias decorridos).`}
                                        </p>
                                        <div className="pt-1 text-[11px] font-medium text-foreground">
                                            Data sugerida para reavaliação: <strong>{diagnosis?.pauseDetails?.data_reavaliacao || '30 dias após encerramento'}</strong>.
                                            Nenhum envio prematuro está autorizado.
                                        </div>
                                    </div>
                                )}

                                {/* CASO D: TAREFA = HUMAN_VALIDATION (Validação de Dados) */}
                                {selectedCandidate.taskType === 'HUMAN_VALIDATION' && (
                                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-2 text-xs">
                                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold">
                                            <UserCheck size={16} />
                                            <span>Revisão Humana de Identidade Obrigatória</span>
                                        </div>
                                        <p className="text-muted-foreground leading-relaxed">
                                            {selectedCandidate.humanValidationReason ||
                                                'O interlocutor não possui nome ou cargo formalmente confirmados no histórico. Confirme o decisor clínico antes de qualquer abordagem.'}
                                        </p>
                                        <button
                                            onClick={handleToggleApproved}
                                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors mt-1"
                                        >
                                            Validar e Marcar como Aprovado
                                        </button>
                                    </div>
                                )}

                                {/* CASO E: TAREFA = CLOSER_SPIN (Qualificação SPIN Selling) */}
                                {selectedCandidate.taskType === 'CLOSER_SPIN' && (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 space-y-2 text-xs">
                                            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold">
                                                <Award size={16} />
                                                <span>Qualificação Comercial pelo Closer (SPIN Selling)</span>
                                            </div>
                                            <p className="text-muted-foreground leading-relaxed">
                                                {diagnosis?.closerContext?.resumo_partilhado ||
                                                    'Lead demonstrou interesse explícito. Conduzir diagnóstico consultivo das dores clínicas e capacidade de agenda.'}
                                            </p>
                                        </div>

                                        {/* Perguntas SPIN */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                            <div className="p-3 rounded-lg bg-background border border-border">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground block">S — Situação</span>
                                                <p className="text-foreground mt-0.5">{diagnosis?.closerContext?.roteiro_spin?.situacao || 'Como está hoje a captação de primeiras consultas?'}</p>
                                            </div>
                                            <div className="p-3 rounded-lg bg-background border border-border">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground block">P — Problema</span>
                                                <p className="text-foreground mt-0.5">{diagnosis?.closerContext?.roteiro_spin?.problema || 'A dependência de acordos causa oscilação na faturação?'}</p>
                                            </div>
                                            <div className="p-3 rounded-lg bg-background border border-border">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground block">I — Implicação</span>
                                                <p className="text-foreground mt-0.5">{diagnosis?.closerContext?.roteiro_spin?.implicacao || 'Quanto custa um gabinete ocioso ou a baixa margem de seguros?'}</p>
                                            </div>
                                            <div className="p-3 rounded-lg bg-background border border-border">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground block">N — Necessidade</span>
                                                <p className="text-foreground mt-0.5">{diagnosis?.closerContext?.roteiro_spin?.necessidade || 'Faria sentido ter um fluxo previsível de pacientes particulares?'}</p>
                                            </div>
                                        </div>

                                        {/* Aviso de Limitação de Calendário Externo */}
                                        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                                            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                                            <span>
                                                <strong>Limitação Técnica:</strong> A integração com calendário externo não está configurada. A reunião de 20 minutos só deve ser registada como confirmada quando existir um evento real na agenda da clínica.
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <button
                                                onClick={() => handleRegisterOutcome('REUNIAO_CONFIRMADA')}
                                                disabled={isRecordingOutcome}
                                                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                                            >
                                                Confirmar Agendamento de Reunião (20 min)
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* ------------------------------------------------------------- */}
                            {/* ETAPA 7: Registo do resultado real e próxima etapa            */}
                            {/* ------------------------------------------------------------- */}
                            <section className="p-5 rounded-xl border border-border bg-card/60 shadow-xs space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Etapa 7</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-xs font-semibold text-primary">Registo do Resultado Real & Ciclo de Vida</span>
                                </div>

                                <div className="p-4 rounded-lg bg-background border border-border space-y-3 text-xs">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                                                Desfecho Observado (10 Estados Canónicos)
                                            </label>
                                            <select
                                                value={selectedOutcome}
                                                onChange={(e) => setSelectedOutcome(e.target.value)}
                                                className="w-full p-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                            >
                                                <option value="EXECUTADA">1. Executada (Abordagem realizada com sucesso)</option>
                                                <option value="SEM_RESPOSTA">2. Sem Resposta (Após janela de observação)</option>
                                                <option value="RESPOSTA_POSITIVA">3. Resposta Positiva (Interesse preliminar)</option>
                                                <option value="RESPOSTA_NEGATIVA">4. Resposta Negativa / Objeção Declarada</option>
                                                <option value="OPTOUT">5. Pedido para não voltar a contactar (Opt-out)</option>
                                                <option value="INTERESSE_QUALIFICADO">6. Interesse Qualificado (Pronto para Closer)</option>
                                                <option value="REUNIAO_CONFIRMADA">7. Reunião Confirmada (Evento real em agenda)</option>
                                                <option value="PROPOSTA_APRESENTADA">8. Proposta Apresentada</option>
                                                <option value="VENDA_GANHA">9. Venda Ganha (Contrato fechado)</option>
                                                <option value="VENDA_PERDIDA">10. Venda Perdida</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                                                Notas Operacionais do CRM
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Falou com Dra. Sofia, pediu envio de caso prático por email..."
                                                value={outcomeNotes}
                                                onChange={(e) => setOutcomeNotes(e.target.value)}
                                                className="w-full p-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                    </div>

                                    {/* Botão de Gravação do Resultado */}
                                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                                        {recordOutcomeSuccess ? (
                                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                                <CheckCircle2 size={13} />
                                                {recordOutcomeSuccess}
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground">
                                                O registo atualiza a máquina de estados do CRM e alimenta a aprendizagem contínua.
                                            </span>
                                        )}

                                        <button
                                            onClick={() => handleRegisterOutcome()}
                                            disabled={isRecordingOutcome}
                                            className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 size={13} />
                                            <span>{isRecordingOutcome ? 'A registar...' : 'Registar Resultado no CRM'}</span>
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-muted-foreground">
                            <FileText size={36} className="text-muted-foreground/40 mb-3" />
                            <h3 className="text-sm font-semibold text-foreground">Nenhum negócio selecionado</h3>
                            <p className="text-xs max-w-sm mt-1">
                                Selecione um negócio na fila de trabalho à esquerda para analisar o histórico factual e executar a próxima ação recomendada.
                            </p>
                        </div>
                    )}
                </div>
            </div>
            </div>
            )}

            {/* MODAL / PAINEL DE APRENDIZAGEM COMERCIAL CONTÍNUA (B.14.1.5) */}
            {showLearningModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
                    <div className="bg-card border border-border rounded-xl max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar space-y-4">
                        {/* Cabeçalho do Painel */}
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2">
                                <Brain size={20} className="text-purple-500" />
                                <div>
                                    <h3 className="font-bold text-sm text-foreground">Painel de Aprendizagem Comercial Contínua</h3>
                                    <p className="text-[11px] text-muted-foreground">Motor SDR + Closer Grounded • Fonte de verdade: CRM</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={learningPeriod}
                                    onChange={(e) => {
                                        const p = parseInt(e.target.value, 10);
                                        setLearningPeriod(p);
                                        handleOpenLearningModal(p);
                                    }}
                                    className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
                                >
                                    <option value={7}>Últimos 7 dias</option>
                                    <option value={30}>Últimos 30 dias</option>
                                    <option value={90}>Últimos 90 dias</option>
                                </select>
                                <button
                                    onClick={handleTriggerAnalysis}
                                    disabled={loadingLearning}
                                    className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                    title="Disparar análise quantitativa e qualitativa GPT sob demanda"
                                >
                                    <Sparkles size={12} />
                                    <span>Analisar com GPT</span>
                                </button>
                                <button onClick={() => setShowLearningModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Feedback de Ação */}
                        {learningActionFeedback && (
                            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs flex items-center justify-between">
                                <span>{learningActionFeedback}</span>
                                <button onClick={() => setLearningActionFeedback(null)} className="text-xs text-primary/70 hover:text-primary">✕</button>
                            </div>
                        )}

                        {/* Abas Internas de Navegação */}
                        <div className="flex items-center gap-1 border-b border-border pb-1">
                            <button
                                onClick={() => setLearningTab('piloto')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                                    learningTab === 'piloto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Rocket size={13} className="text-amber-400" />
                                <span>Piloto 30 Dias</span>
                            </button>
                            <button
                                onClick={() => setLearningTab('kpis')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    learningTab === 'kpis' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Indicadores & Custos
                            </button>
                            <button
                                onClick={() => setLearningTab('estrategias')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    learningTab === 'estrategias' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Estratégias & Segmentos
                            </button>
                            <button
                                onClick={() => setLearningTab('ineficiencias')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                    learningTab === 'ineficiencias' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <span>Ineficiências & Alertas</span>
                                {(fullLearningData?.advanced?.inefficiencies?.length || 0) > 0 && (
                                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                                        {fullLearningData?.advanced?.inefficiencies.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setLearningTab('memoria')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                    learningTab === 'memoria' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <span>Memória & Recomendações</span>
                                {(fullLearningData?.memory?.recommendations?.filter(r => r.status === 'pending_approval')?.length || 0) > 0 && (
                                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                                        {fullLearningData?.memory?.recommendations.filter(r => r.status === 'pending_approval').length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {loadingLearning ? (
                            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                                <RefreshCw size={20} className="animate-spin text-purple-500" />
                                <span>A calcular indicadores reais de aprendizagem e custos...</span>
                            </div>
                        ) : (
                            <div className="space-y-4 text-xs">
                                {/* Aviso Rigoroso de Calibração */}
                                <div className={`p-3 rounded-lg border leading-relaxed flex items-start gap-2.5 ${
                                    learningMetrics?.isCalibrated
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                                }`}>
                                    {learningMetrics?.isCalibrated ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                                    <div>
                                        <strong className="font-semibold block">Calibração Estatística da Amostra:</strong>
                                        <span className="text-[11px]">{learningMetrics?.sampleDisclaimer || fullLearningData?.advanced?.sampleWarning}</span>
                                    </div>
                                </div>

                                {/* TAB 0: COCKPIT DO PILOTO COMERCIAL 30 DIAS */}
                                {learningTab === 'piloto' && (
                                    <div className="space-y-4">
                                        {/* Banner do Piloto */}
                                        <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-background border border-blue-500/30">
                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                                                        <Target size={18} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-sm text-foreground">Cockpit do Piloto Comercial (30 Dias)</h3>
                                                        <p className="text-[11px] text-muted-foreground">Objetivo: Conquistar pelo menos 1 cliente pago para a Vamuss com operação autónoma supervisionada</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
                                                        CRM Real
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-semibold">
                                                        Staging Fail-Closed
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-semibold">
                                                        Tarifas Estimadas
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Métricas do Funil do Piloto */}
                                        <div>
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <TrendingUp size={13} className="text-primary" />
                                                <span>Funil Comercial Real do Piloto</span>
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Contactos Elegíveis</span>
                                                    <strong className="text-base text-foreground">{candidates.length}</strong>
                                                    <span className="text-[9px] text-muted-foreground block">Fila real do CRM</span>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Abordagens Realizadas</span>
                                                    <strong className="text-base text-blue-500">{fullLearningData?.advanced?.kpis?.taxaResposta?.denominador ?? 0}</strong>
                                                    <span className="text-[9px] text-muted-foreground block">Disparos no período</span>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Respostas Recebidas</span>
                                                    <strong className="text-base text-foreground">{fullLearningData?.advanced?.kpis?.taxaResposta?.numerador ?? 0}</strong>
                                                    <span className="text-[9px] text-emerald-500 block font-semibold">{fullLearningData?.advanced?.kpis?.taxaResposta?.valor ?? 0}% taxa resposta</span>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Interesse Genuíno</span>
                                                    <strong className="text-base text-emerald-500">{counts.closerQualificacao}</strong>
                                                    <span className="text-[9px] text-muted-foreground block">Passados ao Closer</span>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Reuniões Confirmadas</span>
                                                    <strong className="text-base text-indigo-500">{counts.reuniaoConfirmada}</strong>
                                                    <span className="text-[9px] text-muted-foreground block">Diagnóstico 20 min</span>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Propostas Apresentadas</span>
                                                    <strong className="text-base text-purple-500">{counts.reuniaoConfirmada > 0 ? 1 : 0}</strong>
                                                    <span className="text-[9px] text-muted-foreground block">Dossiê Vamuss</span>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Clientes Conquistados</span>
                                                    <strong className="text-base text-emerald-500">0</strong>
                                                    <span className="text-[9px] text-amber-500 block font-semibold">Meta: ≥ 1 cliente</span>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Despesa Total</span>
                                                    <strong className="text-base text-foreground">€{fullLearningData?.advanced?.costSummary?.totalCombined ?? '0.00'}</strong>
                                                    <span className="text-[9px] text-muted-foreground block">OpenAI + WhatsApp</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Custos Unitários e Eficiência Financeira */}
                                        <div>
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <DollarSign size={13} className="text-emerald-500" />
                                                <span>Economia e Custos Unitários de Aquisição</span>
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Custo por Oportunidade Qualificada</span>
                                                    <strong className="text-sm text-foreground">
                                                        €{fullLearningData?.advanced?.kpis?.custoPorOportunidadeQualificada?.valor ?? '0.00'}
                                                    </strong>
                                                    <span className="text-[9px] text-muted-foreground block mt-0.5">Baseado em leads engajados</span>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Custo por Reunião de Diagnóstico</span>
                                                    <strong className="text-sm text-indigo-500">
                                                        €{fullLearningData?.advanced?.kpis?.custoPorReuniao?.valor ?? '0.00'}
                                                    </strong>
                                                    <span className="text-[9px] text-muted-foreground block mt-0.5">Sessões marcadas na agenda</span>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Custo por Cliente Conquistado</span>
                                                    <strong className="text-sm text-emerald-500">
                                                        €{fullLearningData?.advanced?.kpis?.custoPorClienteConquistado?.valor ?? '0.00'}
                                                    </strong>
                                                    <span className="text-[9px] text-muted-foreground block mt-0.5">Venda fechada</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Salvaguardas Operacionais do Piloto */}
                                        <div className="p-3.5 rounded-xl bg-card border border-border space-y-2.5">
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <ShieldAlert size={13} className="text-amber-500" />
                                                <span>Salvaguardas e Bloqueios em Execução</span>
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                                <div className="p-2 rounded-lg bg-background border border-border">
                                                    <span className="text-muted-foreground block text-[10px]">Horário Comercial</span>
                                                    <strong className="text-foreground">09h00 - 17h00</strong>
                                                    <span className="text-[9px] text-muted-foreground block">Europe/Lisbon Seg-Sex</span>
                                                </div>
                                                <div className="p-2 rounded-lg bg-background border border-border">
                                                    <span className="text-muted-foreground block text-[10px]">Gate Legal de Envio</span>
                                                    <strong className={legalGateStatus === 'LIVE_AUTHORIZED' ? 'text-emerald-500' : 'text-red-500'}>
                                                        {legalGateStatus === 'LIVE_AUTHORIZED' ? 'LIVE AUTHORIZED' : 'FAIL-CLOSED'}
                                                    </strong>
                                                    <span className="text-[9px] text-muted-foreground block">
                                                        {legalGateStatus === 'LIVE_AUTHORIZED' ? 'Envios reais ativos' : 'Simulação protegida'}
                                                    </span>
                                                </div>
                                                <div className="p-2 rounded-lg bg-background border border-border">
                                                    <span className="text-muted-foreground block text-[10px]">Casos em Revisão Humana</span>
                                                    <strong className="text-purple-500">{counts.revisaoHumana}</strong>
                                                    <span className="text-[9px] text-muted-foreground block">Ambiguidades / Dúvidas</span>
                                                </div>
                                                <div className="p-2 rounded-lg bg-background border border-border">
                                                    <span className="text-muted-foreground block text-[10px]">Supressões / Opt-Out</span>
                                                    <strong className="text-red-600">{counts.bloqueados}</strong>
                                                    <span className="text-[9px] text-muted-foreground block">Impedidos de envio</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Checklist para Ativação de Produção */}
                                        <div className="p-3.5 rounded-xl bg-card border border-border space-y-2">
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <CheckSquare size={13} className="text-emerald-500" />
                                                <span>Checklist para Ativação de Envios Reais</span>
                                            </h4>
                                            <div className="space-y-1.5 text-[11px]">
                                                <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                                                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-[10px]">✓</span>
                                                    <span className="flex-1">Código B.14.2.1 validado com testes determinísticos de ponta a ponta</span>
                                                </div>
                                                <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                                                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-[10px]">!</span>
                                                    <span className="flex-1">Executar migração SQL no Supabase (<code className="text-[10px] bg-muted px-1 py-0.5 rounded">supabase/migrations/20261020_sdr_b14_2_complete.sql</code>)</span>
                                                </div>
                                                <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                                                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-[10px]">!</span>
                                                    <span className="flex-1">Configurar credenciais da WhatsApp Business Cloud API em produção (<code className="text-[10px] bg-muted px-1 py-0.5 rounded">.env</code>)</span>
                                                </div>
                                                <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                                                    <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold text-[10px]">×</span>
                                                    <span className="flex-1">Definir <code className="text-[10px] bg-muted px-1 py-0.5 rounded">SDR_LEGAL_GATE=LIVE_AUTHORIZED</code> apenas após validação do operador</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 1: INDICADORES E CUSTOS */}
                                {learningTab === 'kpis' && (
                                    <div className="space-y-4">
                                        {/* Grid de Custos Unitários */}
                                        <div>
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <DollarSign size={13} className="text-emerald-500" />
                                                <span>Economia Comercial & Custos por Resultado</span>
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Custo / Oportunidade Qualificada</span>
                                                    <strong className="text-base text-foreground">
                                                        €{fullLearningData?.advanced?.kpis?.custoPorOportunidadeQualificada?.valor ?? '0.00'}
                                                    </strong>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Custo / Reunião Realizada</span>
                                                    <strong className="text-base text-indigo-600">
                                                        €{fullLearningData?.advanced?.kpis?.custoPorReuniao?.valor ?? '0.00'}
                                                    </strong>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Custo / Cliente Conquistado</span>
                                                    <strong className="text-base text-emerald-600">
                                                        €{fullLearningData?.advanced?.kpis?.custoPorClienteConquistado?.valor ?? '0.00'}
                                                    </strong>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Custo Médio / Abordagem</span>
                                                    <strong className="text-base text-foreground">
                                                        €{fullLearningData?.advanced?.costSummary?.custoMedioPorAbordagem ?? '0.00'}
                                                    </strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Balanço de Custos */}
                                        <div className="p-3 rounded-lg bg-background border border-border flex items-center justify-between text-[11px]">
                                            <div className="flex items-center gap-2">
                                                <DollarSign size={14} className="text-muted-foreground" />
                                                <span className="font-medium text-foreground">Despesa Total Acumulada no Período:</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-muted-foreground">
                                                <span>WhatsApp: <strong>€{fullLearningData?.advanced?.costSummary?.totalWhatsapp ?? '0.00'}</strong></span>
                                                <span>OpenAI: <strong>€{fullLearningData?.advanced?.costSummary?.totalOpenai ?? '0.00'}</strong></span>
                                                <span className="text-foreground font-bold">Total: €{fullLearningData?.advanced?.costSummary?.totalCombined ?? '0.00'}</span>
                                            </div>
                                        </div>

                                        {/* Taxas de Conversão e Métricas Operacionais */}
                                        <div>
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <TrendingUp size={13} className="text-primary" />
                                                <span>Taxas do Funil & Salvaguardas</span>
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                                <div className="p-2.5 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Taxa de Resposta</span>
                                                    <strong className="text-sm text-foreground">{fullLearningData?.advanced?.kpis?.taxaResposta?.valor ?? 0}%</strong>
                                                    <span className="text-[9px] text-muted-foreground block">{fullLearningData?.advanced?.kpis?.taxaResposta?.numerador}/{fullLearningData?.advanced?.kpis?.taxaResposta?.denominador}</span>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Taxa Interesse Genuíno</span>
                                                    <strong className="text-sm text-emerald-600">{fullLearningData?.advanced?.kpis?.taxaInteresseGenuino?.valor ?? 0}%</strong>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Taxa Reuniões</span>
                                                    <strong className="text-sm text-indigo-600">{fullLearningData?.advanced?.kpis?.taxaReuniao?.valor ?? 0}%</strong>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Mensagens / Oportunidade</span>
                                                    <strong className="text-sm text-foreground">{fullLearningData?.advanced?.kpis?.mensagensMediasPorOportunidade?.valor ?? 0}</strong>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Taxa de Rejeição</span>
                                                    <strong className="text-sm text-amber-600">{fullLearningData?.advanced?.kpis?.taxaRejeicao?.valor ?? 0}%</strong>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Taxa de Opt-out</span>
                                                    <strong className="text-sm text-red-600">{fullLearningData?.advanced?.kpis?.taxaOptout?.valor ?? 0}%</strong>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Taxa de Reclamações</span>
                                                    <strong className="text-sm text-red-700">{fullLearningData?.advanced?.kpis?.taxaReclamacao?.valor ?? 0}%</strong>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-background border border-border">
                                                    <span className="text-[10px] text-muted-foreground block">Intervenção Humana</span>
                                                    <strong className="text-sm text-purple-600">{fullLearningData?.advanced?.kpis?.taxaIntervencaoHumana?.valor ?? 0}%</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: ESTRATÉGIAS & SEGMENTOS */}
                                {learningTab === 'estrategias' && (
                                    <div className="space-y-4">
                                        {/* Top Performers */}
                                        <div>
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <Award size={13} className="text-amber-500" />
                                                <span>Estratégias com Melhor Desempenho Observado</span>
                                            </h4>
                                            {(fullLearningData?.advanced?.topPerformers?.length || 0) > 0 ? (
                                                <div className="space-y-1.5">
                                                    {fullLearningData?.advanced?.topPerformers.map((tp, idx) => (
                                                        <div key={idx} className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between text-[11px]">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 font-bold flex items-center justify-center text-[10px]">
                                                                    #{idx + 1}
                                                                </span>
                                                                <span className="font-semibold text-foreground">{tp.estrategia}</span>
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground uppercase">{tp.tipo_dado}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-muted-foreground">
                                                                <span>{tp.positivas}/{tp.total} positivas ({tp.taxaPositiva}%)</span>
                                                                <span className="font-medium text-foreground">€{tp.custoPorPositiva}/positiva</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded">Ainda sem dados suficientes para destacar estratégias com alto desempenho.</p>
                                            )}
                                        </div>

                                        {/* Todas por Estratégia */}
                                        <div>
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2">Desempenho Geral por Estratégia Comercial</h4>
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                                {Object.entries(fullLearningData?.advanced?.byApproachType || {}).map(([strat, data]: [string, any]) => (
                                                    <div key={strat} className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between text-[11px]">
                                                        <div>
                                                            <span className="font-medium text-foreground block">{strat}</span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {data.total} tentativas • Custo: €{data.costTotal}
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="font-semibold text-foreground block">{data.positive} positivas ({data.taxaPositiva}%)</span>
                                                            <span className="text-[10px] text-muted-foreground">{data.meetings} reuniões • {data.optouts} opt-outs</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Por Segmento */}
                                        <div>
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2">Desempenho por Segmento / Causa de Perda</h4>
                                            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                                {Object.entries(fullLearningData?.advanced?.bySegment || {}).map(([seg, data]: [string, any]) => (
                                                    <div key={seg} className="p-2 rounded-lg bg-background border border-border flex items-center justify-between text-[11px]">
                                                        <span className="font-medium text-foreground">{seg}</span>
                                                        <span className="text-muted-foreground">
                                                            {data.total} casos • {data.positive} positivas ({data.taxaPositiva}%) • €{data.costTotal}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: INEFICIÊNCIAS E ALERTAS */}
                                {learningTab === 'ineficiencias' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <AlertOctagon size={13} className="text-red-500" />
                                                <span>Alertas de Desperdício & Ineficiências Detetadas</span>
                                            </h4>
                                            <span className="text-[10px] text-muted-foreground">Regras determinísticas de integridade comercial</span>
                                        </div>

                                        {(fullLearningData?.advanced?.inefficiencies?.length || 0) > 0 ? (
                                            <div className="space-y-2">
                                                {fullLearningData?.advanced?.inefficiencies.map((ineff, idx) => (
                                                    <div key={idx} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 space-y-1 text-[11px]">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-red-600 dark:text-red-400 uppercase tracking-wide text-[10px]">
                                                                [{ineff.tipo}]
                                                            </span>
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground uppercase">{ineff.tipo_dado}</span>
                                                        </div>
                                                        <p className="text-foreground font-medium">{ineff.descricao}</p>
                                                        <p className="text-muted-foreground text-[10px]"><strong>Ação recomendada:</strong> {ineff.recomendacao}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-6 text-center text-muted-foreground bg-muted/10 rounded-lg">
                                                <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                                                <p className="font-medium text-foreground">Nenhuma ineficiência crítica detetada.</p>
                                                <p className="text-[10px] mt-1">Não foram identificados ciclos excessivos, mensagens redundantes ou custos desproporcionados no período.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 4: MEMÓRIA & RECOMENDAÇÕES */}
                                {learningTab === 'memoria' && (
                                    <div className="space-y-4">
                                        {/* Recomendações Pendentes de Aprovação */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                    <Lightbulb size={13} className="text-amber-500" />
                                                    <span>Recomendações Comerciais do GPT (Requerem Aprovação)</span>
                                                </h4>
                                                <span className="text-[10px] text-muted-foreground">Salvaguarda: nenhuma alteração de alto impacto é autónoma</span>
                                            </div>

                                            {(fullLearningData?.memory?.recommendations?.filter(r => r.status === 'pending_approval')?.length || 0) > 0 ? (
                                                <div className="space-y-2">
                                                    {fullLearningData?.memory?.recommendations.filter(r => r.status === 'pending_approval').map(rec => (
                                                        <div key={rec.id} className="p-3 rounded-lg bg-background border border-border space-y-2 text-[11px]">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div>
                                                                    <p className="font-semibold text-foreground">{rec.description}</p>
                                                                    {rec.expected_impact && (
                                                                        <p className="text-[10px] text-muted-foreground mt-0.5">Impacto esperado: {rec.expected_impact}</p>
                                                                    )}
                                                                </div>
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-600 font-semibold uppercase">
                                                                    Risco {rec.risk_level || 'Médio'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                                                                <button
                                                                    onClick={() => handleRejectRec(rec.id)}
                                                                    className="px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-[10px] font-medium flex items-center gap-1"
                                                                >
                                                                    <XCircle size={11} />
                                                                    <span>Rejeitar</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleApproveRec(rec.id, false)}
                                                                    className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-[10px] font-medium flex items-center gap-1"
                                                                >
                                                                    <Check size={11} />
                                                                    <span>Aprovar</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleApproveRec(rec.id, true)}
                                                                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold flex items-center gap-1"
                                                                >
                                                                    <CheckSquare size={11} />
                                                                    <span>Aprovar como Regra Ativa</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic p-3 bg-muted/20 rounded">Nenhuma recomendação pendente de aprovação no momento.</p>
                                            )}
                                        </div>

                                        {/* Regras Comerciais Aprovadas e Ativas */}
                                        <div>
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <CheckCircle2 size={13} className="text-emerald-500" />
                                                <span>Regras Comerciais Aprovadas (Ativas no Motor SDR)</span>
                                            </h4>
                                            {(fullLearningData?.memory?.rules?.length || 0) > 0 ? (
                                                <div className="space-y-1.5">
                                                    {fullLearningData?.memory?.rules.map(rule => (
                                                        <div key={rule.id} className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between text-[11px]">
                                                            <div>
                                                                <span className="font-medium text-foreground block">{rule.descricao}</span>
                                                                <span className="text-[10px] text-muted-foreground">Aprovada por: {rule.approved_by} • {rule.created_at?.slice(0, 10)}</span>
                                                            </div>
                                                            {rule.can_revert && (
                                                                <button
                                                                    onClick={() => handleRevertRule(rule.id)}
                                                                    className="px-2 py-0.5 rounded border border-red-500/30 text-red-600 hover:bg-red-500/10 text-[10px] flex items-center gap-1"
                                                                >
                                                                    <RotateCcw size={10} />
                                                                    <span>Reverter</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded">Nenhuma regra personalizada ativa. O motor utiliza a base canónica de boas práticas Vamuss.</p>
                                            )}
                                        </div>

                                        {/* Hipóteses a Testar */}
                                        <div>
                                            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider mb-2">Hipóteses em Investigação (Não Confirmadas)</h4>
                                            {(fullLearningData?.memory?.hypotheses?.length || 0) > 0 ? (
                                                <div className="space-y-1.5">
                                                    {fullLearningData?.memory?.hypotheses.slice(0, 5).map(hyp => (
                                                        <div key={hyp.id} className="p-2 rounded-lg bg-background border border-border text-[11px] space-y-0.5">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-semibold text-foreground">{hyp.description}</span>
                                                                <span className="text-[9px] uppercase px-1 rounded bg-muted text-muted-foreground">{hyp.confidence}</span>
                                                            </div>
                                                            {hyp.suggested_test && <p className="text-[10px] text-muted-foreground">Teste sugerido: {hyp.suggested_test}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground italic p-2 bg-muted/20 rounded">Nenhuma hipótese registada.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL DO GUIA WHATSAPP (WEB OU META CLOUD API) */}
            {showMetaGuideModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
                    <div className="bg-card border border-border rounded-xl max-w-xl w-full p-6 shadow-xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2">
                                <MessageSquare size={16} className="text-emerald-500" />
                                <h3 className="font-bold text-sm text-foreground">Conexão WhatsApp (Web ou Cloud API)</h3>
                            </div>
                            <button onClick={() => setShowMetaGuideModal(false)} className="text-muted-foreground hover:text-foreground">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Card WhatsApp Web (Recomendado para manter telemóvel e histórico) */}
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                    <span className="font-semibold text-emerald-600 text-sm">WhatsApp Web (Sessão do Telemóvel)</span>
                                </div>
                                <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                                    whatsAppStatus?.whatsappWeb?.isConnected 
                                        ? 'bg-emerald-500/20 text-emerald-600' 
                                        : 'bg-amber-500/20 text-amber-600'
                                }`}>
                                    {whatsAppStatus?.whatsappWeb?.isConnected ? 'Conectado' : 'Aguardando QR Code'}
                                </span>
                            </div>
                            <p className="text-muted-foreground text-[11px] leading-relaxed">
                                Permite disparar as mensagens diretamente do teu número atual, mantendo todo o teu histórico no aplicativo do telemóvel intacto, sem custos de API e sem risco de desconexão.
                            </p>
                            <div className="pt-1 flex items-center gap-2">
                                <a
                                    href="http://localhost:3001/api/whatsapp-web/qr"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all shadow-sm"
                                >
                                    <QrCode size={13} />
                                    <span>{whatsAppStatus?.whatsappWeb?.isConnected ? 'Ver Estado da Sessão' : 'Abrir QR Code para Conectar'}</span>
                                </a>
                                {whatsAppStatus?.whatsappWeb?.isConnected && (
                                    <span className="text-[11px] text-muted-foreground">
                                        Número ativo: +{whatsAppStatus.whatsappWeb.connectedUser?.phone}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Card Meta Cloud API */}
                        <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1.5 font-mono text-[11px]">
                            <div className="font-sans font-semibold text-foreground mb-1">Status Meta Cloud API:</div>
                            <div>• META_WA_PHONE_NUMBER_ID: {whatsAppStatus?.checks?.hasPhoneNumberId ? 'Configurado' : 'Pendente'}</div>
                            <div>• META_WA_ACCESS_TOKEN: {whatsAppStatus?.checks?.hasAccessToken ? 'Token Permanente Ativo' : 'Pendente'}</div>
                            <div>• Gate Legal: {legalGateStatus === 'LIVE_AUTHORIZED' ? 'LIVE AUTHORIZED (Envios reais ativos)' : 'FAIL-CLOSED (Proteção ativa)'}</div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setShowMetaGuideModal(false)}
                                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
