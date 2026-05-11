import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ArrowLeft, Building, User, Pencil, Trash2, X, Ban, MoreHorizontal, Phone, Check, MessageCircle, Instagram, ExternalLink, Search, CalendarDays } from 'lucide-react';




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
    const { deals, companies, contacts, updateDeal, deleteDeal, pipelines, openNewDealModal, updateContact } = useCRM();


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
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Focus input when editing starts
    useEffect(() => {
        if (editingField && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingField]);

    // Scroll right column to top when deal changes
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, [id]);

    if (!deal) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-muted-foreground mb-4 font-medium dark:text-slate-400">Negócio não encontrado.</p>
                {isModal ? (
                    <button onClick={onClose} className="text-primary hover:text-primary font-bold transition-colors">Fechar</button>
                ) : (
                    <button onClick={() => navigate('/')} className="text-primary hover:text-primary font-bold transition-colors">Voltar</button>
                )}
            </div>
        );
    }

    const pipeline = pipelines[deal.pipelineId] || pipelines['sales'];

    if (!pipeline) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-muted-foreground dark:text-muted-foreground/60">Erro: Pipeline não encontrado.</p>
                {isModal ? (
                    <button onClick={onClose} className="text-primary hover:underline mt-2 font-bold">Fechar</button>
                ) : (
                    <button onClick={() => navigate('/')} className="text-primary hover:underline mt-2 font-bold">Voltar</button>
                )}
            </div>
        );
    }

    const currentStageIndex = pipeline.stages.findIndex((s: any) => s.id === deal.stageId);
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
                navigate('/pipeline');
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
            ? currentTags.filter((t: any) => t !== tagId)
            : [...currentTags, tagId];
        updateDeal(deal.id, { tags: newTags });
    };

    return (
        <div className={`flex flex-col overflow-hidden w-full h-full bg-background overscroll-none ${!isModal && 'max-w-full lg:max-w-6xl mx-auto border-x border-border shadow-lg'}`}>

            {/* HEADER PIPEDRIVE STYLE */}
            <header className="shrink-0 bg-background border-b border-border dark:border-border px-5 py-4 z-40 relative">
                <button
                    onClick={() => isModal ? onClose?.() : navigate(-1)}
                    className="absolute top-4 left-5 p-1.5 hover:bg-muted dark:hover:bg-muted/10 rounded-full transition-colors shrink-0 text-muted-foreground z-50 focus:ring-2 focus:ring-primary/20"
                    title="Fechar"
                >
                    {isModal ? <X size={18} /> : <ArrowLeft size={18} />}
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
                                    className="text-base sm:text-lg font-bold text-primary dark:text-primary bg-transparent border-b-2 border-primary/50 outline-none w-full max-w-[450px] transition-all"
                                    autoFocus
                                    style={{ fontSize: '15px' }}
                                />
                            ) : (
                                <div className="flex items-center gap-2 group/title">
                                    <h1
                                        data-editable="true"
                                        className="text-base sm:text-lg font-semibold text-foreground truncate max-w-[200px] sm:max-w-[450px] hover:text-primary transition-colors relative group"
                                    >
                                        <a
                                            href={`https://www.google.com/search?q=${encodeURIComponent(deal.title.replace(/^Negócio /i, '').trim())}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Pesquisar no Google"
                                        >
                                            {deal.title}
                                        </a>
                                        <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300"></span>
                                    </h1>
                                    <Pencil
                                        size={14}
                                        className="text-muted-foreground opacity-0 group-hover/title:opacity-100 cursor-pointer hover:text-primary transition-opacity"
                                        onClick={() => startEditing('title')}
                                        title="Editar nome"
                                    />
                                </div>
                            )}
                            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border shadow-sm ${deal.status === 'won' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                deal.status === 'lost' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                    'bg-primary/10 text-primary border-primary dark:bg-primary/30 dark:text-primary dark:border-primary'
                                }`}>
                                {deal.status === 'open' ? 'Aberto' : deal.status === 'won' ? 'Ganho' : 'Perdido'}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {editingField === 'value' ? (
                                <div className="flex items-center gap-1 border-b-2 border-primary/50">
                                    <span className="text-sm font-bold text-primary">{currency.symbol}</span>
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
                                        className="text-sm sm:text-base font-semibold text-primary dark:text-primary bg-transparent outline-none w-24"
                                        style={{ fontSize: '16px' }}
                                    />
                                </div>
                            ) : (
                                <div
                                    className="group flex items-center gap-2 cursor-text w-fit"
                                    onClick={() => startEditing('value')}
                                    data-editable="true"
                                >
                                    <span className="text-xs font-semibold text-primary dark:text-primary group-hover:underline decoration-primary/30">
                                        {deal.value.toLocaleString(currency.locale, { style: 'currency', currency: currency.code })}
                                    </span>
                                    <Pencil size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                        </div>
                        {/* Data de Adição Display */}
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 dark:text-muted-foreground/40 uppercase tracking-wider bg-muted/30 dark:bg-muted/5 px-2.5 py-1 rounded-lg border border-border/50 dark:border-border/20 mt-0.5">
                            <CalendarDays size={12} className="text-primary" />
                            <span>Adicionado em {deal.expectedCloseDate ? new Date(deal.expectedCloseDate + 'T12:00:00').toLocaleDateString('pt-PT') : deal.createdAt ? new Date(deal.createdAt).toLocaleDateString('pt-PT') : 'N/A'}</span>
                        </div>
                    </div>

                    {/* Top Right: Actions */}
                    <div className="flex items-center gap-2">
                        {deal.status === 'open' ? (
                            <>
                                <button
                                    onClick={handleWon}
                                    className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                                >
                                    <Check size={14} />
                                    Ganho
                                </button>
                                <button
                                    onClick={handleLost}
                                    className="h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                                >
                                    <X size={14} />
                                    Perdido
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleReopen}
                                className="h-9 px-4 bg-muted dark:bg-muted/10 hover:bg-muted/80 border border-border dark:border-border rounded-md text-sm font-semibold flex items-center gap-2 transition-all active:scale-95"
                            >
                                <Ban size={16} />
                                Reabrir
                            </button>
                        )}
                        <div className="relative">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className={`p-2 hover:bg-muted dark:hover:bg-muted/10 rounded-md transition-colors ml-1 ${isMenuOpen ? 'bg-muted dark:bg-muted/10 text-foreground' : 'text-muted-foreground'}`}
                            >
                                <MoreHorizontal size={20} />
                            </button>

                            {isMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                                    <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                handleDeleteDeal();
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-500/10 transition-colors text-left font-medium"
                                        >
                                            <Trash2 size={16} />
                                            Excluir Negócio
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* PIPELINE BAR - LINHA FINA REFORMULADA */}
            <div className="bg-background border-b border-border dark:border-border px-6 py-4 shrink-0 overflow-x-auto no-scrollbar touch-pan-x">
                <div className="flex items-center gap-1.5 min-w-[600px] sm:min-w-full h-1 bg-muted/20 dark:bg-muted/5 rounded-full overflow-hidden">
                    {pipeline.stages.map((stage: any, index: number) => {
                        const isActive = index === currentStageIndex;
                        const isPast = index < currentStageIndex;
                        const isWon = deal.status === 'won';
                        const isLost = deal.status === 'lost' && isActive;

                        let colorClass = "bg-transparent";
                        if (isWon) colorClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]";
                        else if (isLost) colorClass = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]";
                        else if (isActive) colorClass = "bg-primary shadow-[0_0_8px_rgba(99,102,241,0.4)]";
                        else if (isPast) colorClass = "bg-primary/30";

                        return (
                            <div
                                key={stage.id}
                                className={`h-full flex-1 transition-all duration-300 ${colorClass} cursor-pointer hover:bg-primary/50`}
                                title={stage.title}
                                onClick={() => handleStageChange(stage.id)}
                            />
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2.5 px-1">
                    <div className="flex items-center gap-2 group relative">
                        {editingField === 'stage' ? (
                            <div className="flex items-center border-b border-primary/50">
                                <select
                                    ref={inputRef as any}
                                    value={deal.stageId}
                                    onChange={(e) => {
                                        handleStageChange(e.target.value);
                                        setEditingField(null);
                                    }}
                                    onBlur={() => setEditingField(null)}
                                    className="text-[10px] sm:text-xs font-semibold text-primary dark:text-primary uppercase tracking-[0.15em] bg-transparent outline-none cursor-pointer pr-4"
                                    autoFocus
                                    style={{ fontSize: '16px' }}
                                >
                                    {pipeline.stages.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.title}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group cursor-text" onClick={() => startEditing('stage')} data-editable="true">
                                <span className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-[0.15em]">
                                    Etapa: <span className="text-primary dark:text-primary font-semibold group-hover:underline">{pipeline.stages[currentStageIndex]?.title}</span>
                                </span>
                                <Pencil size={10} className="text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground/60 dark:text-muted-foreground/40">
                        {currentStageIndex + 1} / {pipeline.stages.length}
                    </span>
                </div>
            </div>

            {/* VERTICAL CONTENT AREA - SPLIT VIEW PARA EVITAR SCROLL */}
            <div className="flex-1 overflow-y-auto md:overflow-hidden bg-background flex flex-col md:flex-row custom-scrollbar">

                {/* COLUNA DIREITA: ÁREA OPERACIONAL (SCROLL INTERNO) - AGORA EM PRIMEIRO NO MOBILE */}
                <main
                    ref={contentRef}
                    className="flex-1 md:overflow-y-auto p-3 sm:p-5 bg-background dark:bg-card/20 custom-scrollbar order-1 md:order-2"
                >
                    <div className="max-w-[700px] mx-auto pb-4 sm:pb-0">
                        <ActivityPanel deal={deal} readOnly={isClosed} />
                    </div>
                </main>

                {/* COLUNA ESQUERDA: CONTATOS (FIXA/ESTÁTICA) - AGORA EM SEGUNDO NO MOBILE */}
                <aside className="w-full md:w-[340px] shrink-0 border-b md:border-r md:border-b-0 border-border dark:border-border/50 p-3 sm:p-4 space-y-5 sm:space-y-6 md:overflow-y-auto bg-muted/5 dark:bg-card/30 custom-scrollbar order-2 md:order-1">
                    {/* BLOCO 2 – Pessoa e Organização */}
                    <div className="space-y-6 sm:space-y-8">
                        {/* Seção Pessoa */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-bold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-[0.15em] flex items-center gap-1.5">
                                    <User size={11} className="text-primary" />
                                    Pessoa de Contato
                                </h3>
                                {contact && (
                                    <button
                                        onClick={() => openNewDealModal(undefined, deal)}
                                        className="p-1 hover:bg-primary/10 rounded-md text-muted-foreground/60 hover:text-primary transition-all font-semibold"
                                        title="Alterar Contato"
                                    >
                                        <Pencil size={12} />
                                    </button>
                                )}
                            </div>
                            {contact ? (
                                <div className="space-y-3 bg-white dark:bg-card p-3 rounded-xl border border-border dark:border-border/80 shadow-sm dark:shadow-black/20 group/card transition-all hover:bg-muted/10 dark:hover:bg-card/80">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-muted text-primary dark:text-primary flex items-center justify-center font-semibold text-sm border border-primary/20 dark:border-border shadow-inner">
                                            {contact.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <Link
                                                to={`/contacts/${contact.id}`}
                                                data-link="true"
                                                className="text-sm font-semibold text-foreground dark:text-foreground/90 hover:text-primary transition-colors block truncate pr-1"
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
                                                    className="text-[11px] text-primary dark:text-primary bg-transparent border-b border-primary/50 outline-none w-full mt-1"
                                                    style={{ fontSize: '13px' }}
                                                />
                                            ) : (
                                                <p
                                                    className="text-[11px] text-muted-foreground dark:text-muted-foreground/60 truncate hover:text-primary cursor-text group/email flex items-center gap-1.5 mt-0.5"
                                                    onClick={() => startEditing('email')}
                                                    data-editable="true"
                                                >
                                                    {contact.email || 'Adicionar email'}
                                                    <Pencil size={8} className="opacity-0 group-hover/email:opacity-100" />
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-border/50 dark:border-border/10">
                                        {editingField === 'phone' ? (
                                            <div className="flex items-center gap-3 border-b border-primary/50">
                                                <Phone size={14} className="text-primary" />
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
                                                    className="text-sm sm:text-xs font-semibold text-primary dark:text-primary bg-transparent outline-none w-full py-1"
                                                    style={{ fontSize: '16px' }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between group/phone gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div
                                                        className="flex items-center gap-2 text-[11px] text-muted-foreground dark:text-muted-foreground/60 hover:text-primary cursor-text py-0.5 whitespace-nowrap"
                                                        onClick={() => startEditing('phone')}
                                                        data-editable="true"
                                                    >
                                                        <Phone size={11} className="text-muted-foreground/40 shrink-0" />
                                                        <span className="font-semibold">{contact.phone || 'Adicionar telefone'}</span>
                                                        <Pencil size={8} className="opacity-0 group-hover/phone:opacity-100 shrink-0" />
                                                    </div>
                                                    {contact.phone && (
                                                        <div className="flex items-center gap-2">
                                                            <a
                                                                href={`tel:${contact.phone.replace(/\D/g, '')}`}
                                                                className="p-1 px-2 bg-primary/10 text-primary dark:text-primary rounded-md text-[10px] font-bold hover:bg-primary/20 transition-all flex items-center gap-1"
                                                                title="Ligar"
                                                            >
                                                                <Phone size={10} />
                                                                Ligar
                                                            </a>

                                                            {/* WhatsApp Link - Estilo Premium clicável */}
                                                            {contact.phone.replace(/\D/g, '').startsWith('9') && (
                                                                <a
                                                                    href={`https://wa.me/351${contact.phone.replace(/\D/g, '')}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-1 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                                                                    title="Enviar WhatsApp"
                                                                >
                                                                    <MessageCircle size={10} />
                                                                    WhatsApp
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Botão de Chamada Nativa Mobile (Mantido para UX mobile rápida) */}
                                                {contact.phone && (
                                                    <a
                                                        href={`tel:${contact.phone.replace(/\D/g, '')}`}
                                                        className="sm:hidden h-10 w-10 flex items-center justify-center bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/20 active:scale-90 transition-all"
                                                    >
                                                        <Phone size={18} fill="currentColor" />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => openNewDealModal(undefined, deal)} className="w-full py-3 border border-dashed border-border dark:border-border rounded-xl text-[10px] text-primary font-bold hover:bg-primary/5 hover:border-primary/30 transition-all active:scale-[0.98] uppercase tracking-wider">
                                    + Vincular Contato
                                </button>
                            )}
                        </div>

                        {/* BLOCO: Links de Marketing (Instagram & Ads) */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-[0.15em] flex items-center gap-1.5">
                                <Search size={11} className="text-primary" />
                                Pesquisa de Marketing
                            </h3>
                            <div className="bg-white dark:bg-card p-2.5 rounded-xl border border-border dark:border-border/80 shadow-sm space-y-2">
                                {/* Instagram Link */}
                                <div className="flex items-center justify-between group/link">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-lg">
                                            <Instagram size={13} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">Instagram</p>
                                            {deal.instagramUrl ? (
                                                <a
                                                    href={deal.instagramUrl.startsWith('http') ? deal.instagramUrl : `https://instagram.com/${deal.instagramUrl.replace('@', '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-semibold text-primary hover:underline block truncate max-w-[180px]"
                                                >
                                                    {deal.instagramUrl.replace('https://www.instagram.com/', '').replace('https://instagram.com/', '').replace('/', '')}
                                                </a>
                                            ) : (
                                                <button
                                                    onClick={() => openNewDealModal(undefined, deal)}
                                                    className="text-sm text-muted-foreground/60 italic hover:text-primary"
                                                >
                                                    Adicionar Perfil
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {deal.instagramUrl && <ExternalLink size={12} className="text-muted-foreground/40 opacity-0 group-hover/link:opacity-100 transition-opacity" />}
                                </div>

                                {/* Ad Library (Automation) */}
                                <div className="flex items-center justify-between group/link">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                                            <MessageCircle size={13} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">Biblioteca de Ads</p>
                                            {deal.adLibraryUrl ? (
                                                <a
                                                    href={deal.adLibraryUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-semibold text-primary hover:underline block truncate max-w-[180px]"
                                                >
                                                    Ver Biblioteca
                                                </a>
                                            ) : (
                                                <a
                                                    href={`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=PT&q=${encodeURIComponent(
                                                        deal.instagramUrl
                                                            ? deal.instagramUrl.replace('https://www.instagram.com/', '').replace('https://instagram.com/', '').replace('@', '').split('/')[0]
                                                            : deal.title.replace('Negócio ', '').trim()
                                                    )}&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped&media_type=all`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 px-1.5 py-0.5 rounded bg-blue-500/5 flex items-center gap-1 transition-all border border-blue-500/10"
                                                >
                                                    <Search size={10} />
                                                    Auto-Buscar Ads
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <ExternalLink size={12} className="text-muted-foreground/40 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        </div>

                        {/* Seção Organização */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-bold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-[0.15em] flex items-center gap-1.5">
                                    <Building size={11} className="text-primary" />
                                    Organização
                                </h3>
                                {company && (
                                    <button
                                        onClick={() => openNewDealModal(undefined, deal)}
                                        className="p-1.5 sm:p-1 hover:bg-primary/10 rounded-md text-muted-foreground/60 hover:text-primary transition-all font-semibold"
                                    >
                                        <Pencil size={14} className="sm:w-3 sm:h-3" />
                                    </button>
                                )}
                            </div>
                            {company ? (
                                <div className="bg-white dark:bg-card p-3 rounded-xl border border-border dark:border-border/80 shadow-sm dark:shadow-black/20 hover:bg-muted/10 dark:hover:bg-card/80 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-muted/20 dark:bg-muted/10 text-muted-foreground dark:text-muted-foreground/60 flex items-center justify-center font-semibold text-sm border border-border dark:border-border/30 shadow-sm">
                                            {company.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <Link
                                                to={`/companies/${company.id}`}
                                                data-link="true"
                                                className="text-sm font-semibold text-foreground dark:text-foreground/90 hover:text-primary transition-colors block truncate"
                                            >
                                                {company.name}
                                            </Link>
                                            <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/60 truncate mt-0.5">{company.website || 'Sem website'}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={() => openNewDealModal(undefined, deal)} className="w-full py-3 border border-dashed border-border dark:border-border rounded-xl text-[10px] text-primary font-bold hover:bg-primary/5 hover:border-primary/30 transition-all active:scale-[0.98] uppercase tracking-wider">
                                    + Vincular Empresa
                                </button>
                            )}
                        </div>

                        {/* Etiquetas */}
                        <div className="space-y-4">
                            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-[0.15em]">Etiquetas</p>
                            <div className="flex flex-wrap gap-2.5">
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
                                            className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all active:scale-95 ${isSelected ? typeColors : 'bg-transparent border-border dark:border-border text-muted-foreground/60 dark:text-muted-foreground/40'}`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex flex-col gap-4 pb-20 sm:pb-0">
                        <div className="h-px bg-border/50 dark:bg-border/20" />
                    </div>
                </aside>
            </div>

            <LostReasonModal
                isOpen={isLostModalOpen}
                onClose={() => setIsLostModalOpen(false)}
                onConfirm={confirmLost}
            />
        </div>
    );
}
