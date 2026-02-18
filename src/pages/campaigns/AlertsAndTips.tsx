import { Info, ChevronRight, Bell } from 'lucide-react';

export default function AlertsAndTips() {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Page Header */}
            <div className="bg-white dark:bg-card border-b border-border p-6 shrink-0">
                <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-foreground">Alertas e dicas</h1>
                    <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <Bell size={10} />
                        2 novos
                    </span>
                </div>
                <p className="text-muted-foreground text-sm font-medium">Siga as recomendações da nossa equipe para melhorar suas práticas de e-mail marketing.</p>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-8 bg-[#F9FAFB] dark:bg-slate-950/20">
                <div className="max-w-4xl mx-auto space-y-4">
                    {/* Alert Card 1 */}
                    <div className="group bg-white dark:bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                        <div className="flex gap-5">
                            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/30">
                                <Info size={24} className="text-[#FBBF24]" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                                            Como manter sua reputação de remetente de campanhas em alta
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                        </h3>
                                        <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">18 de fev de 2026</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Sua reputação de remetente é o que determina se seus e-mails chegam na caixa de entrada ou na pasta de spam.
                                        Aprenda como manter essa métrica saudável através da limpeza regular da lista e engajamento constante.
                                    </p>
                                </div>
                                <div className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest">CONTA DO CAMPAIGNS</span>
                                    </div>
                                    <ChevronRight size={20} className="text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Alert Card 2 */}
                    <div className="group bg-white dark:bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                        <div className="flex gap-5">
                            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/30">
                                <Info size={24} className="text-[#FBBF24]" />
                            </div>
                            <div className="flex-1 space-y-4">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                                            Como garantir a aprovação da sua conta
                                        </h3>
                                        <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">18 de fev de 2026</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Antes de enviar grandes volumes, nossa equipe revisa as contas para garantir conformidade com as leis de spam e taxas de entrega.
                                        Confira os passos necessários para uma aprovação rápida e sem atritos.
                                    </p>
                                </div>
                                <div className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest">CONTA DO CAMPAIGNS</span>
                                    </div>
                                    <ChevronRight size={20} className="text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
