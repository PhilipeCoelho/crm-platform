import { useState, useEffect, useMemo } from 'react';
import {
    Target,
    UserCheck,
    Bot,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    PhoneCall,
    FileText,
    ArrowRight,
    TrendingUp,
    RefreshCw,
    Search,
    X,
    User,
    PauseCircle,
    XCircle,
    Zap
} from 'lucide-react';
import {
    RecoveryDealItem,
    RecoveryPipelineResponse,
    fetchRecoveryPipeline,
    executeRecoveryPipelineAction,
    fetchRecoveryDealDetail
} from '@/services/sdrService';

interface SDRRecoveryKanbanProps {
    onSelectDealForTriage?: (dealId: string) => void;
}

export default function SDRRecoveryKanban({ onSelectDealForTriage }: SDRRecoveryKanbanProps) {
    const [pipelineData, setPipelineData] = useState<RecoveryPipelineResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<'todos' | 'elegiveis' | 'intervencao' | 'operador' | 'reuniao'>('todos');
    
    // Modal de detalhe e ações
    const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
    const [dealDetail, setDealDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [activeActionTab, setActiveActionTab] = useState<'detalhes' | 'assumir' | 'contacto' | 'reuniao' | 'adiar' | 'sem_recuperacao'>('detalhes');
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isExecutingAction, setIsExecutingAction] = useState(false);

    // Form states
    const [operatorName, setOperatorName] = useState('Closer Vamuss');
    const [contactChannel, setContactChannel] = useState<'Chamada Telefónica' | 'WhatsApp' | 'Email'>('Chamada Telefónica');
    const [contactNotes, setContactNotes] = useState('');
    const [meetingDate, setMeetingDate] = useState('');
    const [postponeDays, setPostponeDays] = useState(15);
    const [unrecoveredReason, setUnrecoveredReason] = useState('Sem interesse em marketing neste momento');

    const loadPipeline = async () => {
        setLoading(true);
        try {
            const data = await fetchRecoveryPipeline(150);
            if (data) {
                setPipelineData(data);
            }
        } catch (e) {
            console.error('Erro ao carregar pipeline:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPipeline();
    }, []);

    const openDealModal = async (dealId: string) => {
        setSelectedDealId(dealId);
        setLoadingDetail(true);
        setActionFeedback(null);
        setActiveActionTab('detalhes');
        try {
            const detail = await fetchRecoveryDealDetail(dealId);
            setDealDetail(detail);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleExecuteAction = async (action: string, payload: any = {}) => {
        if (!selectedDealId) return;
        setIsExecutingAction(true);
        setActionFeedback(null);
        try {
            const res = await executeRecoveryPipelineAction(selectedDealId, action, payload);
            if (res.success) {
                setActionFeedback({ type: 'success', message: 'Ação executada com sucesso!' });
                // Recarregar detalhe e pipeline
                const updatedDetail = await fetchRecoveryDealDetail(selectedDealId);
                setDealDetail(updatedDetail);
                loadPipeline();
            } else {
                setActionFeedback({ type: 'error', message: res.message || 'Falha ao executar ação.' });
            }
        } catch (e: any) {
            setActionFeedback({ type: 'error', message: e.message || 'Erro de comunicação.' });
        } finally {
            setIsExecutingAction(false);
        }
    };

    // Suporte a Drag and Drop entre Etapas
    const [draggingDealId, setDraggingDealId] = useState<string | null>(null);

    const handleMoveStage = async (dealId: string, newStage: string) => {
        // Atualização otimista imediata na interface
        setPipelineData(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                items: prev.items.map(it => it.dealId === dealId ? { ...it, stage: newStage as any } : it)
            };
        });

        try {
            await executeRecoveryPipelineAction(dealId, 'move_stage', { stage: newStage });
            loadPipeline();
        } catch (e) {
            console.error('Erro ao mover cartão no Kanban:', e);
            loadPipeline();
        }
    };

    // Filtros de negócios
    const filteredItems = useMemo(() => {
        if (!pipelineData?.items) return [];
        return pipelineData.items.filter(item => {
            const matchesSearch =
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.phone && item.phone.includes(searchQuery)) ||
                (item.lostReason && item.lostReason.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (filterCategory === 'elegiveis') return item.eligibilityStatus === 'Elegível';
            if (filterCategory === 'intervencao') return item.isHumanInterventionPending || item.stage === 'pronto_reabrir';
            if (filterCategory === 'operador') return item.owner === 'Operador' || item.stage === 'pronto_reabrir';
            if (filterCategory === 'reuniao') return item.stage === 'pronto_reabrir';

            return true;
        });
    }, [pipelineData, searchQuery, filterCategory]);

    const itemsByStage = useMemo(() => {
        const map: Record<string, RecoveryDealItem[]> = {};
        (pipelineData?.stages || []).forEach(s => {
            map[s.id] = filteredItems.filter(it => it.stage === s.id);
        });
        return map;
    }, [pipelineData, filteredItems]);

    return (
        <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
            {/* 1. BARRA SUPERIOR DE INDICADORES DO PIPELINE */}
            <div className="p-4 border-b border-border bg-card/60 backdrop-blur shrink-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                            <TrendingUp size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold">Quadro Kanban de Reaquecimento (5 Etapas)</h2>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
                                    CRM Real: Leads Perdidos
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-500">
                                    Piloto: 5 Leads Ativos
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500">
                                    WhatsApp Web Conectado
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Reativação consultiva de clínicas no WhatsApp. O robô aquece os leads até à confirmação de interesse; o negócio é reaberto manualmente pelo Philipe.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadPipeline}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium transition-all"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                            <span>Atualizar</span>
                        </button>
                    </div>
                </div>

                {/* Métricas do Funil (5 Etapas) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground block">Perdidos Analisados</span>
                        <strong className="text-sm text-foreground">{pipelineData?.metrics?.lostDealsAnalyzed ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground block">1. Perdidos Qualificados</span>
                        <strong className="text-sm text-blue-500">{pipelineData?.counts?.perdidos_qualificados ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground block">2. Mensagem Enviada</span>
                        <strong className="text-sm text-cyan-500">{pipelineData?.counts?.mensagem_enviada ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground block">3. Em Conversa</span>
                        <strong className="text-sm text-emerald-500">{pipelineData?.counts?.em_conversa ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground block">⭐ 4. Reunião Solicitada</span>
                        <strong className="text-sm text-amber-500 font-bold">{pipelineData?.counts?.pronto_reabrir ?? 0}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border">
                        <span className="text-[10px] text-muted-foreground block">5. Não Reativado</span>
                        <strong className="text-sm text-rose-500">{pipelineData?.counts?.nao_reativado ?? 0}</strong>
                    </div>
                </div>

                {/* Barra de Filtros e Pesquisa */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-1.5 flex-1 max-w-sm relative">
                        <Search size={14} className="absolute left-2.5 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Filtrar por clínica, responsável ou telefone..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                        <button
                            onClick={() => setFilterCategory('todos')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filterCategory === 'todos' ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Todos ({filteredItems.length})
                        </button>
                        <button
                            onClick={() => setFilterCategory('elegiveis')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filterCategory === 'elegiveis' ? 'bg-blue-600 text-white' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Elegíveis
                        </button>
                        <button
                            onClick={() => setFilterCategory('intervencao')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filterCategory === 'intervencao' ? 'bg-amber-600 text-white' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Intervenção Humana
                        </button>
                        <button
                            onClick={() => setFilterCategory('operador')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filterCategory === 'operador' ? 'bg-indigo-600 text-white' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Com Operador
                        </button>
                        <button
                            onClick={() => setFilterCategory('reuniao')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filterCategory === 'reuniao' ? 'bg-purple-600 text-white' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Reunião Confirmada
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. QUADRO KANBAN DE 5 ETAPAS */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 bg-muted/20">
                <div className="flex gap-3 h-full min-w-max pb-2">
                    {(pipelineData?.stages || []).map(stage => {
                        const items = itemsByStage[stage.id] || [];
                        return (
                            <div
                                key={stage.id}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggingDealId) {
                                        handleMoveStage(draggingDealId, stage.id);
                                        setDraggingDealId(null);
                                    }
                                }}
                                className="w-72 shrink-0 flex flex-col rounded-xl border border-border bg-card/70 backdrop-blur shadow-sm overflow-hidden"
                            >
                                {/* Cabeçalho da Coluna */}
                                <div className="p-3 border-b border-border bg-muted/40 shrink-0 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-foreground">{stage.label}</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-background border border-border text-foreground">
                                        {items.length}
                                    </span>
                                </div>

                                {/* Lista de Cartões da Coluna */}
                                <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
                                    {items.length === 0 ? (
                                        <div className="py-8 text-center text-[11px] text-muted-foreground">
                                            Nenhum negócio nesta etapa
                                        </div>
                                    ) : (
                                        items.map(item => (
                                            <div
                                                key={item.dealId}
                                                draggable
                                                onDragStart={(e) => {
                                                    setDraggingDealId(item.dealId);
                                                    e.dataTransfer.setData('text/plain', item.dealId);
                                                }}
                                                onDragEnd={() => setDraggingDealId(null)}
                                                onClick={() => openDealModal(item.dealId)}
                                                className={`p-3 rounded-xl border border-border bg-background hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing shadow-sm space-y-2 relative group ${
                                                    draggingDealId === item.dealId ? 'opacity-40 border-dashed border-primary scale-95' : ''
                                                }`}
                                            >
                                                {/* Título e Valor */}
                                                <div className="flex items-start justify-between gap-1.5">
                                                    <h4 className="font-semibold text-xs text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                                        {item.title}
                                                    </h4>
                                                    <span className="text-[10px] font-bold text-emerald-500 shrink-0">
                                                        €{item.value || 197}
                                                    </span>
                                                </div>

                                                {/* Contacto e Encerramento */}
                                                <div className="text-[11px] text-muted-foreground space-y-0.5">
                                                    <div className="flex items-center gap-1">
                                                        <User size={11} />
                                                        <span className="truncate">{item.contactName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px]">
                                                        <Clock size={10} />
                                                        <span>Perdido há {item.daysSinceLost} dias ({item.lostReason})</span>
                                                    </div>
                                                    {item.returnDate && (
                                                        <div className="flex items-center gap-1 text-[10px] text-blue-400 font-medium">
                                                            <Calendar size={10} />
                                                            <span>Retorno: {item.returnDate.slice(0, 10)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Badges de Estado e Responsável */}
                                                <div className="flex items-center gap-1.5 flex-wrap text-[9px] pt-1 border-t border-border/60">
                                                    {/* Responsável */}
                                                    <span className={`px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 ${
                                                        item.owner === 'Operador'
                                                            ? 'bg-blue-500/15 text-blue-500 border border-blue-500/20'
                                                            : 'bg-purple-500/15 text-purple-500 border border-purple-500/20'
                                                    }`}>
                                                        {item.owner === 'Operador' ? <User size={9} /> : <Bot size={9} />}
                                                        <span>{item.owner}</span>
                                                    </span>

                                                    {/* Elegibilidade */}
                                                    <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                                        item.eligibilityStatus === 'Elegível'
                                                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20'
                                                            : item.eligibilityStatus === 'Inelegível'
                                                            ? 'bg-red-500/15 text-red-500 border border-red-500/20'
                                                            : 'bg-amber-500/15 text-amber-500 border border-amber-500/20'
                                                    }`}>
                                                        {item.eligibilityStatus}
                                                    </span>

                                                    {/* Intervenção Humana Pendente */}
                                                    {item.isHumanInterventionPending && (
                                                        <span className="px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-600 border border-amber-500/30 animate-pulse">
                                                            Handoff Pendente
                                                        </span>
                                                    )}

                                                    {/* Tentativas */}
                                                    {item.attemptsCount > 0 && (
                                                        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                            {item.attemptsCount} {item.attemptsCount === 1 ? 'tentativa' : 'tentativas'}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Próxima Ação */}
                                                <div className="text-[10px] bg-muted/40 p-1.5 rounded-lg text-foreground/80 flex items-start gap-1">
                                                    <ArrowRight size={11} className="shrink-0 mt-0.5 text-primary" />
                                                    <span className="line-clamp-2">{item.nextAction}</span>
                                                </div>

                                                {/* Ação Rápida Posto */}
                                                <div className="flex items-center justify-between pt-1">
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {item.phone || 'Sem telemóvel'}
                                                    </span>
                                                    {onSelectDealForTriage && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onSelectDealForTriage(item.dealId);
                                                            }}
                                                            className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5"
                                                            title="Abrir no Posto Comercial para ver mensagem e enviar WhatsApp"
                                                        >
                                                            <span>Posto & WhatsApp</span>
                                                            <ArrowRight size={10} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 3. MODAL DE DETALHE DO NEGÓCIO E AÇÕES OPERACIONAIS */}
            {selectedDealId && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header do Modal */}
                        <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/40">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-base text-foreground">
                                        {dealDetail?.deal?.title || 'Detalhe do Negócio'}
                                    </h3>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                        {dealDetail?.deal?.stage}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Contacto: {dealDetail?.deal?.contactName} • {dealDetail?.deal?.phone || 'Sem telefone'} • Motivo Perda: {dealDetail?.deal?.lostReason}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {onSelectDealForTriage && (
                                    <button
                                        onClick={() => {
                                            const id = selectedDealId;
                                            setSelectedDealId(null);
                                            onSelectDealForTriage(id);
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1 transition-colors"
                                        title="Abrir este lead no Posto de Triagem para disparar WhatsApp"
                                    >
                                        <Zap size={12} />
                                        <span>Abrir no Posto & WhatsApp</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedDealId(null)}
                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Abas de Ação */}
                        <div className="flex border-b border-border bg-muted/20 px-4 text-xs font-medium gap-1 overflow-x-auto shrink-0">
                            <button
                                onClick={() => setActiveActionTab('detalhes')}
                                className={`px-3 py-2 border-b-2 transition-colors ${
                                    activeActionTab === 'detalhes' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground'
                                }`}
                            >
                                Diagnóstico & Histórico
                            </button>
                            <button
                                onClick={() => setActiveActionTab('assumir')}
                                className={`px-3 py-2 border-b-2 transition-colors ${
                                    activeActionTab === 'assumir' ? 'border-blue-500 text-blue-500 font-bold' : 'border-transparent text-muted-foreground'
                                }`}
                            >
                                1. Assumir Oportunidade
                            </button>
                            <button
                                onClick={() => setActiveActionTab('contacto')}
                                className={`px-3 py-2 border-b-2 transition-colors ${
                                    activeActionTab === 'contacto' ? 'border-indigo-500 text-indigo-500 font-bold' : 'border-transparent text-muted-foreground'
                                }`}
                            >
                                2. Registar Contacto
                            </button>
                            <button
                                onClick={() => setActiveActionTab('reuniao')}
                                className={`px-3 py-2 border-b-2 transition-colors ${
                                    activeActionTab === 'reuniao' ? 'border-purple-500 text-purple-500 font-bold' : 'border-transparent text-muted-foreground'
                                }`}
                            >
                                3. Agendar Reunião
                            </button>
                            <button
                                onClick={() => setActiveActionTab('adiar')}
                                className={`px-3 py-2 border-b-2 transition-colors ${
                                    activeActionTab === 'adiar' ? 'border-amber-500 text-amber-500 font-bold' : 'border-transparent text-muted-foreground'
                                }`}
                            >
                                4. Adiar Seguimento
                            </button>
                            <button
                                onClick={() => setActiveActionTab('sem_recuperacao')}
                                className={`px-3 py-2 border-b-2 transition-colors ${
                                    activeActionTab === 'sem_recuperacao' ? 'border-rose-500 text-rose-500 font-bold' : 'border-transparent text-muted-foreground'
                                }`}
                            >
                                5. Sem Recuperação
                            </button>
                        </div>

                        {/* Conteúdo do Modal */}
                        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
                            {loadingDetail ? (
                                <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                    <RefreshCw size={18} className="animate-spin text-primary" />
                                    <span>A carregar detalhe factual e histórico do CRM...</span>
                                </div>
                            ) : (
                                <>
                                    {actionFeedback && (
                                        <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                                            actionFeedback.type === 'success'
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                                                : 'bg-red-500/10 border-red-500/20 text-red-600'
                                        }`}>
                                            {actionFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                            <span>{actionFeedback.message}</span>
                                        </div>
                                    )}

                                    {dealDetail?.deal?.stage === 'pronto_reabrir' && (
                                        <div className="p-3.5 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-800 dark:text-amber-200 text-xs space-y-1.5">
                                            <strong className="block font-bold text-amber-600 dark:text-amber-400">
                                                ⭐ REUNIÃO DE DIAGNÓSTICO SOLICITADA!
                                            </strong>
                                            <p className="text-muted-foreground">
                                                O contacto manifestou interesse em agendar! Notificação já enviada para o seu WhatsApp (+351 964 094 865).
                                            </p>
                                            <div className="p-2 rounded bg-background/80 border border-amber-500/30 text-[11px] font-medium text-foreground">
                                                👉 <strong>Ação manual do Philipe:</strong> Aceda ao <strong>Funil de Prospecção</strong> principal e <strong>reabra este negócio</strong> na coluna <strong>"Reunião Agendada"</strong>.
                                            </div>
                                        </div>
                                    )}

                            {/* TAB 0: DETALHES FACTUAIS & HISTÓRICO */}
                            {activeActionTab === 'detalhes' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="p-3 rounded-lg bg-background border border-border">
                                            <span className="text-[10px] text-muted-foreground block">Responsável Atual</span>
                                            <strong className="text-sm text-foreground flex items-center gap-1.5 mt-0.5">
                                                {dealDetail?.deal?.owner === 'Operador' ? <User size={14} className="text-blue-500" /> : <Bot size={14} className="text-purple-500" />}
                                                <span>{dealDetail?.deal?.owner}</span>
                                            </strong>
                                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                                                Autonomia IA: {dealDetail?.deal?.aiAutonomySuspended ? 'Suspensa' : 'Ativa'}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-lg bg-background border border-border">
                                            <span className="text-[10px] text-muted-foreground block">Elegibilidade</span>
                                            <strong className="text-sm text-foreground block mt-0.5">
                                                {dealDetail?.deal?.eligibilityStatus}
                                            </strong>
                                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                                                {dealDetail?.deal?.eligibilityReason}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-lg bg-background border border-border">
                                            <span className="text-[10px] text-muted-foreground block">Dias Desde Perda</span>
                                            <strong className="text-sm text-foreground block mt-0.5">
                                                {dealDetail?.deal?.daysSinceLost} dias
                                            </strong>
                                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                                                Respiro Comercial: {dealDetail?.deal?.daysSinceLost >= 30 ? 'Cumprido' : 'Em Cooldown'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Resumo Factual */}
                                    <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5">
                                        <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                            <FileText size={13} className="text-primary" />
                                            <span>Resumo e Contexto Consultivo SPIN</span>
                                        </h4>
                                        <p className="text-[11px] leading-relaxed text-foreground/90">
                                            {dealDetail?.deal?.summary}
                                        </p>
                                        <div className="pt-1.5 border-t border-border/60 text-[11px] text-muted-foreground">
                                            <strong className="text-foreground">Próximo passo recomendado:</strong> {dealDetail?.deal?.recommendedNextStep}
                                        </div>
                                    </div>

                                    {/* Linha Temporal de Atividades CRM */}
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-xs text-foreground">Histórico Real de Atividades no CRM</h4>
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {(dealDetail?.activities || []).length === 0 ? (
                                                <div className="text-[11px] text-muted-foreground py-3 text-center">
                                                    Sem atividades registadas
                                                </div>
                                            ) : (
                                                (dealDetail?.activities || []).map((act: any) => (
                                                    <div key={act.id} className="p-2 rounded-lg bg-background border border-border text-[11px]">
                                                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                                                            <span>{act.type} • {act.title}</span>
                                                            <span>{new Date(act.date).toLocaleDateString('pt-PT')}</span>
                                                        </div>
                                                        {act.notes && <p className="text-foreground/90 mt-1">{act.notes}</p>}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 1: ASSUMIR OPORTUNIDADE */}
                            {activeActionTab === 'assumir' && (
                                <div className="space-y-3 p-2">
                                    <h4 className="font-bold text-sm text-foreground">Assumir Oportunidade como Operador Closer</h4>
                                    <p className="text-muted-foreground text-xs leading-relaxed">
                                        Ao assumir esta oportunidade, a autonomia comercial da IA é imediatamente suspensa. Novas mensagens automáticas ficam bloqueadas e o negócio é atribuído ao operador para condução direta.
                                    </p>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold">Nome do Operador / Closer:</label>
                                        <input
                                            type="text"
                                            value={operatorName}
                                            onChange={e => setOperatorName(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-border bg-background text-xs"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleExecuteAction('assume_opportunity', { operatorName })}
                                        disabled={isExecutingAction}
                                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2"
                                    >
                                        <UserCheck size={14} />
                                        <span>Confirmar Atribuição ao Operador</span>
                                    </button>
                                </div>
                            )}

                            {/* TAB 2: REGISTAR CONTACTO */}
                            {activeActionTab === 'contacto' && (
                                <div className="space-y-3 p-2">
                                    <h4 className="font-bold text-sm text-foreground">Registar Contacto Realizado pelo Closer</h4>
                                    <p className="text-muted-foreground text-xs">
                                        Regista notas factuais sobre a chamada, mensagem ou contacto direto mantido com o responsável da clínica.
                                    </p>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-[11px] font-semibold block mb-1">Canal Utilizado:</label>
                                            <div className="flex gap-2">
                                                {(['Chamada Telefónica', 'WhatsApp', 'Email'] as const).map(c => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => setContactChannel(c)}
                                                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                                                            contactChannel === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 border-border'
                                                        }`}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold block mb-1">Notas do Contacto e Resposta do Lead:</label>
                                            <textarea
                                                rows={4}
                                                value={contactNotes}
                                                onChange={e => setContactNotes(e.target.value)}
                                                placeholder="Descreva o que foi conversado, objeções apresentadas e abertura manifestada..."
                                                className="w-full p-2 rounded-lg border border-border bg-background text-xs"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleExecuteAction('log_contact', { channel: contactChannel, notes: contactNotes })}
                                        disabled={isExecutingAction || !contactNotes.trim()}
                                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2"
                                    >
                                        <PhoneCall size={14} />
                                        <span>Gravar Registo de Contacto</span>
                                    </button>
                                </div>
                            )}

                            {/* TAB 3: AGENDAR REUNIÃO */}
                            {activeActionTab === 'reuniao' && (
                                <div className="space-y-3 p-2">
                                    <h4 className="font-bold text-sm text-foreground">Agendar Reunião de Diagnóstico de 20 Minutos</h4>
                                    <p className="text-muted-foreground text-xs">
                                        Avança o negócio para a etapa <strong>Reunião Confirmada</strong>. Apenas utilize após data e hora efetivamente acordadas com o decisor clínico.
                                    </p>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold">Data e Hora da Reunião:</label>
                                        <input
                                            type="datetime-local"
                                            value={meetingDate}
                                            onChange={e => setMeetingDate(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-border bg-background text-xs"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleExecuteAction('schedule_meeting', { meetingDate })}
                                        disabled={isExecutingAction || !meetingDate}
                                        className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2"
                                    >
                                        <Calendar size={14} />
                                        <span>Confirmar Agendamento de Reunião</span>
                                    </button>
                                </div>
                            )}

                            {/* TAB 4: ADIAR SEGUIMENTO */}
                            {activeActionTab === 'adiar' && (
                                <div className="space-y-3 p-2">
                                    <h4 className="font-bold text-sm text-foreground">Adiar Seguimento Comercial (Pausa sem falsa progressão)</h4>
                                    <p className="text-muted-foreground text-xs">
                                        Programa um lembrete para retomar o contacto mais tarde, respeitando a indisponibilidade temporária da clínica (ex: bloco cirúrgico, obras, fecho de mês).
                                    </p>
                                    <div>
                                        <label className="text-[11px] font-semibold block mb-1">Adiar por:</label>
                                        <div className="flex gap-2">
                                            {[7, 15, 30, 60].map(d => (
                                                <button
                                                    key={d}
                                                    type="button"
                                                    onClick={() => setPostponeDays(d)}
                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                                                        postponeDays === d ? 'bg-amber-600 text-white border-amber-600' : 'bg-muted/40 border-border'
                                                    }`}
                                                >
                                                    {d} dias
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleExecuteAction('postpone_followup', { days: postponeDays })}
                                        disabled={isExecutingAction}
                                        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2"
                                    >
                                        <PauseCircle size={14} />
                                        <span>Programar Seguimento para Daqui a {postponeDays} Dias</span>
                                    </button>
                                </div>
                            )}

                            {/* TAB 5: SEM RECUPERAÇÃO */}
                            {activeActionTab === 'sem_recuperacao' && (
                                <div className="space-y-3 p-2">
                                    <h4 className="font-bold text-sm text-foreground">Encerrar como Sem Recuperação</h4>
                                    <p className="text-muted-foreground text-xs">
                                        Transita o negócio para a etapa final de desqualificação/não recuperação, encerrando o ciclo comercial do SDR.
                                    </p>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-semibold">Motivo do Encerramento:</label>
                                        <input
                                            type="text"
                                            value={unrecoveredReason}
                                            onChange={e => setUnrecoveredReason(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-border bg-background text-xs"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleExecuteAction('close_lost_unrecovered', { reason: unrecoveredReason })}
                                        disabled={isExecutingAction || !unrecoveredReason.trim()}
                                        className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2"
                                    >
                                        <XCircle size={14} />
                                        <span>Encerrar Ciclo de Recuperação</span>
                                    </button>
                                </div>
                            )}
                                </>
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="p-3 border-t border-border bg-muted/40 flex items-center justify-between shrink-0 text-xs">
                            <span className="text-muted-foreground text-[11px]">
                                ID: <code className="font-mono">{selectedDealId}</code>
                            </span>
                            <div className="flex gap-2">
                                {onSelectDealForTriage && (
                                    <button
                                        onClick={() => {
                                            if (selectedDealId) onSelectDealForTriage(selectedDealId);
                                            setSelectedDealId(null);
                                        }}
                                        className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted font-medium text-xs flex items-center gap-1.5"
                                    >
                                        <Target size={13} />
                                        <span>Ver no Posto de Triagem</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedDealId(null)}
                                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
