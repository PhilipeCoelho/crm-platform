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
    };

    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (!isNewDealModalOpen) {
            setIsInitialized(false);
            return;
        }

        if (isInitialized) return;
        if (isLoading) return; // Wait for data to load before populating

        if (dealToEdit) {
            setTitle(dealToEdit.title);
            setIsTitleManuallyEdited(true);
            setValue(dealToEdit.value.toString());
            setExpectedCloseDate(dealToEdit.expectedCloseDate || new Date().toISOString().split('T')[0]);
            setSelectedLabels(dealToEdit.tags || []);
            setSelectedPipelineId(dealToEdit.pipelineId || 'sales');
            setSelectedStageId(dealToEdit.stageId);
            setSource(dealToEdit.source || '');

            const linkedContact = contacts.find(c => c.id === dealToEdit.contactId);
            setContactId(dealToEdit.contactId || '');
            setContactSearch(linkedContact?.name || '');
            setPhone(linkedContact?.phone || '');
            setEmail(linkedContact?.email || '');

            const linkedCompany = companies.find(c => c.id === dealToEdit.companyId);
            setCompanyId(dealToEdit.companyId || '');
            setCompanySearch(linkedCompany?.name || '');
            setCompanyManuallyEdited(true);
            setInstagramUrl(dealToEdit.instagramUrl || '');
            setAdLibraryUrl(dealToEdit.adLibraryUrl || '');
            setWebsite(linkedCompany?.website || '');

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
    }, [isNewDealModalOpen, dealToEdit, newDealStageId, pipelines, contacts, companies, isInitialized, isLoading]);

    useEffect(() => {
        if (isNewDealModalOpen && !dealToEdit && !companyManuallyEdited && !companyId) {
            setCompanySearch(contactSearch);
        }
    }, [contactSearch, companyId, companyManuallyEdited, dealToEdit, isNewDealModalOpen]);

    useEffect(() => {
        if (isNewDealModalOpen && !isTitleManuallyEdited && !dealToEdit) {
            setTitle(contactSearch ? `Negócio ${contactSearch}` : 'Negócio');
        }
    }, [contactSearch, isTitleManuallyEdited, dealToEdit, isNewDealModalOpen]);

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
                            <input type="text" className="w-full pl-9 pr-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary transition-colors" placeholder="Nome" value={contactSearch} onChange={(e) => { setContactSearch(e.target.value); setContactId(''); }} />
                            {contactId && <Check className="absolute right-3 top-2.5 text-emerald-500" size={14} />}
                        </div>
                        {contactSearch && !contactId && contactSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded mt-1 z-50">
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
                            <input type="text" className="w-full pl-9 pr-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary" placeholder="Empresa" value={companySearch} onChange={(e) => { setCompanySearch(e.target.value); setCompanyId(''); setCompanyManuallyEdited(true); }} />
                        </div>
                    </div>

                    {/* Linha 3: Título */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Título do Negócio</label>
                        <input type="text" className="w-full px-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-semibold outline-none focus:border-primary" value={title} onChange={(e) => { setTitle(e.target.value); setIsTitleManuallyEdited(true); }} />
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

                    {/* Linha 5: Funil & Etapa */}
                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/50 rounded-xl space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            <span>Funil & Etapa</span>
                            <select className="bg-transparent border-0 text-primary font-bold outline-none p-0 h-auto cursor-pointer hover:opacity-80 transition-opacity" value={selectedPipelineId} onChange={(e) => setSelectedPipelineId(e.target.value)}>
                                {Object.values(pipelines).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-1.5 h-1.5">
                            {stages.map((stage, idx) => (
                                <div key={stage.id} onClick={() => setSelectedStageId(stage.id)} className={`flex-1 rounded-full cursor-pointer transition-all duration-300 ${stage.id === selectedStageId ? 'bg-primary ring-4 ring-primary/10' : stages.findIndex(s => s.id === selectedStageId) > idx ? 'bg-primary/30' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                            ))}
                        </div>
                        <div className="text-[10px] text-right font-black text-primary/80 uppercase tracking-tighter">{stages.find(s => s.id === selectedStageId)?.title}</div>
                    </div>

                    {/* Linha 6: Origem */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Canal de Origem</label>
                        <select className="w-full px-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary cursor-pointer" value={source} onChange={(e) => setSource(e.target.value)}>
                            <option value="">Selecione...</option>
                            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Linha 7: Contatos (Agrupados para salvar altura) */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Telefone / E-mail</label>
                            <input type="tel" className="w-full px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary mb-1.5" placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                            <input type="email" className="w-full px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Web / Instagram</label>
                            <input type="text" className="w-full px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary mb-1.5" placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
                            <input type="text" className="w-full px-3 py-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded text-xs outline-none focus:border-primary" placeholder="@instagram" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} />
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
