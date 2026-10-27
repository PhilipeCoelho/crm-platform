import { useState } from 'react';
import { ContentProposal, ProposalApprovalStatus } from '@/types/contentIntelligence';
import { 
    X, CheckCircle, Clock, Trash2, 
    Send, Sparkles, FileText, Check, Edit2, Save
} from 'lucide-react';

interface ProposalDetailModalProps {
    isOpen: boolean;
    proposal: ContentProposal | null;
    onClose: () => void;
    onUpdateStatus: (proposalId: string, status: ProposalApprovalStatus) => Promise<void>;
    onSaveProposal: (proposal: ContentProposal) => Promise<void>;
    onSendToKanban: (proposalId: string) => Promise<void>;
}

export function ProposalDetailModal({
    isOpen,
    proposal,
    onClose,
    onUpdateStatus,
    onSaveProposal,
    onSendToKanban
}: ProposalDetailModalProps) {
    if (!isOpen || !proposal) return null;

    const [isEditing, setIsEditing] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);

    // Form states
    const [titulo, setTitulo] = useState(proposal.titulo);
    const [ideiaMelhorada, setIdeiaMelhorada] = useState(proposal.ideiaMelhorada);
    const [ganchoVerbal, setGanchoVerbal] = useState(proposal.ganchoVerbal || proposal.ganchoBase);
    const [ganchoVisual, setGanchoVisual] = useState(proposal.ganchoVisual || '');
    const [roteiroSlides, setRoteiroSlides] = useState(proposal.roteiroSlides || '');
    const [cta, setCta] = useState(proposal.cta || '');
    const [textoTela, setTextoTela] = useState(proposal.textoTela || '');

    const handleSaveEdits = async () => {
        const updated: ContentProposal = {
            ...proposal,
            titulo,
            ideiaMelhorada,
            ganchoVerbal,
            ganchoBase: ganchoVerbal,
            ganchoVisual,
            roteiroSlides,
            cta,
            textoTela
        };
        await onSaveProposal(updated);
        setIsEditing(false);
        setFeedback('Alterações salvas com sucesso!');
        setTimeout(() => setFeedback(null), 2500);
    };

    const handleSendKanban = async () => {
        setIsSending(true);
        try {
            await onSendToKanban(proposal.id);
            setFeedback('Proposta enviada com sucesso para o Kanban!');
            setTimeout(() => setFeedback(null), 3000);
        } catch (e: any) {
            setFeedback(`Erro: ${e.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const statusBadge = () => {
        switch (proposal.statusAprovacao) {
            case 'aprovado_desenvolver':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Aprovado p/ Produção</span>;
            case 'testar_alteracoes':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">Testar c/ Alterações</span>;
            case 'guardar_mais_tarde':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">Guardado p/ Mais Tarde</span>;
            case 'descartado':
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">Descartado</span>;
            default:
                return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">Rascunho Editorial</span>;
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div 
                className="bg-card text-card-foreground border border-border w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between shrink-0 bg-secondary/15">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Sparkles size={16} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground px-1.5 py-0.2 bg-muted rounded">
                                    {proposal.formato}
                                </span>
                                {statusBadge()}
                            </div>
                            <h2 className="text-sm sm:text-base font-medium text-foreground truncate mt-0.5">
                                {isEditing ? (
                                    <input 
                                        type="text" 
                                        value={titulo} 
                                        onChange={e => setTitulo(e.target.value)}
                                        className="bg-background text-foreground border border-border rounded px-2 py-0.5 text-sm w-full"
                                    />
                                ) : (
                                    proposal.titulo
                                )}
                            </h2>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                        {isEditing ? (
                            <button
                                type="button"
                                onClick={handleSaveEdits}
                                className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg flex items-center gap-1 shadow-xs"
                            >
                                <Save size={13} />
                                <span>Salvar</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg flex items-center gap-1 hover:bg-muted"
                                title="Editar campos da proposta"
                            >
                                <Edit2 size={12} />
                                <span>Editar</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Feedback Toast */}
                {feedback && (
                    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-xs font-medium text-primary flex items-center justify-between">
                        <span>{feedback}</span>
                        <Check size={14} />
                    </div>
                )}

                {/* Body com Scroll */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-normal custom-scrollbar">
                    {/* Grelha Oficial das 4 Colunas Resumida */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/70">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">Ângulo</span>
                            <span className="font-medium text-foreground">{proposal.angulo}</span>
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-1">
                            <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">Ideia Melhorada</span>
                            <span className="text-foreground">{isEditing ? (
                                <textarea value={ideiaMelhorada} onChange={e => setIdeiaMelhorada(e.target.value)} rows={2} className="w-full text-xs p-1 bg-background border rounded" />
                            ) : proposal.ideiaMelhorada}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">Gancho / Base</span>
                            <span className="text-foreground">{proposal.ganchoBase}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">Retenção / Hook</span>
                            <span className="text-foreground">{proposal.retencaoHook}</span>
                        </div>
                    </div>

                    {/* Gancho Verbal & Visual */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-card border border-border/60 flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase font-medium text-primary tracking-wider flex items-center gap-1">
                                🎙️ Gancho Verbal (Fala nos primeiros 3s)
                            </span>
                            {isEditing ? (
                                <textarea value={ganchoVerbal} onChange={e => setGanchoVerbal(e.target.value)} rows={2} className="w-full text-xs p-1.5 bg-background border rounded" />
                            ) : (
                                <p className="text-xs text-foreground italic">"{proposal.ganchoVerbal || proposal.ganchoBase}"</p>
                            )}
                        </div>

                        <div className="p-3 rounded-xl bg-card border border-border/60 flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase font-medium text-primary tracking-wider flex items-center gap-1">
                                👁️ Gancho Visual (Cena e Ação Inicial)
                            </span>
                            {isEditing ? (
                                <textarea value={ganchoVisual} onChange={e => setGanchoVisual(e.target.value)} rows={2} className="w-full text-xs p-1.5 bg-background border rounded" />
                            ) : (
                                <p className="text-xs text-foreground">{proposal.ganchoVisual || 'Gravação em plano médio com contraste visual direto.'}</p>
                            )}
                        </div>
                    </div>

                    {/* Roteiro Completo / Slides */}
                    <div className="p-3.5 rounded-xl bg-card border border-border/60 flex flex-col gap-2">
                        <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider flex items-center gap-1.5">
                            <FileText size={13} className="text-primary" />
                            Roteiro Cena a Cena / Sequência de Conteúdo
                        </span>
                        {isEditing ? (
                            <textarea 
                                value={roteiroSlides} 
                                onChange={e => setRoteiroSlides(e.target.value)} 
                                rows={6} 
                                className="w-full text-xs p-2 bg-background border rounded font-mono" 
                            />
                        ) : (
                            <div className="text-xs text-foreground leading-relaxed whitespace-pre-line bg-secondary/15 p-3 rounded-lg border border-border/40">
                                {proposal.roteiroSlides || 'Roteiro direto com desenvolvimento em 3 atos e fechamento rápido.'}
                            </div>
                        )}
                    </div>

                    {/* Texto no Ecrã & Chamada para Ação */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-card border border-border/60 flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">
                                Texto no Ecrã (Primeiro Frame)
                            </span>
                            {isEditing ? (
                                <input type="text" value={textoTela} onChange={e => setTextoTela(e.target.value)} className="w-full text-xs p-1.5 bg-background border rounded" />
                            ) : (
                                <p className="text-xs text-foreground font-medium">{proposal.textoTela || 'Sem texto no ecrã definido'}</p>
                            )}
                        </div>

                        <div className="p-3 rounded-xl bg-card border border-border/60 flex flex-col gap-1.5">
                            <span className="text-[10px] uppercase font-medium text-emerald-600 tracking-wider">
                                📢 Chamada para Ação (CTA)
                            </span>
                            {isEditing ? (
                                <input type="text" value={cta} onChange={e => setCta(e.target.value)} className="w-full text-xs p-1.5 bg-background border rounded" />
                            ) : (
                                <p className="text-xs text-foreground font-medium">{proposal.cta || 'Comenta a tua opinião abaixo.'}</p>
                            )}
                        </div>
                    </div>

                    {/* Justificativa Estratégica & Hipóteses */}
                    {(proposal.justificativaEstrategica || proposal.limitacoesHipoteses) && (
                        <div className="p-3 rounded-xl bg-muted/20 border border-border/50 text-[11px] space-y-1.5 text-muted-foreground">
                            {proposal.justificativaEstrategica && (
                                <p><strong>🎯 Justificativa Vamuss:</strong> {proposal.justificativaEstrategica}</p>
                            )}
                            {proposal.limitacoesHipoteses && (
                                <p><strong>🧪 Hipótese a Testar:</strong> {proposal.limitacoesHipoteses}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer: Decisões Editoriais Humanas & Enviar p/ Kanban */}
                <div className="p-4 border-t border-border/60 bg-secondary/15 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    {/* Botões de Decisão */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => onUpdateStatus(proposal.id, 'aprovado_desenvolver')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                                proposal.statusAprovacao === 'aprovado_desenvolver' 
                                    ? 'bg-emerald-500 text-white border-emerald-600' 
                                    : 'border-border text-foreground hover:bg-emerald-500/10 hover:text-emerald-600'
                            }`}
                        >
                            <CheckCircle size={13} />
                            <span>Aprovar</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onUpdateStatus(proposal.id, 'testar_alteracoes')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                                proposal.statusAprovacao === 'testar_alteracoes' 
                                    ? 'bg-amber-500 text-white border-amber-600' 
                                    : 'border-border text-foreground hover:bg-amber-500/10 hover:text-amber-600'
                            }`}
                        >
                            <Clock size={13} />
                            <span>Testar c/ Alterações</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onUpdateStatus(proposal.id, 'guardar_mais_tarde')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 ${
                                proposal.statusAprovacao === 'guardar_mais_tarde' 
                                    ? 'bg-blue-500 text-white border-blue-600' 
                                    : 'border-border text-foreground hover:bg-blue-500/10 hover:text-blue-600'
                            }`}
                        >
                            <span>Guardar</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onUpdateStatus(proposal.id, 'descartado')}
                            className="px-2 py-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg text-xs font-medium transition-colors"
                            title="Descartar proposta"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>

                    {/* Enviar para o Kanban de Produção (Idempotente) */}
                    <button
                        type="button"
                        onClick={handleSendKanban}
                        disabled={isSending}
                        className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
                    >
                        <Send size={13} />
                        <span>{isSending ? 'A enviar...' : proposal.cardId ? 'Reenviar ao Kanban' : 'Enviar para o Kanban'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
