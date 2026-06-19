import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ArrowLeft, Building, User, Pencil, Trash2, X, Ban, MoreHorizontal, Phone, Check, MessageCircle, Instagram, ExternalLink, Search } from 'lucide-react';




import ActivityPanel from '@/components/deals/ActivityPanel';
import LostReasonModal from '@/components/deals/LostReasonModal';
import { isMobileNumber, isLandline, getWhatsAppUrl, getCleanedPhoneLink } from '@/utils/phoneHelpers';

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

            {/* HEADER PREMIUM MOBILE-FIRST */}
            <header className="shrink-0 bg-background border-b border-border dark:border-border z-40">

                {/* Linha única: [←] [título+valor] [ações] */}
                <div className="flex items-center gap-2 px-3 sm:px-5 pt-3 pb-2">

                    {/* Botão Voltar / Fechar */}
                    <button
                        onClick={() => isModal ? onClose?.() : navigate(-1)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center hover:bg-muted dark:hover:bg-muted/10 rounded-full transition-colors text-muted-foreground"
                        title="Fechar"
                    >
                        {isModal ? <X size={17} /> : <ArrowLeft size={17} />}
                    </button>

                    {/* Bloco central: Título + Valor — flex-1 + min-w-0 garante truncate correto */}
                    <div className="min-w-0 flex-1">

                        {/* Linha do título + badge status */}
                        <div className="flex items-center gap-2 min-w-0">
                            {editingField === 'title' ? (
                                <input
                                    ref={inputRef as any}
                                    value={tempTitle}
                                    onChange={(e) => { setTempTitle(e.target.value); saveChanges('title', e.target.value); }}
                                    onBlur={handleBlur}
                                    onKeyDown={handleKeyDown}
                                    data-editable="true"
                                    className="text-sm font-semibold text-primary bg-transparent border-b-2 border-primary/50 outline-none flex-1 min-w-0"
                                    autoFocus
                                    style={{ fontSize: '15px' }}
                                />
                            ) : (
                                <div className="flex items-center gap-1 min-w-0 group/title">
                                    <h1 className="text-[13px] sm:text-sm font-semibold text-foreground truncate leading-snug">
                                        <a
                                            href={`https://www.google.com/search?q=${encodeURIComponent(deal.title.replace(/^Negócio /i, '').trim())}`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="hover:text-primary transition-colors"
                                            title="Pesquisar no Google"
                                        >
                                            {deal.title}
                                        </a>
                                    </h1>
                                    <Pencil size={10} className="shrink-0 text-muted-foreground/40 opacity-0 group-hover/title:opacity-100 cursor-pointer hover:text-primary transition-opacity" onClick={() => startEditing('title')} />
                                </div>
                            )}

                            {/* Status badge compacto — nunca estoura */}
                            <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${
                                deal.status === 'won'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                deal.status === 'lost' ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800' :
                                                         'bg-primary/8 text-primary border-primary/30 dark:bg-primary/20 dark:text-primary dark:border-primary/40'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    deal.status === 'won' ? 'bg-emerald-500' : deal.status === 'lost' ? 'bg-rose-500' : 'bg-primary'
                                }`} />
                                <span className="hidden xs:inline">{deal.status === 'open' ? 'Aberto' : deal.status === 'won' ? 'Ganho' : 'Perdido'}</span>
                            </span>
                        </div>

                        {/* Valor editável */}
                        <div className="mt-0.5">
                            {editingField === 'value' ? (
                                <div className="flex items-center gap-1 border-b border-primary/50 w-fit">
                                    <span className="text-[11px] font-bold text-primary">{currency.symbol}</span>
                                    <input
                                        ref={inputRef as any}
                                        type="number"
                                        value={tempValue}
                                        onChange={(e) => { setTempValue(e.target.value); saveChanges('value', e.target.value); }}
                                        onBlur={handleBlur}
                                        onKeyDown={handleKeyDown}
                                        data-editable="true"
                                        className="text-[11px] font-semibold text-primary bg-transparent outline-none w-20"
                                        style={{ fontSize: '16px' }}
                                    />
                                </div>
                            ) : (
                                <div className="group flex items-center gap-1 cursor-text w-fit" onClick={() => startEditing('value')} data-editable="true">
                                    <span className="text-[11px] font-bold text-primary group-hover:underline decoration-primary/30">
                                        {deal.value.toLocaleString(currency.locale, { style: 'currency', currency: currency.code })}
                                    </span>
                                    <Pencil size={8} className="text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ações — quadrados 32×32 no mobile, texto visível sm+ */}
                    <div className="flex items-center gap-1 shrink-0">
                        {deal.status === 'open' ? (
                            <>
                                <button onClick={handleWon} title="Ganho"
                                    className="w-8 h-8 sm:w-auto sm:h-8 sm:px-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all shadow-sm">
                                    <Check size={15} strokeWidth={2.5} />
                                    <span className="hidden sm:inline">Ganho</span>
                                </button>
                                <button onClick={handleLost} title="Perdido"
                                    className="w-8 h-8 sm:w-auto sm:h-8 sm:px-3 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all shadow-sm">
                                    <X size={15} strokeWidth={2.5} />
                                    <span className="hidden sm:inline">Perdido</span>
                                </button>
                            </>
                        ) : (
                            <button onClick={handleReopen} title="Reabrir"
                                className="w-8 h-8 sm:w-auto sm:h-8 sm:px-3 bg-muted hover:bg-muted/80 border border-border rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all active:scale-95">
                                <Ban size={14} />
                                <span className="hidden sm:inline">Reabrir</span>
                            </button>
                        )}

                        {/* Menu ⋯ */}
                        <div className="relative">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isMenuOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                                <MoreHorizontal size={17} />
                            </button>
                            {isMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                                    <div className="absolute right-0 mt-1.5 w-48 bg-popover border border-border rounded-xl shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-150">
                                        <button
                                            onClick={() => { setIsMenuOpen(false); handleDeleteDeal(); }}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-500/10 transition-colors text-left font-medium">
                                            <Trash2 size={15} />
                                            Excluir Negócio
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pipeline Stepper Horizontal */}
                <div className="px-3 sm:px-5 pb-3">
                    <div className="bg-muted/30 dark:bg-muted/10 p-[2px] rounded-lg border border-border/40 flex w-full items-center gap-[2px] overflow-hidden">
                        {pipeline.stages.map((s: any, idx: number) => {
                            const isPast = idx < currentStageIndex;
                            const isCurrent = idx === currentStageIndex;
                            const isFirst = idx === 0;
                            const isLast = idx === pipeline.stages.length - 1;
                            
                            const clipPathStyle = isFirst && isLast
                                ? 'none'
                                : isFirst
                                ? 'polygon(0% 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 0% 100%)'
                                : isLast
                                ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 8px 50%)'
                                : 'polygon(0% 0%, calc(100% - 8px) 0%, 100% 50%, calc(100% - 8px) 100%, 0% 100%, 8px 50%)';

                            return (
                                <button
                                    key={s.id}
                                    disabled={isClosed}
                                    onClick={() => handleStageChange(s.id)}
                                    style={{ clipPath: clipPathStyle }}
                                    className={`relative h-8 flex-1 min-w-0 flex items-center justify-center transition-all duration-150 ${
                                        isFirst ? 'pl-3 pr-4' : isLast ? 'pl-5 pr-3' : 'pl-5 pr-4'
                                    } ${
                                        isCurrent ? 'bg-primary text-primary-foreground font-bold shadow-inner' :
                                        isPast ? 'bg-primary/15 dark:bg-primary/20 text-primary font-semibold hover:bg-primary/25 dark:hover:bg-primary/30' :
                                        'bg-muted/45 dark:bg-muted/25 text-muted-foreground font-medium hover:bg-muted/65 dark:hover:bg-muted/40'
                                    } ${isClosed ? 'opacity-85 cursor-not-allowed' : 'cursor-pointer active:opacity-90'}`}
                                    title={s.title}
                                >
                                    <span className="flex items-center justify-center gap-1.5 truncate w-full">
                                        {isPast && <Check size={11} className="shrink-0 stroke-[3px]" />}
                                        {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse shrink-0" />}
                                        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider truncate">
                                            {s.title}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>


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
                                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
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
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {/* Ligar */}
                                                            <a
                                                                href={getCleanedPhoneLink(contact.phone)}
                                                                className="p-1 px-2 bg-primary/10 text-primary dark:text-primary rounded-md text-[10px] font-bold hover:bg-primary/20 transition-all flex items-center gap-1"
                                                                title="Ligar"
                                                            >
                                                                <Phone size={10} />
                                                                Ligar
                                                            </a>

                                                            {/* WhatsApp — só para celular */}
                                                            {isMobileNumber(contact.phone) ? (
                                                                <a
                                                                    href={getWhatsAppUrl(contact.phone, `Olá ${contact.name.split(' ')[0]}`)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-1 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1 border border-emerald-500/20"
                                                                    title={`WhatsApp: ${contact.phone}`}
                                                                >
                                                                    <MessageCircle size={10} />
                                                                    WhatsApp
                                                                </a>
                                                            ) : isLandline(contact.phone) ? (
                                                                <span className="p-1 px-2 bg-muted/30 text-muted-foreground/50 rounded-md text-[10px] font-bold flex items-center gap-1 border border-border/40" title="Número fixo — sem WhatsApp">
                                                                    <Phone size={10} />
                                                                    Fixo
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                </div>
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

                    <div className="pt-6 flex flex-col gap-4 pb-24 sm:pb-0">
                        <div className="h-px bg-border/50 dark:bg-border/20" />
                    </div>
                </aside>

                {/* ── BOTÃO FLUTUANTE WHATSAPP (mobile-only, só para celular) ── */}
                {contact && isMobileNumber(contact.phone) && (
                    <a
                        href={getWhatsAppUrl(contact.phone!, `Olá ${contact.name.split(' ')[0]}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`WhatsApp ${contact.name.split(' ')[0]}`}
                        className="
                            fixed bottom-6 right-5 z-50
                            flex md:hidden items-center gap-2
                            bg-emerald-500 hover:bg-emerald-600 active:scale-95
                            text-white text-xs font-bold
                            px-4 py-3 rounded-full
                            shadow-[0_4px_20px_rgba(16,185,129,0.45)]
                            transition-all duration-200
                            animate-[pulse_2.5s_ease-in-out_3]
                        "
                    >
                        <MessageCircle size={17} strokeWidth={2.5} />
                        <span>WhatsApp {contact.name.split(' ')[0]}</span>
                    </a>
                )}
            </div>

            <LostReasonModal
                isOpen={isLostModalOpen}
                onClose={() => setIsLostModalOpen(false)}
                onConfirm={confirmLost}
            />
        </div>
    );
}
