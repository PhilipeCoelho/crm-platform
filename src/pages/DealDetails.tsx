import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ArrowLeft, Building, User, DollarSign, Plus, Pencil, Trash2, Check, X, Ban, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NewDealModal from '@/components/kanban/NewDealModal';
import ActivityPanel from '@/components/deals/ActivityPanel';
import LostReasonModal from '@/components/deals/LostReasonModal';

interface DealDetailsProps {
    dealId?: string;
    onClose?: () => void;
    isModal?: boolean;
}

export default function DealDetails({ dealId: propId, onClose, isModal = false }: DealDetailsProps) {
    const { id: paramId } = useParams();
    const navigate = useNavigate();
    const { deals, companies, contacts, updateDeal, deleteDeal, pipelines } = useCRM();

    const id = propId || paramId;

    const deal = deals.find(d => d.id === id);
    const company = companies.find(c => c.id === deal?.companyId);
    const contact = contacts.find(c => c.id === deal?.contactId);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isLostModalOpen, setIsLostModalOpen] = useState(false);

    // Inline Editing State
    const [editingField, setEditingField] = useState<'title' | 'value' | null>(null);
    const [tempTitle, setTempTitle] = useState('');
    const [tempValue, setTempValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when editing starts
    useEffect(() => {
        if (editingField && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingField]);

    if (!deal) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-muted-foreground mb-4">Negócio não encontrado.</p>
                {isModal ? (
                    <button onClick={onClose} className="text-primary hover:underline">Fechar</button>
                ) : (
                    <button onClick={() => navigate('/')} className="text-primary hover:underline">Voltar</button>
                )}
            </div>
        );
    }

    const pipeline = pipelines[deal.pipelineId] || pipelines['sales'];

    if (!pipeline) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-muted-foreground">Erro: Pipeline não encontrado.</p>
                {isModal ? (
                    <button onClick={onClose} className="text-primary hover:underline mt-2">Fechar</button>
                ) : (
                    <button onClick={() => navigate('/')} className="text-primary hover:underline mt-2">Voltar</button>
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

    const startEditing = (field: 'title' | 'value') => {
        if (isClosed) return; // Prevent editing closed deals inline? Or allow? Let's allow but maybe warn? No, usually fine to edit metadata.
        setEditingField(field);
        if (field === 'title') setTempTitle(deal.title);
        if (field === 'value') setTempValue(deal.value.toString());
    };

    const saveEditing = () => {
        if (!editingField) return;

        if (editingField === 'title') {
            if (tempTitle.trim() && tempTitle !== deal.title) {
                updateDeal(deal.id, { title: tempTitle });
            }
        } else if (editingField === 'value') {
            const val = parseFloat(tempValue); // Simple parse, store.ts handles currency? No store.ts expects number.
            // Note: currency inputs can be tricky. Assuming simple number for now.
            if (!isNaN(val) && val !== deal.value) {
                updateDeal(deal.id, { value: val });
            }
        }
        setEditingField(null);
    };

    const cancelEditing = () => {
        setEditingField(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            saveEditing();
        } else if (e.key === 'Escape') {
            cancelEditing();
        }
    };

    return (
        <div className={`flex flex-col overflow-hidden w-full ${isModal ? 'h-full bg-transparent' : 'bg-background max-w-[780px] mx-auto'}`}>
            {/* Header */}
            <div className="bg-background border-b border-border p-2 flex flex-col gap-2 shrink-0">

                {/* Top Row: Navigation & Actions */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button onClick={() => isModal ? onClose?.() : navigate(-1)} className="p-1 hover:bg-muted rounded-full transition-colors shrink-0">
                            {isModal ? <X size={20} className="text-muted-foreground" /> : <ArrowLeft size={20} className="text-muted-foreground" />}
                        </button>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                {/* Editable Title */}
                                {editingField === 'title' ? (
                                    <input
                                        ref={inputRef}
                                        value={tempTitle}
                                        onChange={(e) => setTempTitle(e.target.value)}
                                        onBlur={saveEditing}
                                        onKeyDown={handleKeyDown}
                                        className="text-base font-bold text-foreground bg-muted/30 border border-primary/20 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-primary/50 w-full max-w-[300px]"
                                    />
                                ) : (
                                    <h1
                                        onClick={() => startEditing('title')}
                                        className="text-base font-bold text-foreground truncate max-w-[180px] sm:max-w-[300px] hover:bg-muted/50 hover:text-primary cursor-pointer rounded px-1 transition-colors select-none"
                                        title="Clique para editar"
                                    >
                                        {deal.title}
                                    </h1>
                                )}

                                {/* Status Badge */}
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${deal.status === 'won' ? 'bg-green-100 text-green-700 border-green-200' :
                                    deal.status === 'lost' ? 'bg-red-100 text-red-700 border-red-200' :
                                        'bg-blue-100 text-blue-700 border-blue-200'
                                    }`}>
                                    {deal.status === 'open' ? 'Em Aberto' : deal.status === 'won' ? 'Ganho' : 'Perdido'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                                <span className="font-semibold text-foreground flex items-center gap-1">
                                    <DollarSign size={10} />
                                    {deal.value.toLocaleString('pt-BR', { style: 'currency', currency: deal.currency })}
                                </span>
                                <span>•</span>
                                <span>Criado em {format(new Date(deal.createdAt), "d MMM", { locale: ptBR })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pl-2">
                        {deal.status === 'open' ? (
                            <>
                                <button
                                    onClick={handleWon}
                                    className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors shadow-sm"
                                >
                                    <Check size={12} />
                                    <span className="hidden sm:inline">Ganho</span>
                                </button>
                                <button
                                    onClick={handleLost}
                                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors shadow-sm"
                                >
                                    <X size={12} />
                                    <span className="hidden sm:inline">Perdido</span>
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleReopen}
                                className="px-2.5 py-1 bg-muted hover:bg-muted/80 border border-border rounded-md text-[10px] font-medium flex items-center gap-1 transition-colors"
                            >
                                <Ban size={12} />
                                <span className="hidden sm:inline">Reabrir</span>
                            </button>
                        )}

                        <div className="w-px h-4 bg-border mx-1 hidden sm:block" />

                        <div className='flex items-center gap-1'>
                            <button
                                onClick={handleDeleteDeal}
                                className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors text-muted-foreground"
                                title="Excluir Negócio"
                            >
                                <Trash2 size={14} /> // Increased size slightly and padding
                            </button>

                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground"
                                title="Editar Tudo"
                            >
                                <Pencil size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Pipeline Progress Bar */}
                <div className="flex items-center w-full mt-2 bg-muted/30 rounded-full p-0.5 overflow-hidden">
                    {pipeline.stages.map((stage, index) => {
                        // Logic for stage color
                        let bgColor = "bg-muted text-muted-foreground"; // Future
                        if (deal.status === 'lost' && index === currentStageIndex) bgColor = "bg-red-500 text-white";
                        else if (deal.status === 'won') bgColor = "bg-green-500 text-white";
                        else if (index < currentStageIndex) bgColor = "bg-green-500 text-white"; // Past
                        else if (index === currentStageIndex) bgColor = "bg-primary text-primary-foreground"; // Current

                        // Chevron shape using clip-path
                        return (
                            <div
                                key={stage.id}
                                className={`
                                    flex-1 h-7 flex items-center justify-center relative cursor-pointer transition-colors text-[10px] font-medium px-2
                                    ${bgColor}
                                    ${index === 0 ? 'rounded-l-full pl-3' : ''} 
                                    ${index === pipeline.stages.length - 1 ? 'rounded-r-full pr-3' : ''}
                                    ${index !== 0 ? '-ml-2 pl-4 clip-path-arrow-left' : ''}
                                    hover:brightness-95
                                `}
                                style={{
                                    clipPath: index === 0
                                        ? 'polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%)'
                                        : index === pipeline.stages.length - 1
                                            ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 5% 50%)'
                                            : 'polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%, 5% 50%)',
                                    zIndex: 10 - index // Stack properly
                                }}
                                onClick={() => handleStageChange(stage.id)}
                            >
                                <span className="truncate max-w-full">{stage.title}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-muted/5">
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
                    {/* Left Column: Info (Resumo) */}
                    <div className="lg:sticky lg:top-0 h-fit space-y-6">
                        <div className="space-y-6 bg-transparent">
                            {/* Summary Section */}
                            <div>
                                <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                                    <span className="w-1 h-3 bg-primary rounded-full" />
                                    Resumo
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <DollarSign size={16} className="text-muted-foreground" />
                                        {editingField === 'value' ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    ref={inputRef}
                                                    type="number"
                                                    value={tempValue}
                                                    onChange={(e) => setTempValue(e.target.value)}
                                                    onBlur={saveEditing}
                                                    onKeyDown={handleKeyDown}
                                                    className="font-bold text-foreground bg-muted/30 border border-primary/20 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-primary/50 w-32 text-sm"
                                                />
                                                <button onMouseDown={saveEditing} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={16} /></button>
                                            </div>
                                        ) : (
                                            <div
                                                className="group flex items-center gap-2 cursor-pointer"
                                                onClick={() => startEditing('value')}
                                                title="Clique para editar valor"
                                            >
                                                <span
                                                    className="font-bold text-foreground text-lg group-hover:text-primary transition-colors border border-transparent rounded px-1 group-hover:border-border/50 group-hover:bg-muted/50"
                                                >
                                                    {deal.value.toLocaleString('pt-BR', { style: 'currency', currency: deal.currency })}
                                                </span>
                                                <Pencil size={12} className="opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Building size={14} />
                                        <span>Funil de vendas &rarr; <strong>{pipeline.name}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <User size={14} />
                                        <span>Criado por <strong>Você</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-border/50" />

                            {/* Person Section */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                                        <User size={14} />
                                        Pessoa
                                    </h3>
                                    {!contact && (
                                        <button onClick={() => setIsEditModalOpen(true)} className="text-primary hover:bg-primary/10 p-1 rounded">
                                            <Plus size={12} />
                                        </button>
                                    )}
                                </div>

                                {contact ? (
                                    <Link to={`/contacts/${contact.id}`} className="group block">
                                        <div className="flex items-start gap-2">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                                {contact.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-blue-600 group-hover:underline truncate">{contact.name}</p>
                                                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                                                    <p className="flex items-center gap-1">
                                                        <span className="opacity-70">Email:</span> {contact.email}
                                                    </p>
                                                    <p className="flex items-center gap-1">
                                                        <span className="opacity-70">Tel:</span> {contact.phone || '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">Nenhuma pessoa vinculada</p>
                                )}
                            </div>

                            <div className="h-px bg-border/50" />

                            {/* Organization Section */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                                        <Building size={14} />
                                        Organização
                                    </h3>
                                    {!company && (
                                        <button onClick={() => setIsEditModalOpen(true)} className="text-primary hover:bg-primary/10 p-1 rounded">
                                            <Plus size={12} />
                                        </button>
                                    )}
                                </div>

                                {company ? (
                                    <Link to={`/companies/${company.id}`} className="group block">
                                        <div className="flex items-start gap-2">
                                            <div className="w-8 h-8 rounded bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                                {company.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">{company.name}</p>
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">{company.website || 'Sem website'}</p>
                                            </div>
                                        </div>
                                    </Link>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">Nenhuma organização vinculada</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Activity Panel */}
                    <div className="min-w-0 overflow-hidden bg-background rounded-lg border border-border shadow-sm">
                        <ActivityPanel deal={deal} readOnly={isClosed} />
                    </div>
                </div>
            </div>

            {isEditModalOpen && (
                <NewDealModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    dealToEdit={deal}
                />
            )}

            <LostReasonModal
                isOpen={isLostModalOpen}
                onClose={() => setIsLostModalOpen(false)}
                onConfirm={confirmLost}
            />
        </div>
    );
}
