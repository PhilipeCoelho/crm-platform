import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ArrowLeft, Building, User, Pencil, Trash2, X, Ban, MoreHorizontal, Phone, Check } from 'lucide-react';




import ActivityPanel from '@/components/deals/ActivityPanel';
import LostReasonModal from '@/components/deals/LostReasonModal';

import { Currency } from '@/data/currencies';

interface DealDetailsProps {
    dealId?: string;
    onClose?: () => void;
    isModal?: boolean;
    currency: Currency;
}

export default function DealDetails({ dealId: propId, onClose, isModal = false, currency }: DealDetailsProps) {
    const { id: paramId } = useParams();
    const navigate = useNavigate();
    const { deals, companies, contacts, updateDeal, deleteDeal, pipelines, openNewDealModal, updateContact, updateCompany } = useCRM();


    const id = propId || paramId;

    const deal = deals.find(d => d.id === id);
    const company = companies.find(c => c.id === deal?.companyId);
    const contact = contacts.find(c => c.id === deal?.contactId);


    const [isLostModalOpen, setIsLostModalOpen] = useState(false);

    // Inline Editing State
    const [editingField, setEditingField] = useState<'title' | 'value' | 'phone' | 'email' | 'stage' | null>(null);
    const [tempTitle, setTempTitle] = useState('');
    const [tempValue, setTempValue] = useState('');
    const [tempPhone, setTempPhone] = useState('');
    const [tempEmail, setTempEmail] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Focus input when editing starts
    useEffect(() => {
        if (editingField && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingField]);

    if (!deal) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-muted-foreground mb-4 font-medium dark:text-slate-400">Negócio não encontrado.</p>
                {isModal ? (
                    <button onClick={onClose} className="text-indigo-500 hover:text-indigo-400 font-bold transition-colors">Fechar</button>
                ) : (
                    <button onClick={() => navigate('/')} className="text-indigo-500 hover:text-indigo-400 font-bold transition-colors">Voltar</button>
                )}
            </div>
        );
    }

    const pipeline = pipelines[deal.pipelineId] || pipelines['sales'];

    if (!pipeline) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-muted-foreground dark:text-slate-400">Erro: Pipeline não encontrado.</p>
                {isModal ? (
                    <button onClick={onClose} className="text-indigo-500 hover:underline mt-2 font-bold">Fechar</button>
                ) : (
                    <button onClick={() => navigate('/')} className="text-indigo-500 hover:underline mt-2 font-bold">Voltar</button>
                )}
            </div>
        );
    }

    const currentStageIndex = pipeline.stages.findIndex(s => s.id === deal.stageId);
    const isClosed = deal.status !== 'open';

    const handleStageChange = (stageId: string) => {
        if (isClosed) return;
        updateDeal(deal.id, { stageId });
    };

    const handleDeleteDeal = () => {
        if (window.confirm('Tem certeza que deseja excluir este negócio? Esta ação não pode ser desfeita.')) {
            deleteDeal(deal.id);
            if (isModal) {
                onClose?.();
            } else {
                navigate('/kanban');
            }
        }
    };

    const handleWon = () => {
        updateDeal(deal.id, {
            status: 'won',
            wonAt: new Date().toISOString()
        });
    };

    const handleLost = () => {
        setIsLostModalOpen(true);
    };

    const confirmLost = (reason: string) => {
        updateDeal(deal.id, {
            status: 'lost',
            lostAt: new Date().toISOString(),
            lostReason: reason
        });
        setIsLostModalOpen(false);
    };

    const handleReopen = () => {
        updateDeal(deal.id, {
            status: 'open',
            wonAt: undefined,
            lostAt: undefined,
            lostReason: undefined
        });
    };

    // --- Inline Editing Handlers ---

    const startEditing = (field: 'title' | 'value' | 'phone' | 'email' | 'stage') => {
        if (isClosed && (field === 'title' || field === 'value')) return; // Allow editing contacts even if deal is closed?
        setEditingField(field);
        if (field === 'title') setTempTitle(deal.title);
        if (field === 'value') setTempValue(deal.value.toString());
        if (field === 'phone') setTempPhone(contact?.phone || '');
        if (field === 'email') setTempEmail(contact?.email || '');
    };

    const saveChanges = (field: string, value: any) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            if (field === 'title') updateDeal(deal.id, { title: value });
            if (field === 'value') updateDeal(deal.id, { value: parseFloat(value) || 0 });
            if (field === 'phone' && contact) updateContact(contact.id, { phone: value });
            if (field === 'email' && contact) updateContact(contact.id, { email: value });
            if (field === 'tags') updateDeal(deal.id, { tags: value });
        }, 400);
    };

    const handleBlur = () => {
        if (!editingField) return;

        // Final save on blur
        if (editingField === 'title') updateDeal(deal.id, { title: tempTitle });
        if (editingField === 'value') updateDeal(deal.id, { value: parseFloat(tempValue) || 0 });
        if (editingField === 'phone' && contact) updateContact(contact.id, { phone: tempPhone });
        if (editingField === 'email' && contact) updateContact(contact.id, { email: tempEmail });

        setEditingField(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        } else if (e.key === 'Escape') {
            setEditingField(null);
        }
    };

    const toggleTag = (tagId: string) => {
        const currentTags = deal.tags || [];
        const newTags = currentTags.includes(tagId)
            ? currentTags.filter(t => t !== tagId)
            : [...currentTags, tagId];
        updateDeal(deal.id, { tags: newTags });
    };

    return (
        <div className={`flex flex-col overflow-hidden w-full h-full bg-background ${!isModal && 'max-w-5xl mx-auto border-x border-border shadow-lg'}`}>

            {/* HEADER PIPEDRIVE STYLE */}
            <header className="shrink-0 bg-background border-b border-border dark:border-slate-800 px-6 py-6 z-40 relative">
                <button
                    onClick={() => isModal ? onClose?.() : navigate(-1)}
                    className="absolute top-6 left-6 p-2 hover:bg-muted dark:hover:bg-slate-800 rounded-full transition-colors shrink-0 text-muted-foreground z-50 focus:ring-2 focus:ring-indigo-500/20"
                    title="Fechar"
                >
                    {isModal ? <X size={20} /> : <ArrowLeft size={20} />}
                </button>

                <div className="flex items-start justify-between gap-4 pl-12">
                    {/* Top Left: Title Info */}
                    <div className="min-w-0 space-y-1.5 pt-1">
                        <div className="flex items-center gap-3">
                            {editingField === 'title' ? (
                                <input
                                    ref={inputRef as any}
                                    value={tempTitle}
                                    onChange={(e) => {
                                        setTempTitle(e.target.value);
                                        saveChanges('title', e.target.value);
                                    }}
                                    onBlur={handleBlur}
                                    onKeyDown={handleKeyDown}
                                    data-editable="true"
                                    className="text-xl font-bold text-indigo-500 dark:text-indigo-400 bg-transparent border-b-2 border-indigo-500/50 outline-none w-full max-w-[450px] transition-all"
                                    autoFocus
                                />
                            ) : (
                                <h1
                                    onClick={() => startEditing('title')}
                                    data-editable="true"
                                    className="text-xl font-bold text-foreground truncate max-w-[450px] hover:text-indigo-500 cursor-text transition-colors relative group"
                                >
                                    {deal.title}
                                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-indigo-500 group-hover:w-full transition-all duration-300"></span>
                                </h1>
                            )}
                            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase border shadow-sm ${deal.status === 'won' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                deal.status === 'lost' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                    'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800'
                                }`}>
                                {deal.status === 'open' ? 'Aberto' : deal.status === 'won' ? 'Ganho' : 'Perdido'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {editingField === 'value' ? (
                                <div className="flex items-center gap-1 border-b-2 border-indigo-500/50">
                                    <span className="text-sm font-bold text-indigo-500">{currency.symbol}</span>
                                    <input
                                        ref={inputRef as any}
                                        type="number"
                                        value={tempValue}
                                        onChange={(e) => {
                                            setTempValue(e.target.value);
                                            saveChanges('value', e.target.value);
                                        }}
                                        onBlur={handleBlur}
                                        onKeyDown={handleKeyDown}
                                        data-editable="true"
                                        className="text-sm font-bold text-indigo-500 dark:text-indigo-400 bg-transparent outline-none w-24"
                                    />
                                </div>
                            ) : (
                                <div
                                    className="group flex items-center gap-2 cursor-text w-fit"
                                    onClick={() => startEditing('value')}
                                    data-editable="true"
                                >
                                    <span className="text-sm font-bold text-primary dark:text-indigo-400 group-hover:underline decoration-indigo-500/30">
                                        {deal.value.toLocaleString(currency.locale, { style: 'currency', currency: currency.code })}
                                    </span>
                                    <Pencil size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Right: Actions */}
                    <div className="flex items-center gap-2">
                        {deal.status === 'open' ? (
                            <>
                                <button
                                    onClick={handleWon}
                                    className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"
                                >
                                    <Check size={16} />
                                    Ganho
                                </button>
                                <button
                                    onClick={handleLost}
                                    className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"
                                >
                                    <X size={16} />
                                    Perdido
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleReopen}
                                className="h-9 px-4 bg-muted dark:bg-slate-800 hover:bg-muted/80 border border-border dark:border-slate-700 rounded-md text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                            >
                                <Ban size={16} />
                                Reabrir
                            </button>
                        )}
                        <button className="p-2 hover:bg-muted dark:hover:bg-slate-800 rounded-md text-muted-foreground transition-colors ml-1">
                            <MoreHorizontal size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* PIPELINE BAR - LINHA FINA REFORMULADA */}
            <div className="bg-background border-b border-border dark:border-slate-800 px-6 py-4 shrink-0">
                <div className="flex items-center gap-1.5 w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    {pipeline.stages.map((stage, index) => {
                        const isActive = index === currentStageIndex;
                        const isPast = index < currentStageIndex;
                        const isWon = deal.status === 'won';
                        const isLost = deal.status === 'lost' && isActive;

                        let colorClass = "bg-transparent";
                        if (isWon) colorClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]";
                        else if (isLost) colorClass = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]";
                        else if (isActive) colorClass = "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]";
                        else if (isPast) colorClass = "bg-indigo-500/30";

                        return (
                            <div
                                key={stage.id}
                                className={`h-full flex-1 transition-all duration-300 ${colorClass} cursor-pointer hover:bg-indigo-500/50`}
                                title={stage.title}
                                onClick={() => handleStageChange(stage.id)}
                            />
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2.5 px-1">
                    <div className="flex items-center gap-2 group relative">
                        {editingField === 'stage' ? (
                            <div className="flex items-center border-b border-indigo-500/50">
                                <select
                                    ref={inputRef as any}
                                    value={deal.stageId}
                                    onChange={(e) => {
                                        handleStageChange(e.target.value);
                                        setEditingField(null);
                                    }}
                                    onBlur={() => setEditingField(null)}
                                    className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.15em] bg-transparent outline-none cursor-pointer pr-4"
                                    autoFocus
                                >
                                    {pipeline.stages.map(s => (
                                        <option key={s.id} value={s.id}>{s.title}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group cursor-text" onClick={() => startEditing('stage')} data-editable="true">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-[0.15em]">
                                    Etapa: <span className="text-indigo-500 dark:text-indigo-400 font-extrabold group-hover:underline">{pipeline.stages[currentStageIndex]?.title}</span>
                                </span>
                                <Pencil size={10} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        {currentStageIndex + 1} / {pipeline.stages.length}
                    </span>
                </div>
            </div>

            {/* VERTICAL CONTENT AREA - SPLIT VIEW PARA EVITAR SCROLL */}
            <div className="flex-1 overflow-hidden bg-background flex flex-col lg:flex-row">

                {/* COLUNA ESQUERDA: CONTATOS (FIXA/ESTÁTICA) */}
                <aside className="w-full lg:w-[360px] shrink-0 border-r border-border dark:border-slate-800 p-6 space-y-10 overflow-y-auto bg-muted/5 dark:bg-slate-900/20 custom-scrollbar">
                    {/* BLOCO 2 – Pessoa e Organização */}
                    <div className="space-y-10">
                        {/* Seção Pessoa */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2">
                                    <User size={12} className="text-indigo-500" />
                                    Pessoa de Contato
                                </h3>
                                {contact && (
                                    <button
                                        onClick={() => openNewDealModal(undefined, deal)}
                                        className="p-1 hover:bg-indigo-500/10 rounded-md text-slate-400 hover:text-indigo-500 transition-all"
                                        title="Alterar Contato"
                                    >
                                        <Pencil size={12} />
                                    </button>
                                )}
                            </div>
                            {contact ? (
                                <div className="space-y-4 bg-white dark:bg-slate-800/60 p-5 rounded-2xl border border-border dark:border-slate-700/60 shadow-sm dark:shadow-black/20 group/card transition-all hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-indigo-500/10 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base border border-indigo-500/20 dark:border-slate-600 shadow-inner">
                                            {contact.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <Link
                                                to={`/contacts/${contact.id}`}
                                                data-link="true"
                                                className="text-sm font-bold text-foreground dark:text-slate-100 hover:text-indigo-500 transition-colors block truncate pr-2"
                                            >
                                                {contact.name}
                                            </Link>

                                            {editingField === 'email' ? (
                                                <input
                                                    ref={inputRef as any}
                                                    value={tempEmail}
                                                    onChange={(e) => {
                                                        setTempEmail(e.target.value);
                                                        saveChanges('email', e.target.value);
                                                    }}
                                                    onBlur={handleBlur}
                                                    onKeyDown={handleKeyDown}
                                                    data-editable="true"
                                                    className="text-xs text-indigo-500 dark:text-indigo-400 bg-transparent border-b border-indigo-500/50 outline-none w-full mt-1"
                                                />
                                            ) : (
                                                <p
                                                    className="text-xs text-muted-foreground dark:text-slate-400 truncate hover:text-indigo-400 cursor-text group/email flex items-center gap-1"
                                                    onClick={() => startEditing('email')}
                                                    data-editable="true"
                                                >
                                                    {contact.email || 'Adicionar email'}
                                                    <Pencil size={8} className="opacity-0 group-hover/email:opacity-100" />
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-border/50 dark:border-slate-700/50">
                                        {editingField === 'phone' ? (
                                            <div className="flex items-center gap-2 border-b border-indigo-500/50">
                                                <Phone size={12} className="text-indigo-500" />
                                                <input
                                                    ref={inputRef as any}
                                                    value={tempPhone}
                                                    onChange={(e) => {
                                                        setTempPhone(e.target.value);
                                                        saveChanges('phone', e.target.value);
                                                    }}
                                                    onBlur={handleBlur}
                                                    onKeyDown={handleKeyDown}
                                                    data-editable="true"
                                                    placeholder="Telefone"
                                                    className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 bg-transparent outline-none w-full"
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-400 hover:text-indigo-400 cursor-text group/phone w-fit"
                                                onClick={() => startEditing('phone')}
                                                data-editable="true"
                                            >
                                                <Phone size={12} className="text-muted-foreground/40" />
                                                <span className="font-semibold">{contact.phone || 'Adicionar telefone'}</span>
                                                <Pencil size={8} className="opacity-0 group-hover/phone:opacity-100" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => openNewDealModal(undefined, deal)} className="w-full py-5 border-2 border-dashed border-border dark:border-slate-800 rounded-2xl text-xs text-indigo-500 font-bold hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all active:scale-[0.98]">
                                    + Vincular Contato
                                </button>
                            )}
                        </div>

                        {/* Seção Organização */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2">
                                    <Building size={12} className="text-indigo-500" />
                                    Organização
                                </h3>
                                {company && (
                                    <button
                                        onClick={() => openNewDealModal(undefined, deal)}
                                        className="p-1 hover:bg-indigo-500/10 rounded-md text-slate-400 hover:text-indigo-500 transition-all font-bold"
                                    >
                                        <Pencil size={12} />
                                    </button>
                                )}
                            </div>
                            {company ? (
                                <div className="bg-white dark:bg-slate-800/60 p-5 rounded-2xl border border-border dark:border-slate-700/60 shadow-sm dark:shadow-black/20 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-base border border-slate-200 dark:border-slate-600 shadow-sm">
                                            {company.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <Link
                                                to={`/companies/${company.id}`}
                                                data-link="true"
                                                className="text-sm font-bold text-foreground dark:text-slate-100 hover:text-indigo-500 transition-colors block truncate"
                                            >
                                                {company.name}
                                            </Link>
                                            <p className="text-xs text-muted-foreground dark:text-slate-400 truncate mt-0.5">{company.website || 'Sem website'}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => openNewDealModal(undefined, deal)} className="w-full py-5 border-2 border-dashed border-border dark:border-slate-800 rounded-2xl text-xs text-indigo-500 font-bold hover:bg-indigo-500/5 hover:border-indigo-500/30 transition-all active:scale-[0.98]">
                                    + Vincular Empresa
                                </button>
                            )}
                        </div>

                        {/* Etiquetas */}
                        <div className="space-y-4">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-[0.15em]">Etiquetas</p>
                            <div className="flex flex-wrap gap-2">
                                {['Quente', 'Morno', 'Frio'].map((label, idx) => {
                                    const tagId = (idx + 1).toString();
                                    const isSelected = deal.tags?.includes(tagId);
                                    const typeColors = [
                                        'border-rose-200 text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30',
                                        'border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30',
                                        'border-sky-200 text-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-900/30'
                                    ][idx];

                                    return (
                                        <button
                                            key={tagId}
                                            onClick={() => toggleTag(tagId)}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all hover:scale-105 ${isSelected ? typeColors : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600'}`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="pt-10 flex flex-col gap-6">
                        <div className="h-px bg-slate-100 dark:bg-slate-800" />
                        <button
                            onClick={handleDeleteDeal}
                            className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] hover:text-rose-500 dark:hover:text-rose-400 flex items-center gap-3 transition-all opacity-40 hover:opacity-100 p-2 group"
                        >
                            <Trash2 size={14} className="group-hover:animate-pulse" />
                            Excluir Negócio
                        </button>
                    </div>
                </aside>

                {/* COLUNA DIREITA: ÁREA OPERACIONAL (SCROLL INTERNO) */}
                <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-background dark:bg-slate-900/30 custom-scrollbar">
                    <div className="max-w-[780px] mx-auto">
                        <ActivityPanel deal={deal} readOnly={isClosed} />
                    </div>
                </main>
            </div>

            <LostReasonModal
                isOpen={isLostModalOpen}
                onClose={() => setIsLostModalOpen(false)}
                onConfirm={confirmLost}
            />
        </div>
    );
}
