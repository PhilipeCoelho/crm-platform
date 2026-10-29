import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Clock,
    Calendar,
    RefreshCw,
    Search,
    User,
    Zap,
    ShieldCheck,
    MessageSquare,
    ExternalLink,
    Send,
    Activity,
    Sparkles,
    Brain
} from 'lucide-react';
import {
    RecoveryDealItem,
    RecoveryPipelineResponse,
    fetchRecoveryPipeline,
    executeRecoveryPipelineAction,
    fetchRecoveryDealDetail
} from '@/services/sdrService';
import SDRDealDetailDrawer from './SDRDealDetailDrawer';

interface SDRRecoveryKanbanProps {
    onSelectDealForTriage?: (dealId: string) => void;
    onSwitchToPosto?: () => void;
    onOpenLearningMetrics?: () => void;
    onOpenWhatsAppSettings?: () => void;
}

export default function SDRRecoveryKanban({
    onSelectDealForTriage: _onSelectDealForTriage,
    onSwitchToPosto,
    onOpenLearningMetrics,
    onOpenWhatsAppSettings
}: SDRRecoveryKanbanProps) {
    const [pipelineData, setPipelineData] = useState<RecoveryPipelineResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<'todos' | 'elegiveis' | 'intervencao' | 'operador' | 'reuniao'>('todos');
    const [showLiveFeed, setShowLiveFeed] = useState(false);
    const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
    const [showInfoPopover, setShowInfoPopover] = useState(false);

    // Gaveta Lateral Deslizante (Slide-over Drawer)
    const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
    const [dealDetail, setDealDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isExecutingAction, setIsExecutingAction] = useState(false);

    const loadPipeline = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchRecoveryPipeline(150);
            if (data) {
                setPipelineData(data);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPipeline();
    }, [loadPipeline]);

    const openDealDrawer = async (dealId: string) => {
        setSelectedDealId(dealId);
        setLoadingDetail(true);
        setActionFeedback(null);
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
                const updatedDetail = await fetchRecoveryDealDetail(selectedDealId);
                setDealDetail(updatedDetail);
                loadPipeline();
            } else {
                setActionFeedback({ type: 'error', message: res.message || 'Falha ao executar ação.' });
            }
        } catch (e: any) {
            setActionFeedback({ type: 'error', message: e.message });
        } finally {
            setIsExecutingAction(false);
        }
    };

    const handleMoveStage = async (dealId: string, targetStage: string) => {
        try {
            await executeRecoveryPipelineAction(dealId, 'move_stage', { stage: targetStage });
            loadPipeline();
        } catch (e) {
            console.error('Erro ao mover etapa:', e);
        }
    };

    // Filtros de negócios com tolerância a formatação de telefone
    const filteredItems = useMemo(() => {
        if (!pipelineData?.items) return [];
        const cleanQuery = searchQuery.toLowerCase().trim();
        const searchNoSpaces = cleanQuery.replace(/\s+/g, '');
        const searchDigits = cleanQuery.replace(/\D/g, '');

        return pipelineData.items.filter(item => {
            const itemPhone = item.phone || '';
            const phoneNoSpaces = itemPhone.replace(/\s+/g, '');
            const phoneDigits = itemPhone.replace(/\D/g, '');

            const directMatch = !cleanQuery ||
                item.title.toLowerCase().includes(cleanQuery) ||
                item.contactName.toLowerCase().includes(cleanQuery) ||
                (itemPhone && itemPhone.toLowerCase().includes(cleanQuery)) ||
                (item.lostReason && item.lostReason.toLowerCase().includes(cleanQuery));

            const noSpacesMatch = searchNoSpaces.length > 0 && (
                item.title.toLowerCase().replace(/\s+/g, '').includes(searchNoSpaces) ||
                item.contactName.toLowerCase().replace(/\s+/g, '').includes(searchNoSpaces) ||
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

    const live = pipelineData?.agentLive;

    // Badges semânticos de estado operacional real
    const agentStatusConfig = useMemo(() => {
        const isConnected = live?.whatsappConnected === true;
        const isWithinHours = live?.isWithinBusinessHours === true;

        if (!isConnected) {
            return {
                label: 'WhatsApp Desconectado',
                dotColor: 'bg-rose-500',
                badgeClass: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
                tooltip: 'Sessão Baileys desconectada. Abra a aplicação para sincronizar.'
            };
        }

        if (!isWithinHours) {
            return {
                label: 'Aguardando Horário',
                dotColor: 'bg-amber-500',
                badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
                tooltip: 'Fora da janela de expediente (09h-18h Lisboa). Próximo envio amanhã às 09h00.'
            };
        }

        return {
            label: 'Operacional Ativo',
            dotColor: 'bg-emerald-500',
            badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
            tooltip: 'Robô pronto para enviar abordagens e ler respostas no WhatsApp.'
        };
    }, [live]);

    return (
        <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
            {/* ========================================================================= */}
            {/* 1. CABEÇALHO UNIFICADO E COMPACTO (Padrão CRM Vamuss)                     */}
            {/* ========================================================================= */}
            <header className="border-b border-border bg-card/60 backdrop-blur shrink-0 px-4 py-2.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Identificação Principal & Status Real */}
                    <div className="flex items-center gap-3">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-base font-bold text-foreground tracking-tight">
                                    Reaquecimento de Leads
                                </h1>

                                {/* Status Real do Agente */}
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 cursor-help ${agentStatusConfig.badgeClass}`}
                                    title={agentStatusConfig.tooltip}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${agentStatusConfig.dotColor} animate-pulse`} />
                                    <span>{agentStatusConfig.label}</span>
                                </span>

                                {/* WhatsApp Conectado */}
                                <button
                                    onClick={onOpenWhatsAppSettings}
                                    className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                                    title="WhatsApp Web sincronizado e conectado"
                                >
                                    <span>WA: {live?.connectedPhone || '+351 964 094 865'}</span>
                                </button>

                                {/* Blindagem */}
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20 font-semibold flex items-center gap-1" title="Apenas contatos do CRM recebem mensagens. Conversas pessoais, amigos e grupos 100% blindados.">
                                    <ShieldCheck size={11} />
                                    <span>Blindado</span>
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Reconexão consultiva de negócios perdidos via WhatsApp até à Reunião de Diagnóstico
                            </p>
                        </div>
                    </div>

                    {/* Ações da Barra Superior */}
                    <div className="flex items-center gap-2">
                        {/* Feed de Ações */}
                        <button
                            onClick={() => setShowLiveFeed(!showLiveFeed)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                showLiveFeed
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-background hover:bg-muted border-border text-foreground'
                            }`}
                            title="Ver histórico recente de mensagens enviadas e recebidas pelo robô"
                        >
                            <Activity size={13} className={showLiveFeed ? 'animate-pulse' : 'text-indigo-500'} />
                            <span>Feed de Ações</span>
                            {live?.recentActions && live.recentActions.length > 0 && (
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${showLiveFeed ? 'bg-white/20 text-white' : 'bg-indigo-500/15 text-indigo-500'}`}>
                                    {live.recentActions.length}
                                </span>
                            )}
                        </button>

                        {/* Métricas de Aprendizagem */}
                        {onOpenLearningMetrics && (
                            <button
                                onClick={onOpenLearningMetrics}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold transition-all"
                                title="Ver ciclo de aprendizagem contínua, regras acumuladas e eficácia"
                            >
                                <Brain size={13} />
                                <span>Aprendizagem</span>
                            </button>
                        )}

                        {/* Alternador para Posto de Triagem */}
                        {onSwitchToPosto && (
                            <button
                                onClick={onSwitchToPosto}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all"
                                title="Alternar para visualização clássica em Lista"
                            >
                                <Zap size={13} className="text-amber-500" />
                                <span>Posto de Triagem</span>
                            </button>
                        )}

                        {/* Link Cal.com */}
                        <a
                            href={live?.calcomLink || 'https://cal.com/euphilipecoelho-jxauxj/diagostico'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium transition-all"
                            title="Página de agendamento de diagnóstico do Closer"
                        >
                            <Calendar size={13} />
                            <span>Cal.com</span>
                            <ExternalLink size={10} className="opacity-70" />
                        </a>

                        {/* Botão de Atualizar */}
                        <button
                            onClick={loadPipeline}
                            disabled={loading}
                            className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                            title="Atualizar dados do pipeline"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* 2. RÉGUA COMPACTA DE MÉTRICAS (Inline, 1 Linha)                           */}
                {/* ========================================================================= */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60 text-xs">
                    {/* Contadores das 5 Etapas Canónicas */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 font-medium">
                            <span className="font-bold">{pipelineData?.counts?.perdidos_qualificados ?? 0}</span>
                            <span className="text-[11px] text-muted-foreground">Elegíveis</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 font-medium">
                            <span className="font-bold">{pipelineData?.counts?.mensagem_enviada ?? 0}</span>
                            <span className="text-[11px] text-muted-foreground">Aguardam Resposta</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-medium">
                            <span className="font-bold">{pipelineData?.counts?.em_conversa ?? 0}</span>
                            <span className="text-[11px] text-muted-foreground">Em Conversa</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 font-bold">
                            <Sparkles size={12} className="text-amber-500" />
                            <span>{pipelineData?.counts?.pronto_reabrir ?? 0}</span>
                            <span className="text-[11px]">Reunião Solicitada</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 border border-border text-muted-foreground font-medium">
                            <span className="font-bold">{pipelineData?.counts?.nao_reativado ?? 0}</span>
                            <span className="text-[11px]">Não Reativados</span>
                        </div>
                    </div>

                    {/* Disparos do Dia com Auditoria de Extras */}
                    <div className="flex items-center gap-2 text-xs">
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-600 cursor-pointer hover:bg-purple-500/15 transition-colors"
                            onClick={() => setShowInfoPopover(!showInfoPopover)}
                            title="Clique para detalhes da quota diária e autorizações de envio"
                        >
                            <Zap size={12} className="text-purple-500" />
                            <span className="font-bold">
                                {live?.todayDispatches ?? 0}
                            </span>
                            <span className="text-muted-foreground text-[11px]">
                                / {live?.dailyLimit ?? 5} limite base
                            </span>

                            {live?.hasExtraAuthorizationsLogged && (
                                <span className="text-[10px] px-1 rounded bg-purple-500/20 font-bold ml-0.5">
                                    +{live.extraAuthorizedDispatches} extras autorizados
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* PAINEL EXPANSÍVEL: LIVE FEED DE AÇÕES */}
                {showLiveFeed && (
                    <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity size={14} className="text-indigo-500" />
                                <span className="text-xs font-bold text-foreground">Registo de Ações Recentes do Robô</span>
                                <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-500/15 text-indigo-600 font-semibold">
                                    Auditoria em Tempo Real
                                </span>
                            </div>
                            <button
                                onClick={() => setShowLiveFeed(false)}
                                className="text-muted-foreground hover:text-foreground text-xs p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {(!live?.recentActions || live.recentActions.length === 0) ? (
                                <p className="text-xs text-muted-foreground py-2 text-center">Nenhuma ação recente registada no ciclo atual.</p>
                            ) : (
                                live.recentActions.map((act, idx) => {
                                    const isOutbound = act.actionType === 'OUTBOUND_DISPATCH';
                                    const timeStr = act.timestamp ? new Date(act.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                                    const snippet = act.details?.snippet || act.details?.textSnippet || act.details?.agentResolution || '';
                                    const phone = act.details?.phone ? `+${act.details.phone}` : '';
                                    const clinic = act.details?.clinicName || 'Clínica';

                                    return (
                                        <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-background/90 border border-border text-xs">
                                            <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">
                                                {timeStr}
                                            </span>
                                            <div className="shrink-0 mt-0.5">
                                                {isOutbound ? (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/15 text-cyan-600 flex items-center gap-1">
                                                        <Send size={9} /> Abordagem
                                                    </span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 flex items-center gap-1">
                                                        <MessageSquare size={9} /> Resposta
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <strong className="text-foreground text-xs truncate">{clinic}</strong>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{phone}</span>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                    "{snippet}"
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* BARRA DE PESQUISA E FILTROS RÁPIDOS */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
                    {/* Campo de Busca Rápida (Suporta números com/sem espaços) */}
                    <div className="flex items-center gap-1.5 flex-1 max-w-sm relative">
                        <Search size={14} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar clínica, interlocutor ou telefone..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border/80 bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 text-muted-foreground hover:text-foreground text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filtros de Categoria */}
                    <div className="flex items-center gap-1 flex-wrap">
                        <button
                            onClick={() => setFilterCategory('todos')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filterCategory === 'todos' ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Todos ({filteredItems.length})
                        </button>
                        <button
                            onClick={() => setFilterCategory('elegiveis')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filterCategory === 'elegiveis' ? 'bg-blue-600 text-white font-bold' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Elegíveis
                        </button>
                        <button
                            onClick={() => setFilterCategory('intervencao')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filterCategory === 'intervencao' ? 'bg-amber-600 text-white font-bold' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Intervenção Humana
                        </button>
                        <button
                            onClick={() => setFilterCategory('operador')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filterCategory === 'operador' ? 'bg-indigo-600 text-white font-bold' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Com Operador
                        </button>
                        <button
                            onClick={() => setFilterCategory('reuniao')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filterCategory === 'reuniao' ? 'bg-purple-600 text-white font-bold' : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Reunião Confirmada
                        </button>
                    </div>
                </div>
            </header>

            {/* ========================================================================= */}
            {/* 3. QUADRO KANBAN DE 5 ETAPAS (VISTA PRINCIPAL SOBERANA)                   */}
            {/* ========================================================================= */}
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
                                className="w-72 shrink-0 flex flex-col rounded-xl border border-border bg-card/70 backdrop-blur shadow-xs overflow-hidden"
                            >
                                {/* Cabeçalho da Coluna */}
                                <div className="p-2.5 border-b border-border bg-muted/40 shrink-0 flex items-center justify-between">
                                    <span className="font-bold text-xs text-foreground truncate" title={stage.label}>
                                        {stage.label}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-background border border-border/80 text-foreground">
                                        {items.length}
                                    </span>
                                </div>

                                {/* Lista de Cartões da Coluna com Scroll Interno */}
                                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                    {items.length === 0 ? (
                                        <div className="py-12 text-center text-[11px] text-muted-foreground">
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
                                                onClick={() => openDealDrawer(item.dealId)}
                                                className={`p-2.5 rounded-lg border border-border bg-background hover:border-primary/50 transition-all cursor-pointer shadow-2xs space-y-1.5 relative group ${
                                                    draggingDealId === item.dealId ? 'opacity-40 border-dashed border-primary scale-95' : ''
                                                }`}
                                            >
                                                {/* Título e Valor */}
                                                <div className="flex items-start justify-between gap-1.5">
                                                    <h4 className="font-semibold text-xs text-foreground line-clamp-1 group-hover:text-primary transition-colors" title={item.title}>
                                                        {item.title}
                                                    </h4>
                                                    <span className="text-[10px] font-bold text-emerald-500 shrink-0">
                                                        €{item.value || 197}
                                                    </span>
                                                </div>

                                                {/* Contacto e Encerramento */}
                                                <div className="text-[11px] text-muted-foreground space-y-0.5">
                                                    <div className="flex items-center gap-1">
                                                        <User size={10} className="shrink-0" />
                                                        <span className="truncate">{item.contactName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px]">
                                                        <Clock size={10} className="shrink-0" />
                                                        <span className="truncate">Perdido há {item.daysSinceLost}d ({item.lostReason})</span>
                                                    </div>
                                                </div>

                                                {/* Badges de Estado e Próxima Ação */}
                                                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px]">
                                                    <span className="font-mono text-muted-foreground">
                                                        {item.phone ? `+${item.phone.slice(-9)}` : 'Sem tel.'}
                                                    </span>

                                                    {item.isHumanInterventionPending ? (
                                                        <span className="px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-600 border border-amber-500/30 animate-pulse text-[9px]">
                                                            Intervenção
                                                        </span>
                                                    ) : (
                                                        <span className={`px-1.5 py-0.2 rounded font-semibold text-[9px] ${
                                                            item.owner === 'Operador'
                                                                ? 'bg-blue-500/10 text-blue-600'
                                                                : 'bg-purple-500/10 text-purple-600'
                                                        }`}>
                                                            {item.owner}
                                                        </span>
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

            {/* ========================================================================= */}
            {/* 4. GAVETA LATERAL DESLIZANTE DE DETALHE (SLIDE-OVER DRAWER)              */}
            {/* ========================================================================= */}
            <SDRDealDetailDrawer
                dealId={selectedDealId}
                dealDetail={dealDetail}
                loading={loadingDetail}
                onClose={() => setSelectedDealId(null)}
                onExecuteAction={handleExecuteAction}
                isExecutingAction={isExecutingAction}
                actionFeedback={actionFeedback}
            />
        </div>
    );
}
