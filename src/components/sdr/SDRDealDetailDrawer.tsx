import { useState } from 'react';
import {
    X,
    User,
    Bot,
    Calendar,
    Phone,
    Mail,
    Globe,
    FileText,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Send,
    MessageSquare,
    ExternalLink,
    Ban,
    UserCheck,
    RefreshCw,
    Sparkles
} from 'lucide-react';
import { RecoveryDealItem } from '@/services/sdrService';

interface SDRDealDetailDrawerProps {
    dealId: string | null;
    dealDetail: any;
    loading: boolean;
    onClose: () => void;
    onExecuteAction: (action: string, payload?: any) => Promise<void>;
    isExecutingAction: boolean;
    actionFeedback: { type: 'success' | 'error'; message: string } | null;
}

export default function SDRDealDetailDrawer({
    dealId,
    dealDetail,
    loading,
    onClose,
    onExecuteAction,
    isExecutingAction,
    actionFeedback
}: SDRDealDetailDrawerProps) {
    const [activeTab, setActiveTab] = useState<'conversa' | 'diagnostico' | 'acoes'>('conversa');
    const [operatorName, setOperatorName] = useState('Philipe Coelho');
    const [contactNotes, setContactNotes] = useState('');
    const [postponeDays, setPostponeDays] = useState(7);
    const [unrecoveredReason, setUnrecoveredReason] = useState('Sem interesse em prosseguir');

    if (!dealId) return null;

    const deal: RecoveryDealItem | null = dealDetail?.deal || null;
    const activities = dealDetail?.activities || [];
    const verifiedDossier = dealDetail?.verifiedDossier || null;
    const spinState = dealDetail?.spinState || null;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
            {/* Backdrop click to close */}
            <div className="flex-1" onClick={onClose} />

            {/* Slide-over panel */}
            <aside className="w-full max-w-xl bg-card border-l border-border h-full flex flex-col shadow-2xl relative z-10 animate-in slide-in-from-right duration-300">
                {/* 1. CABEÇALHO DA GAVETA (IDENTIFICAÇÃO) */}
                <div className="p-4 border-b border-border bg-card/60 backdrop-blur shrink-0 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    deal?.stage === 'pronto_reabrir'
                                        ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                                        : deal?.stage === 'em_conversa'
                                        ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                        : deal?.stage === 'mensagem_enviada'
                                        ? 'bg-cyan-500/15 text-cyan-600 border border-cyan-500/30'
                                        : deal?.stage === 'nao_reativado'
                                        ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                                        : 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                                }`}>
                                    {deal?.stage === 'pronto_reabrir' ? '⭐ Reunião Solicitada' :
                                     deal?.stage === 'em_conversa' ? 'Em Conversa SPIN' :
                                     deal?.stage === 'mensagem_enviada' ? 'Mensagem Enviada' :
                                     deal?.stage === 'nao_reativado' ? 'Não Reativado' : 'Perdidos Qualificados'}
                                </span>

                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                                    {deal?.owner === 'Operador' ? <User size={12} className="text-blue-500" /> : <Bot size={12} className="text-purple-500" />}
                                    {deal?.owner || 'IA'}
                                </span>

                                {deal?.aiAutonomySuspended && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                                        Autonomia IA Suspensa
                                    </span>
                                )}
                            </div>

                            <h2 className="text-base font-bold text-foreground truncate" title={deal?.title}>
                                {deal?.title || 'Detalhe do Negócio'}
                            </h2>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-0.5">
                                {deal?.phone && (
                                    <span className="flex items-center gap-1 font-mono">
                                        <Phone size={12} className="text-primary" />
                                        +{deal.phone}
                                    </span>
                                )}
                                {deal?.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail size={12} />
                                        {deal.email}
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    Perdido há {deal?.daysSinceLost ?? '--'} dias
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Fechar gaveta"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Alerta de Reunião Solicitada */}
                    {deal?.stage === 'pronto_reabrir' && (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                            <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <strong className="font-bold text-amber-600 dark:text-amber-400 block">
                                    ⭐ Reunião Solicitada pelo Lead!
                                </strong>
                                <p className="text-[11px] leading-relaxed text-muted-foreground">
                                    Aceda ao Funil de Prospeção principal e reabra este negócio na coluna "Reunião Agendada".
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Feedback de Ação */}
                    {actionFeedback && (
                        <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                            actionFeedback.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                                : 'bg-red-500/10 border-red-500/20 text-red-600'
                        }`}>
                            {actionFeedback.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                            <span>{actionFeedback.message}</span>
                        </div>
                    )}

                    {/* Navegação por Abas */}
                    <div className="flex items-center gap-1 border-b border-border/60 -mb-4 pt-1">
                        <button
                            onClick={() => setActiveTab('conversa')}
                            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                                activeTab === 'conversa'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <MessageSquare size={13} />
                            <span>Histórico & Mensagens</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-normal">
                                {activities.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('diagnostico')}
                            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                                activeTab === 'diagnostico'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <FileText size={13} />
                            <span>Diagnóstico Factual</span>
                            {verifiedDossier && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Dossiê factual verificado disponível" />
                            )}
                        </button>

                        <button
                            onClick={() => setActiveTab('acoes')}
                            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                                activeTab === 'acoes'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <UserCheck size={13} />
                            <span>Ações do Operador</span>
                        </button>
                    </div>
                </div>

                {/* 2. CORPO SCROLLÁVEL */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                    {loading ? (
                        <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                            <RefreshCw size={20} className="animate-spin text-primary" />
                            <span>Carregando dossiê factual e histórico do CRM...</span>
                        </div>
                    ) : (
                        <>
                            {/* ABA 1: HISTÓRICO & CONVERSAS */}
                            {activeTab === 'conversa' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-xs text-foreground uppercase tracking-wider text-[10px]">
                                            Linha Temporal de Mensagens e Atividades
                                        </h4>
                                        <span className="text-[10px] text-muted-foreground">
                                            {activities.length} evento(s)
                                        </span>
                                    </div>

                                    {activities.length === 0 ? (
                                        <div className="py-10 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                                            Nenhuma atividade ou mensagem registada ainda para este negócio.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {activities.map((act: any) => {
                                                const isWA = act.type === 'whatsapp';
                                                const dateStr = act.date ? new Date(act.date).toLocaleString('pt-PT', {
                                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                }) : '--:--';

                                                return (
                                                    <div
                                                        key={act.id}
                                                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition-colors ${
                                                            isWA
                                                                ? 'bg-emerald-500/5 border-emerald-500/20'
                                                                : 'bg-background border-border'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                            <span className="font-bold flex items-center gap-1 text-foreground">
                                                                {isWA ? <Send size={11} className="text-emerald-500" /> : <Clock size={11} />}
                                                                {act.title || act.type}
                                                            </span>
                                                            <span className="font-mono">{dateStr}</span>
                                                        </div>

                                                        {act.notes && (
                                                            <p className="text-foreground/90 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-card/60 p-2 rounded-lg border border-border/50">
                                                                {act.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ABA 2: DIAGNÓSTICO FACTUAL */}
                            {activeTab === 'diagnostico' && (
                                <div className="space-y-3.5">
                                    {/* Dossiê Pesquisado Online */}
                                    {verifiedDossier ? (
                                        <div className="p-3.5 rounded-xl border border-border bg-background space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                                    <Globe size={13} className="text-primary" />
                                                    <span>Pesquisa Factual da Clínica</span>
                                                </h4>
                                                {verifiedDossier.siteAnalysis?.url && (
                                                    <a
                                                        href={verifiedDossier.siteAnalysis.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        <span>Ver website</span>
                                                        <ExternalLink size={10} />
                                                    </a>
                                                )}
                                            </div>

                                            {verifiedDossier.siteAnalysis?.highlightedTreatments?.length > 0 && (
                                                <div>
                                                    <span className="text-[10px] text-muted-foreground block mb-1">
                                                        Tratamentos Reais Verificados:
                                                    </span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {verifiedDossier.siteAnalysis.highlightedTreatments.map((t: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-medium text-[10px]">
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {verifiedDossier.verifiedFacts?.length > 0 && (
                                                <div className="space-y-1 pt-1 border-t border-border/60">
                                                    {verifiedDossier.verifiedFacts.map((f: any, i: number) => (
                                                        <p key={i} className="text-[11px] text-foreground/90 leading-relaxed">
                                                            • {f.fact}
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-3 rounded-xl border border-dashed border-border text-center text-muted-foreground text-[11px]">
                                            Sem dossiê factual específico em cache para esta clínica.
                                        </div>
                                    )}

                                    {/* Diagnóstico SPIN do Agente */}
                                    <div className="p-3.5 rounded-xl border border-border bg-background space-y-2">
                                        <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                            <FileText size={13} className="text-amber-500" />
                                            <span>Contexto Comercial e Motivo da Perda</span>
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="p-2 rounded-lg bg-muted/40">
                                                <span className="text-[10px] text-muted-foreground block">Motivo Registado:</span>
                                                <strong className="text-foreground">{deal?.lostReason || 'Não informado'}</strong>
                                            </div>
                                            <div className="p-2 rounded-lg bg-muted/40">
                                                <span className="text-[10px] text-muted-foreground block">Maturidade SPIN:</span>
                                                <strong className="text-foreground">{spinState?.currentStage || 'SITUAÇÃO'}</strong>
                                            </div>
                                        </div>

                                        {deal?.summary && (
                                            <p className="text-[11px] text-foreground/90 leading-relaxed bg-muted/20 p-2.5 rounded-lg border border-border/40">
                                                {deal.summary}
                                            </p>
                                        )}

                                        {deal?.recommendedNextStep && (
                                            <div className="text-[11px] text-muted-foreground pt-1">
                                                <strong className="text-foreground">Próximo Passo:</strong> {deal.recommendedNextStep}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ABA 3: AÇÕES DO OPERADOR CLOSER */}
                            {activeTab === 'acoes' && (
                                <div className="space-y-3">
                                    {/* Ação 1: Assumir Oportunidade */}
                                    <div className="p-3 rounded-xl border border-border bg-background space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                                <UserCheck size={14} className="text-blue-500" />
                                                <span>1. Assumir Controlo Manual</span>
                                            </h4>
                                            <span className="text-[10px] text-muted-foreground">Pausa IA</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">
                                            Suspende a iniciativa do robô para este lead e atribui o contacto diretamente ao operador.
                                        </p>
                                        <div className="flex items-center gap-2 pt-1">
                                            <input
                                                type="text"
                                                value={operatorName}
                                                onChange={e => setOperatorName(e.target.value)}
                                                placeholder="Nome do operador"
                                                className="flex-1 p-1.5 rounded-lg border border-border bg-card text-xs"
                                            />
                                            <button
                                                onClick={() => onExecuteAction('assume_opportunity', { operatorName })}
                                                disabled={isExecutingAction}
                                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shrink-0"
                                            >
                                                Assumir
                                            </button>
                                        </div>
                                    </div>

                                    {/* Ação 2: Registar Contacto Humano */}
                                    <div className="p-3 rounded-xl border border-border bg-background space-y-2">
                                        <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                            <Phone size={14} className="text-emerald-500" />
                                            <span>2. Registar Contacto Realizado</span>
                                        </h4>
                                        <p className="text-[11px] text-muted-foreground">
                                            Guarda notas sobre uma ligação ou mensagem direta trocada com a clínica.
                                        </p>
                                        <textarea
                                            rows={2}
                                            value={contactNotes}
                                            onChange={e => setContactNotes(e.target.value)}
                                            placeholder="Ex: Falou com a rececionista Maria, confirmou que Dr. Pedro liga amanhã..."
                                            className="w-full p-2 rounded-lg border border-border bg-card text-xs resize-none"
                                        />
                                        <button
                                            onClick={() => onExecuteAction('log_contact', { notes: contactNotes })}
                                            disabled={isExecutingAction || !contactNotes.trim()}
                                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors disabled:opacity-50"
                                        >
                                            Guardar Nota
                                        </button>
                                    </div>

                                    {/* Ação 3: Adiar / Cooldown */}
                                    <div className="p-3 rounded-xl border border-border bg-background space-y-2">
                                        <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                            <Clock size={14} className="text-purple-500" />
                                            <span>3. Adiar Próxima Tentativa (Cooldown)</span>
                                        </h4>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={postponeDays}
                                                onChange={e => setPostponeDays(Number(e.target.value))}
                                                className="p-1.5 rounded-lg border border-border bg-card text-xs"
                                            >
                                                <option value={3}>3 dias</option>
                                                <option value={7}>7 dias (1 semana)</option>
                                                <option value={14}>14 dias (2 semanas)</option>
                                                <option value={30}>30 dias (1 mês)</option>
                                            </select>
                                            <button
                                                onClick={() => onExecuteAction('postpone', { days: postponeDays })}
                                                disabled={isExecutingAction}
                                                className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted font-bold text-xs transition-colors"
                                            >
                                                Agendar Pausa
                                            </button>
                                        </div>
                                    </div>

                                    {/* Ação 4: Desqualificar / Sem Recuperação */}
                                    <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-2">
                                        <h4 className="font-bold text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                            <Ban size={14} />
                                            <span>4. Encerrar sem Recuperação (Opt-out)</span>
                                        </h4>
                                        <p className="text-[11px] text-muted-foreground">
                                            Move o negócio para Não Reativado e bloqueia abordagens futuras.
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={unrecoveredReason}
                                                onChange={e => setUnrecoveredReason(e.target.value)}
                                                className="flex-1 p-1.5 rounded-lg border border-border bg-card text-xs"
                                            />
                                            <button
                                                onClick={() => onExecuteAction('close_unrecovered', { reason: unrecoveredReason })}
                                                disabled={isExecutingAction}
                                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shrink-0"
                                            >
                                                Encerrar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 3. RODAPÉ COM ATALHO EXTERNO */}
                <div className="p-3 border-t border-border bg-card/60 backdrop-blur shrink-0 flex items-center justify-between text-xs">
                    <a
                        href="https://cal.com/euphilipecoelho-jxauxj/diagostico"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px] transition-colors"
                    >
                        <Calendar size={12} className="text-amber-500" />
                        <span>Abrir Cal.com</span>
                        <ExternalLink size={10} className="opacity-60" />
                    </a>

                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted font-medium text-xs transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </aside>
        </div>
    );
}
