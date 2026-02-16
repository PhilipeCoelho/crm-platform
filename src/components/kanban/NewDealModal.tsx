import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import { Building, User, Phone, Mail, Check } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';

interface NewDealModalProps {
    currency?: string;
}


const SOURCES = ['Google Maps', 'Indicação', 'Website', 'LinkedIn', 'Instagram', 'Cold Call', 'Eventos', 'Outros'];

const LABELS = [
    { id: '1', name: 'Quente', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900' },
    { id: '2', name: 'Morno', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900' },
    { id: '3', name: 'Frio', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900' },
];

const parseCurrency = (value: string): number => {
    if (!value) return 0;
    return parseFloat(value) || 0;
};

export default function NewDealModal({ currency = 'BRL' }: NewDealModalProps) {
    const {
        addDeal, updateDeal, companies, contacts, deals, pipelines,
        addCompany, addContact, updateContact,
        isNewDealModalOpen, closeNewDealModal, newDealStageId,
        dealToEdit
    } = useCRM();


    // --- Form State ---
    const [title, setTitle] = useState('Negócio');
    const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
    const [value, setValue] = useState('');
    const [expectedCloseDate, setExpectedCloseDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState('sales');
    const [selectedStageId, setSelectedStageId] = useState('');
    const [source, setSource] = useState('Google Maps');
    const [contactSearch, setContactSearch] = useState('');
    const [contactId, setContactId] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [companySearch, setCompanySearch] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [companyManuallyEdited, setCompanyManuallyEdited] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setTitle('Negócio');
        setIsTitleManuallyEdited(false);
        setValue('');
        setExpectedCloseDate(new Date().toISOString().split('T')[0]);
        setSelectedLabels([]);
        setSelectedPipelineId('sales');
        const defaultPipeline = pipelines['sales'];
        if (defaultPipeline?.stages?.length > 0) setSelectedStageId(defaultPipeline.stages[0].id);
        setSource('Google Maps');
        setContactSearch('');
        setContactId('');
        setPhone('');
        setEmail('');
        setCompanySearch('');
        setCompanyId('');
        setCompanyManuallyEdited(false);
        setIsSubmitting(false);
    };

    const handleOnClose = () => {
        resetForm();
        closeNewDealModal();
    };

    // Update selectedStageId when pipeline changes
    useEffect(() => {
        const pipeline = pipelines[selectedPipelineId];
        if (pipeline && pipeline.stages.length > 0) {
            const isValid = pipeline.stages.find(s => s.id === selectedStageId);
            if (!isValid) {
                setSelectedStageId(pipeline.stages[0].id);
            }
        }
    }, [selectedPipelineId, pipelines, selectedStageId]);

    // Initialize/Edit Mode
    useEffect(() => {
        if (isNewDealModalOpen) {
            if (dealToEdit) {
                setTitle(dealToEdit.title);
                setIsTitleManuallyEdited(true);
                setValue(dealToEdit.value.toString());
                setExpectedCloseDate(dealToEdit.expectedCloseDate || '');
                setSelectedLabels(dealToEdit.tags || []);
                if (dealToEdit.pipelineId) setSelectedPipelineId(dealToEdit.pipelineId);
                setSelectedStageId(dealToEdit.stageId);
                setSource(dealToEdit.source || 'Google Maps');
                const linkedContact = contacts.find(c => c.id === dealToEdit.contactId);
                setContactId(dealToEdit.contactId || '');
                setContactSearch(linkedContact?.name || '');
                setPhone(linkedContact?.phone || '');
                setEmail(linkedContact?.email || '');
                const linkedCompany = companies.find(c => c.id === dealToEdit.companyId);
                setCompanyId(dealToEdit.companyId || '');
                setCompanySearch(linkedCompany?.name || '');
                setCompanyManuallyEdited(true);
            } else if (newDealStageId) {
                const pipe = Object.values(pipelines).find(p => p.stages.some(s => s.id === newDealStageId));
                if (pipe) {
                    setSelectedPipelineId(pipe.id);
                    setSelectedStageId(newDealStageId);
                }
            }
        }
    }, [isNewDealModalOpen, dealToEdit, newDealStageId, pipelines, contacts, companies]);

    // Mirroring logic
    useEffect(() => {
        if (!dealToEdit && !companyManuallyEdited && !companyId) {
            setCompanySearch(contactSearch);
        }
    }, [contactSearch, companyId, companyManuallyEdited, dealToEdit]);

    useEffect(() => {
        if (!isTitleManuallyEdited) {
            setTitle(contactSearch ? `Negócio ${contactSearch}` : 'Negócio');
        }
    }, [contactSearch, isTitleManuallyEdited]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            let finalCompanyId = companyId;
            let finalContactId = contactId;

            if (!finalCompanyId && companySearch) {
                const existingCo = companies.find(c => c.name.toLowerCase() === companySearch.toLowerCase());
                if (existingCo) finalCompanyId = existingCo.id;
                else {
                    const newCo = await addCompany({ name: companySearch });
                    finalCompanyId = newCo.id;
                }
            }

            if (!finalContactId && contactSearch) {
                const existingCt = contacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase());
                if (existingCt) finalContactId = existingCt.id;
                else {
                    const newCt = await addContact({ name: contactSearch, email, phone, companyId: finalCompanyId, status: 'lead' });
                    finalContactId = newCt.id;
                }
            } else if (finalContactId) {
                const contactUpdates: any = {};
                if (phone) contactUpdates.phone = phone;
                if (email) contactUpdates.email = email;
                if (finalCompanyId) contactUpdates.companyId = finalCompanyId;
                if (Object.keys(contactUpdates).length > 0) await updateContact(finalContactId, contactUpdates);
            }

            const numericValue = parseCurrency(value);
            const dealData = {
                title: title || (contactSearch ? `Negócio ${contactSearch}` : 'Novo Negócio'),
                value: numericValue, currency, pipelineId: selectedPipelineId, stageId: selectedStageId,
                companyId: finalCompanyId || undefined, contactId: finalContactId || undefined,
                expectedCloseDate: expectedCloseDate || undefined, tags: selectedLabels, source,
            };

            if (dealToEdit) {
                await updateDeal(dealToEdit.id, dealData);
            } else {
                await addDeal({ ...dealData, status: 'open', priority: 'medium' });
            }
            handleOnClose();
        } catch (error: any) {
            console.error('❌ Error submitting deal:', error);
            alert(`Erro ao salvar negócio: ${error.message || 'Erro desconhecido'}`);
            setIsSubmitting(false);
        }
    };

    const currentPipeline = pipelines[selectedPipelineId];
    const stages = currentPipeline?.stages || [];
    const contactSuggestions = useMemo(() => (!contactSearch ? [] : contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) && c.id !== contactId).slice(0, 5)), [contactSearch, contacts, contactId]);
    const companySuggestions = useMemo(() => (!companySearch ? [] : companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()) && c.id !== companyId).slice(0, 5)), [companySearch, companies, companyId]);

    const activeDuplicateDeals = useMemo(() => {
        if (!isNewDealModalOpen) return [];
        const normalize = (val: string) => val.replace(/\D/g, '').toLowerCase().trim();
        const normPhone = normalize(phone);
        const normEmail = email.toLowerCase().trim();
        const potentialContactIds = contacts
            .filter(c => {
                const matchesId = contactId && c.id === contactId;
                const matchesPhone = normPhone && normalize(c.phone || '') === normPhone;
                const matchesEmail = normEmail && (c.email || '').toLowerCase().trim() === normEmail;
                const matchesName = contactSearch.toLowerCase().trim() && c.name.toLowerCase().trim() === contactSearch.toLowerCase().trim();
                return matchesId || matchesPhone || matchesEmail || matchesName;
            })
            .map(c => c.id);

        return deals.filter(d => d.status === 'open' && d.id !== dealToEdit?.id && ((potentialContactIds.includes(d.contactId || '')) || (companyId && d.companyId === companyId)));
    }, [deals, contactId, companyId, phone, email, contactSearch, isNewDealModalOpen, dealToEdit, contacts]);

    return (
        <Modal isOpen={isNewDealModalOpen} onClose={handleOnClose} title={dealToEdit ? "Editar Negócio" : "Adicionar lead"} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col h-[80vh] md:h-auto overflow-hidden">
                <div className="flex-1 overflow-y-auto p-1 space-y-2">
                    {!isSubmitting && activeDuplicateDeals.length > 0 && (
                        <div className="mb-4 animate-in fade-in slide-in-from-top-2">
                            <p className="text-[11px] font-bold text-red-600">Atenção: Já existe um negócio aberto para este contato/empresa!</p>
                        </div>
                    )}

                    {/* Person Input */}
                    <div className="relative group z-20">
                        <label className="block text-xs font-semibold text-foreground mb-1">Pessoa de contato</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-muted-foreground" size={14} />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-1.5 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm placeholder:text-muted-foreground/50"
                                placeholder="Nome do contato"
                                value={contactSearch}
                                onChange={(e) => { setContactSearch(e.target.value); setContactId(''); }}
                            />
                            {contactId && <div className="absolute right-3 top-2.5 text-green-600"><Check size={14} /></div>}
                        </div>
                        {contactSearch && !contactId && contactSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-popover border border-border shadow-md rounded-md mt-1 z-50">
                                {contactSuggestions.map(c => (
                                    <button
                                        key={c.id} type="button"
                                        className="w-full text-left px-4 py-2 hover:bg-muted text-xs flex items-center justify-between"
                                        onClick={() => {
                                            setContactSearch(c.name); setContactId(c.id); setPhone(c.phone || ''); setEmail(c.email || '');
                                            if (c.companyId) {
                                                const co = companies.find(comp => comp.id === c.companyId);
                                                if (co) { setCompanySearch(co.name); setCompanyId(co.id); }
                                            }
                                        }}
                                    >
                                        <span>{c.name}</span>
                                        <span className="text-muted-foreground">{c.email}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Organization Input */}
                    <div className="relative group z-10">
                        <label className="block text-xs font-semibold text-foreground mb-1">Organização</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-2.5 text-muted-foreground" size={14} />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-1.5 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm placeholder:text-muted-foreground/50"
                                placeholder="Nome da organização"
                                value={companySearch}
                                onChange={(e) => { setCompanySearch(e.target.value); setCompanyId(''); setCompanyManuallyEdited(true); }}
                            />
                            {companyId && <div className="absolute right-3 top-2.5 text-green-600"><Check size={14} /></div>}
                        </div>
                        {companySearch && !companyId && companySuggestions.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-popover border border-border shadow-md rounded-md mt-1 z-50">
                                {companySuggestions.map(c => (
                                    <button
                                        key={c.id} type="button"
                                        className="w-full text-left px-4 py-2 hover:bg-muted text-xs"
                                        onClick={() => { setCompanySearch(c.name); setCompanyId(c.id); setCompanyManuallyEdited(true); }}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold text-foreground mb-1">Título</label>
                        <input
                            type="text"
                            className="w-full px-3 py-1.5 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none text-sm placeholder:text-muted-foreground/50"
                            placeholder="Ex: Venda de Licença Enterprise"
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); setIsTitleManuallyEdited(true); }}
                        />
                    </div>

                    {/* Value */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Valor</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-2.5 text-muted-foreground text-xs font-medium">{currency === 'BRL' ? 'R$' : currency}</span>
                                <input
                                    type="number" step="0.01"
                                    className="w-full pl-12 pr-3 py-1.5 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-primary/50 outline-none text-sm placeholder:text-muted-foreground/50"
                                    placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center px-3 border border-input bg-muted/20 rounded-md text-muted-foreground text-xs cursor-not-allowed whitespace-nowrap">{currency}</div>
                        </div>
                    </div>

                    {/* Pipeline & Stage */}
                    <div className="p-2 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Funil</label>
                            <select
                                className="w-full px-2 py-1.5 border border-input bg-background text-foreground rounded-md text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                                value={selectedPipelineId}
                                onChange={(e) => setSelectedPipelineId(e.target.value)}
                            >
                                {Object.values(pipelines).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Etapa</label>
                            <div className="flex gap-1 w-full overflow-x-auto pb-1">
                                {stages.map((stage, index) => {
                                    const isSelected = stage.id === selectedStageId;
                                    const isPassed = stages.findIndex(s => s.id === selectedStageId) > index;
                                    return (
                                        <div
                                            key={stage.id} onClick={() => setSelectedStageId(stage.id)}
                                            className={`flex-1 min-w-[40px] h-6 cursor-pointer transition-colors relative first:rounded-l-sm last:rounded-r-sm ${isSelected ? 'bg-green-500' : isPassed ? 'bg-green-200' : 'bg-muted'}`}
                                            title={stage.title}
                                        >
                                            <div className={`absolute top-0 right-[-4px] w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[6px] z-10 ${isSelected ? 'border-l-green-500' : isPassed ? 'border-l-green-200' : 'border-l-muted'}`} />
                                            <div className="absolute top-0 right-[-5px] w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[6px] border-l-background z-0" />
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="text-xs text-muted-foreground text-right font-medium">{stages.find(s => s.id === selectedStageId)?.title || 'Selecione uma etapa'}</div>
                        </div>
                    </div>

                    {/* Phone & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Telefone</label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
                                <input type="tel" className="w-full pl-8 pr-3 py-2 border border-input bg-background text-foreground rounded-md text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-muted-foreground/50" placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">E-mail</label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
                                <input type="email" className="w-full pl-8 pr-3 py-2 border border-input bg-background text-foreground rounded-md text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-muted-foreground/50" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Date & Source */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Data de adição</label>
                            <input type="date" className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm focus:ring-2 focus:ring-primary/50 outline-none" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Origem</label>
                            <select className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm focus:ring-2 focus:ring-primary/50 outline-none" value={source} onChange={(e) => setSource(e.target.value)}>
                                <option value="">Selecione...</option>
                                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Labels */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-2">Etiquetas</label>
                        <div className="flex flex-wrap gap-2">
                            {LABELS.map(label => (
                                <button
                                    key={label.id} type="button"
                                    onClick={() => setSelectedLabels(prev => prev.includes(label.id) ? prev.filter(x => x !== label.id) : [...prev, label.id])}
                                    className={`px-2 py-1 rounded-full text-[10px] font-medium border transition-all ${selectedLabels.includes(label.id) ? `${label.color} border-transparent ring-1 ring-primary/20` : 'bg-background border-border text-muted-foreground hover:border-primary/50'}`}
                                >
                                    {label.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-4 sm:mt-2 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-2 border-t border-border shrink-0 bg-background/80 backdrop-blur-sm sm:bg-transparent">
                    <button type="button" onClick={handleOnClose} disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors order-2 sm:order-1 disabled:opacity-50">Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-6 py-2.5 sm:py-2 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors shadow-md order-1 sm:order-2 disabled:opacity-50">
                        {isSubmitting ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
