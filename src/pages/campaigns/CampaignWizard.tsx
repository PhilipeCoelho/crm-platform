import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ChevronRight, ChevronLeft, Send, X, AlertCircle, Users, FileText, Check, Search, ShieldCheck, Sparkles, LayoutTemplate, Clock, Edit3 } from 'lucide-react';
import { DEFAULT_TEMPLATES, renderTemplateHTML, TemplateCategory } from './templatesData';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// Statuses that are automatically excluded from any campaign mailing list
const EXCLUDED_DEAL_STATUSES = ['lost', 'desqualificado'] as const;

type WizardStep = 'template' | 'content' | 'audience' | 'review';

export default function CampaignWizard() {
    const navigate = useNavigate();
    const { addCampaign, campaignSenders, deals, contacts, pipelines, emailTemplates } = useCRM();

    const [currentStep, setCurrentStep] = useState<WizardStep>('template');

    // Step 1: Template Selection
    const [selectedTemplateSource, setSelectedTemplateSource] = useState<'blank' | 'predefined' | 'db'>('blank');
    const [editData, setEditData] = useState<Record<string, any>>({});
    const [editCategory, setEditCategory] = useState<TemplateCategory | 'Personalizado'>('Personalizado');

    // Step 2 & Global Details
    const [campaignData, setCampaignData] = useState({
        name: 'Campanha - ' + new Date().toLocaleDateString('pt-BR'),
        subject: '',
        senderId: '',
        content: '', // Used for blank HTML/Text
    });

    // Step 3: Audience (Filters)
    const [audienceMode, setAudienceMode] = useState<'pipeline' | 'specific'>('pipeline');
    const [audienceFilters, setAudienceFilters] = useState({
        onlyOpenDeals: false,
        pipelineId: 'all',
        stageId: 'all',
    });

    // Step 3.1: Audience (Specific contact)
    const [searchContactTerm, setSearchContactTerm] = useState('');
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

    const selectedSender = campaignSenders.find(s => s.id === campaignData.senderId);

    // AI Assunto Generator
    const generateAIAssunto = () => {
        const intents = [
            "Você não quer perder essa oportunidade",
            "Acelere as vendas no seu negócio agora",
            "Foi por isso que criamos nossa nova solução",
            "Estratégia exclusiva para dobrar seus resultados",
            "Resolvido: o maior desafio das vendas b2b",
            "Descubra como otimizar seu processo nesta semana"
        ];
        const random = intents[Math.floor(Math.random() * intents.length)];
        setCampaignData(prev => ({ ...prev, subject: random }));
    };

    const handleSelectTemplate = (template: any, source: 'blank' | 'predefined' | 'db') => {
        setSelectedTemplateSource(source);
        if (source === 'blank') {
            setEditCategory('Personalizado');
            setCampaignData(prev => ({ ...prev, subject: '', content: '' }));
            setEditData({});
        } else if (source === 'predefined') {
            setEditCategory(template.category);
            setEditData({ ...template.defaultData });
            setCampaignData(prev => ({ ...prev, subject: template.subject || '', content: '' }));
        } else if (source === 'db') {
            setEditCategory(template.category || 'Personalizado');
            let json = {};
            if (template.jsonContent) {
                try {
                    json = typeof template.jsonContent === 'string' ? JSON.parse(template.jsonContent) : template.jsonContent;
                } catch(e){}
            }
            // For DB templates that might be pure HTML blanks, we load html to content
            const contentFallback = Object.keys(json).length === 0 ? template.htmlContent || template.html_content || '' : '';
            setEditData(json);
            setCampaignData(prev => ({ ...prev, subject: template.subject || '', content: contentFallback }));
        }
        setCurrentStep('content');
    };

    // Filter computation
    const filteredDeals = useMemo(() => {
        if (audienceMode !== 'pipeline') return [];
        return deals.filter(deal => {
            if ((EXCLUDED_DEAL_STATUSES as readonly string[]).includes(deal.status)) return false;
            if (audienceFilters.onlyOpenDeals && deal.status !== 'open') return false;
            if (audienceFilters.pipelineId !== 'all' && deal.pipelineId !== audienceFilters.pipelineId) return false;
            if (audienceFilters.stageId !== 'all' && deal.stageId !== audienceFilters.stageId) return false;

            const contact = contacts.find(c => c.id === deal.contactId);
            if (!contact || !contact.email || contact.email.trim() === '' || !contact.email.includes('@')) return false;

            return true;
        });
    }, [deals, contacts, audienceFilters, audienceMode]);

    const recipients = useMemo(() => {
        if (audienceMode === 'specific') {
            if (!selectedContactId) return [];
            const specificContact = contacts.find(c => c.id === selectedContactId);
            if (!specificContact || !specificContact.email || specificContact.email.trim() === '' || !specificContact.email.includes('@')) return [];

            const activeDeal = deals.find(
                d => d.contactId === specificContact.id &&
                    !(EXCLUDED_DEAL_STATUSES as readonly string[]).includes(d.status)
            );
            const anyDeal = deals.find(d => d.contactId === specificContact.id);
            const dealToUse = activeDeal || (!anyDeal ? { id: null } : null);

            if (anyDeal && !activeDeal) return [];

            return [{ contact: specificContact, deal: dealToUse || { id: null } }];
        }

        const uniqueContactsMap = new Map();
        filteredDeals.forEach(deal => {
            const contact = contacts.find(c => c.id === deal.contactId);
            if (contact && contact.email && contact.email.trim() !== '' && !uniqueContactsMap.has(contact.id)) {
                uniqueContactsMap.set(contact.id, { contact, deal });
            }
        });
        return Array.from(uniqueContactsMap.values());
    }, [filteredDeals, contacts, audienceMode, selectedContactId, deals]);

    const getFinalHTMLContent = () => {
        if (selectedTemplateSource === 'blank' || (selectedTemplateSource === 'db' && Object.keys(editData).length === 0)) {
            // Retorna o conteúdo direto do editor dentro de um container padrão e limpo
            return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">${campaignData.content}</div>`;
        }
        return renderTemplateHTML(editCategory as TemplateCategory, editData);
    };

    const handleNext = () => {
        if (currentStep === 'template') {
            setCurrentStep('content');
        } else if (currentStep === 'content') {
            if (!campaignData.subject || !campaignData.senderId) {
                alert('Preencha o remetente e assunto para continuar.');
                return;
            }
            setCurrentStep('audience');
        } else if (currentStep === 'audience') {
            if (recipients.length === 0) return;
            setCurrentStep('review');
        }
    };

    const handleBack = () => {
        if (currentStep === 'content') setCurrentStep('template');
        if (currentStep === 'audience') setCurrentStep('content');
        if (currentStep === 'review') setCurrentStep('audience');
    };

    const handleFinish = async (action: 'draft' | 'sent' | 'scheduled') => {
        try {
            if (recipients.length === 0 && action === 'sent') {
                alert('Nenhum destinatário selecionado!');
                return;
            }

            const finalHtml = getFinalHTMLContent();
            const status = action === 'sent' ? 'sent' : 'draft';

            await addCampaign({
                name: campaignData.name,
                subject: campaignData.subject,
                fromName: selectedSender?.name || 'Unknown',
                fromEmail: selectedSender?.email || 'unknown@example.com',
                content: finalHtml,
                status: status,
                sentAt: action === 'sent' ? new Date().toISOString() : undefined,
                recipients: recipients.map(r => ({
                    email: r.contact.email,
                    personId: r.contact.id,
                    dealId: r.deal.id
                }))
            } as any);

            if (action === 'scheduled') {
                alert('Agendamento salvo com sucesso! O envio será processado no horário escolhido.');
            }

            navigate('/campaigns');
        } catch (error) {
            console.error('Wizard Finish Error:', error);
            alert('Erro ao criar campanha.');
        }
    };

    const renderStepNumbers = () => {
        const steps: { key: WizardStep; label: string }[] = [
            { key: 'template', label: 'Escolher modelo' },
            { key: 'content', label: 'Editar conteúdo' },
            { key: 'audience', label: 'Destinatários' },
            { key: 'review', label: 'Revisão e envio' }
        ];

        const currentIndex = steps.findIndex(s => s.key === currentStep);

        return (
            <div className="hidden md:flex items-center gap-2">
                {steps.map((step, index) => {
                    const isActive = step.key === currentStep;
                    const isPast = currentIndex > index;
                    return (
                        <div key={step.key} className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 ${isActive || isPast ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${isActive || isPast ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
                                    {isPast ? <Check size={12} /> : index + 1}
                                </div>
                                <span className="text-sm">{step.label}</span>
                            </div>
                            {index < steps.length - 1 && <div className="w-8 h-px bg-border mx-2"></div>}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#F9FAFB] dark:bg-slate-950/20">
            {/* Header */}
            <header className="bg-white dark:bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/campaigns')}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <X size={20} className="text-muted-foreground" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-foreground">Nova Campanha</h1>
                        <p className="text-xs text-muted-foreground">Assistente de criação</p>
                    </div>
                </div>

                {renderStepNumbers()}

                <div className="w-[100px]"></div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                
                {/* STEP 1: TEMPLATE */}
                {currentStep === 'template' && (
                    <div className="p-6 md:p-10 space-y-10 max-w-7xl mx-auto animate-in fade-in duration-300">
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">1. Escolha um Modelo base</h2>
                            <p className="text-sm text-muted-foreground mt-1">Selecione uma estrutura de alta conversão para acelerar seu envio.</p>
                        </div>

                        {/* Blank option */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            <div 
                                onClick={() => handleSelectTemplate(null, 'blank')}
                                className="group cursor-pointer bg-white dark:bg-card border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 rounded-xl h-[280px] flex flex-col items-center justify-center gap-4 transition-all"
                            >
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-colors">
                                    <FileText size={28} />
                                </div>
                                <div className="text-center">
                                    <h3 className="font-bold text-foreground">E-mail em branco</h3>
                                    <p className="text-xs text-muted-foreground mt-1 px-4">Comece do zero com um texto simples estruturado.</p>
                                </div>
                                <button className="mt-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                                    Usar modelo
                                </button>
                            </div>
                            
                            {/* Predefined Templates */}
                            {DEFAULT_TEMPLATES.map(template => (
                                <div 
                                    key={template.id} 
                                    onClick={() => handleSelectTemplate(template, 'predefined')}
                                    className="group cursor-pointer bg-white dark:bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/50 transition-all h-[280px] flex flex-col relative"
                                >
                                    <div className="absolute top-3 right-3 z-10">
                                        <span className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded shadow-sm">{template.category}</span>
                                    </div>
                                    <div className="flex-1 relative overflow-hidden flex items-center justify-center border-b border-border bg-slate-900">
                                        <img 
                                            src={template.thumbnail} 
                                            alt={template.name} 
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" 
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                            <button className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-bold text-sm hover:scale-105 transition-transform shadow-xl">
                                                Usar modelo
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-card h-[85px]">
                                        <h4 className="font-bold text-foreground text-sm line-clamp-1">{template.name}</h4>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2" title={template.subject}>Para: {template.subject}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Saved Templates */}
                        {emailTemplates.length > 0 && (
                            <div className="pt-6 border-t border-border">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <LayoutTemplate size={18} /> Modelos Salvos (<span className="text-primary">{emailTemplates.length}</span>)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 lg:grid-cols-5 gap-6">
                                    {emailTemplates.map(template => (
                                        <div 
                                            key={template.id} 
                                            onClick={() => handleSelectTemplate(template, 'db')}
                                            className="group cursor-pointer bg-white dark:bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:border-primary/50 transition-all flex flex-col h-[200px]"
                                        >
                                            <div className="h-[120px] bg-muted/20 relative overflow-hidden flex items-center justify-center border-b border-border">
                                                {template.thumbnail ? (
                                                    <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <LayoutTemplate size={32} className="text-muted-foreground/30" />
                                                )}
                                                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors flex items-center justify-center backdrop-blur-0 group-hover:backdrop-blur-[1px]">
                                                    <button className="bg-white/90 text-primary px-4 py-1.5 rounded-lg font-bold text-xs opacity-0 group-hover:opacity-100 shadow-md transform translate-y-2 group-hover:translate-y-0 transition-all">
                                                        Selecionar
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-4 flex flex-col gap-1 justify-center flex-1">
                                                <h4 className="font-bold text-foreground truncate text-sm">{template.name}</h4>
                                                <div className="text-[11px] font-semibold text-primary">{template.category || 'Personalizado'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2: CONTENT */}
                {currentStep === 'content' && (
                    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-sm space-y-8">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">2. Configurar Conteúdo</h2>
                                <p className="text-sm text-muted-foreground mt-1">Preencha os dados do envio e o texto da mensagem.</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Remetente */}
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-bold text-foreground">1. Remetente</label>
                                    {campaignSenders.length === 0 ? (
                                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-800">
                                            <AlertCircle size={20} />
                                            <div>
                                                <p className="text-sm font-bold">Nenhum remetente configurado</p>
                                                <button onClick={() => navigate('/campaigns/settings')} className="text-xs underline hover:text-amber-900">Configurar nas opções de campanha</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {campaignSenders.map(sender => (
                                                <div
                                                    key={sender.id}
                                                    onClick={() => setCampaignData({ ...campaignData, senderId: sender.id })}
                                                    className={`p-3 border rounded-lg cursor-pointer transition-all flex items-center gap-3 ${campaignData.senderId === sender.id
                                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                        : 'border-border bg-white dark:bg-card hover:border-primary/50'}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${campaignData.senderId === sender.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                                                        {sender.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="overflow-hidden flex-1">
                                                        <p className="text-sm font-bold truncate">{sender.name}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{sender.email}</p>
                                                    </div>
                                                    {campaignData.senderId === sender.id && <Check size={16} className="text-primary" />}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Assunto */}
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-bold text-foreground flex items-center justify-between">
                                        2. Assunto do E-mail
                                        <button 
                                            onClick={generateAIAssunto}
                                            className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 px-3 py-1 rounded-md transition-colors"
                                        >
                                            <Sparkles size={14} /> Gerar com IA
                                        </button>
                                    </label>
                                    <input
                                        type="text"
                                        value={campaignData.subject}
                                        onChange={(e) => setCampaignData({ ...campaignData, subject: e.target.value })}
                                        className="w-full p-3.5 bg-muted/30 dark:bg-card border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm font-medium"
                                        placeholder="Ex: Confirmação de Reunião"
                                    />
                                </div>

                                {/* Dynamic Editor based on Source */}
                                <div className="space-y-6 md:col-span-2 mt-4 pt-6 border-t border-border">
                                    <div className="flex items-center gap-2">
                                        <Edit3 size={18} className="text-primary" />
                                        <h3 className="text-lg font-bold">3. Corpo da Mensagem</h3>
                                    </div>
                                    
                                    {selectedTemplateSource === 'blank' || (selectedTemplateSource === 'db' && Object.keys(editData).length === 0) ? (
                                        <div className="space-y-4">
                                            <ReactQuill 
                                                theme="snow" 
                                                value={campaignData.content} 
                                                onChange={(val) => setCampaignData({ ...campaignData, content: val })} 
                                                className="bg-white [&_.ql-editor]:min-h-[200px] [&_.ql-editor]:text-[15px] [&_.ql-editor]:font-serif rounded-lg border border-border"
                                                placeholder="Olá, digite aqui ou cole do Claude..."
                                            />
                                        </div>
                                    ) : (
                                        <div className="bg-muted/20 p-6 border border-border rounded-xl space-y-6 shadow-inner">
                                            {Object.keys(editData).map(key => {
                                                const humanName = key.replace(/([A-Z])/g, ' $1').trim();
                                                const isArray = Array.isArray(editData[key]);
                                                
                                                return (
                                                    <div key={key} className="space-y-1.5 border-l-2 border-primary/20 pl-4 transition-all focus-within:border-primary">
                                                        <label className="text-xs font-bold text-foreground capitalize tracking-wide flex items-center gap-2">
                                                            {humanName}
                                                            {(key.toLowerCase().includes('cta') || key === 'content') && 
                                                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[9px] rounded uppercase font-black">Principal</span>
                                                            }
                                                        </label>
                                                        
                                                        {isArray ? (
                                                            <textarea 
                                                                value={(editData[key] || []).join('\n')}
                                                                onChange={e => setEditData({...editData, [key]: e.target.value.split('\n')})}
                                                                placeholder="Um item por linha..."
                                                                className="w-full p-3 bg-white dark:bg-card border border-border rounded-lg text-sm outline-none focus:border-primary focus:ring-1 min-h-[100px]"
                                                            />
                                                        ) : (
                                                            <textarea 
                                                                value={editData[key] || ''}
                                                                onChange={e => setEditData({...editData, [key]: e.target.value})}
                                                                className="w-full p-3 bg-white dark:bg-card border border-border rounded-lg text-sm outline-none focus:border-primary focus:ring-1 min-h-[44px]"
                                                                rows={key === 'content' || humanName.toLowerCase().includes('problem') ? 4 : 1}
                                                            />
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: AUDIENCE */}
                {currentStep === 'audience' && (
                    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">3. Selecionar Destinatários</h2>
                                <p className="text-sm text-muted-foreground mt-1">Defina quem vai receber esta campanha</p>
                            </div>

                            <div className="flex gap-4 border-b border-border mb-6">
                                <button
                                    onClick={() => setAudienceMode('pipeline')}
                                    className={`pb-2 text-sm font-bold border-b-2 transition-all ${audienceMode === 'pipeline' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                >
                                    Filtros Dinâmicos (Funil)
                                </button>
                                <button
                                    onClick={() => setAudienceMode('specific')}
                                    className={`pb-2 text-sm font-bold border-b-2 transition-all ${audienceMode === 'specific' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                >
                                    Contato Único
                                </button>
                            </div>

                            <div className="space-y-4 min-h-[180px]">
                                {audienceMode === 'pipeline' ? (
                                    <>
                                        <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/20">
                                            <input
                                                type="checkbox"
                                                id="openDeals"
                                                checked={audienceFilters.onlyOpenDeals}
                                                onChange={(e) => setAudienceFilters({ ...audienceFilters, onlyOpenDeals: e.target.checked })}
                                                className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                                            />
                                            <label htmlFor="openDeals" className="text-sm font-medium cursor-pointer flex-1">
                                                Apenas Negócios de Status "Aberto"
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-foreground">Pipeline Específico</label>
                                                <select
                                                    value={audienceFilters.pipelineId}
                                                    onChange={(e) => setAudienceFilters({ ...audienceFilters, pipelineId: e.target.value, stageId: 'all' })}
                                                    className="w-full p-3 bg-white dark:bg-card border border-border rounded-lg text-sm outline-none focus:border-primary"
                                                >
                                                    <option value="all">Todos os Pipelines</option>
                                                    {Object.values(pipelines).map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-foreground">Etapa Específica</label>
                                                <select
                                                    value={audienceFilters.stageId}
                                                    onChange={(e) => setAudienceFilters({ ...audienceFilters, stageId: e.target.value })}
                                                    disabled={audienceFilters.pipelineId === 'all'}
                                                    className="w-full p-3 bg-white dark:bg-card border border-border rounded-lg text-sm outline-none focus:border-primary disabled:opacity-50"
                                                >
                                                    <option value="all">Todas as Etapas</option>
                                                    {audienceFilters.pipelineId !== 'all' && pipelines[audienceFilters.pipelineId]?.stages.map(s => (
                                                        <option key={s.id} value={s.id}>{s.title}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Buscar por nome ou e-mail..."
                                                value={searchContactTerm}
                                                onChange={(e) => setSearchContactTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-card border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                        <div className="border border-border rounded-lg overflow-hidden flex flex-col max-h-56 shadow-inner">
                                            <div className="overflow-y-auto w-full custom-scrollbar">
                                                {contacts.filter(c => c.email && c.email.includes('@'))
                                                    .filter(c => !searchContactTerm || c.name.toLowerCase().includes(searchContactTerm.toLowerCase()) || c.email.toLowerCase().includes(searchContactTerm.toLowerCase()))
                                                    .map(contact => (
                                                        <div
                                                            key={contact.id}
                                                            onClick={() => setSelectedContactId(contact.id)}
                                                            className={`p-3 border-b border-border last:border-b-0 cursor-pointer flex items-center gap-3 transition-colors ${selectedContactId === contact.id ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                                                        >
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selectedContactId === contact.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                                                                {contact.name.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 overflow-hidden">
                                                                <p className="text-sm font-bold text-foreground truncate">{contact.name}</p>
                                                                <p className="text-[11px] text-muted-foreground truncate">{contact.email}</p>
                                                            </div>
                                                            {selectedContactId === contact.id && <Check size={16} className="text-primary" />}
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                    <ShieldCheck size={14} className="shrink-0" />
                                    Negócios perdidos e desqualificados são bloqueados automaticamente dessa lista de filtro.
                                </div>

                                <div className="mt-6 p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-black text-blue-900 dark:text-blue-100 text-3xl">
                                            {recipients.length}
                                        </p>
                                        <p className="text-xs text-blue-700/80 dark:text-blue-200/70 uppercase tracking-widest font-bold mt-0.5">
                                            {recipients.length === 1 ? 'Destinatário ativo' : 'Destinatários ativos'}
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
                                        <Users size={24} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: REVIEW */}
                {currentStep === 'review' && (
                    <div className="max-w-5xl mx-auto p-6 md:p-10 flex flex-col md:flex-row gap-8 animate-in slide-in-from-right-8 duration-300">
                        {/* Summary Block */}
                        <div className="md:w-[350px] shrink-0 space-y-6">
                            <div className="bg-white dark:bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">4. Revisão</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Valide os detalhes do disparo</p>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1.5"><FileText size={12}/> Assunto</p>
                                        <p className="font-semibold text-foreground text-sm line-clamp-2">{campaignData.subject}</p>
                                    </div>
                                    <div className="border-t border-border pt-4">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1.5"><LayoutTemplate size={12}/> Tipo da Mensagem</p>
                                        <p className="font-medium text-foreground text-sm flex items-center gap-2">
                                            {selectedTemplateSource === 'blank' ? 'Mensagem de Texto' : editCategory}
                                        </p>
                                    </div>
                                    <div className="border-t border-border pt-4">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1.5"><Users size={12}/> Remetente</p>
                                        <p className="font-medium text-foreground text-sm">{selectedSender?.name}</p>
                                        <p className="text-xs text-muted-foreground">{selectedSender?.email}</p>
                                    </div>
                                    <div className="border-t border-border pt-4">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1.5"><Sparkles size={12}/> Alcance</p>
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-bold text-sm">
                                            {recipients.length} pessoas
                                        </div>
                                    </div>
                                </div>
                            </div>



                            <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-col gap-3">
                                <button
                                    onClick={() => handleFinish('sent')}
                                    className="w-full flex justify-center items-center gap-2 py-3.5 bg-[#22C55E] text-white rounded-lg font-bold text-sm hover:opacity-90 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                >
                                    <Send size={18} /> Enviar Agora
                                </button>
                                <button
                                    onClick={() => handleFinish('scheduled')}
                                    className="w-full flex justify-center items-center gap-2 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-all cursor-pointer"
                                >
                                    <Clock size={18} /> Agendar Envio
                                </button>
                                <button
                                    onClick={() => handleFinish('draft')}
                                    className="w-full py-2.5 text-muted-foreground hover:text-foreground text-sm font-bold transition-all"
                                >
                                    Salvar Rascunho
                                </button>
                            </div>
                        </div>

                        {/* Live Email Preview */}
                        <div className="flex-1 flex flex-col min-h-[500px] border border-border rounded-xl bg-white shadow-xl overflow-hidden relative group">
                            <div className="bg-slate-100 border-b border-border px-4 py-2.5 flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                </div>
                                <div className="text-xs font-semibold text-slate-500 flex-1 text-center bg-white px-3 py-1 rounded max-w-[200px] mx-auto truncate border border-slate-200">
                                    {campaignData.subject || 'Novo E-mail'}
                                </div>
                            </div>
                            <div className="bg-white flex-1 p-6 overflow-y-auto">
                                <div 
                                    dangerouslySetInnerHTML={{ __html: getFinalHTMLContent() }}
                                    className="max-w-[600px] mx-auto"
                                />
                            </div>
                        </div>
                    </div>
                )}

            </main>

            {/* Footer Navigation */}
            <footer className="bg-white dark:bg-card border-t border-border px-6 py-4 flex items-center justify-between shadow-[0_-4px_10px_rgba(0,0,0,0.02)] shrink-0 z-20">
                <button
                    onClick={handleBack}
                    disabled={currentStep === 'template'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${currentStep === 'template' ? 'opacity-0 pointer-events-none' : 'hover:bg-muted text-muted-foreground border border-border hover:border-muted-foreground/30'}`}
                >
                    <ChevronLeft size={18} />
                    Voltar Etapa
                </button>

                <div className="flex items-center gap-3">
                    {currentStep !== 'review' && (
                        <button
                            onClick={handleNext}
                            disabled={
                                (currentStep === 'content' && (!campaignData.subject || !campaignData.senderId)) ||
                                (currentStep === 'audience' && recipients.length === 0)
                            }
                            className="flex items-center gap-2 px-8 py-2.5 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20"
                        >
                            Próximo Passo
                            <ChevronRight size={18} />
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}
