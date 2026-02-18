import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ChevronRight, ChevronLeft, Check, Mail, User, FileText, Calendar, Send, Clock, X, AlertCircle } from 'lucide-react';

type WizardStep = 'details' | 'content' | 'review';

export default function CampaignWizard() {
    const navigate = useNavigate();
    const { addCampaign, campaignSenders, emailTemplates } = useCRM();

    const [currentStep, setCurrentStep] = useState<WizardStep>('details');
    const [campaignData, setCampaignData] = useState<{
        name: string;
        subject: string;
        senderId: string;
        templateId: string;
        scheduledDate: string;
    }>({
        name: '',
        subject: '',
        senderId: '',
        templateId: '',
        scheduledDate: ''
    });

    // Computed
    const selectedSender = campaignSenders.find(s => s.id === campaignData.senderId);
    const selectedTemplate = emailTemplates.find(t => t.id === campaignData.templateId);

    const handleNext = () => {
        if (currentStep === 'details') {
            if (!campaignData.name || !campaignData.subject || !campaignData.senderId) return;
            setCurrentStep('content');
        } else if (currentStep === 'content') {
            if (!campaignData.templateId) return;
            setCurrentStep('review');
        }
    };

    const handleBack = () => {
        if (currentStep === 'content') setCurrentStep('details');
        if (currentStep === 'review') setCurrentStep('content');
    };

    const handleFinish = async (status: 'draft' | 'scheduled' | 'sent') => {
        try {
            await addCampaign({
                name: campaignData.name,
                subject: campaignData.subject,
                fromName: selectedSender?.name || 'Unknown',
                fromEmail: selectedSender?.email || 'unknown@example.com',
                templateId: campaignData.templateId,
                status: status,
                scheduledAt: status === 'scheduled' ? campaignData.scheduledDate : undefined,
                sentAt: status === 'sent' ? new Date().toISOString() : undefined
            });
            navigate('/campaigns/email');
        } catch (error) {
            console.error(error);
            alert('Erro ao criar campanha');
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F9FAFB] dark:bg-slate-950/20">
            {/* Header */}
            <header className="bg-white dark:bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/campaigns/email')}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <X size={20} className="text-muted-foreground" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">Nova Campanha</h1>
                        <p className="text-xs text-muted-foreground">Crie e envie sua campanha de e-mail</p>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="hidden md:flex items-center gap-2">
                    <div className={`flex items-center gap-2 ${currentStep === 'details' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${currentStep === 'details' || currentStep === 'content' || currentStep === 'review' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>1</div>
                        <span>Detalhes</span>
                    </div>
                    <div className="w-8 h-px bg-border"></div>
                    <div className={`flex items-center gap-2 ${currentStep === 'content' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${currentStep === 'content' || currentStep === 'review' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>2</div>
                        <span>Conteúdo</span>
                    </div>
                    <div className="w-8 h-px bg-border"></div>
                    <div className={`flex items-center gap-2 ${currentStep === 'review' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${currentStep === 'review' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>3</div>
                        <span>Revisão</span>
                    </div>
                </div>

                <div className="w-[100px]"></div> {/* Spacer for alignment */}
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-6 md:p-10">
                <div className="max-w-3xl mx-auto">

                    {/* STEP 1: DETAILS */}
                    {currentStep === 'details' && (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                            <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">
                                <h2 className="text-xl font-bold text-foreground mb-6">Informações da Campanha</h2>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-foreground">Nome da Campanha (Interno)</label>
                                    <input
                                        type="text"
                                        value={campaignData.name}
                                        onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
                                        className="w-full p-3 bg-muted/30 border border-border rounded-lg outline-none focus:border-primary transition-all"
                                        placeholder="Ex: Newsletter Janeiro 2024"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-foreground">Assunto do E-mail</label>
                                    <input
                                        type="text"
                                        value={campaignData.subject}
                                        onChange={(e) => setCampaignData({ ...campaignData, subject: e.target.value })}
                                        className="w-full p-3 bg-muted/30 border border-border rounded-lg outline-none focus:border-primary transition-all"
                                        placeholder="Ex: Novidades imperdíveis para você!"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-foreground">Remetente</label>
                                    {campaignSenders.length === 0 ? (
                                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-800">
                                            <AlertCircle size={20} />
                                            <div>
                                                <p className="text-sm font-bold">Nenhum remetente configurado</p>
                                                <button onClick={() => navigate('/campaigns/settings')} className="text-xs underline">Configurar remetentes</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {campaignSenders.map(sender => (
                                                <div
                                                    key={sender.id}
                                                    onClick={() => setCampaignData({ ...campaignData, senderId: sender.id })}
                                                    className={`p-3 border rounded-lg cursor-pointer transition-all flex items-center gap-3 ${campaignData.senderId === sender.id
                                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                        : 'border-border hover:border-primary/50'}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${campaignData.senderId === sender.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                                                        <User size={16} />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold truncate">{sender.name}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{sender.email}</p>
                                                    </div>
                                                    {campaignData.senderId === sender.id && <Check size={16} className="text-primary ml-auto" />}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: CONTENT */}
                    {currentStep === 'content' && (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-foreground">Escolha um Modelo</h2>

                                {emailTemplates.length === 0 ? (
                                    <div className="bg-white dark:bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                                        <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="mb-4">Você ainda não tem modelos salvos.</p>
                                        <button
                                            onClick={() => navigate('/campaigns/templates')}
                                            className="text-primary font-bold hover:underline"
                                        >
                                            Criar um modelo agora
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {emailTemplates.map(template => (
                                            <div
                                                key={template.id}
                                                onClick={() => setCampaignData({ ...campaignData, templateId: template.id })}
                                                className={`group bg-white dark:bg-card border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg ${campaignData.templateId === template.id
                                                    ? 'border-primary ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900'
                                                    : 'border-border'}`}
                                            >
                                                <div className="h-40 bg-muted/20 flex items-center justify-center border-b border-border">
                                                    {template.thumbnail ? (
                                                        <img src={template.thumbnail} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FileText size={40} className="text-muted-foreground/30" />
                                                    )}
                                                </div>
                                                <div className="p-4 flex items-center justify-between">
                                                    <span className="font-bold text-foreground">{template.name}</span>
                                                    {campaignData.templateId === template.id && (
                                                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white">
                                                            <Check size={14} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: REVIEW */}
                    {currentStep === 'review' && (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                            <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-sm space-y-8">
                                <h2 className="text-xl font-bold text-foreground">Revisar e Enviar</h2>

                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Detalhes</h3>

                                        <div className="flex items-start gap-3">
                                            <Mail className="text-primary mt-0.5" size={18} />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Assunto:</p>
                                                <p className="font-semibold text-foreground">{campaignData.subject}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <User className="text-primary mt-0.5" size={18} />
                                            <div>
                                                <p className="text-xs text-muted-foreground">Remetente:</p>
                                                <p className="font-semibold text-foreground">{selectedSender?.name}</p>
                                                <p className="text-xs text-muted-foreground">{selectedSender?.email}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Conteúdo</h3>
                                        <div className="bg-muted/30 p-4 rounded-lg border border-border">
                                            <p className="text-xs text-muted-foreground mb-1">Modelo selecionado:</p>
                                            <p className="font-semibold text-foreground flex items-center gap-2">
                                                <FileText size={16} />
                                                {selectedTemplate?.name}
                                            </p>
                                            <button
                                                onClick={() => setCurrentStep('content')}
                                                className="text-xs text-primary hover:underline mt-2 font-medium"
                                            >
                                                Alterar modelo
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-border pt-6">
                                    <div className="space-y-4">
                                        <label className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <Calendar size={16} />
                                            Agendamento (Opcional)
                                        </label>
                                        <div className="flex gap-4">
                                            <input
                                                type="datetime-local"
                                                className="p-2 border border-border rounded-lg bg-muted/20 outline-none text-sm"
                                                value={campaignData.scheduledDate}
                                                onChange={(e) => setCampaignData({ ...campaignData, scheduledDate: e.target.value })}
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">Se deixar em branco, a campanha será enviada imediatamente ao clicar em "Enviar Agora".</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </main>

            {/* Footer Navigation */}
            <footer className="bg-white dark:bg-card border-t border-border px-6 py-4 flex items-center justify-between">
                <button
                    onClick={handleBack}
                    disabled={currentStep === 'details'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${currentStep === 'details' ? 'opacity-0 pointer-events-none' : 'hover:bg-muted text-muted-foreground'}`}
                >
                    <ChevronLeft size={18} />
                    Voltar
                </button>

                <div className="flex items-center gap-3">
                    {currentStep === 'review' ? (
                        <>
                            <button
                                onClick={() => handleFinish('draft')}
                                className="px-6 py-2 border border-border text-foreground rounded-lg font-bold text-sm hover:bg-muted transition-all"
                            >
                                Salvar rascunho
                            </button>
                            <button
                                onClick={() => handleFinish(campaignData.scheduledDate ? 'scheduled' : 'sent')}
                                className="flex items-center gap-2 px-6 py-2 bg-[#22C55E] text-white rounded-lg font-bold text-sm hover:bg-[#1eb054] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                            >
                                {campaignData.scheduledDate ? (
                                    <>
                                        <Clock size={18} />
                                        Agendar Campanha
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Enviar Agora
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleNext}
                            disabled={
                                (currentStep === 'details' && (!campaignData.name || !campaignData.subject || !campaignData.senderId)) ||
                                (currentStep === 'content' && !campaignData.templateId)
                            }
                            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Próximo
                            <ChevronRight size={18} />
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}
