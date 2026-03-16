import { useState, useEffect } from 'react';
import {
    Inbox,
    Send,
    FileText,
    Archive,
    Plus,
    Search,
    RefreshCcw,
    Filter,
    Settings,
    CheckSquare,
    Mail,
    Shield,
    ChevronRight,
    Loader2,
    X,
    MoreHorizontal,
    Check
} from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/lib/supabase';
import EmailSyncSettings from '../settings/EmailSyncSettings';

// Types for the Inbox
interface EmailThread {
    id: string;
    sender_name: string;
    sender_avatar?: string;
    subject: string;
    preview: string;
    timestamp: string;
    is_unread: boolean;
    is_private: boolean;
    has_attachments: boolean;
}

export default function EmailInbox() {
    const { user } = useSupabaseAuth();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [threads, setThreads] = useState<EmailThread[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [activeFolder, setActiveFolder] = useState('inbox');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedThreads, setSelectedThreads] = useState<string[]>([]);

    useEffect(() => {
        if (user) {
            checkAndFetch();
        }
    }, [user]);

    const checkAndFetch = async () => {
        setIsLoading(true);
        try {
            // 1. Check Accounts
            const { data: accs, error: accError } = await supabase
                .from('email_accounts')
                .select('*')
                .eq('user_id', user?.id);

            if (accError) throw accError;
            setAccounts(accs || []);

            if (accs && accs.length > 0) {
                // 2. Fetch real emails
                await fetchThreads();

                // 3. If no emails yet, trigger an initial sync
                const { count } = await supabase
                    .from('emails')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user?.id);

                if (!count || count === 0) {
                    triggerSync(accs[0].id);
                }
            }
        } catch (err) {
            console.error('Error checking accounts:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchThreads = async () => {
        try {
            const { data: emails, error } = await supabase
                .from('emails')
                .select('*')
                .eq('user_id', user?.id)
                .order('received_at', { ascending: false });

            if (error) throw error;

            // Map emails to threads (simplified for now as 1 email = 1 row)
            const mapped: EmailThread[] = (emails || []).map(e => ({
                id: e.id,
                sender_name: e.from_address?.name || e.from_address?.email,
                subject: e.subject || '(Sem assunto)',
                preview: e.body_text?.substring(0, 100) || '',
                timestamp: new Date(e.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                is_unread: !e.is_read,
                is_private: false,
                has_attachments: false
            }));
            setThreads(mapped);
        } catch (err) {
            console.error('Error fetching threads:', err);
        }
    };

    const triggerSync = async (accountId?: string) => {
        const id = accountId || accounts[0]?.id;
        if (!id) return;

        setIsSyncing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch('/api/imap/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ accountId: id })
            });

            if (response.ok) {
                await fetchThreads();
            }
        } catch (err) {
            console.error('Sync failed:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-background text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm font-medium">Carregando sua caixa de entrada...</span>
                </div>
            </div>
        );
    }

    // STATE 1: Not Configured
    if (accounts.length === 0 && !showSettings) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center">
                <div className="max-w-2xl w-full bg-white dark:bg-card border border-border rounded-3xl p-12 shadow-xl shadow-slate-200/50 dark:shadow-none">
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-bounce-subtle">
                        <Mail className="w-10 h-10 text-primary" strokeWidth={1.5} />
                    </div>

                    <h2 className="text-3xl font-bold text-foreground mb-4">Caixa de Entrada de Vendas</h2>
                    <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                        Centralize suas comunicações. Conecte seu e-mail para rastrear conversas, vincular a negócios e nunca perder um follow-up.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-left text-sm">
                        <div className="space-y-2">
                            <div className="font-bold text-foreground flex items-center gap-2">
                                <Shield className="w-4 h-4 text-green-500" />
                                Seguro e Privado
                            </div>
                            <p className="text-muted-foreground">Você decide quais e-mails são visíveis para a equipe.</p>
                        </div>
                        <div className="space-y-2">
                            <div className="font-bold text-foreground flex items-center gap-2">
                                <RefreshCcw className="w-4 h-4 text-blue-500" />
                                Link Automático
                            </div>
                            <p className="text-muted-foreground">E-mails são automaticamente ligados a contatos e negócios.</p>
                        </div>
                        <div className="space-y-2">
                            <div className="font-bold text-foreground flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-primary" />
                                Histórico Completo
                            </div>
                            <p className="text-muted-foreground">Veja toda a jornada do cliente em uma única timeline.</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowSettings(true)}
                        className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-primary/25 transition-all flex items-center justify-center gap-2 group"
                    >
                        Configurar agora mesmo
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <p className="mt-6 text-xs text-muted-foreground">
                        Suporte completo para Gmail, Outlook, Office 365 e qualquer servidor IMAP.
                    </p>
                </div>
            </div>
        );
    }

    // Render configuration UI inside Inbox context if requested
    if (showSettings) {
        return (
            <div className="h-full flex flex-col bg-background">
                <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-bold">Configurações de E-mail</h2>
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    <EmailSyncSettings />
                </div>
            </div>
        );
    }

    // STATE 2: Configured (Dashboard)
    return (
        <div className="h-full flex bg-[#F8F9FA] dark:bg-slate-950 overflow-hidden">

            {/* Folder Sidebar (A) */}
            <aside className="w-64 border-r border-border bg-white dark:bg-slate-900 flex flex-col shrink-0">
                <div className="p-4">
                    <button className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all">
                        <Plus className="w-5 h-5" />
                        Novo e-mail
                    </button>
                </div>

                <nav className="flex-1 px-2 space-y-1">
                    <FolderItem
                        icon={<Inbox className="w-4 h-4" />}
                        label="Caixa de entrada"
                        count={3}
                        active={activeFolder === 'inbox'}
                        onClick={() => setActiveFolder('inbox')}
                    />
                    <FolderItem
                        icon={<FileText className="w-4 h-4" />}
                        label="Rascunhos"
                        count={0}
                        active={activeFolder === 'drafts'}
                        onClick={() => setActiveFolder('drafts')}
                    />
                    <FolderItem
                        icon={<RefreshCcw className="w-4 h-4 rotate-180" />}
                        label="Caixa de saída"
                        count={0}
                        active={activeFolder === 'outbox'}
                        onClick={() => setActiveFolder('outbox')}
                    />
                    <FolderItem
                        icon={<Send className="w-4 h-4" />}
                        label="Enviados"
                        count={42}
                        active={activeFolder === 'sent'}
                        onClick={() => setActiveFolder('sent')}
                    />
                    <FolderItem
                        icon={<Archive className="w-4 h-4" />}
                        label="Arquivo"
                        count={0}
                        active={activeFolder === 'archive'}
                        onClick={() => setActiveFolder('archive')}
                    />
                </nav>

                <div className="p-4 mt-auto border-t border-border">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                        <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Caixa de Equipe</div>
                        <p className="text-[11px] text-muted-foreground mb-3 leading-tight">
                            Colabore com sua equipe em conversas compartilhadas.
                        </p>
                        <button className="w-full text-xs font-bold text-primary hover:bg-primary/5 py-2 rounded-lg transition-colors border border-primary/20">
                            Ativar agora
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Area (B + C) */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* Header (B) */}
                <header className="h-16 border-b border-border bg-white dark:bg-slate-900 px-6 flex items-center justify-between gap-4">
                    <div className="flex-1 max-w-2xl relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por assunto, remetente ou conteúdo..."
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 ring-primary/20 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {isSyncing && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full animate-pulse">
                                <RefreshCcw className="w-3 h-3 text-primary animate-spin" />
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Sincronizando...</span>
                            </div>
                        )}
                        <button
                            onClick={() => triggerSync()}
                            disabled={isSyncing}
                            className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground disabled:opacity-50"
                            title="Atualizar"
                        >
                            <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        </button>
                        <button className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground" title="Filtros">
                            <Filter className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground" title="Configurações"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Bulk Actions (Conditional) */}
                {selectedThreads.length > 0 && (
                    <div className="bg-primary/5 border-b border-primary/10 px-6 py-2 flex items-center gap-4 animate-in slide-in-from-top duration-200">
                        <span className="text-sm font-bold text-primary">
                            {selectedThreads.length} selecionados
                        </span>
                        <div className="h-4 w-px bg-primary/20" />
                        <button className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <Archive className="w-4 h-4" /> Arquivar
                        </button>
                        <button className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <Mail className="w-4 h-4" /> Marcar como lido
                        </button>
                        <button className="text-sm font-medium hover:text-red-500 transition-colors flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <X className="w-4 h-4" /> Excluir
                        </button>
                    </div>
                )}

                {/* Email List (C) */}
                <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 border-l border-border m-4 rounded-3xl shadow-sm border relative">
                    {threads.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                {isSyncing ? (
                                    <RefreshCcw className="w-8 h-8 text-primary animate-spin" />
                                ) : (
                                    <Inbox className="w-8 h-8 text-muted-foreground/30" />
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-2">
                                {isSyncing ? 'Buscando seus e-mails...' : 'Tudo limpo por aqui!'}
                            </h3>
                            <p className="text-muted-foreground max-w-sm">
                                {isSyncing
                                    ? 'Isso pode levar alguns minutos na primeira sincronização.'
                                    : 'Sua caixa de entrada está vazia. Novos e-mails aparecerão aqui assim que entrarem.'}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {threads.map((thread: EmailThread) => (
                                <EmailRow
                                    key={thread.id}
                                    thread={thread}
                                    isSelected={selectedThreads.includes(thread.id)}
                                    onSelect={(selected) => {
                                        if (selected) setSelectedThreads([...selectedThreads, thread.id]);
                                        else setSelectedThreads(selectedThreads.filter(id => id !== thread.id));
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

// Sub-components

function FolderItem({ icon, label, count, active, onClick }: {
    icon: React.ReactNode,
    label: string,
    count: number,
    active: boolean,
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${active
                ? 'bg-primary/10 text-primary font-bold shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
        >
            <div className="flex items-center gap-3">
                <span className={active ? 'text-primary font-bold' : ''}>{icon}</span>
                <span className="text-sm">{label}</span>
            </div>
            {count > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                    {count}
                </span>
            )}
        </button>
    );
}

function EmailRow({ thread, isSelected, onSelect }: {
    thread: EmailThread,
    isSelected: boolean,
    onSelect: (v: boolean) => void
}) {
    return (
        <div className={`group flex items-center gap-4 px-6 py-4 border-b border-border hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${thread.is_unread ? 'bg-primary/5 dark:bg-primary/5' : ''}`}>
            {/* Selection */}
            <div
                className="shrink-0"
                onClick={(e) => { e.stopPropagation(); onSelect(!isSelected); }}
            >
                {isSelected ? (
                    <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                ) : (
                    <div className="w-5 h-5 border-2 border-slate-200 dark:border-slate-700 rounded group-hover:border-primary/50 transition-colors" />
                )}
            </div>

            {/* Avatar / Icon */}
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-border group-hover:shadow-md transition-shadow">
                {thread.sender_avatar ? (
                    <img src={thread.sender_avatar} alt="" />
                ) : (
                    <span className="text-sm font-bold text-slate-500">{thread.sender_name[0]}</span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-4">
                    <span className={`text-sm truncate ${thread.is_unread ? 'font-bold text-foreground' : 'text-slate-600 dark:text-slate-400'}`}>
                        {thread.sender_name}
                    </span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {thread.timestamp}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-sm truncate ${thread.is_unread ? 'font-bold text-foreground' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                        {thread.subject}
                    </span>
                    {thread.is_private && <Shield className="w-3 h-3 text-red-400 shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground truncate leading-relaxed">
                    {thread.preview}
                </p>
            </div>

            {/* Hover Actions */}
            <div className="hidden group-hover:flex items-center gap-1 pl-4 animate-in fade-in slide-in-from-right-2 duration-150">
                <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-muted-foreground" title="Arquivar">
                    <Archive className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-muted-foreground" title="Marcar como lido">
                    <Mail className="w-4 h-4" />
                </button>
                <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-muted-foreground">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
