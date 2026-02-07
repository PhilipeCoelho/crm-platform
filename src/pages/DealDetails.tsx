import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ArrowLeft, Building, User, DollarSign, Plus, Pencil, Trash2, Check, X, Ban } from 'lucide-react';
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

    return (
        <div className={`flex flex-col overflow-hidden bg-background w-full max-w-[780px] mx-auto ${isModal ? 'h-full max-h-[85vh] rounded-lg shadow-2xl' : 'h-full'}`}>
            {/* Header */}
            <div className="bg-card border-b border-border p-2 flex flex-col gap-2 shrink-0">

                {/* Top Row: Navigation & Actions */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => isModal ? onClose?.() : navigate(-1)} className="p-1 hover:bg-muted rounded-full transition-colors">
                            {isModal ? <X size={16} className="text-muted-foreground" /> : <ArrowLeft size={16} className="text-muted-foreground" />}
                        </button>
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <h1 className="text-base font-bold text-foreground truncate max-w-[180px] sm:max-w-[300px]">{deal.title}</h1>

                                {/* Status Badge */}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${deal.status === 'won' ? 'bg-green-100 text-green-700 border-green-200' :
                                    deal.status === 'lost' ? 'bg-red-100 text-red-700 border-red-200' :
                                        'bg-blue-100 text-blue-700 border-blue-200'
                                    }`}>
                                    {deal.status === 'open' ? 'Em Aberto' : deal.status === 'won' ? 'Ganho' : 'Perdido'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="font-semibold text-foreground flex items-center gap-1">
                                    <DollarSign size={10} />
                                    {deal.value.toLocaleString('pt-BR', { style: 'currency', currency: deal.currency })}
                                </span>
                                <span>•</span>
                                <span>Criado em {format(new Date(deal.createdAt), "d MMM", { locale: ptBR })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
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

                        <button
                            onClick={handleDeleteDeal}
                            className="p-1 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors text-muted-foreground"
                            title="Excluir Negócio"
                        >
                            <Trash2 size={12} />
                        </button>

                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground"
                            title="Editar Negócio"
                        >
                            <Pencil size={12} />
                        </button>
                    </div>
                </div>

                {/* Pipeline Progress Bar */}
                <div className="flex items-center gap-0.5 mt-0.5 overflow-x-auto no-scrollbar pb-1">
                    {pipeline.stages.map((stage, index) => {
                        // Logic for stage color
                        let colorClass = "bg-muted"; // Future
                        if (deal.status === 'lost' && index === currentStageIndex) colorClass = "bg-red-500";
                        else if (deal.status === 'won') colorClass = "bg-green-500";
                        else if (index < currentStageIndex) colorClass = "bg-green-500"; // Past
                        else if (index === currentStageIndex) colorClass = "bg-primary"; // Current

                        return (
                            <div
                                key={stage.id}
                                className={`h-1 flex-1 min-w-[20px] first:rounded-l-full last:rounded-r-full relative group cursor-pointer transition-colors ${colorClass}`}
                                onClick={() => handleStageChange(stage.id)}
                            >
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap z-50">
                                    {stage.title}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[220px_1fr] overflow-hidden">
                {/* Left Column: Info */}
                <div className="border-b lg:border-b-0 lg:border-r border-border p-3 overflow-y-auto bg-card/30">
                    <div className="space-y-3">
                        {/* Status Info Card (if closed) */}
                        {isClosed && (
                            <div className={`p-2 rounded-md border ${deal.status === 'won' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <h3 className={`text-[10px] font-bold flex items-center gap-1 ${deal.status === 'won' ? 'text-green-800' : 'text-red-800'}`}>
                                    {deal.status === 'won' ? <Check size={12} /> : <X size={12} />}
                                    Negócio {deal.status === 'won' ? 'Ganho' : 'Perdido'}
                                </h3>
                                <p className="text-[10px] mt-0.5 opacity-80">
                                    Em {format(new Date(deal.status === 'won' ? deal.wonAt! : deal.lostAt!), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                </p>
                                {deal.status === 'lost' && deal.lostReason && (
                                    <p className="text-[10px] mt-1 font-medium text-red-900">
                                        "{deal.lostReason}"
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Company Card */}
                        <div className="p-2 bg-card rounded-md border border-border shadow-sm">
                            <h3 className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                                <Building size={12} />
                                Organização
                            </h3>
                            {company ? (
                                <Link to={`/companies/${company.id}`} className="group block">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0 text-xs">
                                            {company.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-xs group-hover:text-primary transition-colors truncate">{company.name}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{company.website || 'Sem website'}</p>
                                        </div>
                                    </div>
                                </Link>
                            ) : (
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                >
                                    <Plus size={10} /> Vincular Organização
                                </button>
                            )}
                        </div>

                        {/* Contact Card */}
                        <div className="p-2 bg-card rounded-md border border-border shadow-sm">
                            <h3 className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                                <User size={12} />
                                Contacto Principal
                            </h3>
                            {contact ? (
                                <Link to={`/contacts/${contact.id}`} className="group block">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0 text-xs">
                                            {contact.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-xs group-hover:text-primary transition-colors truncate">{contact.name}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{contact.email}</p>
                                        </div>
                                    </div>
                                </Link>
                            ) : (
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                >
                                    <Plus size={10} /> Vincular Contato
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Activity Panel */}
                <div className="flex flex-col bg-background relative overflow-hidden min-h-[300px]">
                    <ActivityPanel deal={deal} readOnly={isClosed} />
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
