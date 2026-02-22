import { useInsights } from '@/contexts/InsightsContext';
import VariationBadge from './VariationBadge';
import { Flame, BatteryWarning, BatteryCharging, BatteryFull } from 'lucide-react';

export default function IntensityModule() {
    const { data, loading } = useInsights();

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const { intensity } = data.current;
    const { variation } = data;

    const totalDeals = data.current.totalDeals;
    const getPercent = (count: number) => {
        if (totalDeals === 0) return 0;
        return (count / totalDeals) * 100;
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
            {/* 1. KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <KPICard
                    title="Média de Contatos/Negócio"
                    value={intensity.mediaContatosPorNegocio === 0 ? '—' : intensity.mediaContatosPorNegocio.toFixed(1)}
                    variation={variation.mediaContatosPorNegocio}
                    subtitle="Persistência média"
                />
                <KPICard
                    title="Com 7+ Contatos"
                    value={intensity.percent7OuMais === 0 ? '—' : intensity.percent7OuMais.toFixed(1) + '%'}
                    variation={variation.percent7OuMais}
                    subtitle="Alta intensidade comercial"
                />
                <KPICard
                    title="Encerrados p/ falta de follow-up"
                    value={intensity.percentEncerradosAntes5 === 0 ? '—' : intensity.percentEncerradosAntes5.toFixed(1) + '%'}
                    variation={variation.percentEncerradosAntes5}
                    subtitle="Finalizados < 5 contatos"
                />
            </div>

            {/* 2. Distribuição */}
            <div className="bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Faixas de Intensidade</h3>
                        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">Volume de deals por número de contatos</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <IntensityBar
                        label="0 a 2 Contatos"
                        count={intensity.faixa0_2}
                        percent={getPercent(intensity.faixa0_2)}
                        colorClass="bg-red-500"
                        icon={<BatteryWarning size={16} className="text-red-500" />}
                        subLabel="Baixa insistência"
                    />
                    <IntensityBar
                        label="3 a 5 Contatos"
                        count={intensity.faixa3_5}
                        percent={getPercent(intensity.faixa3_5)}
                        colorClass="bg-amber-500"
                        icon={<BatteryCharging size={16} className="text-amber-500" />}
                        subLabel="Aquecimento"
                    />
                    <IntensityBar
                        label="6 a 9 Contatos"
                        count={intensity.faixa6_9}
                        percent={getPercent(intensity.faixa6_9)}
                        colorClass="bg-blue-500"
                        icon={<BatteryFull size={16} className="text-blue-500" />}
                        subLabel="Ideal comercial"
                    />
                    <IntensityBar
                        label="10+ Contatos"
                        count={intensity.faixa10_plus}
                        percent={getPercent(intensity.faixa10_plus)}
                        colorClass="bg-emerald-500"
                        icon={<Flame size={16} className="text-emerald-500" />}
                        subLabel="Alta persistência"
                    />
                </div>
            </div>
        </div>
    );
}

function KPICard({ title, value, variation, subtitle }: any) {
    return (
        <div className="flex flex-col gap-1 p-5 bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF] tracking-widest">{title}</span>
            <div className="flex items-baseline gap-3 my-1">
                <span className="text-4xl font-semibold tracking-tighter text-[#111827] dark:text-[#F9FAFB]">{value}</span>
                <VariationBadge value={variation} />
            </div>
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium">{subtitle}</span>
        </div>
    );
}

function IntensityBar({ label, count, percent, colorClass, icon, subLabel }: any) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-[#F7F9FC] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151]">
                    {icon}
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB] leading-tight">{label}</h4>
                    <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] uppercase font-bold tracking-wider">{subLabel}</p>
                </div>
            </div>

            <div>
                <div className="flex items-end justify-between mb-2">
                    <span className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#F9FAFB] leading-none">{count}</span>
                    <span className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF]">{percent === 0 ? '—' : percent.toFixed(1) + '%'}</span>
                </div>
                <div className="h-2 w-full bg-[#E5E7EB] dark:bg-[#1F2937] rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 ease-out rounded-full ${colorClass}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
