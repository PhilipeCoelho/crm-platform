import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ChevronRight, ChevronLeft, Send, X, AlertCircle, Users, FileText, Check, Search, ShieldCheck } from 'lucide-react';

// Statuses that are automatically excluded from any campaign mailing list
const EXCLUDED_DEAL_STATUSES = ['lost', 'desqualificado'] as const;

type WizardStep = 'details' | 'audience' | 'content' | 'review';

export default function CampaignWizard() {
    const navigate = useNavigate();
    const { addCampaign, campaignSenders, deals, contacts, pipelines } = useCRM();

    const [currentStep, setCurrentStep] = useState<WizardStep>('details');

    // Step 1: Detalhes
    const [campaignData, setCampaignData] = useState({
        name: '',
        subject: '',
        senderId: ''
    });

    // Step 2: Audiência (Filtros)
    const [audienceMode, setAudienceMode] = useState<'pipeline' | 'specific'>('pipeline');
    const [audienceFilters, setAudienceFilters] = useState({
        onlyOpenDeals: false,
        pipelineId: 'all',
        stageId: 'all',
        mappedDeals: true // Default: only deals that have a contact
    });

    // Step 2.1: Audiência (Contato específico)
    const [searchContactTerm, setSearchContactTerm] = useState('');
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

    // Step 3: Conteúdo
    const [content, setContent] = useState('');

    const selectedSender = campaignSenders.find(s => s.id === campaignData.senderId);

    // Filter computation
    const filteredDeals = useMemo(() => {
        if (audienceMode !== 'pipeline') return [];
        return deals.filter(deal => {
            // AUTOMATIC: always exclude lost/disqualified deals from any campaign
            if ((EXCLUDED_DEAL_STATUSES as readonly string[]).includes(deal.status)) return false;

            // Optional user filter: only 'open' status deals
            if (audienceFilters.onlyOpenDeals && deal.status !== 'open') return false;

            if (audienceFilters.pipelineId !== 'all' && deal.pipelineId !== audienceFilters.pipelineId) return false;
            if (audienceFilters.stageId !== 'all' && deal.stageId !== audienceFilters.stageId) return false;

            // Requisito: ter contato com email válido (deve existir e não estar vazio)
            const contact = contacts.find(c => c.id === deal.contactId);
            if (!contact || !contact.email || contact.email.trim() === '' || !contact.email.includes('@')) return false;

            return true;
        });
    }, [deals, contacts, audienceFilters, audienceMode]);

    // Unique contacts from the filtered deals or specific contact
    const recipients = useMemo(() => {
        if (audienceMode === 'specific') {
            if (!selectedContactId) return [];
            const specificContact = contacts.find(c => c.id === selectedContactId);
            // Validate email
            if (!specificContact || !specificContact.email || specificContact.email.trim() === '' || !specificContact.email.includes('@')) return [];

            // Find the best (active) deal for this contact – exclude lost/disqualified
            const activeDeal = deals.find(
                d => d.contactId === specificContact.id &&
                    !(EXCLUDED_DEAL_STATUSES as readonly string[]).includes(d.status)
            );
            // Fallback: if contact has no deal at all, still allow (deal id will be null)
            const anyDeal = deals.find(d => d.contactId === specificContact.id);
            const dealToUse = activeDeal || (!anyDeal ? { id: null } : null);

            // Block if the only deals this contact has are all lost/disqualified
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

    const handleNext = () => {
        if (currentStep === 'details') {
            if (!campaignData.name || !campaignData.subject || !campaignData.senderId) return;
            setCurrentStep('audience');
        } else if (currentStep === 'audience') {
            if (recipients.length === 0) return;
            setCurrentStep('content');
        } else if (currentStep === 'content') {
            if (!content) return;
            setCurrentStep('review');
        }
    };

    const handleBack = () => {
        if (currentStep === 'audience') setCurrentStep('details');
        if (currentStep === 'content') setCurrentStep('audience');
        if (currentStep === 'review') setCurrentStep('content');
    };

    const handleFinish = async (status: 'draft' | 'sent') => {
        try {
            console.log('🏁 Finishing campaign...', { status, recipientsCount: recipients.length });

            if (recipients.length === 0 && status === 'sent') {
                alert('Nenhum destinatário selecionado!');
                return;
            }

            await addCampaign({
                name: campaignData.name,
                subject: campaignData.subject,
                fromName: selectedSender?.name || 'Unknown',
                fromEmail: selectedSender?.email || 'unknown@example.com',
                content: content,
                status: status,
                sentAt: status === 'sent' ? new Date().toISOString() : undefined,
                recipients: recipients.map(r => ({
                    email: r.contact.email,
                    personId: r.contact.id,
                    dealId: r.deal.id
                }))
            } as any);

            navigate('/campaigns');
        } catch (error) {
            console.error('🔥 Wizard Finish Error:', error);
            alert('Erro ao criar campanha. Verifique o console do desenvolvedor.');
        }
    };

    const renderStepNumbers = () => {
        const steps: { key: WizardStep; label: string }[] = [
            { key: 'details', label: 'Detalhes' },
            { key: 'audience', label: 'Audiência' },
            { key: 'content', label: 'Conteúdo' },
            { key: 'review', label: 'Revisão' }
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
                                <span>{step.label}</span>
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
            <header className="bg-white dark:bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-10">
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

                {/* Progress Steps */}
                {renderStepNumbers()}

                <div className="w-[100px]"></div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-6 md:p-10">
                <div className="max-w-3xl mx-auto">

                    {/* STEP 1: DETALHES */}
                    {currentStep === 'details' && (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                            <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Detalhes da Campanha</h2>
                                    <p className="text-sm text-muted-foreground">Configurações iniciais e remetente</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-foreground">Nome da Campanha (Interno)</label>
                                        <input
                                            type="text"
                                            value={campaignData.name}
                                            onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
                                            className="w-full p-3 bg-white dark:bg-card border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                            placeholder="Ex: Newsletter Março 2026"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-foreground">Assunto do E-mail</label>
                                        <input
                                            type="text"
                                            value={campaignData.subject}
                                            onChange={(e) => setCampaignData({ ...campaignData, subject: e.target.value })}
                                            className="w-full p-3 bg-white dark:bg-card border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                            placeholder="Ex: Confirmação de Reunião"
                                        />
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <label className="text-sm font-bold text-foreground">Remetente</label>
                                        {campaignSenders.length === 0 ? (
                                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 text-amber-800">
                                                <AlertCircle size={20} />
                                                <div>
                                                    <p className="text-sm font-bold">Nenhum remetente configurado</p>
                                                    <button onClick={() => navigate('/campaigns/settings')} className="text-xs underline hover:text-amber-900">Configurar remetentes</button>
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
                                                            : 'border-border bg-white dark:bg-card hover:border-primary/50'}`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${campaignData.senderId === sender.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                                                            {sender.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="overflow-hidden flex-1">
                                                            <p className="text-sm font-bold truncate">{sender.name}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{sender.email}</p>
                                                        </div>
                                                        {campaignData.senderId === sender.id && <Check size={16} className="text-primary" />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: AUDIENCE */}
                    {currentStep === 'audience' && (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                            <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Seleção de Audiência</h2>
                                    <p className="text-sm text-muted-foreground">Defina quem vai receber esta campanha</p>
                                </div>

                                <div className="flex gap-4 border-b border-border mb-6">
                                    <button
                                        onClick={() => setAudienceMode('pipeline')}
                                        className={`pb-2 text-sm font-bold border-b-2 transition-all ${audienceMode === 'pipeline' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Por Funil (Pipeline)
                                    </button>
                                    <button
                                        onClick={() => setAudienceMode('specific')}
                                        className={`pb-2 text-sm font-bold border-b-2 transition-all ${audienceMode === 'specific' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Contato Específico
                                    </button>
                                </div>

                                <div className="space-y-4 min-h-[160px]">
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
                                                    Apenas Negócios Abertos
                                                </label>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-bold text-foreground">Pipeline Específico</label>
                                                    <select
                                                        value={audienceFilters.pipelineId}
                                                        onChange={(e) => setAudienceFilters({ ...audienceFilters, pipelineId: e.target.value, stageId: 'all' })}
                                                        className="w-full p-2.5 bg-white dark:bg-card border border-border rounded-lg text-sm outline-none focus:border-primary"
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
                                                        className="w-full p-2.5 bg-white dark:bg-card border border-border rounded-lg text-sm outline-none focus:border-primary disabled:opacity-50"
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
                                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-card border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                                />
                                            </div>

                                            <div className="border border-border rounded-lg overflow-hidden flex flex-col max-h-56">
                                                <div className="overflow-y-auto w-full custom-scrollbar">
                                                    {contacts
                                                        .filter(c => c.email && c.email.includes('@'))
                                                        .filter(c =>
                                                            !searchContactTerm ||
                                                            c.name.toLowerCase().includes(searchContactTerm.toLowerCase()) ||
                                                            c.email.toLowerCase().includes(searchContactTerm.toLowerCase())
                                                        )
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
                                                                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                                                                </div>
                                                                {selectedContactId === contact.id && <Check size={16} className="text-primary" />}
                                                            </div>
                                                        ))
                                                    }
                                                    {contacts.length > 0 && contacts.filter(c => c.email).length === 0 && (
                                                        <div className="p-4 text-center text-muted-foreground text-sm">Nenhum contato com e-mail cadastrado.</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Active filter notice */}
                                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                        <ShieldCheck size={14} className="shrink-0" />
                                        Negócios <strong>Perdidos</strong> e <strong>Desqualificados</strong> são excluídos automaticamente desta lista.
                                    </div>

                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center shrink-0">
                                            <Users size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-blue-900 dark:text-blue-100 text-lg">
                                                {recipients.length} {recipients.length === 1 ? 'contato encontrado' : 'contatos encontrados'}
                                            </p>
                                            <p className="text-sm text-blue-700/80 dark:text-blue-200/70 mt-1">
                                                {audienceMode === 'pipeline'
                                                    ? 'Apenas negócios ativos com e-mail válido são incluídos. Perdidos e desqualificados são excluídos automaticamente.'
                                                    : 'Contato selecionado. Ele deve ter e-mail válido e pelo menos um negócio ativo no CRM.'}
                                            </p>
                                        </div>
                                    </div>
                                    {recipients.length === 0 && (
                                        <p className="text-red-500 text-sm font-medium">
                                            {audienceMode === 'pipeline' ? 'Nenhum contato ativo elegível encontrado. Verifique os filtros ou o status dos negócios.' : 'Selecione um contato com negócio ativo e e-mail válido para prosseguir.'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: CONTENT */}
                    {currentStep === 'content' && (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                            <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Conteúdo do E-mail</h2>
                                    <p className="text-sm text-muted-foreground">Escreva a mensagem (texto livre)</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-foreground">Corpo da Mensagem</label>
                                        <textarea
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            rows={12}
                                            className="w-full p-4 bg-white dark:bg-card border border-border rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none shadow-inner"
                                            placeholder="Olá,"
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md flex items-start gap-2">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                        <p>Nesta versão 1, a formatação é texto simples com quebras de linha automáticas. Links copiados diretamente funcionarão na maioria dos clientes de e-mail.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: REVIEW */}
                    {currentStep === 'review' && (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                            <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-sm space-y-8">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Revisar e Enviar</h2>
                                    <p className="text-sm text-muted-foreground">Verifique os dados antes de disparar a campanha.</p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-8 bg-muted/20 p-6 border border-border rounded-xl">
                                    <div className="space-y-5">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Campanha</p>
                                            <p className="font-semibold text-foreground text-lg">{campaignData.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><FileText size={12} /> Assunto</p>
                                            <p className="font-medium text-foreground">{campaignData.subject}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Users size={12} /> Remetente</p>
                                            <p className="font-medium text-foreground">{selectedSender?.name} <span className="text-muted-foreground font-normal">({selectedSender?.email})</span></p>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-card p-5 border border-border rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                                                <Send size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-foreground">{recipients.length} Destinatários</h3>
                                                <p className="text-xs text-muted-foreground">Prontos para receber seu e-mail</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="bg-muted px-4 py-2 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Preview da Mensagem
                                    </div>
                                    <div className="p-6 bg-white dark:bg-card prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-serif text-sm">
                                        {content || <span className="text-muted-foreground italic">Nenhum conteúdo</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </main>

            {/* Footer Navigation */}
            <footer className="bg-white dark:bg-card border-t border-border px-6 py-4 flex items-center justify-between shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                <button
                    onClick={handleBack}
                    disabled={currentStep === 'details'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${currentStep === 'details' ? 'opacity-0 pointer-events-none' : 'hover:bg-muted text-muted-foreground border border-border hover:border-muted-foreground/30'}`}
                >
                    <ChevronLeft size={18} />
                    Voltar
                </button>

                <div className="flex items-center gap-3">
                    {currentStep === 'review' ? (
                        <>
                            <button
                                onClick={() => handleFinish('draft')}
                                className="px-6 py-2 border border-border bg-white dark:bg-card text-foreground rounded-lg font-bold text-sm hover:bg-muted transition-all"
                            >
                                Salvar Rascunho
                            </button>
                            <button
                                onClick={() => handleFinish('sent')}
                                className="flex items-center gap-2 px-6 py-2 bg-[#22C55E] text-white rounded-lg font-bold text-sm hover:bg-[#1eb054] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                            >
                                <Send size={18} />
                                Enviar Agora
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleNext}
                            disabled={
                                (currentStep === 'details' && (!campaignData.name || !campaignData.subject || !campaignData.senderId)) ||
                                (currentStep === 'audience' && recipients.length === 0) ||
                                (currentStep === 'content' && !content)
                            }
                            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20"
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
