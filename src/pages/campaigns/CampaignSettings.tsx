import { useState } from 'react';
import { Plus, ShieldCheck, UserX, Send, Trash2, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';

type Tab = 'senders' | 'unsubscribe' | 'domain';

export default function CampaignSettings() {
    const { campaignSenders, addCampaignSender, deleteCampaignSender, verifySender } = useCRM();
    const [activeTab, setActiveTab] = useState<Tab>('senders');
    const [isAddingSender, setIsAddingSender] = useState(false);
    const [newSender, setNewSender] = useState({ name: '', email: '' });
    const [isTestingSMTP, setIsTestingSMTP] = useState(false);
    const [smtpResult, setSmtpResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

    const handleAddSender = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addCampaignSender(newSender);
            setIsAddingSender(false);
            setNewSender({ name: '', email: '' });
        } catch (error) {
            console.error(error);
        }
    };

    const handleTestSMTP = async () => {
        setIsTestingSMTP(true);
        setSmtpResult(null);
        try {
            const { supabase } = await import('@/lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Não autenticado.");

            const res = await fetch('http://localhost:3001/api/test-smtp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                setSmtpResult({ success: true, message: 'SMTP conectado com sucesso.', details: data.messageId });
            } else {
                const error = await res.json();
                setSmtpResult({ success: false, message: 'Falha na conexão SMTP.', details: error.error || error.details });
            }
        } catch (error: any) {
            console.error('SMTP test error:', error);
            setSmtpResult({ success: false, message: 'Erro ao tentar testar SMTP.', details: error.message });
        } finally {
            setIsTestingSMTP(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Page Header */}
            <div className="bg-white dark:bg-card border-b border-border px-6 pt-6 shrink-0">
                <h1 className="text-2xl font-bold text-foreground mb-6">Configurações do Campaigns</h1>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-8 -mb-px">
                    <button
                        onClick={() => setActiveTab('senders')}
                        className={`pb-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'senders'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Remetentes
                    </button>
                    <button
                        onClick={() => setActiveTab('unsubscribe')}
                        className={`pb-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'unsubscribe'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Fluxo de cancelamento de assinatura
                    </button>
                    <button
                        onClick={() => setActiveTab('domain')}
                        className={`pb-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'domain'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Autenticação de domínio
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto bg-[#F9FAFB] dark:bg-slate-950/20 p-8">
                {activeTab === 'senders' ? (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-end mb-6 gap-3">
                            <button
                                onClick={handleTestSMTP}
                                disabled={isTestingSMTP}
                                className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 px-4 py-2 rounded font-bold text-sm transition-all shadow-sm"
                            >
                                {isTestingSMTP ? <span className="animate-spin text-lg">⚙️</span> : <Mail size={18} />}
                                {isTestingSMTP ? 'Testando...' : 'Testar SMTP'}
                            </button>
                            <button
                                onClick={() => setIsAddingSender(true)}
                                className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#1eb054] text-white px-4 py-2 rounded font-bold text-sm transition-all shadow-lg shadow-emerald-500/10"
                            >
                                <Plus size={18} />
                                Remetente
                            </button>
                        </div>

                        {smtpResult && (
                            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${smtpResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                                {smtpResult.success ? <CheckCircle2 size={20} className="mt-0.5 shrink-0" /> : <AlertCircle size={20} className="mt-0.5 shrink-0" />}
                                <div>
                                    <h3 className="font-bold">{smtpResult.message}</h3>
                                    {smtpResult.details && <p className="text-xs mt-1 opacity-80 font-mono break-all">{smtpResult.details}</p>}
                                </div>
                            </div>
                        )}

                        {campaignSenders.length === 0 ? (
                            <div className="bg-white dark:bg-card border border-border rounded-2xl p-12 flex flex-col items-center text-center shadow-sm">
                                <div className="w-64 h-64 relative mb-8">
                                    <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900/10 rounded-full animate-pulse" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="relative">
                                            <Send size={80} className="text-blue-500 transform -rotate-12 translate-y-4" />
                                            <div className="absolute -top-4 -right-4 w-12 h-12 bg-white dark:bg-slate-900 rounded-xl shadow-xl flex items-center justify-center text-emerald-500 border border-border">
                                                <ShieldCheck size={24} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h2 className="text-2xl font-bold text-foreground mb-3">Adicione informações do remetente para começar a enviar campanhas</h2>
                                <p className="text-muted-foreground text-sm max-w-lg leading-relaxed mb-8">
                                    Você pode configurar vários remetentes para fins diferentes. Os remetentes estarão disponíveis para todos os usuários que enviarem campanhas de marketing.
                                </p>

                                <button
                                    onClick={() => setIsAddingSender(true)}
                                    className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#1eb054] text-white px-8 py-3 rounded-lg font-bold transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                                >
                                    <Plus size={18} />
                                    Adicionar remetente
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-card border border-border rounded-xl divide-y divide-border overflow-hidden shadow-sm">
                                {campaignSenders.map(sender => (
                                    <div key={sender.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                                <Mail size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-foreground">{sender.name}</h4>
                                                    {sender.isVerified ? (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                            <CheckCircle2 size={10} />
                                                            VERIFICADO
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                            <AlertCircle size={10} />
                                                            PENDENTE
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{sender.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {!sender.isVerified && (
                                                <button
                                                    onClick={() => verifySender(sender.id)}
                                                    className="text-xs font-bold text-primary hover:underline"
                                                >
                                                    Verificar agora
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteCampaignSender(sender.id)}
                                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'unsubscribe' ? (
                    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20 text-center opacity-60">
                        <UserX size={64} className="text-muted-foreground mb-4" />
                        <h3 className="text-lg font-bold text-foreground">Gerencie o fluxo de unsubscribe</h3>
                        <p className="text-sm text-muted-foreground mt-2">Personalize a experiência dos seus usuários ao cancelarem a assinatura.</p>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20 text-center opacity-60">
                        <ShieldCheck size={64} className="text-muted-foreground mb-4" />
                        <h3 className="text-lg font-bold text-foreground">Verificação de domínio em breve</h3>
                        <p className="text-sm text-muted-foreground mt-2">Melhore sua entregabilidade configurando SPF, DKIM e DMARC.</p>
                    </div>
                )}
            </div>
            {/* Add Sender Modal Overlay */}
            {isAddingSender && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border">
                            <h3 className="text-xl font-bold text-foreground">Adicionar novo remetente</h3>
                        </div>
                        <form onSubmit={handleAddSender} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">Nome do remetente</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Philipe Coelho"
                                    className="w-full px-4 py-2 bg-muted/40 border border-border rounded-lg outline-none focus:border-primary transition-all"
                                    value={newSender.name}
                                    onChange={e => setNewSender(prev => ({ ...prev, name: e.target.value }))}
                                />
                                <p className="text-[10px] text-muted-foreground italic">Este nome aparecerá no campo "De:" dos seus e-mails.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-foreground">E-mail do remetente</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="philipe@exemplo.com"
                                    className="w-full px-4 py-2 bg-muted/40 border border-border rounded-lg outline-none focus:border-primary transition-all"
                                    value={newSender.email}
                                    onChange={e => setNewSender(prev => ({ ...prev, email: e.target.value }))}
                                />
                                <p className="text-[10px] text-muted-foreground italic">Você precisará verificar a propriedade deste e-mail.</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingSender(false)}
                                    className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg font-bold hover:bg-muted transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-[#22C55E] text-white rounded-lg font-bold hover:bg-[#1eb054] transition-all"
                                >
                                    Adicionar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
