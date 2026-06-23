import { useState } from 'react';
import { InsightsProvider, useInsights, PeriodType } from '@/contexts/InsightsContext';
import DashboardsView, { DashboardTabId } from '@/components/insights/DashboardsView';
import ReportsView from '@/components/insights/ReportsView';
import GoalsView from '@/components/insights/GoalsView';
import { BarChart3, FileText, Target, Calendar, ChevronDown, Check } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type InsightsView = 'dashboards' | 'reports' | 'goals';

const MAIN_NAV: { id: InsightsView; label: string; icon: typeof BarChart3 }[] = [
    { id: 'dashboards', label: 'Painéis', icon: BarChart3 },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'goals', label: 'Metas', icon: Target },
];

const DASHBOARD_TABS: { id: DashboardTabId; label: string }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'execucao', label: 'Execução' },
    { id: 'velocidade', label: 'Velocidade' },
    { id: 'canais', label: 'Canais' },
    { id: 'perdas', label: 'Perdas' },
];

const PERIOD_OPTIONS: { id: PeriodType; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: '7d', label: 'Últimos 7 dias' },
    { id: '30d', label: 'Últimos 30 dias' },
    { id: '90d', label: 'Últimos 90 dias' },
    { id: 'all', label: 'Todo o Período' },
    { id: 'custom', label: 'Personalizado' },
];

function formatDateRange(start: string, end: string) {
    const s = parseISO(start);
    const e = parseISO(end);
    return `${format(s, "dd MMM", { locale: ptBR })} – ${format(e, "dd MMM yy", { locale: ptBR })}`;
}

