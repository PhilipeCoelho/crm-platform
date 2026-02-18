import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { QRCodeSVG } from 'qrcode.react';
import {
    Plus,
    Send,
    Users,
    Image as ImageIcon,
    BarChart3,
    Play,
    Megaphone,
    Shield,
    Mail,
    User,
    Info,
    ExternalLink,
    CheckCircle2,
    X,
    Lock
} from 'lucide-react';

export default function CampaignsDashboard() {
    const { campaigns, campaignSenders, contacts, addCampaignSender } = useCRM();
    const navigate = useNavigate();

    // Checklist States
    const [is2FAEnabled, setIs2FAEnabled] = useState(false); // Mock state for 2FA
    const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
    const [isSenderModalOpen, setIsSenderModalOpen] = useState(false);
    const [newSender, setNewSender] = useState({ name: '', email: '' });

    // Computed Checklist Items
    const hasVerifiedSender = campaignSenders.some(s => s.isVerified);
    const hasSubscribedContacts = contacts.some(c => c.marketingStatus === 'subscribed');
    const isChecklistComplete = is2FAEnabled && hasVerifiedSender && hasSubscribedContacts;

    const [view, setView] = useState<'onboarding' | 'setup' | 'list'>(() => {
        const onboardingDone = localStorage.getItem('campaigns_onboarding_done');
        if (onboardingDone !== 'true') return 'onboarding';
        return isChecklistComplete ? 'list' : 'setup';
    });

    useEffect(() => {
        if (view === 'setup' && isChecklistComplete) {
            setView('list');
        }
    }, [isChecklistComplete, view]);

    const handleStart = () => {
        localStorage.setItem('campaigns_onboarding_done', 'true');
        setView(isChecklistComplete ? 'list' : 'setup');
    };

    const handleEnable2FA = () => {
        // Mock 2FA enabling process
        setTimeout(() => {
            setIs2FAEnabled(true);
            setIs2FAModalOpen(false);
        }, 1500);
    };

    const handleAddSender = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addCampaignSender(newSender);
            setIsSenderModalOpen(false);
            setNewSender({ name: '', email: '' });
            alert('Remetente adicionado! Verifique seu e-mail (simulação: clique em verificar na lista de configurações).');
        } catch (error) {
            console.error(error);
        }
    };

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
                    {/* Checklist Item 1: 2FA */}
                    <div className={`bg-white dark:bg-card border ${is2FAEnabled ? 'border-emerald-200 bg-emerald-50/50' : 'border-border'} rounded-xl p-6 flex gap-6 shadow-sm hover:shadow-md transition-all`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${is2FAEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>
                            {is2FAEnabled ? <CheckCircle2 size={24} /> : <Shield size={24} />}
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-foreground">Ative o login por autenticação de 2 fatores (2FA)</h3>
                                <Info size={14} className="text-muted-foreground cursor-help" />
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                A autenticação de dois fatores torna sua conta mais segura e ajuda a proteger seus dados de contato. É obrigatório para o envio de campanhas de marketing.
                            </p>
                            {!is2FAEnabled && (
                                <button
                                    onClick={() => setIs2FAModalOpen(true)}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Ativar a 2FA
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Checklist Item 2: Sender */}
                    <div className={`bg-white dark:bg-card border ${hasVerifiedSender ? 'border-emerald-200 bg-emerald-50/50' : 'border-border'} rounded-xl p-6 flex gap-6 shadow-sm hover:shadow-md transition-all`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${hasVerifiedSender ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>
                            {hasVerifiedSender ? <CheckCircle2 size={24} /> : <Mail size={24} />}
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-foreground">Adicionar informações de remetente</h3>
                                <Info size={14} className="text-muted-foreground cursor-help" />
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Configure as informações do remetente que aparecerão nos e-mails. É necessário pelo menos um remetente verificado.
                                <Link to="#" className="text-primary hover:underline flex items-center gap-1 mt-1 font-semibold">
                                    Saiba mais <ExternalLink size={12} />
                                </Link>
                            </p>
                            {!hasVerifiedSender && (
                                <button
                                    onClick={() => setIsSenderModalOpen(true)}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Adicionar remetente
                                </button>
                            )}
                            {campaignSenders.length > 0 && !hasVerifiedSender && (
                                <p className="text-xs text-amber-600 font-bold bg-amber-50 inline-block px-2 py-1 rounded">
                                    * Você tem remetentes pendentes. Verifique-os em Configurações.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Checklist Item 3: Contacts */}
                    <div className={`bg-white dark:bg-card border ${hasSubscribedContacts ? 'border-emerald-200 bg-emerald-50/50' : 'border-border'} rounded-xl p-6 flex gap-6 shadow-sm hover:shadow-md transition-all`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${hasSubscribedContacts ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'}`}>
                            {hasSubscribedContacts ? <CheckCircle2 size={24} /> : <User size={24} />}
                        </div>
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-foreground">Marque seus contatos como inscritos</h3>
                            </div>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Seus contatos devem ter o status de marketing definido como "Inscrito" (subscribed).
                                <Link to="#" className="text-primary hover:underline flex items-center gap-1 mt-1 font-semibold">
                                    Saiba mais <ExternalLink size={12} />
                                </Link>
                            </p>
                            {!hasSubscribedContacts && (
                                <button
                                    onClick={() => navigate('/contacts')}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Ir para contatos
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2FA Modal */}
                {is2FAModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-border flex justify-between items-center">
                                <h3 className="text-xl font-bold text-foreground">Ativar Autenticação (2FA)</h3>
                                <button onClick={() => setIs2FAModalOpen(false)}><X size={20} className="text-muted-foreground" /></button>
                            </div>
                            <div className="p-8 flex flex-col items-center gap-6">
                                <div className="bg-white p-2 rounded-lg border border-border shadow-sm">
                                    <QRCodeSVG value="otpauth://totp/CRM:Usuario?secret=JBSWY3DPEHPK3PXP&issuer=CRM" size={160} />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-sm font-bold">Escaneie o QR Code</p>
                                    <p className="text-xs text-muted-foreground max-w-[260px]">Abra seu app autenticador (Google Auth ou Authy) e escaneie o código acima.</p>
                                </div>

                                <input type="text" placeholder="Digite o código de 6 dígitos" className="w-full text-center text-2xl tracking-widest p-3 border border-border rounded-lg outline-none focus:border-primary font-mono uppercase" maxLength={6} />

                                <button
                                    onClick={handleEnable2FA}
                                    className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                                >
                                    <Lock size={16} />
                                    Confirmar e Ativar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Sender Modal */}
                {isSenderModalOpen && (
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
                                    <p className="text-[10px] text-muted-foreground italic">Vamos enviar um e-mail de verificação para este endereço.</p>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsSenderModalOpen(false)}
                                        className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg font-bold hover:bg-muted transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 bg-[#22C55E] text-white rounded-lg font-bold hover:bg-[#1eb054] transition-all"
                                    >
                                        Adicionar e Verificar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (view === 'list') {
        return (
            <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold text-foreground">Campanhas de e-mail</h1>
                        <p className="text-muted-foreground text-sm">Gerencie e acompanhe o desempenho de suas campanhas enviadas.</p>
                    </div>
                    <button
                        onClick={() => navigate('/campaigns/new')}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus size={18} />
                        Nova campanha
                    </button>
                </div>

                {campaigns.length === 0 ? (
                    <div className="bg-white dark:bg-card border border-dashed border-border rounded-2xl p-12 flex flex-col items-center text-center space-y-4">
                        <div className="w-20 h-20 rounded-full bg-primary/5 text-primary flex items-center justify-center">
                            <Send size={40} />
                        </div>
                        <div className="max-w-md space-y-2">
                            <h3 className="text-xl font-bold text-foreground">Nenhuma campanha enviada ainda</h3>
                            <p className="text-muted-foreground text-sm">
                                Comece criando sua primeira campanha para se envolver com seus contatos e impulsionar suas vendas.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/campaigns/new')}
                            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-all"
                        >
                            Criar minha primeira campanha
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {campaigns.map(campaign => (
                            <div key={campaign.id} className="bg-white dark:bg-card border border-border rounded-xl p-6 flex items-center justify-between hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                        <Mail size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground">{campaign.name}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${campaign.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                {campaign.status}
                                            </span>
                                            <span className="text-xs text-muted-foreground">Enviada em {new Date(campaign.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-foreground">{campaign.sentCount}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Enviados</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-foreground">{((campaign.openedCount / campaign.sentCount) * 100 || 0).toFixed(1)}%</div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Aberturas</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-foreground">{((campaign.clickedCount / campaign.sentCount) * 100 || 0).toFixed(1)}%</div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Cliques</div>
                                    </div>
                                    <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                                        <BarChart3 size={18} className="text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return null;
}
