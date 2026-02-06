import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import { Building, User, Phone, Mail, Check } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { Deal } from '@/types/schema';

interface NewDealModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialColumnId?: string;
    dealToEdit?: Deal | null;
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
    // Remove dots (thousands separator) and replace comma with dot (decimal)
    const normalized = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
};

export default function NewDealModal({ isOpen, onClose, initialColumnId, dealToEdit, currency = 'BRL' }: NewDealModalProps) {
    const { addDeal, updateDeal, companies, contacts, pipelines, addCompany, addContact, updateContact } = useCRM();

    // --- Form State ---
    const [title, setTitle] = useState('');
    const [value, setValue] = useState('');
    // Default to today
    const [expectedCloseDate, setExpectedCloseDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

    // Pipeline & Stage State
    const [selectedPipelineId, setSelectedPipelineId] = useState('sales'); // Default
    const [selectedStageId, setSelectedStageId] = useState(''); // Validated effect will set this

    const [source, setSource] = useState('Google Maps');
    // Removed sourceId state

    // --- Smart Contact/Org State ---
    const [contactSearch, setContactSearch] = useState('');
    const [contactId, setContactId] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');

    const [companySearch, setCompanySearch] = useState('');
    const [companyId, setCompanyId] = useState('');
    // Track if user manually edited company name to stop mirroring
    const [companyManuallyEdited, setCompanyManuallyEdited] = useState(false);

    // Update selectedStageId when pipeline changes or on init
    useEffect(() => {
        const pipeline = pipelines[selectedPipelineId];
        if (pipeline && pipeline.stages.length > 0) {
            // If current stage is valid for this pipeline, keep it (unless we switched pipelines and IDs dont match)
            // simplified: just default to first stage if switching, or keep if editing and matches
            const isValid = pipeline.stages.find(s => s.id === selectedStageId);
            if (!isValid) {
                setSelectedStageId(pipeline.stages[0].id);
            }
        }
    }, [selectedPipelineId, pipelines, selectedStageId]);

    // Initial load
    useEffect(() => {
        if (isOpen) {
            if (dealToEdit) {
                // Edit Mode
                setTitle(dealToEdit.title);
                setValue(dealToEdit.value.toString());
                setExpectedCloseDate(dealToEdit.expectedCloseDate || '');
                setSelectedLabels(dealToEdit.tags || []);

                if (dealToEdit.pipelineId) setSelectedPipelineId(dealToEdit.pipelineId);
                setSelectedStageId(dealToEdit.stageId);

                setSource(dealToEdit.source || 'Google Maps');
                // Removed sourceId

                const linkedContact = contacts.find(c => c.id === dealToEdit.contactId);
                setContactId(dealToEdit.contactId || '');
                setContactSearch(linkedContact?.name || '');
                setPhone(linkedContact?.phone || '');
                setEmail(linkedContact?.email || '');

                const linkedCompany = companies.find(c => c.id === dealToEdit.companyId);
                setCompanyId(dealToEdit.companyId || '');
                setCompanySearch(linkedCompany?.name || '');
                setCompanyManuallyEdited(true);
            } else {
                // New Mode
                resetForm();
                if (initialColumnId) {
                    // Find which pipeline this col belongs to
                    const pipe = Object.values(pipelines).find(p => p.stages.some(s => s.id === initialColumnId));
                    if (pipe) setSelectedPipelineId(pipe.id);
                    setSelectedStageId(initialColumnId);
                }
            }
        }
    }, [isOpen, dealToEdit, initialColumnId, pipelines, contacts, companies]);

    // Mirroring Logic: If Contact Name changes and Company wasn't manually edited, update Company Name
    useEffect(() => {
        if (!dealToEdit && !companyManuallyEdited && !companyId) {
            setCompanySearch(contactSearch);
        }
    }, [contactSearch, companyId, companyManuallyEdited, dealToEdit]);

    // Title Mirroring Logic: Always 'Negócio [Contact Name]' if not editing an existing custom title (or always if user insists?)
    // User said: "quero que seja sempre a palavra 'negócio ' e o mesmo nome da pessoa de contato."
    // I will force it for new deals. For edits, I'll respect existing, unless they change the contact?
    // Let's make it reactive to contactSearch for now.
    useEffect(() => {
        if (contactSearch) {
            setTitle(`Negócio ${contactSearch}`);
        } else {
            setTitle('Negócio');
        }
    }, [contactSearch]);

    const resetForm = () => {
        setTitle('Negócio');
        setValue('');
        setExpectedCloseDate(new Date().toISOString().split('T')[0]);
        setSelectedLabels([]);
        // Default pipeline reset
        setSelectedPipelineId('sales');
        if (pipelines['sales']?.stages?.length > 0) setSelectedStageId(pipelines['sales'].stages[0].id);

        setSource('Google Maps');
        setContactSearch('');
        setContactId('');
        setPhone('');
        setEmail('');
        setCompanySearch('');
        setCompanyId('');
        setCompanyManuallyEdited(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalCompanyId = companyId;
        let finalContactId = contactId;

        // 1. Resolve Company
        if (!finalCompanyId && companySearch) {
            // Check if exists by name
            const existingCo = companies.find(c => c.name.toLowerCase() === companySearch.toLowerCase());
            if (existingCo) finalCompanyId = existingCo.id;
            else {
                const newCo = await addCompany({ name: companySearch });
                finalCompanyId = newCo.id;
            }
        }

        // 2. Resolve Contact
        if (!finalContactId && contactSearch) {
            const existingCt = contacts.find(c => c.name.toLowerCase() === contactSearch.toLowerCase());
            if (existingCt) finalContactId = existingCt.id;
            else {
                const newCt = await addContact({
                    name: contactSearch,
                    email,
                    phone,
                    companyId: finalCompanyId, // Link to company
                    status: 'lead'
                });
                finalContactId = newCt.id;
            }
        } else if (finalContactId && !dealToEdit) {
            // Update existing contact info if different (and provided)
            // This ensures "detailment of saved contacts" gets updated with new info from the deal form
            if (phone || email) {
                await updateContact(finalContactId, {
                    phone: phone || undefined,
                    email: email || undefined
                });
            }
        }

        const dealData = {
            title: title || (contactSearch ? `Negócio com ${contactSearch}` : 'Novo Negócio'),
            value: parseCurrency(value),
            currency: currency,
            pipelineId: selectedPipelineId,
            stageId: selectedStageId,
            companyId: finalCompanyId || undefined,
            contactId: finalContactId || undefined,
            expectedCloseDate: expectedCloseDate || undefined,
            tags: selectedLabels,
            source,
            // sourceId removed
        };

        if (dealToEdit) {
            updateDeal(dealToEdit.id, dealData);
        } else {
            addDeal({
                ...dealData,
                status: 'open',
                priority: 'medium',
            });
        }

        onClose();
    };

    // Derived Stages based on selected Pipeline
    const currentPipeline = pipelines[selectedPipelineId];
    const stages = currentPipeline?.stages || [];

    // Filter suggestions
    const contactSuggestions = useMemo(() => {
        if (!contactSearch) return [];
        return contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) && c.id !== contactId).slice(0, 5);
    }, [contactSearch, contacts, contactId]);

    const companySuggestions = useMemo(() => {
        if (!companySearch) return [];
        return companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()) && c.id !== companyId).slice(0, 5);
    }, [companySearch, companies, companyId]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={dealToEdit ? "Editar Negócio" : "Adicionar lead"} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col h-[80vh] md:h-auto overflow-hidden">
                <div className="flex-1 overflow-y-auto p-1 space-y-2">

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
                                onChange={(e) => {
                                    setContactSearch(e.target.value);
                                    setContactId('');
                                }}
                            />
                            {contactId && <div className="absolute right-3 top-2.5 text-green-600"><Check size={14} /></div>}
                        </div>
                        {contactSearch && !contactId && contactSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-popover border border-border shadow-md rounded-md mt-1 z-50">
                                {contactSuggestions.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        className="w-full text-left px-4 py-2 hover:bg-muted text-xs flex items-center justify-between"
                                        onClick={() => {
                                            setContactSearch(c.name);
                                            setContactId(c.id);
                                            setPhone(c.phone || '');
                                            setEmail(c.email || '');
                                            if (c.companyId) {
                                                const co = companies.find(comp => comp.id === c.companyId);
                                                if (co) {
                                                    setCompanySearch(co.name);
                                                    setCompanyId(co.id);
                                                }
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
                                onChange={(e) => {
                                    setCompanySearch(e.target.value);
                                    setCompanyId('');
                                    setCompanyManuallyEdited(true);
                                }}
                            />
                            {companyId && <div className="absolute right-3 top-2.5 text-green-600"><Check size={14} /></div>}
                        </div>
                        {companySearch && !companyId && companySuggestions.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-popover border border-border shadow-md rounded-md mt-1 z-50">
                                {companySuggestions.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        className="w-full text-left px-4 py-2 hover:bg-muted text-xs"
                                        onClick={() => {
                                            setCompanySearch(c.name);
                                            setCompanyId(c.id);
                                            setCompanyManuallyEdited(true);
                                        }}
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
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    {/* Value */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Valor</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-2.5 text-muted-foreground text-xs font-medium">{currency === 'BRL' ? 'R$' : currency}</span>
                                <input
                                    type="number"
                                    className="w-full pl-12 pr-3 py-1.5 border border-input bg-background text-foreground rounded-md focus:ring-2 focus:ring-primary/50 outline-none text-sm placeholder:text-muted-foreground/50"
                                    placeholder="0,00"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center px-3 border border-input bg-muted/20 rounded-md text-muted-foreground text-xs cursor-not-allowed whitespace-nowrap">
                                {currency}
                            </div>
                        </div>
                    </div>

                    {/* Pipeline & Stage Selection */}
                    <div className="p-2 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                        {/* Pipeline Selector */}
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Funil</label>
                            <select
                                className="w-full px-2 py-1.5 border border-input bg-background text-foreground rounded-md text-xs focus:ring-2 focus:ring-primary/50 outline-none"
                                value={selectedPipelineId}
                                onChange={(e) => setSelectedPipelineId(e.target.value)}
                            >
                                {Object.values(pipelines).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Visual Stage Selector */}
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Etapa</label>
                            <div className="flex gap-1 w-full overflow-x-auto pb-1">
                                {stages.map((stage, index) => {
                                    const isSelected = stage.id === selectedStageId;
                                    const isPassed = stages.findIndex(s => s.id === selectedStageId) > index;
                                    return (
                                        <div
                                            key={stage.id}
                                            onClick={() => setSelectedStageId(stage.id)}
                                            className={`
                                                flex-1 min-w-[40px] h-6 cursor-pointer transition-colors relative group
                                                first:rounded-l-sm last:rounded-r-sm
                                                ${isSelected ? 'bg-green-500' : isPassed ? 'bg-green-200' : 'bg-muted'}
                                            `}
                                            title={stage.title}
                                        >
                                            <div className={`absolute top-0 right-[-4px] w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[6px] z-10
                                                ${isSelected ? 'border-l-green-500' : isPassed ? 'border-l-green-200' : 'border-l-muted'}
                                            `} />
                                            <div className="absolute top-0 right-[-5px] w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[6px] border-l-background z-0" />
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="text-xs text-muted-foreground text-right font-medium">
                                {stages.find(s => s.id === selectedStageId)?.title || 'Selecione uma etapa'}
                            </div>
                        </div>
                    </div>

                    {/* Phone & Email */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Telefone</label>
                            <div className="relative">
                                <Phone size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
                                <input
                                    type="tel"
                                    className="w-full pl-8 pr-3 py-1.5 border border-input bg-background text-foreground rounded-md text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-muted-foreground/50"
                                    placeholder="Telefone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    readOnly={!!contactId} // Read only if selected from existing? Maybe editable is better. Pipedrive allows edit.
                                // Actually user might want to update it. Let's keep it editable but maybe warn it updates contact? 
                                // For simplicity, just editable.
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">E-mail</label>
                            <div className="relative">
                                <Mail size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
                                <input
                                    type="email"
                                    className="w-full pl-8 pr-3 py-1.5 border border-input bg-background text-foreground rounded-md text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-muted-foreground/50"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Date & Source */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Data de adição</label>
                            <input
                                type="date"
                                className="w-full px-3 py-1.5 border border-input bg-background text-foreground rounded-md text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                                value={expectedCloseDate}
                                onChange={(e) => setExpectedCloseDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Origem</label>
                            <select
                                className="w-full px-3 py-1.5 border border-input bg-background text-foreground rounded-md text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                            >
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
                                    key={label.id}
                                    type="button"
                                    onClick={() => setSelectedLabels(prev => prev.includes(label.id) ? prev.filter(x => x !== label.id) : [...prev, label.id])}
                                    className={`
                                        px-2 py-1 rounded-full text-[10px] font-medium border transition-all
                                        ${selectedLabels.includes(label.id)
                                            ? `${label.color} border-transparent ring-1 ring-primary/20`
                                            : 'bg-background border-border text-muted-foreground hover:border-primary/50'}
                                    `}
                                >
                                    {label.name}
                                </button>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="mt-2 flex justify-end gap-3 pt-2 border-t border-border shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors shadow-sm"
                    >
                        Salvar
                    </button>
                </div>
            </form>
        </Modal>
    );
}
