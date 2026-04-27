import { useInsights } from '@/contexts/InsightsContext';
import VariationBadge from './VariationBadge';
import QuickGuide from '../ui/QuickGuide';
import { AlertCircle } from 'lucide-react';

interface Props {
    activeGuide: string | null;
    setActiveGuide: (name: string | null) => void;
}

export default function ExecutiveSummary({ activeGuide, setActiveGuide }: Props) {
    const { data, loading } = useInsights();

    if (loading || !data) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-[#E5E7EB] dark:bg-[#1F2937] animate-pulse rounded-lg bg-opacity-30"></div>
                ))}
            </div>
        );
    }

    const { current, variation } = data;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <h2 className="text-xl font-bold text-[#111827] dark:text-[#EAEAEA] tracking-tight">Status do Período</h2>
                    <QuickGuide
                        moduleName="insights_resumo"
                        activeGuide={activeGuide}
                        setActiveGuide={setActiveGuide}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Total de Negócios"
                    value={current.totalDeals === 0 ? '—' : current.totalDeals}
                    variation={variation.totalDeals}
                    subtitle="Negócios criados no período"
                />
                <KPICard
                    title="Ganhos (Won)"
                    value={current.totalWon === 0 ? '—' : current.totalWon}
                    variation={variation.totalWon}
                    subtitle="Fechados com sucesso"
                />
                <KPICard
                    title="Perdidos (Lost)"
                    value={current.totalLost === 0 ? '—' : current.totalLost}
                    variation={variation.totalLost}
                    subtitle="Finalizados sem venda"
                />
                <KPICard
                    title="Taxa de Fechamento"
                    value={current.funnel.taxaFechamento === 0 ? '—' : current.funnel.taxaFechamento.toFixed(1) + '%'}
                    variation={variation.taxaFechamento}
                    subtitle="Conversão global de vendas"
                />
            </div>

            {/* Principais Motivos de Perda */}
            {current.lost.motivos.length > 0 && (
                <div className="bg-[#FFFFFF] dark:bg-[#141414] rounded-xl border border-[#E5E7EB] dark:border-[#262626] p-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                    <h3 className="text-sm font-bold text-[#111827] dark:text-[#EAEAEA] uppercase tracking-wider mb-4 flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-500" />
                        Principais Motivos de Perda
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {current.lost.motivos.slice(0, 3).map((motivo: any, idx: number) => (
                            <div key={idx} className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-[#111827] dark:text-[#EAEAEA] truncate max-w-[200px]" title={motivo.motivo_perda}>
                                        {motivo.motivo_perda}
                                    </span>
                                    <span className="font-bold text-[#6B7280] dark:text-[#8A8A8A] shrink-0">
                                        {motivo.quantidade} <span className="text-[10px] font-normal">({motivo.percentual.toFixed(1)}%)</span>
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-[#E5E7EB] dark:bg-[#1F2937] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-rose-500 transition-all duration-1000"
                                        style={{ width: `${motivo.percentual}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function KPICard({ title, value, variation, subtitle }: any) {
    return (
        <div className="flex flex-col gap-1 p-5 bg-[#FFFFFF] dark:bg-[#141414] rounded-xl border border-[#E5E7EB] dark:border-[#262626] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#8A8A8A] tracking-widest">{title}</span>
            <div className="flex items-baseline gap-3 my-1">
                <span className="text-4xl font-semibold tracking-tighter text-[#111827] dark:text-[#EAEAEA]">{value}</span>
                <VariationBadge value={variation} />
            </div>
            <span className="text-xs text-[#6B7280] dark:text-[#8A8A8A] font-medium">{subtitle}</span>
        </div>
    );
}