// ── Inner component that consumes the context ──────────────────────────────
function InsightsContent() {
    const [activeView, setActiveView] = useState<InsightsView>('dashboards');
    const [activeTab, setActiveTab] = useState<DashboardTabId>('resumo');

    const {
        period, setPeriod,
        startDate, endDate, setCustomRange,
        isComparing, setIsComparing, comparisonDates,
    } = useInsights();

    const renderView = () => {
        switch (activeView) {
            case 'dashboards': return <DashboardsView activeTab={activeTab} />;
            case 'reports':    return <ReportsView />;
            case 'goals':      return <GoalsView />;
        }
    };

    return (
        <div className="flex h-full w-full bg-[#F7F9FC] dark:bg-[#0D0D0D]">
            <main className="flex-1 flex flex-col overflow-hidden w-full">

                {/* ── Unified Header ──────────────────────────────────────────── */}
                <header className="sticky top-0 z-30 bg-[#FFFFFF] dark:bg-[#0D0D0D] border-b border-[#E5E7EB] dark:border-[#1F1F1F]">

                    {/* Row 1 — Title · Main Nav · Controls */}
                    <div className="px-6 h-[52px] flex items-center justify-between gap-4">

                        {/* Left: brand + divider + main nav */}
                        <div className="flex items-center gap-4">
                            <div className="shrink-0 leading-none">
                                <p className="text-[15px] font-bold text-[#111827] dark:text-[#EAEAEA] tracking-tight">Insights</p>
                                <p className="text-[10px] text-[#6B7280] dark:text-[#8A8A8A] font-medium mt-0.5">Panorama Comercial</p>
                            </div>

                            <div className="w-px h-5 bg-[#E5E7EB] dark:bg-[#262626] shrink-0" />

                            <nav className="flex items-center gap-0.5">
                                {MAIN_NAV.map(({ id, label, icon: Icon }) => (
                                    <button
                                        key={id}
                                        onClick={() => setActiveView(id)}
                                        className={`
                                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-150
                                            ${activeView === id
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-[#6B7280] dark:text-[#8A8A8A] hover:text-[#111827] dark:hover:text-[#EAEAEA] hover:bg-[#F3F4F6] dark:hover:bg-[#1A1A1A]'
                                            }
                                        `}
                                    >
                                        <Icon size={13} />
                                        {label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Right: period filter + compare toggle */}
                        <div className="flex items-center gap-2 shrink-0">
                            {/* Period Popover */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#262626] bg-[#F7F9FC] dark:bg-[#1A1A1A] hover:bg-[#F0F1F3] dark:hover:bg-[#222] transition-colors text-[13px] font-medium text-[#111827] dark:text-[#EAEAEA]">
                                        <Calendar size={13} className="text-primary shrink-0" />
                                        <span className="hidden sm:inline">{PERIOD_OPTIONS.find(p => p.id === period)?.label}</span>
                                        <span className="hidden md:inline text-[#6B7280] dark:text-[#8A8A8A] text-xs">
                                            ({formatDateRange(startDate, endDate)})
                                        </span>
                                        <ChevronDown size={12} className="text-[#6B7280] dark:text-[#8A8A8A]" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60 p-1.5" align="end">
                                    <div className="space-y-0.5">
                                        {PERIOD_OPTIONS.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setPeriod(p.id)}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                                                    period === p.id
                                                        ? 'bg-primary/10 text-primary font-semibold'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                }`}
                                            >
                                                <span>{p.label}</span>
                                                {period === p.id && <Check size={13} />}
                                            </button>
                                        ))}
                                    </div>
                                    {period === 'custom' && (
                                        <div className="mt-2 pt-2 border-t border-border space-y-2 px-1">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Início</label>
                                                    <input
                                                        type="date"
                                                        value={startDate}
                                                        onChange={e => setCustomRange(e.target.value, endDate)}
                                                        className="w-full bg-muted/50 border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/30"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Fim</label>
                                                    <input
                                                        type="date"
                                                        value={endDate}
                                                        onChange={e => setCustomRange(startDate, e.target.value)}
                                                        className="w-full bg-muted/50 border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/30"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>

                            {/* Compare toggle */}
                            <label className="hidden sm:flex items-center gap-2 cursor-pointer group border-l border-[#E5E7EB] dark:border-[#262626] pl-3 ml-1">
                                <div className="relative shrink-0">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isComparing}
                                        onChange={e => setIsComparing(e.target.checked)}
                                    />
                                    <div className={`w-8 rounded-full transition-colors ${isComparing ? 'bg-primary' : 'bg-[#E5E7EB] dark:bg-[#333]'}`} style={{ height: 18 }} />
                                    <div
                                        className="absolute top-[2px] bg-white rounded-full shadow-sm transition-transform duration-200"
                                        style={{ width: 14, height: 14, left: 2, transform: isComparing ? 'translateX(14px)' : 'translateX(0)' }}
                                    />
                                </div>
                                <span className="text-xs font-medium text-[#6B7280] dark:text-[#8A8A8A] group-hover:text-[#111827] dark:group-hover:text-[#EAEAEA] transition-colors whitespace-nowrap select-none">
                                    Comparar
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Comparison period badge */}
                    {isComparing && comparisonDates && (
                        <div className="px-6 pb-2 flex">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/20 rounded-full animate-in slide-in-from-top-1 duration-200">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                    Comparando: {formatDateRange(comparisonDates.startDate, comparisonDates.endDate)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Row 2 — Dashboard sub-tabs (contextual) */}
                    {activeView === 'dashboards' && (
                        <div className="flex px-6 border-t border-[#E5E7EB] dark:border-[#1F1F1F] overflow-x-auto no-scrollbar">
                            {DASHBOARD_TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`relative shrink-0 px-4 py-2.5 text-[13px] font-semibold tracking-wide transition-colors ${
                                        activeTab === tab.id
                                            ? 'text-primary'
                                            : 'text-[#6B7280] dark:text-[#8A8A8A] hover:text-[#111827] dark:hover:text-[#EAEAEA]'
                                    }`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </header>

                {/* ── Page content ─────────────────────────────────────────────── */}
                <div className="flex-1 overflow-auto w-full">
                    {renderView()}
                </div>

            </main>
        </div>
    );
}

// ── Public page export (wraps in provider) ─────────────────────────────────
export default function Insights() {
    return (
        <InsightsProvider>
            <InsightsContent />
        </InsightsProvider>
    );
}
