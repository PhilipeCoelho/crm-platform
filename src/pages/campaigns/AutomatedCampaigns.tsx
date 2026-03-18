import { Plus, Bot, Mail } from 'lucide-react';

export default function AutomatedCampaigns() {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Page Header */}
            <div className="bg-white dark:bg-card border-b border-border p-6 flex flex-row justify-between items-center shrink-0">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-foreground">Campanhas automatizadas</h1>
                    <p className="text-muted-foreground text-sm font-medium">Automatize seu fluxo de trabalho de marketing por e-mail.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 border border-border px-4 py-2 rounded font-bold text-sm bg-white dark:bg-card hover:bg-muted/50 transition-colors">
                        <Bot size={18} className="text-primary" />
                        Usar modelo de automação
                    </button>
                    <button className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#1eb054] text-white px-4 py-2 rounded font-bold text-sm transition-all shadow-lg shadow-emerald-500/10">
                        <Plus size={18} />
                        Campanha
                    </button>
                </div>
            </div>

            {/* Empty State */}
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#F9FAFB] dark:bg-background/20 overflow-y-auto">
                <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in- duration-500">
                    <div className="relative mx-auto w-64 h-64 bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center border-2 border-dashed border-blue-200 dark:border-blue-800">
                        <div className="absolute inset-0 flex items-center justify-center animate-bounce-slow">
                            <Bot size={120} className="text-blue-500 opacity-20" />
                        </div>
                        <div className="relative flex flex-col items-center">
                            <div className="w-20 h-20 rounded-2xl bg-white dark:bg-card shadow-xl flex items-center justify-center text-blue-500 mb-4 border border-border">
                                <Mail size={40} />
                            </div>
                            <div className="flex gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse delay-75" />
                                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse delay-150" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-2xl font-bold text-foreground">Configure campanhas de e-mail automatizadas e economize tempo</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Crie fluxos de trabalho que enviam e-mails marketing automaticamente com base em ações do CRM.
                            Comece criando sua primeira <span className="text-primary hover:underline cursor-pointer font-semibold underline-offset-4 decoration-2">campanha</span> compatível com automações.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                        <button className="bg-[#22C55E] hover:bg-[#1eb054] text-white px-8 py-3 rounded-lg font-bold transition-all shadow-xl shadow-emerald-500/20 active:scale-95">
                            Criar primeira automação
                        </button>
                        <p className="text-xs text-muted-foreground">
                            Precisa de ajuda? <span className="text-primary hover:underline cursor-pointer font-medium">Veja nossos modelos</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
