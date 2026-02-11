import { useState, useRef } from 'react';
import { Deal } from '@/types/schema';
import { Currency } from '@/data/currencies';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';

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
    const [activeColumnIndex, setActiveColumnIndex] = useState(0);
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const activeColumn = columns[activeColumnIndex];
    const columnDeals = filteredDeals.filter(d => d.stageId === activeColumn?.id);

    // Swipe detection
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(0);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe && activeColumnIndex < columns.length - 1) {
            setActiveColumnIndex(prev => prev + 1);
        }
        if (isRightSwipe && activeColumnIndex > 0) {
            setActiveColumnIndex(prev => prev - 1);
        }
    };

    const goToPrevColumn = () => {
        if (activeColumnIndex > 0) {
            setActiveColumnIndex(prev => prev - 1);
        }
    };

    const goToNextColumn = () => {
        if (activeColumnIndex < columns.length - 1) {
            setActiveColumnIndex(prev => prev + 1);
        }
    };

    if (!activeColumn) return null;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background">
            {/* Stage Header with Navigation */}
            <div className="shrink-0 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                {/* Stage Title & Navigation */}
                <div className="flex items-center justify-between px-3 py-3">
                    <button
                        onClick={goToPrevColumn}
                        disabled={activeColumnIndex === 0}
                        className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Etapa anterior"
                    >
                        <ChevronLeft size={20} className="text-foreground" />
                    </button>

                    <div className="flex-1 text-center">
                        <h2 className="text-base font-bold text-foreground">
                            {activeColumn.title}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {columnDeals.length} {columnDeals.length === 1 ? 'negócio' : 'negócios'}
                        </p>
                    </div>

                    <button
                        onClick={goToNextColumn}
                        disabled={activeColumnIndex === columns.length - 1}
                        className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Próxima etapa"
                    >
                        <ChevronRight size={20} className="text-foreground" />
                    </button>
                </div>

                {/* Stage Indicator Dots */}
                <div className="flex items-center justify-center gap-1.5 pb-3">
                    {columns.map((col, idx) => (
                        <button
                            key={col.id}
                            onClick={() => setActiveColumnIndex(idx)}
                            className={`h-1.5 rounded-full transition-all ${idx === activeColumnIndex
                                ? 'w-6 bg-primary'
                                : 'w-1.5 bg-muted-foreground/30'
                                }`}
                            aria-label={`Ir para ${col.title}`}
                        />
                    ))}
                </div>
            </div>

            {/* Cards List */}
            <div
                ref={containerRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-2.5"
            >
                {columnDeals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                            <span className="text-2xl">📭</span>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                            Nenhum negócio nesta etapa
                        </p>
                        <button
                            onClick={() => onAddDeal(activeColumn.id)}
                            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                        >
                            Adicionar primeiro negócio
                        </button>
                    </div>
                ) : (
                    columnDeals.map((deal) => (
                        <div
                            key={deal.id}
                            onClick={() => onDealClick(deal.id)}
                            className="active:scale-[0.98] transition-transform"
                        >
                            <MobileDealCard deal={deal} currency={currency} />
                        </div>
                    ))
                )}
            </div>

            {/* Floating Add Button */}
            <button
                onClick={() => onAddDeal(activeColumn.id)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-[#00875A] hover:bg-[#00704a] text-white rounded-full shadow-lg flex items-center justify-center z-20 active:scale-95 transition-all"
                aria-label="Adicionar negócio"
            >
                <span className="text-2xl font-light leading-none">+</span>
            </button>
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
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm active:shadow-md transition-shadow">
            {/* Header: Title & Value */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-base font-semibold text-foreground leading-tight flex-1 line-clamp-2">
                    {deal.title}
                </h3>
                <div className="text-right shrink-0">
                    <p className="text-base font-bold text-foreground whitespace-nowrap">
                        {formatValue(deal.value)}
                    </p>
                </div>
            </div>

            {/* Contact & Company */}
            {(contact || company) && (
                <div className="space-y-1 mb-3">
                    {contact && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <span className="text-xs">👤</span>
                            {contact.name}
                        </p>
                    )}
                    {company && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <span className="text-xs">🏢</span>
                            {company.name}
                        </p>
                    )}
                </div>
            )}

            {/* Activity Status */}
            <div className="flex items-center gap-2 flex-wrap">
                {hasOverdueActivity && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-md text-xs font-medium">
                        🔴 Atrasado
                    </span>
                )}
                {hasTodayActivity && !hasOverdueActivity && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-md text-xs font-medium">
                        🟠 Hoje
                    </span>
                )}
                {deal.tags && deal.tags.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium">
                        {deal.tags[0] === '1' ? '🔥' : deal.tags[0] === '2' ? '🟡' : '🔵'}
                    </span>
                )}
            </div>
        </div>
    );
}
