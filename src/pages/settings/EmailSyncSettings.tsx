import { useState, useEffect } from 'react';
import { Mail, Plus, Trash2, CheckCircle2, RefreshCw, Settings, Shield, Globe, Lock, AlertCircle } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/lib/supabase';

// Mock providers for UI
const PROVIDERS = [
    { id: 'gmail', name: 'Gmail', icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968534.png' }, // Placeholder for now, maybe use text or SVG
    { id: 'outlook', name: 'Outlook / Office 365', icon: 'https://cdn-icons-png.flaticon.com/512/732/732221.png' },
    { id: 'exchange', name: 'Microsoft Exchange', icon: 'https://cdn-icons-png.flaticon.com/512/732/732221.png' }, // Same icon for simplicity
    { id: 'yahoo', name: 'Yahoo', icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968636.png' },
    { id: 'icloud', name: 'iCloud', icon: 'https://cdn-icons-png.flaticon.com/512/831/831276.png' },
    { id: 'other', name: 'Outro (IMAP)', icon: null },
];

export default function EmailSyncSettings() {
    const { user } = useSupabaseAuth(); // Real auth
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [step, setStep] = useState(1); // 1: Provider, 2: Auth (Mock), 3: Options

    // IMAP State
    const [imapConfig, setImapConfig] = useState({ user: '', password: '', host: '', port: 993 });
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch accounts on load
    useEffect(() => {
        if (user) {
            fetchAccounts();
        }
    }, [user]);

    const fetchAccounts = async () => {
        const { data, error } = await supabase
            .from('email_accounts')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setAccounts(data);
        }
    };

    // Generic Options State
    const [syncOptions, setSyncOptions] = useState({
        syncStart: '1month',
        syncLabels: 'all',
        syncSent: true,
        archiveInCrm: false,
        deleteSync: false,
        trackingOpen: true,
        trackingClick: true,
        autoLink: true,
    });

    const resetForm = () => {
        setIsAdding(false);
        setStep(1);
        setImapConfig({ user: '', password: '', host: '', port: 993 });
        setVerificationError(null);
    };

    const handleVerifyImap = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        setVerificationError(null);

        try {
            const response = await fetch('/api/imap/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(imapConfig)
            });

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error("Non-JSON response:", text);
                throw new Error("O servidor retornou uma resposta inválida. Verifique se o backend está rodando na porta 3001.");
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.details || data.error || 'Falha na verificação');
            }

            // Success
            setStep(3);
        } catch (err: any) {
            console.error(err);
            setVerificationError(err.message || 'Erro ao conectar com o servidor IMAP.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sessão não encontrada");

            // Use the SECURE backend endpoint for encryption
            const response = await fetch('/api/imap/add-account', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    email: imapConfig.user,
                    password: imapConfig.password,
                    host: imapConfig.host,
                    port: imapConfig.port,
                    tls: true,
                    name: imapConfig.user // Default name
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.details || errData.error || 'Erro ao salvar conta');
            }

            const { data: newAccount } = await response.json();

            // Trigger initial sync
            fetch('/api/imap/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ accountId: newAccount.id })
            }).catch(e => console.error('Initial sync trigger failed:', e));

            await fetchAccounts();
            resetForm();
        } catch (error: any) {
            console.error('Error saving account:', error);
            alert(`Erro ao salvar conta: ${error.message || 'Erro desconhecido'}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#F9FAFB] dark:bg-background">
            {/* Header */}
            <header className="bg-white dark:bg-card border-b border-border px-8 py-6 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Sincronização de E-mail</h1>
                    <p className="text-muted-foreground mt-1">Conecte sua conta de e-mail para enviar e receber mensagens dentro do CRM.</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                    <Plus size={18} />
                    Adicionar nova conta
                </button>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-auto p-8">
                <div className="max-w-4xl mx-auto space-y-6">

                    {/* General Info Card */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-6 flex gap-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg h-fit text-blue-600 dark:text-blue-200">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Privacidade e Segurança</h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                                A sincronização de e-mail é segura e privada. Mensagens sincronizadas são visíveis apenas para você, a menos que compartilhe.
                                O CRM não altera seus e-mails no servidor original.
                            </p>
                        </div>
                    </div>

                    {/* Connected Accounts List */}
                    <div className="bg-white dark:bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                            <h2 className="font-semibold text-foreground flex items-center gap-2">
                                <Mail size={18} className="text-muted-foreground" />
                                Contas Conectadas
                            </h2>
                            <span className="text-xs font-medium bg-muted px-2 py-1 rounded-full text-muted-foreground">
                                {accounts.length} {accounts.length === 1 ? 'conta' : 'contas'}
                            </span>
                        </div>

                        {accounts.length === 0 ? (
                            <div className="p-12 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                    <Mail size={32} className="text-muted-foreground/50" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma conta conectada</h3>
                                <p className="text-muted-foreground max-w-sm mb-6">
                                    Adicione uma conta de e-mail para rastrear conversas, vincular a negócios e centralizar sua comunicação.
                                </p>
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="text-primary font-medium hover:underline"
                                >
                                    Conectar primeira conta
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {accounts.map((acc) => (
                                    <div key={acc.id} className="p-6 flex items-center justify-between hover:bg-muted/20 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                                                <CheckCircle2 size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium text-foreground">{acc.email}</h4>
                                                    <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                        {acc.provider || 'IMAP'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <RefreshCw size={10} /> Sincronizado: {new Date(acc.lastSync).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors" title="Configurações">
                                                <Settings size={18} />
                                            </button>
                                            <button
                                                onClick={() => setAccounts(accounts.filter(a => a.id !== acc.id))}
                                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Remover conta"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Smart BCC Section */}
                    <div className="bg-white dark:bg-card border border-border rounded-xl shadow-sm p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary rounded-lg mt-1">
                                <Lock size={20} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-foreground mb-1">Smart Bcc</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Copie este endereço para o campo CCO (Bcc) de qualquer e-mail enviado externamente para anexá-lo automaticamente ao CRM.
                                </p>
                                <div className="flex items-center gap-2">
                                    <code className="bg-muted px-3 py-2 rounded-lg text-sm font-mono text-foreground border border-border select-all">
                                        empresa@pipedrivemail.com
                                    </code>
                                    <button className="text-sm font-medium text-primary hover:underline">Copiar</button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            {/* Add Account Modal */}
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-card w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">
                                {step === 1 && 'Escolha seu provedor de e-mail'}
                                {step === 2 && 'Configurar IMAP'}
                                {step === 3 && 'Opções de Sincronização'}
                            </h3>
                            <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                                <XIcon />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto">
                            {step === 1 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {PROVIDERS.map(provider => (
                                        <button
                                            key={provider.id}
                                            onClick={() => { setStep(2); }}
                                            className="flex items-center p-4 border border-border rounded-lg hover:border-primary hover:bg-muted/50 transition-all text-left gap-4 group"
                                        >
                                            <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-full group-hover:bg-white dark:group-hover:bg-[#1A1A1A] transition-colors">
                                                {provider.icon ? (
                                                    <img src={provider.icon} alt={provider.name} className="w-5 h-5 opacity-80 group-hover:opacity-100" />
                                                ) : (
                                                    <Globe size={20} className="text-muted-foreground" />
                                                )}
                                            </div>
                                            <span className="font-medium text-foreground">{provider.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {step === 2 && (
                                <form id="imap-form" onSubmit={handleVerifyImap} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-foreground">E-mail</label>
                                        <input
                                            type="email"
                                            required
                                            value={imapConfig.user}
                                            onChange={e => setImapConfig({ ...imapConfig, user: e.target.value })}
                                            className="w-full px-3 py-2 border border-border rounded-lg bg-background outline-none focus:border-primary"
                                            placeholder="seunome@empresa.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-foreground">Senha</label>
                                        <input
                                            type="password"
                                            required
                                            value={imapConfig.password}
                                            onChange={e => setImapConfig({ ...imapConfig, password: e.target.value })}
                                            className="w-full px-3 py-2 border border-border rounded-lg bg-background outline-none focus:border-primary"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-foreground">Host IMAP</label>
                                            <input
                                                type="text"
                                                required
                                                value={imapConfig.host}
                                                onChange={e => setImapConfig({ ...imapConfig, host: e.target.value })}
                                                className="w-full px-3 py-2 border border-border rounded-lg bg-background outline-none focus:border-primary"
                                                placeholder="imap.gmail.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-foreground">Porta</label>
                                            <input
                                                type="number"
                                                required
                                                value={imapConfig.port}
                                                onChange={e => setImapConfig({ ...imapConfig, port: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 border border-border rounded-lg bg-background outline-none focus:border-primary"
                                                placeholder="993"
                                            />
                                        </div>
                                    </div>

                                    {verificationError && (
                                        <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-start gap-2">
                                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                            <span>{verificationError}</span>
                                        </div>
                                    )}
                                </form>
                            )}

                            {step === 3 && (
                                <div className="space-y-6">
                                    {/* Sync Scope */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-bold text-foreground block">Período de Sincronização</label>
                                        <select
                                            value={syncOptions.syncStart}
                                            onChange={(e) => setSyncOptions({ ...syncOptions, syncStart: e.target.value })}
                                            className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
                                        >
                                            <option value="1month">Último mês</option>
                                            <option value="3months">Últimos 3 meses</option>
                                            <option value="6months">Últimos 6 meses</option>
                                            <option value="all">Todo o histórico</option>
                                        </select>
                                    </div>

                                    {/* Folders */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-bold text-foreground block">Quais e-mails sincronizar?</label>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="syncLabels"
                                                    checked={syncOptions.syncLabels === 'all'}
                                                    onChange={() => setSyncOptions({ ...syncOptions, syncLabels: 'all' })}
                                                    className="accent-primary"
                                                />
                                                Todos os e-mails
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="syncLabels"
                                                    checked={syncOptions.syncLabels === 'specific'}
                                                    onChange={() => setSyncOptions({ ...syncOptions, syncLabels: 'specific' })}
                                                    className="accent-primary"
                                                />
                                                Apenas rótulos específicos
                                            </label>
                                        </div>
                                    </div>

                                    {/* Toggles */}
                                    <div className="space-y-4 pt-4 border-t border-border">
                                        <ToggleOption
                                            label="Sincronizar e-mails enviados"
                                            desc="Importar e-mails que você enviou fora do CRM"
                                            checked={syncOptions.syncSent}
                                            onChange={(v) => setSyncOptions({ ...syncOptions, syncSent: v })}
                                        />
                                        <ToggleOption
                                            label="Vincular automaticamente a negócios e contatos"
                                            desc="O CRM tentará encontrar a pessoa ou negócio correspondente"
                                            checked={syncOptions.autoLink}
                                            onChange={(v) => setSyncOptions({ ...syncOptions, autoLink: v })}
                                        />
                                        <ToggleOption
                                            label="Rastreamento de abertura e cliques"
                                            desc="Adicionar pixel de rastreamento aos e-mails enviados pelo CRM"
                                            checked={syncOptions.trackingOpen}
                                            onChange={(v) => setSyncOptions({ ...syncOptions, trackingOpen: v })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-muted/30 border-t border-border flex justify-end gap-3">
                            <button
                                onClick={resetForm}
                                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            {step === 2 && (
                                <button
                                    form="imap-form"
                                    disabled={isVerifying}
                                    type="submit"
                                    className="px-6 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                                >
                                    {isVerifying ? <RefreshCw className="animate-spin" size={16} /> : null}
                                    {isVerifying ? 'Verificando...' : 'Verificar Conexão'}
                                </button>
                            )}
                            {step === 3 && (
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-6 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                                >
                                    {isSaving ? <RefreshCw className="animate-spin" size={16} /> : null}
                                    {isSaving ? 'Salvando...' : 'Iniciar Sincronização'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Icon Helper
function XIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
    )
}

function ToggleOption({ label, desc, checked, onChange }: { label: string, desc: string, checked: boolean, onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-start justify-between">
            <div>
                <span className="text-sm font-medium text-foreground block">{label}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${checked ? 'left-6' : 'left-1'}`} />
            </button>
        </div>
    )
}
