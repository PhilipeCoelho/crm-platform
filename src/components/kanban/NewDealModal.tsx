import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import { Building, User, Check, Calendar } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';

interface NewDealModalProps { currency?: string; }

const SOURCES = ['Google Maps', 'Indicação', 'Website', 'LinkedIn', 'Instagram', 'Cold Call', 'Eventos', 'Outros'];
const LABELS = [
    { id: '1', name: 'Quente', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900' },
    { id: '2', name: 'Morno', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900' },
    { id: '3', name: 'Frio', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900' },
];

const parseCurrency = (value: string): number => {
    if (!value) return 0;
    const cleanValue = value.replace(',', '.').replace(/[^\d.]/g, '');
    return parseFloat(cleanValue) || 0;
};

export default function NewDealModal({ currency = 'BRL' }: NewDealModalProps) {
    const { addDeal, updateDeal, companies, contacts, pipelines, addCompany, updateCompany, addContact, updateContact, isNewDealModalOpen, closeNewDealModal, newDealStageId, dealToEdit, isLoading } = useCRM();

    const [title, setTitle] = useState('Negócio');
    const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
    const [value, setValue] = useState('');
    const [expectedCloseDate, setExpectedCloseDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState('sales');
    const [selectedStageId, setSelectedStageId] = useState('');
    const [source, setSource] = useState('');
    const [contactSearch, setContactSearch] = useState('');
    const [contactId, setContactId] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [companySearch, setCompanySearch] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [companyManuallyEdited, setCompanyManuallyEdited] = useState(false);
    const [instagramUrl, setInstagramUrl] = useState('');
    const [adLibraryUrl, setAdLibraryUrl] = useState('');
    const [website, setWebsite] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setTitle('Negócio');
        setIsTitleManuallyEdited(false);
        setValue('');
        setExpectedCloseDate(new Date().toISOString().split('T')[0]);
        setSelectedLabels([]);
        setSource('');
        setContactSearch('');
        setContactId('');
        setPhone('');
        setEmail('');
        setCompanySearch('');
        setCompanyId('');
        setCompanyManuallyEdited(false);
        setInstagramUrl('');
        setAdLibraryUrl('');
        setWebsite('');
        setSelectedStageId('');
        setTouchedFields(new Set());
    };

    const [isInitialized, setIsInitialized] = useState(false);
    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

    const markFieldAsTouched = (field: string) => {
        if (!isNewDealModalOpen) return;
        setTouchedFields(prev => {
            if (prev.has(field)) return prev;
            const next = new Set(prev);
            next.add(field);
            return next;
        });
    };

    useEffect(() => {
        if (!isNewDealModalOpen) {
            setIsInitialized(false);
            return;
        }

        if (isInitialized) return;

        if (dealToEdit) {
            setTitle(dealToEdit.title);
            setIsTitleManuallyEdited(true);
            setValue(dealToEdit.value.toString());
            setExpectedCloseDate(dealToEdit.expectedCloseDate || new Date().toISOString().split('T')[0]);
            setSelectedLabels(dealToEdit.tags || []);
            setSelectedPipelineId(dealToEdit.pipelineId || 'sales');
            setSelectedStageId(dealToEdit.stageId);
            setSource(dealToEdit.source || '');
            setInstagramUrl(dealToEdit.instagramUrl || '');
            setAdLibraryUrl(dealToEdit.adLibraryUrl || '');

            if (!isLoading) {
                const linkedContact = contacts.find(c => c.id === dealToEdit.contactId);
                setContactId(dealToEdit.contactId || '');
                setContactSearch(linkedContact?.name || '');
                setPhone(linkedContact?.phone || '');
                setEmail(linkedContact?.email || '');

                const linkedCompany = companies.find(c => c.id === dealToEdit.companyId);
                setCompanyId(dealToEdit.companyId || '');
                setCompanySearch(linkedCompany?.name || '');
                setCompanyManuallyEdited(true);
                setWebsite(linkedCompany?.website || '');
            }

            setIsInitialized(true);
        } else {
            resetForm();
            if (newDealStageId) {
                const pipe = Object.values(pipelines).find(p => p.stages.some(s => s.id === newDealStageId));
                if (pipe) {
                    setSelectedPipelineId(pipe.id);
                    setSelectedStageId(newDealStageId);
                }
            }
            setIsInitialized(true);
        }
    }, [isNewDealModalOpen, dealToEdit, newDealStageId, pipelines, isInitialized, isLoading]);

    useEffect(() => {
        if (isNewDealModalOpen && dealToEdit && isInitialized && !isLoading) {
            if (!touchedFields.has('contact')) {
                const linkedContact = contacts.find(c => c.id === dealToEdit.contactId);
                if (linkedContact) {
                    setContactId(dealToEdit.contactId || '');
                    setContactSearch(linkedContact.name);
                    setPhone(p => touchedFields.has('phone') ? p : (linkedContact.phone || ''));
                    setEmail(e => touchedFields.has('email') ? e : (linkedContact.email || ''));
                }
            }
            if (!touchedFields.has('company')) {
                const linkedCompany = companies.find(c => c.id === dealToEdit.companyId);
                if (linkedCompany) {
                    setCompanyId(dealToEdit.companyId || '');
                    setCompanySearch(linkedCompany.name);
                    setWebsite(w => touchedFields.has('website') ? w : (linkedCompany.website || ''));
                }
            }
        }
    }, [isLoading, contacts, companies, isNewDealModalOpen, dealToEdit, isInitialized, touchedFields]);

    useEffect(() => {
        if (isNewDealModalOpen && !dealToEdit && !companyManuallyEdited && !companyId && !touchedFields.has('company')) {
            setCompanySearch(contactSearch);
        }
    }, [contactSearch, companyId, companyManuallyEdited, dealToEdit, isNewDealModalOpen, touchedFields]);

    useEffect(() => {
        if (isNewDealModalOpen && !isTitleManuallyEdited && !dealToEdit && !touchedFields.has('title')) {
            setTitle(contactSearch ? `Negócio ${contactSearch}` : 'Negócio');
        }
    }, [contactSearch, isTitleManuallyEdited, dealToEdit, isNewDealModalOpen, touchedFields]);

    const handleOnClose = () => { closeNewDealModal(); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            let finalCoId = companyId;
            let finalCtId = contactId;

            // 1. Handle Company
            if (companySearch) {
                if (finalCoId) {
                    // Update existing company if website changed
                    const ex = companies.find(c => c.id === finalCoId);
                    if (ex && website !== undefined && ex.website !== website) {
                        await updateCompany(finalCoId, { website });
                    }
                } else {
                    // Search or Create
                    const ex = companies.find(c => c.name.toLowerCase() === companySearch.toLowerCase());
                    if (ex) {
                        finalCoId = ex.id;
                        if (website !== undefined && ex.website !== website) await updateCompany(ex.id, { website });
                    }
                    else {
                        const newCo = await addCompany({ name: companySearch, website: website || undefined });
                        finalCoId = newCo.id;
                    }
                }
            }

            // 2. Handle Contact
            if (contactSearch) {
                if (finalCtId) {
                    // Update existing contact if phone/email changed
                    const ex = contacts.find(c => c.id === finalCtId);
                    if (ex && (email !== ex.email || phone !== ex.phone)) {
                        await updateContact(finalCtId, { email, phone });
                    }
                } else {
                    // Search or Create
                    const ex = contacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase());
                    if (ex) {
                        finalCtId = ex.id;
                        if (email !== ex.email || phone !== ex.phone) await updateContact(ex.id, { email, phone });
                    } else {
                        const newCt = await addContact({ name: contactSearch, email, phone, companyId: finalCoId, status: 'lead' });
                        finalCtId = newCt.id;
                    }
                }
            }

            const dealData = {
                title,
                value: parseCurrency(value),
                currency,
                pipelineId: selectedPipelineId,
                stageId: selectedStageId,
                companyId: finalCoId,
                contactId: finalCtId,
                expectedCloseDate,
                tags: selectedLabels,
                source: source || undefined,
                instagramUrl,
                adLibraryUrl,
                status: dealToEdit?.status || 'open',
                priority: dealToEdit?.priority || 'medium'
            };

            if (dealToEdit) await updateDeal(dealToEdit.id, dealData);
            else await addDeal(dealData);

            handleOnClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const stages = pipelines[selectedPipelineId]?.stages || [];
    const contactSuggestions = useMemo(() => (!contactSearch ? [] : contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) && c.id !== contactId).slice(0, 3)), [contactSearch, contacts, contactId]);

    return (
        <Modal isOpen={isNewDealModalOpen} onClose={handleOnClose} title={dealToEdit ? "Editar Negócio" : "Adicionar negócio"} maxWidth="max-w-[420px]">
            <form onSubmit={handleSubmit} className="flex flex-col h-auto overflow-hidden bg-background premium-shadow">
                <div className="flex-1 p-5 sm:p-6 space-y-5">

                    {/* Linha 1: Pessoa de Contato */}
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Pessoa de contato</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-slate-400" size={14} />
                            <input type="text" className="w-full pl-9 pr-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary transition-colors" placeholder="Nome" value={contactSearch} onChange={(e) => { setContactSearch(e.target.value); setContactId(''); markFieldAsTouched('contact'); }} />
                            {contactId && <Check className="absolute right-3 top-2.5 text-emerald-500" size={14} />}
                        </div>
                        {contactSearch && !contactId && contactSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-white dark:bg-card border border-slate-200 dark:border-border shadow-xl rounded mt-1 z-50">
                                {contactSuggestions.map(c => (
                                    <button key={c.id} type="button" className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[10px] border-b last:border-0 border-zinc-100 dark:border-zinc-800" onClick={() => { setContactSearch(c.name); setContactId(c.id); setPhone(c.phone || ''); setEmail(c.email || ''); }}>{c.name}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Linha 2: Organização */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Organização</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-2.5 text-slate-400" size={14} />
                            <input type="text" className="w-full pl-9 pr-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary" placeholder="Empresa" value={companySearch} onChange={(e) => { setCompanySearch(e.target.value); setCompanyId(''); setCompanyManuallyEdited(true); markFieldAsTouched('company'); }} />
                        </div>
                    </div>

                    {/* Linha 3: Título */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Título do Negócio</label>
                        <input type="text" className="w-full px-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-semibold outline-none focus:border-primary" value={title} onChange={(e) => { setTitle(e.target.value); setIsTitleManuallyEdited(true); markFieldAsTouched('title'); }} />
                    </div>

                    {/* Linha 4: Valor & Data (Agrupados para salvar altura) */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Valor ({currency})</label>
                            <input type="text" className="w-full px-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-bold outline-none focus:border-primary" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Data Adição</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 text-slate-400" size={14} />
                                <input type="date" className="w-full pl-9 pr-2 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} required />
                            </div>
                        </div>
                    </div>

                    {/* Linha 5: Funil & Etapa com Barra de Progresso Horizontal Premium */}
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/50 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            <span>Funil & Etapa</span>
                            <select className="bg-transparent border-0 text-primary font-bold outline-none p-0 h-auto cursor-pointer hover:opacity-80 transition-opacity" value={selectedPipelineId} onChange={(e) => setSelectedPipelineId(e.target.value)}>
                                {Object.values(pipelines).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        {/* Barra de Progresso Segmentada Compacta */}
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 select-none -mx-1 px-1 custom-scrollbar">
                            {stages.map((stage: any, idx: number) => {
                                const currentStageIndex = stages.findIndex((s: any) => s.id === selectedStageId);
                                const isActive = stage.id === selectedStageId;
                                const isCompleted = idx < currentStageIndex;
                                
                                let bgClass = '';
                                let textClass = '';
                                let borderClass = '';
                                let glowClass = '';

                                if (isActive) {
                                    if (dealToEdit?.status === 'won') {
                                        bgClass = 'bg-emerald-500 text-white';
                                        borderClass = 'border-emerald-600 dark:border-emerald-500';
                                        glowClass = 'shadow-[0_2px_6px_rgba(16,185,129,0.25)]';
                                    } else if (dealToEdit?.status === 'lost') {
                                        bgClass = 'bg-rose-500 text-white';
                                        borderClass = 'border-rose-600 dark:border-rose-500';
                                        glowClass = 'shadow-[0_2px_6px_rgba(244,63,94,0.25)]';
                                    } else {
                                        bgClass = 'bg-primary text-white';
                                        borderClass = 'border-primary';
                                        glowClass = 'shadow-[0_2px_6px_rgba(59,130,246,0.25)]';
                                    }
                                } else if (isCompleted) {
                                    if (dealToEdit?.status === 'won') {
                                        bgClass = 'bg-emerald-50/70 dark:bg-emerald-950/20';
                                        textClass = 'text-emerald-600 dark:text-emerald-400 font-bold';
                                        borderClass = 'border-emerald-100 dark:border-emerald-900/20';
                                    } else {
                                        bgClass = 'bg-primary/5 dark:bg-primary/10';
                                        textClass = 'text-primary dark:text-primary font-bold';
                                        borderClass = 'border-primary/10 dark:border-primary/25';
                                    }
                                } else {
                                    bgClass = 'bg-white dark:bg-zinc-900/60';
                                    textClass = 'text-zinc-400 dark:text-zinc-500 font-medium';
                                    borderClass = 'border-zinc-200/50 dark:border-zinc-800/40';
                                }

                                const interactiveHoverClass = !isActive 
                                    ? (isCompleted 
                                        ? 'hover:bg-primary/10 dark:hover:bg-primary/20 hover:text-primary transition-all duration-200' 
                                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all duration-200')
                                    : 'transition-all duration-200';

                                return (
                                    <button
                                        key={stage.id}
                                        type="button"
                                        onClick={() => setSelectedStageId(stage.id)}
                                        title={`Mudar para ${stage.title}`}
                                        className={`
                                            flex-1 min-w-[70px] xs:min-w-[80px] sm:min-w-[90px] py-1.5 px-1.5
                                            rounded-lg border text-[9px] font-bold uppercase tracking-wider text-center truncate
                                            relative overflow-hidden transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99]
                                            ${bgClass} ${textClass} ${borderClass} ${glowClass} ${interactiveHoverClass}
                                        `}
                                    >
                                        <div className="flex items-center justify-center gap-0.5 truncate">
                                            {isCompleted && (
                                                <Check size={8} strokeWidth={3} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
                                            )}
                                            <span className="truncate">{stage.title}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Linha 6: Origem */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Canal de Origem</label>
                        <select className="w-full px-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary cursor-pointer" value={source} onChange={(e) => setSource(e.target.value)}>
                            <option value="">Selecione...</option>
                            {SOURCES.map((s: any) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Linha 7: Contatos (Agrupados para salvar altura) */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Telefone / E-mail</label>
                            <input type="tel" className="w-full px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary mb-1.5" placeholder="Telefone" value={phone} onChange={(e) => { setPhone(e.target.value); markFieldAsTouched('phone'); }} />
                            <input type="email" className="w-full px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary" placeholder="E-mail" value={email} onChange={(e) => { setEmail(e.target.value); markFieldAsTouched('email'); }} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Web / Instagram</label>
                            <input type="text" className="w-full px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary mb-1.5" placeholder="Website" value={website} onChange={(e) => { setWebsite(e.target.value); markFieldAsTouched('website'); }} />
                            <input type="text" className="w-full px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary" placeholder="@instagram" value={instagramUrl} onChange={(e) => { setInstagramUrl(e.target.value); markFieldAsTouched('instagram'); }} />
                        </div>
                    </div>

                    {/* Linha 8: Etiquetas */}
                    <div className="flex items-center justify-between pt-1 gap-4">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Etiquetas</label>
                            <div className="flex gap-1">
                                {LABELS.map(l => (
                                    <button key={l.id} type="button" onClick={() => setSelectedLabels(prev => prev.includes(l.id) ? prev.filter(x => x !== l.id) : [...prev, l.id])} className={`px-2 py-1 rounded text-[9px] font-bold border transition-all ${selectedLabels.includes(l.id) ? `${l.color} border-transparent` : 'bg-transparent border-zinc-100 dark:border-zinc-800 text-zinc-400'}`}>{l.name}</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Link Auxiliar</label>
                            <input type="text" className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded text-[9px] text-zinc-500" placeholder="Ads Lib..." value={adLibraryUrl} onChange={(e) => setAdLibraryUrl(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Footer Fixo */}
                <div className="p-5 bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between gap-4">
                    <button type="button" onClick={handleOnClose} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors uppercase tracking-widest">Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="px-10 py-3 text-xs font-black text-primary-foreground bg-primary hover:brightness-110 rounded-lg shadow-xl shadow-primary/20 active:scale-[0.98] disabled:opacity-50 transition-all uppercase tracking-widest">
                        {isSubmitting ? 'Salvando...' : 'Salvar negócio'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
