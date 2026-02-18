import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Users,
    Image as ImageIcon,
    BarChart3,
    Play,
    Megaphone,
    Shield,
    Mail,
    User,
    Info,
    ExternalLink
} from 'lucide-react';

export default function CampaignsDashboard() {
    const [view, setView] = useState<'onboarding' | 'setup' | 'list'>('onboarding');

    const handleStart = () => setView('setup');

    if (view === 'onboarding') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
                        {/* Left: Video Section */}
                        <div className="md:w-1/2 bg-slate-900 flex flex-col p-8 justify-center relative group">
                            <div className="absolute top-8 left-8 flex items-center gap-3 z-10">
                                <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-lg">
                                    <Megaphone size={20} />
                                </div>
                                <div className="text-white">
                                    <h3 className="font-bold text-lg leading-tight">Campaigns by Pipedrive</h3>
                                    <p className="text-slate-400 text-xs">Engage your customers with beautifully crafted emails</p>
                                </div>
                            </div>

                            <div className="relative aspect-video rounded-xl overflow-hidden shadow-2xl mt-12">
                                <img
                                    src="https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=800"
                                    alt="Video thumbnail"
                                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <button className="w-16 h-16 rounded-full bg-[#22C55E] text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-emerald-500/30">
                                        <Play fill="currentColor" size={24} className="ml-1" />
                                    </button>
                                </div>
                                <div className="absolute bottom-4 right-4 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded">
                                    16:05
                                </div>
                            </div>
                        </div>

                        {/* Right: Content Section */}
                        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-between overflow-y-auto">
                            <div>
                                <h1 className="text-3xl font-bold text-foreground mb-8">Vamos começar com o Campaigns</h1>

                                <div className="space-y-8">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                                            <Users size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground">Use seus dados existentes</h4>
                                            <p className="text-slate-500 text-sm mt-1 leading-relaxed">Transforme seus contatos de vendas existentes em uma lista de marketing segmentada em um clique.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center shrink-0">
                                            <ImageIcon size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground">Crie e envie uma campanha</h4>
                                            <p className="text-slate-500 text-sm mt-1 leading-relaxed">Crie e envie designs de e-mail profissionais usando nosso editor intuitivo de arrastar e soltar.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center shrink-0">
                                            <BarChart3 size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground">Obtenha insights e cresça</h4>
                                            <p className="text-slate-500 text-sm mt-1 leading-relaxed">Acompanhe as taxas de abertura e cliques em tempo real enquanto suas campanhas são enviadas.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12">
                                <button
                                    onClick={handleStart}
                                    className="w-full py-4 bg-[#22C55E] hover:bg-[#1eb054] text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                >
                                    Começar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'setup') {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-foreground">Antes de começar a enviar campanhas</h1>
                    <p className="text-muted-foreground text-sm">Siga o checklist abaixo para garantir que sua conta está pronta para o marketing por e-mail.</p>
                </div>

                <div className="space-y-4">
                    {/* Checklist Item 1 */}
                    <div className="bg-white dark:bg-card border border-border rounded-xl p-6 flex gap-6 shadow-sm hover:shadow-md transition-all">
                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                            <Shield size={24} />
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-foreground">Ative o login por autenticação de 2 fatores (2FA)</h3>
                                <Info size={14} className="text-muted-foreground cursor-help" />
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                A autenticação de dois fatores torna sua conta mais segura e ajuda a proteger seus dados de contato. É obrigatório para o envio de campanhas de marketing.
                            </p>
                            <button className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                Ativar a 2FA
                            </button>
                        </div>
                    </div>

                    {/* Checklist Item 2 */}
                    <div className="bg-white dark:bg-card border border-border rounded-xl p-6 flex gap-6 shadow-sm hover:shadow-md transition-all">
                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                            <Mail size={24} />
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-foreground">Adicionar informações de remetente</h3>
                                <Info size={14} className="text-muted-foreground cursor-help" />
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Configure as informações do remetente (nome e e-mail) que aparecerão nos e-mails que seus inscritos receberem. É necessário pelo menos um remetente verificado.
                                <Link to="#" className="text-primary hover:underline flex items-center gap-1 mt-1 font-semibold">
                                    Saiba mais <ExternalLink size={12} />
                                </Link>
                            </p>
                            <button className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                Adicionar remetente
                            </button>
                        </div>
                    </div>

                    {/* Checklist Item 3 */}
                    <div className="bg-white dark:bg-card border border-border rounded-xl p-6 flex gap-6 shadow-sm hover:shadow-md transition-all">
                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                            <User size={24} />
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-foreground">Marque seus contatos como inscritos</h3>
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Para enviar e-mails de marketing, seus contatos devem ter o status de marketing definido como "Inscrito". Altere esse status para os contatos que concordaram em receber seus e-mails.
                                <Link to="#" className="text-primary hover:underline flex items-center gap-1 mt-1 font-semibold">
                                    Saiba mais <ExternalLink size={12} />
                                </Link>
                            </p>
                            <button className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                Ir para contatos
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
