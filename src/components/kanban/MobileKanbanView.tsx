import { useRef } from 'react';
import { Deal } from '@/types/schema';
import { Currency } from '@/data/currencies';
import { useCRM } from '@/contexts/CRMContext';
import { Plus } from 'lucide-react';

interface MobileKanbanViewProps {
    columns: Array<{ id: string; title: string; pipelineId: string }>;
    filteredDeals: Deal[];
    currency: Currency;
    onDealClick: (dealId: string) => void;
    onAddDeal: (stageId: string) => void;
}

export default function MobileKanbanView({
    columns,
    filteredDeals,
    currency,
    onDealClick,
    onAddDeal
}: MobileKanbanViewProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="relative flex-1 flex flex-col overflow-hidden bg-background">
            {/* Horizontal Scrollable Container */}
            <div
                ref={scrollContainerRef}
                className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide overscroll-x-contain"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {columns.map((column) => {
                    const columnDeals = filteredDeals.filter(d => d.stageId === column.id);

                    return (
                        <div
                            key={column.id}
                            className="w-[85vw] shrink-0 snap-start flex flex-col h-full border-r border-border/40 last:border-r-0"
                        >
                            {/* Column Header */}
                            <div className="px-4 py-3 bg-card/30 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10 flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-bold text-foreground">
                                        {column.title}
                                    </h2>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                        {columnDeals.length} {columnDeals.length === 1 ? 'negócio' : 'negócios'}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddDeal(column.id);
                                    }}
                                    className="p-1.5 rounded-full hover:bg-muted text-primary transition-colors"
                                    aria-label="Adicionar negócio nesta etapa"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            {/* Column Content (Vertical Scroll) */}
                            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                                {columnDeals.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
                                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                            <span className="text-xl">📭</span>
                                        </div>
                                        <p className="text-xs font-medium text-muted-foreground px-4">
                                            Nenhum negócio nesta etapa
                                        </p>
                                    </div>
                                ) : (
                                    columnDeals.map((deal) => (
                                        <div
                                            key={deal.id}
                                            onClick={() => onDealClick(deal.id)}
                                            className="active:scale-[0.97] transition-transform duration-75"
                                        >
                                            <MobileDealCard deal={deal} currency={currency} />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Visual Peek Space at the end */}
                <div className="w-[10vw] shrink-0" />
            </div>

            {/* Global Floating Add Button (Optional, can be removed if per-column button is enough) */}
            <button
                onClick={() => onAddDeal(columns[0]?.id || 'new')}
                className="fixed bottom-6 right-6 w-14 h-14 bg-[#00875A] hover:bg-[#00704a] text-white rounded-full shadow-lg flex items-center justify-center z-20 active:scale-90 transition-all shadow-[#00875a]/20"
                aria-label="Adicionar negócio"
            >
                <Plus size={28} strokeWidth={2.5} />
            </button>

            {/* CSS for hiding scrollbars but keeping functionality */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}} />
        </div>
    );
}

// Mobile-optimized Deal Card
function MobileDealCard({ deal, currency }: { deal: Deal; currency: Currency }) {
    const { contacts, companies, activities } = useCRM();

    const contact = contacts.find(c => c.id === deal.contactId);
    const company = companies.find(c => c.id === deal.companyId);
    const dealActivities = activities.filter(a => a.dealId === deal.id);
    const hasOverdueActivity = dealActivities.some(a => !a.completed && a.dueDate && new Date(a.dueDate) < new Date());
    const hasTodayActivity = dealActivities.some(a => {
        if (!a.dueDate || a.completed) return false;
        const today = new Date().toDateString();
        return new Date(a.dueDate).toDateString() === today;
    });

    const formatValue = (value: number) => {
        return new Intl.NumberFormat('pt-PT', {
            style: 'currency',
            currency: currency.code,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    return (
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm active:shadow-md transition-all border-l-4 border-l-primary/10">
            {/* Header: Title & Value */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-sm font-bold text-foreground leading-snug flex-1 line-clamp-2">
                    {deal.title}
                </h3>
            </div>

            <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-primary">
                    {formatValue(deal.value)}
                </p>

                {/* Priority/Hotness indicator */}
                {deal.tags && deal.tags.length > 0 && (
                    <span className="text-[10px] bg-primary/5 text-primary px-1.5 py-0.5 rounded font-bold border border-primary/10">
                        {deal.tags[0] === '1' ? 'HOT 🔥' : deal.tags[0] === '2' ? 'MORNO' : 'FRIO'}
                    </span>
                )}
            </div>

            {/* Contact & Company - More compact for mobile scroll */}
            {(contact || company) && (
                <div className="space-y-1 mb-3 pt-2 border-t border-border/40">
                    {contact && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span className="opacity-70">👤</span>
                            <span className="truncate max-w-[150px]">{contact.name}</span>
                        </p>
                    )}
                    {company && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                            <span className="opacity-70">🏢</span>
                            <span className="truncate max-w-[150px]">{company.name}</span>
                        </p>
                    )}
                </div>
            )}

            {/* Activity Status */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {hasOverdueActivity && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-md text-[10px] font-bold">
                        ⚠️ ATRASADO
                    </span>
                )}
                {hasTodayActivity && !hasOverdueActivity && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-md text-[10px] font-bold">
                        📅 HOJE
                    </span>
                )}
                {!hasOverdueActivity && !hasTodayActivity && dealActivities.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-muted text-muted-foreground rounded-md text-[10px] font-bold">
                        PROX: {new Date(dealActivities[0].dueDate!).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                    </span>
                )}
            </div>
        </div>
    );
}
