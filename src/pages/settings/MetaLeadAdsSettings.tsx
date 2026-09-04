import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    RefreshCw, Check, Link2, Unlink, FileText, Settings2,
    Zap, Play, AlertTriangle, ChevronDown, ChevronRight,
    WifiOff, ToggleLeft, ToggleRight, ClipboardList,
    User, Building2, Briefcase, History, CalendarPlus, Workflow,
    CheckCircle2, XCircle, Clock, Filter, ExternalLink
} from 'lucide-react';
import * as metaService from '@/services/metaLeadAds';
import type { MetaPage, MetaForm, MetaIntegrationLog, MetaLeadAdsSettings, TestResult } from '@/services/metaLeadAds';

// ─── Meta Lead Ads Integration Settings ───────────────────────────────

export default function MetaLeadAdsSettings() {
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);

    // Pages & Forms
    const [pages, setPages] = useState<MetaPage[]>([]);
    const [formsByPage, setFormsByPage] = useState<Record<string, MetaForm[]>>({});
    const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

    // Settings
    const [settings, setSettings] = useState<MetaLeadAdsSettings>({
        defaultPipelineId: 'sales',
        defaultStageId: 'new',
        autoCreateContact: true,
        autoCreateCompany: true,
        autoCreateDeal: true,
        autoRegisterHistory: true,
        autoCreateActivity: true,
        autoStartCadence: true,
        capiEnabled: false,
        capiPixelId: '',
        capiAccessToken: '',
    });
    const [pipelines, setPipelines] = useState<{ id: string; name: string; stages: { id: string; name: string }[] }[]>([]);

    // Logs
    const [logs, setLogs] = useState<MetaIntegrationLog[]>([]);
    const [logFilter, setLogFilter] = useState<string>('');

    // Test
    const [testResult, setTestResult] = useState<TestResult | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [testEventCode, setTestEventCode] = useState<string>('');

    // Loading states
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [subscribingPage, setSubscribingPage] = useState<string | null>(null);
    const [togglingForm, setTogglingForm] = useState<string | null>(null);

    // ─── Load Initial Data ─────────────────────────────
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Load connection status
            const status = await metaService.getMetaStatus();
            setIsConnected(status.connected);
            setUserName(status.userName);
            setExpiresAt(status.expiresAt);

            // Load settings
            try {
                const s = await metaService.getMetaSettings();
                setSettings(s);
            } catch { /* defaults are fine */ }

            // Load pages if connected
            if (status.connected) {
                try {
                    const { pages: p } = await metaService.getMetaPages();
                    setPages(p);
                } catch { /* empty is fine */ }
            }

            // Load logs
            try {
                const { logs: l } = await metaService.getMetaLogs({ limit: 50 });
                setLogs(l);
            } catch { /* empty is fine */ }

            // Load pipelines/stages from Supabase
            const { data: stagesData } = await supabase.from('stages').select('*').order('order_index');
            if (stagesData) {
                const pMap: Record<string, { id: string; name: string; stages: { id: string; name: string }[] }> = {};
                for (const s of stagesData) {
                    const pid = s.pipeline_id || 'sales';
                    if (!pMap[pid]) {
                        pMap[pid] = {
                            id: pid,
                            name: pid === 'sales' ? 'Funil de Prospeção' : pid === 'cold_leads' ? 'Leads Frios' : pid,
                            stages: []
                        };
                    }
                    pMap[pid].stages.push({ id: s.id, name: s.name });
                }
                setPipelines(Object.values(pMap));
            }
        } catch (err) {
            console.error('Error loading Meta settings:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ─── Check for OAuth callback code in URL ─────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
            window.history.replaceState({}, '', window.location.pathname);
            handleOAuthCallback(code);
        }
    }, []);

    // ─── OAuth Handlers ───────────────────────────────
    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const { url } = await metaService.getMetaAuthUrl();
            window.location.href = url;
        } catch (err: any) {
            alert(err.message || 'Erro ao gerar URL de autenticação.');
            setIsConnecting(false);
        }
    };

    const handleOAuthCallback = async (code: string) => {
        setIsConnecting(true);
        try {
            await metaService.handleMetaCallback(code);
            await loadData();
        } catch (err: any) {
            alert(err.message || 'Erro ao finalizar conexão com a Meta.');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Deseja realmente desconectar sua conta Meta? Todos os webhooks serão removidos.')) return;
        setIsConnecting(true);
        try {
            await metaService.disconnectMeta();
            setIsConnected(false);
            setUserName(null);
            setPages([]);
            setFormsByPage({});
            await loadData();
        } catch (err: any) {
            alert(err.message || 'Erro ao desconectar.');
        } finally {
            setIsConnecting(false);
        }
    };

    // ─── Page Handlers ────────────────────────────────
    const handleToggleSubscription = async (pageId: string, isSubscribed: boolean) => {
        setSubscribingPage(pageId);
        try {
            if (isSubscribed) {
                await metaService.unsubscribePage(pageId);
            } else {
                await metaService.subscribePage(pageId);
            }
            setPages(prev => prev.map(p =>
                p.pageId === pageId ? { ...p, isSubscribed: !isSubscribed } : p
            ));
        } catch (err: any) {
            alert(err.message || 'Erro ao alterar inscrição.');
        } finally {
            setSubscribingPage(null);
        }
    };

    const handleTogglePage = async (pageId: string) => {
        const next = new Set(expandedPages);
        if (next.has(pageId)) {
            next.delete(pageId);
        } else {
            next.add(pageId);
            // Load forms if not cached
            if (!formsByPage[pageId]) {
                try {
                    const { forms } = await metaService.getPageForms(pageId);
                    setFormsByPage(prev => ({ ...prev, [pageId]: forms }));
                } catch { /* silent */ }
            }
        }
        setExpandedPages(next);
    };

    const handleToggleFormSync = async (formId: string, enabled: boolean) => {
        setTogglingForm(formId);
        try {
            await metaService.toggleFormSync(formId, !enabled);
            setFormsByPage(prev => {
                const next = { ...prev };
                for (const pid of Object.keys(next)) {
                    next[pid] = next[pid].map(f =>
                        f.formId === formId ? { ...f, syncEnabled: !enabled } : f
                    );
                }
                return next;
            });
        } catch (err: any) {
            alert(err.message || 'Erro ao alterar sincronização.');
        } finally {
            setTogglingForm(null);
        }
    };

    // ─── Settings Handlers ────────────────────────────
    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            await metaService.saveMetaSettings(settings);
        } catch (err: any) {
            alert(err.message || 'Erro ao salvar configurações.');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const updateSetting = <K extends keyof MetaLeadAdsSettings>(key: K, value: MetaLeadAdsSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // ─── Test Handler ─────────────────────────────────
    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await metaService.testMetaIntegration(testEventCode);
            setTestResult(result);
            await loadData();
        } catch (err: any) {
            setTestResult({
                success: false,
                steps: [{ name: 'Conexão', status: 'error', message: err.message || 'Erro desconhecido' }],
                totalTimeMs: 0
            });
        } finally {
            setIsTesting(false);
        }
    };

    // ─── Helpers ──────────────────────────────────────
    const filteredLogs = logFilter ? logs.filter(l => l.eventType === logFilter) : logs;
    const selectedPipeline = pipelines.find(p => p.id === settings.defaultPipelineId);
    const availableStages = selectedPipeline?.stages || [];

    const eventTypeLabels: Record<string, string> = {
        connection: 'Conexão',
        disconnection: 'Desconexão',
        webhook: 'Webhook',
        lead_received: 'Lead Recebido',
        lead_processed: 'Lead Processado',
        error: 'Erro',
        auth_failure: 'Falha de Auth',
        token_expired: 'Token Expirado',
        token_refreshed: 'Token Renovado',
        page_subscribed: 'Página Inscrita',
        page_unsubscribed: 'Página Removida',
        test: 'Teste',
    };

    const statusIcons: Record<string, JSX.Element> = {
        success: <CheckCircle2 size={12} className="text-emerald-500" />,
        error: <XCircle size={12} className="text-red-500" />,
        warning: <AlertTriangle size={12} className="text-yellow-500" />,
    };

    // ─── Render ───────────────────────────────────────
    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <RefreshCw size={24} className="text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background p-6 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>Configurações</span>
                        <span>&gt;</span>
                        <span>Integrações</span>
                        <span>&gt;</span>
                        <span className="font-medium text-foreground">Meta Lead Ads</span>
                    </div>
                    <h1 className="text-xl font-bold text-foreground mt-1">Meta Lead Ads</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Receba leads automaticamente dos Formulários Instantâneos da Meta Ads</p>
                </div>
            </div>

            <div className="space-y-6 max-w-5xl">

                {/* ═══ 1. Connection Status ═══ */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                        <Link2 size={16} className="text-primary" />
                        Conexão Meta
                    </h2>

                    {isConnected ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <Check size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Meta Conectado</p>
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-0.5">{userName || 'Usuário Meta'}</p>
                                    {expiresAt && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            Token expira em: {new Date(expiresAt).toLocaleDateString('pt-BR')}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleDisconnect}
                                disabled={isConnecting}
                                className="px-3 py-1.5 text-xs font-semibold bg-red-100 hover:bg-red-200 dark:bg-red-950/30 dark:hover:bg-red-950/50 text-red-700 dark:text-red-400 rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
                            >
                                <Unlink size={12} />
                                Desconectar
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                    <WifiOff size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-foreground">Não conectado</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Conecte sua conta Meta para começar a receber leads automaticamente.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shrink-0 shadow-sm"
                            >
                                {isConnecting ? (
                                    <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                    <ExternalLink size={14} />
                                )}
                                Conectar com Meta
                            </button>
                        </div>
                    )}
                </div>

                {/* ═══ 2. Pages ═══ */}
                {isConnected && (
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                            <FileText size={16} className="text-primary" />
                            Páginas do Facebook
                        </h2>

                        {pages.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhuma página encontrada. Certifique-se de que seu app Meta tem acesso às suas páginas.</p>
                        ) : (
                            <div className="space-y-2">
                                {pages.map(page => (
                                    <div key={page.pageId} className="border border-border rounded-lg overflow-hidden">
                                        <div className="flex items-center justify-between p-3 bg-zinc-50/50 dark:bg-zinc-900/20">
                                            <button
                                                onClick={() => handleTogglePage(page.pageId)}
                                                className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-colors"
                                            >
                                                {expandedPages.has(page.pageId) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                {page.pageName || page.pageId}
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${page.isSubscribed
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                                                }`}>
                                                    {page.isSubscribed ? 'Webhook Ativo' : 'Webhook Inativo'}
                                                </span>
                                                <button
                                                    onClick={() => handleToggleSubscription(page.pageId, page.isSubscribed)}
                                                    disabled={subscribingPage === page.pageId}
                                                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                                                >
                                                    {subscribingPage === page.pageId ? (
                                                        <RefreshCw size={12} className="animate-spin" />
                                                    ) : page.isSubscribed ? (
                                                        <><ToggleRight size={14} /> Desativar</>
                                                    ) : (
                                                        <><ToggleLeft size={14} /> Ativar</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Forms for this page */}
                                        {expandedPages.has(page.pageId) && (
                                            <div className="p-3 border-t border-border">
                                                {!formsByPage[page.pageId] ? (
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <RefreshCw size={12} className="animate-spin" />
                                                        Carregando formulários...
                                                    </div>
                                                ) : formsByPage[page.pageId].length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">Nenhum formulário encontrado nesta página.</p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {formsByPage[page.pageId].map(form => (
                                                            <div key={form.formId} className="flex items-center justify-between py-2 px-3 rounded-md bg-background border border-border/50">
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-medium text-foreground">{form.formName || form.formId}</p>
                                                                    <div className="flex items-center gap-3 mt-1">
                                                                        <span className="text-[10px] text-muted-foreground">{form.leadsCount} leads</span>
                                                                        {form.lastLeadAt && (
                                                                            <span className="text-[10px] text-muted-foreground">
                                                                                Último: {new Date(form.lastLeadAt).toLocaleDateString('pt-BR')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleToggleFormSync(form.formId, form.syncEnabled)}
                                                                    disabled={togglingForm === form.formId}
                                                                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${form.syncEnabled
                                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                                                                    }`}
                                                                >
                                                                    {togglingForm === form.formId ? (
                                                                        <RefreshCw size={10} className="animate-spin" />
                                                                    ) : form.syncEnabled ? 'Sincronizando' : 'Pausado'}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ 3. Business Settings ═══ */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                        <Settings2 size={16} className="text-primary" />
                        Configurações de Negócio
                    </h2>
                    <p className="text-[11px] text-muted-foreground mb-4">
                        Defina como os leads recebidos serão transformados em negócios no CRM.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Pipeline */}
                        <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Pipeline Padrão</label>
                            <select
                                value={settings.defaultPipelineId}
                                onChange={e => {
                                    updateSetting('defaultPipelineId', e.target.value);
                                    const p = pipelines.find(p => p.id === e.target.value);
                                    if (p && p.stages.length > 0) {
                                        updateSetting('defaultStageId', p.stages[0].id);
                                    }
                                }}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary transition-colors"
                            >
                                {pipelines.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Stage */}
                        <div>
                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Etapa Inicial</label>
                            <select
                                value={settings.defaultStageId}
                                onChange={e => updateSetting('defaultStageId', e.target.value)}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary transition-colors"
                            >
                                {availableStages.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-lg shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                        {isSavingSettings ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                        Salvar Configurações
                    </button>
                </div>

                {/* ═══ API de Conversões (CAPI) ═══ */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                    
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1 mt-1">
                        <Zap size={16} className="text-indigo-500" />
                        API de Conversões da Meta (CAPI)
                    </h2>
                    <p className="text-[11px] text-muted-foreground mb-4">
                        Envie eventos do CRM em tempo real para otimizar suas campanhas e mensurar leads qualificados.
                    </p>

                    <div className="space-y-4">
                        {/* Toggle Enable */}
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-zinc-50/50 dark:bg-zinc-900/20">
                            <div>
                                <p className="text-xs font-semibold text-foreground">Ativar API de Conversões (CAPI)</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Envia automaticamente as atualizações de estágio dos negócios para o seu pixel/conjunto de dados da Meta.</p>
                            </div>
                            <button
                                onClick={() => updateSetting('capiEnabled', !settings.capiEnabled)}
                                className={`w-10 h-6 rounded-full relative transition-colors ${settings.capiEnabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.capiEnabled ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>

                        {settings.capiEnabled && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                {/* Pixel ID */}
                                <div>
                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Identificação do conjunto de dados (Pixel ID)</label>
                                    <input
                                        type="text"
                                        value={settings.capiPixelId || ''}
                                        onChange={e => updateSetting('capiPixelId', e.target.value)}
                                        placeholder="Ex: 1519129585033228"
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>

                                {/* Access Token */}
                                <div>
                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Token de Acesso da CAPI</label>
                                    <input
                                        type="password"
                                        value={settings.capiAccessToken || ''}
                                        onChange={e => updateSetting('capiAccessToken', e.target.value)}
                                        placeholder="EAABw..."
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                            </div>
                        )}

                        {settings.capiEnabled && (
                            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg p-3 text-[11px] text-blue-700 dark:text-blue-400">
                                <p className="font-semibold mb-1 flex items-center gap-1">
                                    <AlertTriangle size={12} /> Como obter estas credenciais?
                                </p>
                                <ol className="list-decimal pl-4 space-y-0.5">
                                    <li>Aceda ao seu <b>Gerenciador de Eventos da Meta</b>.</li>
                                    <li>Selecione o seu <b>Conjunto de Dados (Dataset/Pixel)</b> na barra lateral.</li>
                                    <li>Copie a identificação numérica que aparece abaixo do nome do pixel.</li>
                                    <li>Vá ao separador <b>Configurações</b>, role até a seção <i>API de Conversões</i> e clique em <b>Gerar token de acesso</b>.</li>
                                </ol>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings}
                        className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-2"
                    >
                        {isSavingSettings ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                        Salvar API de Conversões
                    </button>
                </div>

                {/* ═══ 4. Automation Toggles ═══ */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                        <Zap size={16} className="text-primary" />
                        Automação — Ao Receber um Lead
                    </h2>
                    <p className="text-[11px] text-muted-foreground mb-4">
                        Configure quais ações o CRM deve executar automaticamente ao receber um lead da Meta.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {([
                            { key: 'autoCreateContact' as const, icon: User, label: 'Criar Pessoa', desc: 'Cria um novo contato no CRM' },
                            { key: 'autoCreateCompany' as const, icon: Building2, label: 'Criar Organização', desc: 'Cria a empresa do contato' },
                            { key: 'autoCreateDeal' as const, icon: Briefcase, label: 'Criar Negócio', desc: 'Cria um novo negócio no pipeline' },
                            { key: 'autoRegisterHistory' as const, icon: History, label: 'Registrar Histórico', desc: 'Adiciona evento ao timeline do negócio' },
                            { key: 'autoCreateActivity' as const, icon: CalendarPlus, label: 'Criar primeira Atividade', desc: 'Agenda tarefa para contactar o lead' },
                            { key: 'autoStartCadence' as const, icon: Workflow, label: 'Iniciar Cadência', desc: 'Inicia sequência automática de follow-up' },
                        ]).map(({ key, icon: Icon, label, desc }) => (
                            <button
                                key={key}
                                onClick={() => updateSetting(key, !settings[key])}
                                className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${settings[key]
                                    ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
                                    : 'border-border bg-zinc-50/50 dark:bg-zinc-900/20 opacity-60'
                                }`}
                            >
                                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${settings[key]
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                                }`}>
                                    <Icon size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-foreground">{label}</span>
                                        <div className={`w-7 h-4 rounded-full relative transition-colors ${settings[key] ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${settings[key] ? 'right-0.5' : 'left-0.5'}`} />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-lg shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                        {isSavingSettings ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                        Salvar Automações
                    </button>
                </div>

                {/* ═══ 5. Test Integration ═══ */}
                {isConnected && (
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                            <Play size={16} className="text-primary" />
                            Testar Integração
                        </h2>

                        {/* CAPI Test Event Code input */}
                        {settings.capiEnabled && (
                            <div className="mb-4 max-w-sm">
                                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Código de Evento de Teste (CAPI)</label>
                                <input
                                    type="text"
                                    value={testEventCode}
                                    onChange={e => setTestEventCode(e.target.value)}
                                    placeholder="Ex: TEST12345"
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary transition-colors"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Insira o código que aparece na aba <b>Eventos de teste</b> do Gerenciador de Eventos para acompanhar em tempo real.
                                </p>
                            </div>
                        )}

                        <button
                            onClick={handleTest}
                            disabled={isTesting}
                            className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-lg shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-2"
                        >
                            {isTesting ? (
                                <><RefreshCw size={14} className="animate-spin" /> Testando...</>
                            ) : (
                                <><Play size={14} /> Testar Integração</>
                            )}
                        </button>

                        {testResult && (
                            <div className={`mt-4 rounded-lg border p-4 ${testResult.success
                                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/10'
                                : 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10'
                            }`}>
                                <div className="flex items-center gap-2 mb-3">
                                    {testResult.success
                                        ? <CheckCircle2 size={16} className="text-emerald-600" />
                                        : <XCircle size={16} className="text-red-600" />
                                    }
                                    <span className={`text-xs font-bold ${testResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                        {testResult.success ? 'Teste concluído com sucesso' : 'Teste falhou'}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                        {testResult.totalTimeMs}ms
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    {testResult.steps.map((step, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            {step.status === 'success' ? (
                                                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                                            ) : step.status === 'error' ? (
                                                <XCircle size={12} className="text-red-500 shrink-0" />
                                            ) : (
                                                <Clock size={12} className="text-zinc-400 shrink-0" />
                                            )}
                                            <span className="font-medium text-foreground">{step.name}</span>
                                            <span className="text-muted-foreground ml-auto text-[10px]">{step.message}</span>
                                        </div>
                                    ))}
                                </div>

                                {testResult.processingResult && (
                                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {[
                                            { label: 'Pipeline', value: testResult.processingResult.pipelineId },
                                            { label: 'Etapa', value: testResult.processingResult.stageId },
                                            { label: 'Origem', value: testResult.processingResult.source },
                                            { label: 'Processamento', value: `${testResult.processingResult.processingTimeMs}ms` },
                                        ].map(({ label, value }) => (
                                            <div key={label} className="text-[10px]">
                                                <span className="text-muted-foreground">{label}: </span>
                                                <span className="font-semibold text-foreground">{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ 6. Logs ═══ */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <ClipboardList size={16} className="text-primary" />
                            Logs da Integração
                        </h2>
                        <div className="flex items-center gap-2">
                            <Filter size={12} className="text-muted-foreground" />
                            <select
                                value={logFilter}
                                onChange={e => setLogFilter(e.target.value)}
                                className="text-[10px] bg-background border border-border rounded-md px-2 py-1 outline-none focus:border-primary"
                            >
                                <option value="">Todos</option>
                                {Object.entries(eventTypeLabels).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {filteredLogs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum log registrado.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-2 px-2 text-[10px] font-bold text-muted-foreground uppercase">Status</th>
                                        <th className="text-left py-2 px-2 text-[10px] font-bold text-muted-foreground uppercase">Tipo</th>
                                        <th className="text-left py-2 px-2 text-[10px] font-bold text-muted-foreground uppercase">Mensagem</th>
                                        <th className="text-left py-2 px-2 text-[10px] font-bold text-muted-foreground uppercase">Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map(log => (
                                        <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                            <td className="py-2 px-2">{statusIcons[log.status] || statusIcons.warning}</td>
                                            <td className="py-2 px-2">
                                                <span className="text-[10px] font-semibold text-foreground">
                                                    {eventTypeLabels[log.eventType] || log.eventType}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-muted-foreground max-w-[300px] truncate">{log.message}</td>
                                            <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
