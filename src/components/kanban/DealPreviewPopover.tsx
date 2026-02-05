import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { X, Calendar, User, Building, DollarSign, Tag, ExternalLink, Pencil } from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import InlineEditableField from '@/components/ui/InlineEditableField';
import NewDealModal from './NewDealModal';

interface DealPreviewPopoverProps {
    dealId: string;
    onClose: () => void;
    position: { x: number; y: number } | null; // Center of the clicked card
}

export default function DealPreviewPopover({ dealId, onClose, position }: DealPreviewPopoverProps) {
    const navigate = useNavigate();
    const { deals, companies, contacts, activities, pipelines, updateDeal, updateCompany, updateContact } = useCRM();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const deal = deals.find(d => d.id === dealId);

    // Derived Data
    const company = deal?.companyId ? companies.find(c => c.id === deal.companyId) : undefined;
    const contact = deal?.contactId ? contacts.find(c => c.id === deal.contactId) : undefined;

    // Get stage from pipeline
    const pipeline = deal?.pipelineId ? pipelines[deal.pipelineId] : null;
    const stage = pipeline?.stages.find(s => s.id === deal?.stageId);

    // Recent History (Last 3 activities)
    const recentActivities = activities
        .filter(a => a.dealId === dealId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3);

    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Close on Click Outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // Check if clicking on the card itself to prevent double toggle
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                // Also check if we are not clicking inside the modal if it's open (though modal usually has overlay)
                // But since modal is portaled or on top, this might trigger onClose of popover while modal is open?
                // Actually NewDealModal has its own overlay.
                // If isEditModalOpen is true, we should probably NOT close the popover on outside click 
                // because the user might be interacting with the modal which is technically "outside" the popover.
                // However, usually we want the popover to stay legally "open" behind the modal or close?
                // Let's keep it simple: if editing, don't close.
                if (!isEditModalOpen) {
                    onClose();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, isEditModalOpen]);

    if (!deal) return null;

    const handleUpdate = (field: keyof typeof deal, value: any) => {
        updateDeal(deal.id, { [field]: value });
    };

    // --- Smart Positioning Logic ---
    const style: React.CSSProperties = {};

    if (position) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const popoverWidth = 400; // Approx width
        const popoverHeight = 500; // Max height estimate

        // Horizontal: Prefer right of card, switch to left if overflow
        let left = position.x + 20; // 20px Offset
        if (left + popoverWidth > viewportWidth - 20) {
            left = position.x - popoverWidth - 20;
        }

        // Vertical: Center on card y, but clamp to viewport
        let top = position.y - (popoverHeight / 4);

        // Clamping
        if (top < 20) top = 20;
        if (top + popoverHeight > viewportHeight - 20) {
            top = viewportHeight - popoverHeight - 20;
        }

        style.position = 'fixed';
        style.left = `${left}px`;
        style.top = `${top}px`;
        style.width = `${popoverWidth}px`;
    } else {
        // Fallback Center
        style.position = 'fixed';
        style.left = '50%';
        style.top = '50%';
        style.transform = 'translate(-50%, -50%)';
        style.width = '400px';
    }

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-start justify-start" style={{ pointerEvents: 'none' }}>
                <div
                    ref={popoverRef}
                    className="bg-background border border-border rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
                    style={{ ...style, maxHeight: '80vh', pointerEvents: 'auto' }}
                >
                    {/* Header */}
                    <div className="p-4 border-b border-border flex items-start justify-between bg-muted/30 rounded-t-xl">
                        <div className="w-full mr-4">
                            <div className="flex items-center gap-2 mb-1">
                                {deal.priority === 'high' && <span className="w-2 h-2 rounded-full bg-destructive" title="Alta Prioridade" />}
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stage?.title || 'Estágio Desconhecido'}</span>
                            </div>
                            <InlineEditableField
                                value={deal.title}
                                onSave={(val) => handleUpdate('title', val)}
                                className="font-bold text-lg leading-tight text-foreground"
                                inputClassName="font-bold text-lg"
                            />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="text-muted-foreground hover:text-primary transition-colors p-1 hover:bg-muted rounded"
                                title="Editar tudo"
                            >
                                <Pencil size={16} />
                            </button>
                            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar">

                        {/* Value */}
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-primary/10 rounded-full text-primary">
                                <DollarSign size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-muted-foreground font-medium">Valor do Negócio</p>
                                <InlineEditableField
                                    value={deal.value}
                                    onSave={(val) => handleUpdate('value', parseFloat(val))}
                                    type="currency"
                                    formatDisplay={(val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: deal.currency }).format(Number(val))}
                                    className="text-xl font-bold text-foreground"
                                    inputClassName="text-xl font-bold"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {/* Organization */}
                            {company && (
                                <div className="flex items-center gap-3">
                                    <Building size={16} className="text-muted-foreground" />
                                    <div className="flex-1">
                                        <InlineEditableField
                                            value={company.name}
                                            onSave={(val) => updateCompany(company.id, { name: val })}
                                            className="text-sm font-medium"
                                        />
                                        <p className="text-xs text-muted-foreground">Organização</p>
                                    </div>
                                </div>
                            )}

                            {/* Contact */}
                            {contact && (
                                <div className="flex items-center gap-3">
                                    <User size={16} className="text-muted-foreground" />
                                    <div className="flex-1">
                                        <InlineEditableField
                                            value={contact.name}
                                            onSave={(val) => updateContact(contact.id, { name: val })}
                                            className="text-sm font-medium"
                                        />
                                        <p className="text-xs text-muted-foreground">Contato Principal</p>
                                    </div>
                                </div>
                            )}

                            {/* Expected Date */}
                            <div className="flex items-center gap-3">
                                <Calendar size={16} className="text-muted-foreground" />
                                <div className="flex-1">
                                    <InlineEditableField
                                        value={deal.expectedCloseDate || ''}
                                        onSave={(val) => handleUpdate('expectedCloseDate', val)}
                                        type="date"
                                        placeholder="Definir data..."
                                        formatDisplay={(val) => val ? format(parseISO(val), "d 'de' MMMM", { locale: ptBR }) : 'Sem data prevista'}
                                        className="text-sm font-medium"
                                    />
                                    <p className="text-xs text-muted-foreground">Fechamento Esperado</p>
                                </div>
                            </div>
                        </div>

                        {/* Tags */}
                        {deal.tags && deal.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {deal.tags.map(tagId => {
                                    const labelMap: any = { '1': 'Quente', '2': 'Morno', '3': 'Frio' };
                                    const colorMap: any = { '1': 'bg-red-100 text-red-700', '2': 'bg-orange-100 text-orange-700', '3': 'bg-blue-100 text-blue-700' };
                                    return (
                                        <span key={tagId} className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${colorMap[tagId] || 'bg-gray-100 text-gray-700'}`}>
                                            <Tag size={10} /> {labelMap[tagId] || 'Etiqueta'}
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        <hr className="border-border" />

                        {/* Recent Activity */}
                        <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 text-left">Atividade Recente</h4>
                            <div className="space-y-3">
                                {recentActivities.length > 0 ? recentActivities.map(activity => (
                                    <div key={activity.id} className="text-sm border-l-2 border-muted pl-3 py-0.5">
                                        <p className="font-medium text-foreground">{activity.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: ptBR })}
                                        </p>
                                    </div>
                                )) : (
                                    <p className="text-sm text-muted-foreground italic">Nenhuma atividade recente encontrada.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-muted/30 border-t border-border rounded-b-xl flex justify-end">
                        <button
                            onClick={() => navigate(`/deals/${dealId}`)}
                            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors bg-primary/10 px-4 py-2 rounded-md hover:bg-primary/20"
                        >
                            Abrir detalhes completos
                            <ExternalLink size={14} />
                        </button>
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
        </>
    );
}
