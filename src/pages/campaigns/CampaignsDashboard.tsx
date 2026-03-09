import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { supabase } from '@/lib/supabase';
import {
    Plus, Mail, Users, MoreVertical,
    Copy, BarChart2, Filter, Calendar,
    CheckCircle2, MousePointer2, Eye, Trash2
} from 'lucide-react';
import { Campaign } from '@/types/schema';

type FilterStatus = 'all' | 'draft' | 'sent' | 'scheduled';

export default function CampaignsDashboard() {
    const { campaigns, duplicateCampaign, deleteCampaign } = useCRM();
    const navigate = useNavigate();
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [reportLogs, setReportLogs] = useState<any[]>([]);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    useEffect(() => {
        if (selectedCampaign) {
            fetchReportLogs(selectedCampaign.id);
        } else {
            setReportLogs([]);
        }
    }, [selectedCampaign]);

    const fetchReportLogs = async (campaignId: string) => {
        setIsLoadingReport(true);
        try {
            const { data, error } = await supabase
                .from('email_logs')
                .select('*')
                .eq('campaign_id', campaignId)
                .order('sent_at', { ascending: false });

            if (error) throw error;
            setReportLogs(data || []);
        } catch (e) {
            console.error('Error fetching report logs:', e);
        } finally {
            setIsLoadingReport(false);
        }
    };

    const filteredCampaigns = useMemo(() => {
        if (filter === 'all') return campaigns;
        return campaigns.filter(c => c.status === filter);
    }, [campaigns, filter]);

    const formatPercent = (value: number, total: number) => {
        if (!total) return '0%';
        return `${((value / total) * 100).toFixed(1)}%`;
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const styles: Record<string, string> = {
            sent: 'bg-emerald-500/10 text-emerald-500',
            failed: 'bg-rose-500/10 text-rose-500',
            sending: 'bg-blue-500/10 text-blue-500',
            draft: 'bg-amber-500/10 text-amber-500',
            scheduled: 'bg-purple-500/10 text-purple-500'
        };

        const labels: Record<string, string> = {
            sent: 'Enviado',
            failed: 'Erro',
            sending: 'Enviando...',
            draft: 'Rascunho',
            scheduled: 'Agendado'
        };

        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] || styles.draft}`}>
                {labels[status] || status}
            </span>
        );
    };

    const MetricCell = ({ value, total, highlight }: { value: number, total: number, label?: string, highlight?: boolean }) => (
        <div className="flex flex-col items-center min-w-[80px]">
            <div className={`text-sm font-semibold flex items-center gap-1 ${highlight ? 'text-orange-500' : 'text-foreground'}`}>
                {value}
                {highlight && <span title="Alto desempenho">🔥</span>}
            </div>
            <div className="text-[11px] opacity-60 font-medium text-center">
                {formatPercent(value, total)}
            </div>
        </div>
    );

    return (
        <div className="p-8 space-y-8 bg-[#F9FAFB] dark:bg-slate-950/20 h-full overflow-auto">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
                    <p className="text-muted-foreground text-sm">Gerencie e analise o desempenho das suas comunicações.</p>
                </div>
                <button
                    onClick={() => navigate('/campaigns/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                >
                    <Plus size={18} />
                    Nova campanha
                </button>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2 bg-white dark:bg-card p-1 border border-border rounded-lg self-start w-fit">
                {(['all', 'draft', 'sent', 'scheduled'] as FilterStatus[]).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${filter === f
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted'
                            }`}
                    >
                        {f === 'all' ? 'Todos' : f === 'draft' ? 'Rascunho' : f === 'sent' ? 'Enviado' : 'Agendado'}
                    </button>
                ))}
            </div>

            {filteredCampaigns.length === 0 ? (
                <div className="bg-white dark:bg-card border border-dashed border-border rounded-2xl p-12 flex flex-col items-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-primary/5 text-primary flex items-center justify-center">
                        <Filter size={40} className="text-muted-foreground/40" />
                    </div>
                    <div className="max-w-md space-y-2">
                        <h3 className="text-xl font-bold text-foreground">Nenhuma campanha encontrada</h3>
                        <p className="text-muted-foreground text-sm">
                            Não existem campanhas correspondentes ao filtro selecionado.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campanha</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Envio</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Destinatários</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Entregues</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Aberturas</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Cliques</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredCampaigns.map(campaign => {
                                    const total = campaign.sentCount || 0;
                                    const isOpenHigh = total > 0 && (campaign.openedCount / total) > 0.4;

                                    return (
                                        <tr
                                            key={campaign.id}
                                            className="hover:bg-muted/30 transition-colors cursor-pointer group"
                                            onClick={() => setSelectedCampaign(campaign)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                        <Mail size={14} />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{campaign.name}</div>
                                                        <div className="text-[10px] text-muted-foreground line-clamp-1">{campaign.subject}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-[11px] text-foreground font-medium flex items-center gap-1.5">
                                                    <Calendar size={12} className="text-muted-foreground" />
                                                    {campaign.sentAt ? (
                                                        <span>
                                                            {new Date(campaign.sentAt).toLocaleDateString()}<br />
                                                            <span className="opacity-60">{new Date(campaign.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </span>
                                                    ) : '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="text-sm font-semibold">{total}</div>
                                                <div className="text-[11px] opacity-60">100%</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <MetricCell value={campaign.deliveredCount || (campaign.status === 'sent' ? total : 0)} total={total} label="Entregues" />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <MetricCell value={campaign.openedCount || 0} total={total} label="Aberturas" highlight={isOpenHigh} />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <MetricCell value={campaign.clickedCount || 0} total={total} label="Cliques" />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <StatusBadge status={campaign.status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => duplicateCampaign(campaign)}
                                                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-all"
                                                        title="Duplicar"
                                                    >
                                                        <Copy size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Tem certeza que deseja excluir esta campanha?')) {
                                                                deleteCampaign(campaign.id);
                                                            }
                                                        }}
                                                        className="p-1.5 hover:bg-rose-500/10 rounded-md text-muted-foreground hover:text-rose-500 transition-all"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-all">
                                                        <MoreVertical size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Relatório (Simplificado) */}
            {selectedCampaign && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <BarChart2 size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">{selectedCampaign.name}</h2>
                                    <p className="text-sm text-muted-foreground">Relatório de desempenho</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (confirm('Tem certeza que deseja excluir esta campanha?')) {
                                            deleteCampaign(selectedCampaign.id!);
                                            setSelectedCampaign(null);
                                        }
                                    }}
                                    className="p-2 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                                    title="Excluir campanha"
                                >
                                    <Trash2 size={20} />
                                </button>
                                <button onClick={() => setSelectedCampaign(null)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                                    <Plus size={24} className="rotate-45 text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Grid de Métricas */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="p-4 bg-muted/20 border border-border rounded-xl">
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Destinatários</div>
                                    <div className="text-2xl font-bold text-foreground">{selectedCampaign.sentCount}</div>
                                    <div className="text-xs text-muted-foreground">100% da lista</div>
                                </div>
                                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Entregues</div>
                                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                        {selectedCampaign.deliveredCount || (selectedCampaign.status === 'sent' ? selectedCampaign.sentCount : 0)}
                                    </div>
                                    <div className="text-xs text-emerald-600/60 font-medium">
                                        {formatPercent(selectedCampaign.deliveredCount || (selectedCampaign.status === 'sent' ? selectedCampaign.sentCount : 0), selectedCampaign.sentCount)}
                                    </div>
                                </div>
                                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Aberturas</div>
                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedCampaign.openedCount}</div>
                                    <div className="text-xs text-blue-600/60 font-medium">{formatPercent(selectedCampaign.openedCount, selectedCampaign.sentCount)}</div>
                                </div>
                                <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                                    <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Cliques</div>
                                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{selectedCampaign.clickedCount}</div>
                                    <div className="text-xs text-indigo-600/60 font-medium">{formatPercent(selectedCampaign.clickedCount, selectedCampaign.sentCount)}</div>
                                </div>
                                <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                                    <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">Cancelamentos</div>
                                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">0</div>
                                    <div className="text-xs text-rose-600/60 font-medium">0%</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-foreground px-1">Interações por Destinatário</h3>
                                <div className="border border-border rounded-xl overflow-hidden bg-white dark:bg-card/50">
                                    <div className="max-h-[300px] overflow-y-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted/30 border-b border-border">
                                                    <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Destinatário</th>
                                                    <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Envio</th>
                                                    <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Abertura</th>
                                                    <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase">Clique</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {isLoadingReport ? (
                                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando dados...</td></tr>
                                                ) : reportLogs.length === 0 ? (
                                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum registro encontrado</td></tr>
                                                ) : reportLogs.map((log: any) => (
                                                    <tr key={log.id} className="text-xs hover:bg-muted/20 transition-colors">
                                                        <td className="px-4 py-3 font-medium">{log.recipient_email}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-1.5 text-emerald-500 font-bold">
                                                                <CheckCircle2 size={12} /> enviado
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {log.opened ? (
                                                                <div className="flex items-center gap-1.5 text-blue-500 font-bold">
                                                                    <Eye size={12} /> abriu
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground opacity-40">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {log.clicked ? (
                                                                <div className="flex items-center gap-1.5 text-indigo-500 font-bold">
                                                                    <MousePointer2 size={12} /> clicou
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground opacity-40">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="border border-border rounded-xl p-5 space-y-4">
                                    <div className="flex items-center gap-2 font-bold text-foreground">
                                        <Eye size={18} className="text-primary" />
                                        Preview da Mensagem
                                    </div>
                                    <div className="text-sm p-4 bg-muted/30 rounded-lg whitespace-pre-wrap border border-border/50 text-muted-foreground font-serif">
                                        {selectedCampaign.content || "Sem conteúdo"}
                                    </div>
                                </div>

                                <div className="border border-border rounded-xl p-5 space-y-4">
                                    <div className="flex items-center gap-2 font-bold text-foreground">
                                        <Users size={18} className="text-primary" />
                                        Detalhes do Envio
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Remetente</span>
                                            <span className="font-medium">{selectedCampaign.fromName} ({selectedCampaign.fromEmail})</span>
                                        </div>
                                        <div className="flex justify-between text-sm py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Assunto</span>
                                            <span className="font-medium">{selectedCampaign.subject}</span>
                                        </div>
                                        <div className="flex justify-between text-sm py-2 border-b border-border/50">
                                            <span className="text-muted-foreground">Iniciado em</span>
                                            <span className="font-medium">
                                                {selectedCampaign.sentAt ? new Date(selectedCampaign.sentAt).toLocaleString() : 'Não enviado'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm py-2">
                                            <span className="text-muted-foreground">Status Final</span>
                                            <StatusBadge status={selectedCampaign.status} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
                            <button
                                onClick={() => setSelectedCampaign(null)}
                                className="px-6 py-2 bg-white dark:bg-card border border-border rounded-lg font-bold text-sm hover:bg-muted transition-all"
                            >
                                Fechar Relatório
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

