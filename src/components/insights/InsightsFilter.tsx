import { Calendar, ChevronDown, Check } from 'lucide-react';
import { useInsights, PeriodType } from '@/contexts/InsightsContext';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function InsightsFilter() {
    const {
        period, setPeriod, startDate, endDate, setCustomRange,
        isComparing, setIsComparing, comparisonDates
    } = useInsights();

    const periods: { id: PeriodType; label: string }[] = [
        { id: '7d', label: 'Últimos 7 dias' },
        { id: '30d', label: 'Últimos 30 dias' },
        { id: '90d', label: 'Últimos 90 dias' },
        { id: 'all', label: 'Todo o Período' },
        { id: 'custom', label: 'Personalizado' },
    ];

    const formatDateRange = (start: string, end: string) => {
        const s = parseISO(start);
        const e = parseISO(end);
        return `${format(s, "dd 'de' MMM", { locale: ptBR })} - ${format(e, "dd 'de' MMM, yyyy", { locale: ptBR })}`;
    };

    return (
        <div className="bg-[#FFFFFF] dark:bg-[#111827] border-b border-[#E5E7EB] dark:border-[#1F2937] p-4 sticky top-0 z-30">
            <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-4">
                {/* 1. Title */}
                <div>
                    <h1 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Insights</h1>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Panorama Comercial</p>
                </div>

                {/* 2. Controls */}
                <div className="flex items-center gap-3">
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="flex items-center gap-2 px-4 py-2 bg-muted/50 hover:bg-muted transition-all rounded-xl border border-border/50 text-sm font-medium">
                                <Calendar size={16} className="text-primary" />
                                <span>{periods.find(p => p.id === period)?.label}</span>
                                <span className="text-muted-foreground ml-1">
                                    ({formatDateRange(startDate, endDate)})
                                </span>
                                <ChevronDown size={14} className="text-muted-foreground ml-1" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                            <div className="space-y-1">
                                {periods.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setPeriod(p.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${period === p.id
                                            ? 'bg-primary/10 text-primary font-semibold'
                                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <span>{p.label}</span>
                                        {period === p.id && <Check size={14} />}
                                    </button>
                                ))}
                            </div>

                            {period === 'custom' && (
                                <div className="mt-3 pt-3 border-t border-border space-y-3 p-1">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Início</label>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setCustomRange(e.target.value, endDate)}
                                                className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/30"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Fim</label>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setCustomRange(startDate, e.target.value)}
                                                className="w-full bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/30"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>

                    <div className="flex items-center gap-3 ml-2 border-l border-border/60 pl-5">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={isComparing}
                                    onChange={(e) => setIsComparing(e.target.checked)}
                                />
                                <div className={`block w-10 h-6 rounded-full transition-colors ${isComparing ? 'bg-primary' : 'bg-muted border border-border'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${isComparing ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </div>
                            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                Comparar com período anterior
                            </span>
                        </label>
                    </div>
                </div>

                {isComparing && comparisonDates && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-full animate-in slide-in-from-right-2 duration-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            Comparando com: {formatDateRange(comparisonDates.startDate, comparisonDates.endDate)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
