import { useState } from 'react';
import { Plus, ShieldCheck, UserX, Send } from 'lucide-react';

type Tab = 'senders' | 'unsubscribe' | 'domain';

export default function CampaignSettings() {
    const [activeTab, setActiveTab] = useState<Tab>('senders');

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
                        <div className="flex justify-end mb-6">
                            <button className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#1eb054] text-white px-4 py-2 rounded font-bold text-sm transition-all shadow-lg shadow-emerald-500/10">
                                <Plus size={18} />
                                Remetente
                            </button>
                        </div>

                        {/* Empty State Senders */}
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

                            <button className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#1eb054] text-white px-8 py-3 rounded-lg font-bold transition-all shadow-xl shadow-emerald-500/20 active:scale-95">
                                <Plus size={18} />
                                Adicionar remetente
                            </button>
                        </div>
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
        </div>
    );
}
