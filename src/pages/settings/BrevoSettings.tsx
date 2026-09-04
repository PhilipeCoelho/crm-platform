import { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { supabase } from '@/lib/supabase';
import { BrevoSyncLog } from '@/types/schema';
import {
    Check, RefreshCw, Send, Key,
    Database, Activity, CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import Modal from '@/components/ui/Modal';

export default function BrevoSettings() {
    const { contacts, fetchBrevoConfig, connectBrevo, syncBrevo, sendToBrevo } = useCRM();

    const [apiKey, setApiKey] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [maskedKey, setMaskedKey] = useState('');
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
    const [logs, setLogs] = useState<BrevoSyncLog[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const [totalBrevoContacts, setTotalBrevoContacts] = useState<number | null>(null);

    const [syncReport, setSyncReport] = useState<{
        totalCRM: number;
        totalWithEmail: number;
        foundInBrevo: number;
        notFoundInBrevo: number;
        withoutEmail: number;
        durationMs: number;
    } | null>(null);

    // Fetch config and history logs on mount
    const loadConfigAndLogs = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Brevo Config from store
            const config = await fetchBrevoConfig();
            setIsConnected(config.hasKey);
            setMaskedKey(config.apiKey);
            setLastSyncAt(config.lastSyncAt);

            // 2. Fetch Sync Logs from Supabase
            const { data: logsData, error: logsError } = await supabase
                .from('brevo_sync_logs')
                .select('*')
                .order('sync_at', { ascending: false });

            if (!logsError && logsData) {
                setLogs(logsData);
            }
        } catch (err) {
            console.error('Error loading Brevo settings:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadConfigAndLogs();
    }, []);

    // Local computed stats from reactive CRM contacts store
    const stats = useMemo(() => {
        const totalCRM = contacts.length;
        const synced = contacts.filter(c => c.brevoSyncStatus === 'sincronizado').length;
        const notSynced = contacts.filter(c => c.brevoSyncStatus === 'nao_sincronizado').length;
        const notEligible = contacts.filter(c => c.brevoSyncStatus === 'nao_elegivel').length;
        const eligible = synced + notSynced;

        return {
            totalCRM,
            synced,
            notSynced,
            notEligible,
            eligible
        };
    }, [contacts]);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) return;

        setIsConnecting(true);
        try {
            const data = await connectBrevo(apiKey);
            if (data.success) {
                setIsConnected(true);
                setMaskedKey(`${apiKey.substring(0, 8)}...`);
                setTotalBrevoContacts(data.totalContacts);
                setApiKey('');
                alert('Conexão com o Brevo estabelecida com sucesso!');
                await loadConfigAndLogs();
            }
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Erro ao conectar à API do Brevo. Verifique se a chave de API está correta.');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Deseja realmente desconectar e remover a chave da API do Brevo?')) return;
        
        setIsConnecting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('profiles')
                .update({ brevo_api_key: null, brevo_last_sync_at: null })
                .eq('id', user.id);

            if (error) throw error;

            setIsConnected(false);
            setMaskedKey('');
            setLastSyncAt(null);
            setTotalBrevoContacts(null);
            alert('Chave de API do Brevo removida.');
        } catch (err: any) {
            console.error(err);
            alert('Erro ao desconectar.');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await syncBrevo();
            if (res.success) {
                setLastSyncAt(res.lastSyncAt);
                setTotalBrevoContacts(res.totalBrevoContacts);
                setSyncReport({
                    totalCRM: res.totalCRM || 0,
                    totalWithEmail: res.totalWithEmail || 0,
                    foundInBrevo: res.foundInBrevo || 0,
                    notFoundInBrevo: res.notFoundInBrevo || 0,
                    withoutEmail: res.withoutEmail || 0,
                    durationMs: res.durationMs || 0
                });
                await loadConfigAndLogs();
            }
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Erro durante a sincronização.');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSend = async () => {
        if (stats.notSynced === 0) {
            alert('Não há contatos pendentes (Não sincronizados) para enviar.');
            return;
        }

        if (!window.confirm(`Deseja enviar ${stats.notSynced} contatos pendentes para o Brevo agora?`)) return;

        setIsSending(true);
        try {
            const res = await sendToBrevo();
            if (res.success) {
                setLastSyncAt(res.lastSyncAt);
                alert(`${res.count} contatos foram enviados e sincronizados com o Brevo com sucesso!`);
                await loadConfigAndLogs();
            }
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Erro ao enviar contatos.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-background p-6 overflow-y-auto custom-scrollbar">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-3 mb-6">
                <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>Contatos</span>
                        <span>&gt;</span>
                        <span className="font-medium text-foreground">Integração Brevo</span>
                    </div>
                    <h1 className="text-xl font-bold text-foreground mt-1">Integração Nativa Brevo</h1>
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <RefreshCw size={24} className="text-primary animate-spin" />
                </div>
            ) : (
                <div className="space-y-6 max-w-5xl">
                    {/* Connection Panel */}
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                            <Key size={16} className="text-primary" />
                            API Key Connection
                        </h2>

                        {isConnected ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <Check size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Brevo Conectado</p>
                                        <p className="text-[11px] text-emerald-600 dark:text-emerald-500 font-mono mt-0.5">Chave: {maskedKey}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDisconnect}
                                    disabled={isConnecting}
                                    className="px-3 py-1.5 text-xs font-semibold bg-red-100 hover:bg-red-200 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-700 dark:text-red-400 rounded-lg transition-colors shrink-0"
                                >
                                    Desconectar
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleConnect} className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="password"
                                    placeholder="Cole sua chave de API v3 do Brevo..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    disabled={isConnecting}
                                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors font-mono"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isConnecting || !apiKey.trim()}
                                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs uppercase tracking-wider rounded-lg shadow-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isConnecting ? (
                                        <RefreshCw size={14} className="animate-spin" />
                                    ) : (
                                        'Conectar'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Stats Dashboard */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                <Database size={12} />
                                Contatos CRM
                            </span>
                            <span className="text-xl font-bold text-foreground mt-2">{stats.totalCRM}</span>
                        </div>

                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                <ShieldCheck size={12} className="text-blue-500" />
                                Contatos com e-mail
                            </span>
                            <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-2">{stats.eligible}</span>
                        </div>

                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 size={12} className="text-emerald-500" />
                                Sincronizados
                            </span>
                            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{stats.synced}</span>
                        </div>

                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                <Activity size={12} className="text-orange-500" />
                                Pendentes
                            </span>
                            <span className="text-xl font-bold text-orange-500 mt-2">{stats.notSynced}</span>
                        </div>

                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                                <AlertTriangle size={12} className="text-yellow-500" />
                                Não Elegíveis
                            </span>
                            <span className="text-xl font-bold text-yellow-600 dark:text-yellow-500 mt-2">{stats.notEligible}</span>
                        </div>
                    </div>

                    {/* Sync Actions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Sync panel */}
                        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">Sincronização Geral</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Busca todos os contatos do Brevo e compara localmente com o CRM para identificar a correspondência de status.
                                </p>
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg p-3 space-y-2">
                                <div className="flex justify-between">
                                    <span>Última sincronização:</span>
                                    <span className="font-medium text-foreground">
                                        {lastSyncAt ? new Date(lastSyncAt).toLocaleString('pt-BR') : 'Nunca'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Total contatos no Brevo:</span>
                                    <span className="font-medium text-foreground">
                                        {totalBrevoContacts !== null ? totalBrevoContacts : 'Não mapeado'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={handleSync}
                                disabled={!isConnected || isSyncing || isSending}
                                className="w-full flex items-center justify-center gap-2 bg-background border border-border hover:bg-muted font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition-colors"
                            >
                                <RefreshCw size={14} className={isSyncing ? 'animate-spin text-primary' : 'text-primary'} />
                                Sincronizar Brevo
                            </button>
                        </div>

                        {/* Send panel */}
                        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                            <div>
                                <h3 className="font-semibold text-sm text-foreground">Enviar para o Brevo</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Inscreve todos os contatos elegíveis marcados como "Não sincronizado" diretamente nas listas do Brevo.
                                </p>
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg p-3 space-y-2">
                                <div className="flex justify-between">
                                    <span>Contatos elegíveis pendentes:</span>
                                    <span className="font-semibold text-orange-500">{stats.notSynced}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Segurança:</span>
                                    <span className="text-emerald-600 font-medium">Contatos não elegíveis serão ignorados</span>
                                </div>
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={!isConnected || isSending || isSyncing || stats.notSynced === 0}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg shadow-sm hover:bg-primary/90 transition-colors"
                            >
                                {isSending ? (
                                    <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                    <Send size={14} />
                                )}
                                Enviar Pendentes ({stats.notSynced})
                            </button>
                        </div>
                    </div>

                    {/* Sync History Logs Table */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-border">
                            <h3 className="font-semibold text-sm text-foreground">Histórico de Sincronizações</h3>
                            <p className="text-xs text-muted-foreground mt-1">Registro cronológico detalhado das atualizações nativas.</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-muted/50 border-b border-border font-semibold text-muted-foreground select-none">
                                        <th className="p-3">Data / Hora</th>
                                        <th className="p-3">Sincronizados</th>
                                        <th className="p-3">Não Sincronizados</th>
                                        <th className="p-3">Ignorados</th>
                                        <th className="p-3">Tempo Gasto</th>
                                        <th className="p-3">Usuário</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                                Nenhum registro de sincronização encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => (
                                            <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors text-foreground">
                                                <td className="p-3 font-medium">
                                                    {new Date(log.sync_at).toLocaleString('pt-BR')}
                                                </td>
                                                <td className="p-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                                                    {log.synced_count}
                                                </td>
                                                <td className="p-3 text-orange-500 font-medium">
                                                    {log.not_synced_count}
                                                </td>
                                                <td className="p-3 text-muted-foreground">
                                                    {log.ignored_count} (Não elegíveis)
                                                </td>
                                                <td className="p-3 text-muted-foreground font-mono">
                                                    {(log.duration_ms / 1000).toFixed(2)}s
                                                </td>
                                                <td className="p-3 text-muted-foreground">
                                                    Sistema (Você)
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Sync Report Modal */}
            <Modal
                isOpen={syncReport !== null}
                onClose={() => setSyncReport(null)}
                title="Relatório de Sincronização Brevo"
                maxWidth="max-w-md"
            >
                <div className="p-6 space-y-5">
                    <p className="text-xs text-muted-foreground">
                        A comparação com base no e-mail único do Brevo foi executada e processada com sucesso.
                    </p>

                    <div className="space-y-3 bg-muted/40 dark:bg-muted/10 border border-border rounded-xl p-4 font-medium text-xs">
                        <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                            <span className="text-muted-foreground">Contatos CRM:</span>
                            <span className="font-semibold text-foreground text-sm">{syncReport?.totalCRM}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                            <span className="text-muted-foreground">Contatos CRM com e-mail:</span>
                            <span className="font-semibold text-foreground text-sm">{syncReport?.totalWithEmail}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                            <span className="text-muted-foreground text-emerald-600 dark:text-emerald-400">Contatos encontrados no Brevo:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">✅ {syncReport?.foundInBrevo}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                            <span className="text-muted-foreground text-orange-500">Contatos não encontrados:</span>
                            <span className="font-semibold text-orange-500 text-sm">❌ {syncReport?.notFoundInBrevo}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                            <span className="text-muted-foreground">Contatos sem e-mail:</span>
                            <span className="font-semibold text-foreground text-sm">{syncReport?.withoutEmail}</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 font-mono text-[10px] text-muted-foreground">
                            <span>Tempo total da sincronização:</span>
                            <span>{syncReport?.durationMs} ms</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setSyncReport(null)}
                        className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm hover:bg-primary/90 transition-colors text-center"
                    >
                        Fechar Relatório
                    </button>
                </div>
            </Modal>
        </div>
    );
}
