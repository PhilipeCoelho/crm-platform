import { useInsights } from '@/contexts/InsightsContext';
import { Clock, CalendarDays, Timer, FastForward } from 'lucide-react';
import VariationBadge from './VariationBadge';
export default function TimingModule() {
    const { data, loading } = useInsights();

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const { timing } = data.current;
    const { variation } = data;

    const totalEncerrados = timing.ciclo_0_7 + timing.ciclo_8_15 + timing.ciclo_16_30 + timing.ciclo_30_plus;
    const getPercent = (count: number) => {
        if (totalEncerrados === 0) return 0;
        return (count / totalEncerrados) * 100;
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
            {/* 1. KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Tempo Médio até Reunião"
                    value={timing.tempoMedioAteReuniao === 0 ? '—' : timing.tempoMedioAteReuniao.toFixed(1) + 'd'}
                    variation={variation.tempoMedioAteReuniao}
                    subtitle="Dias até demonstração"
                    inverseVariation={true}
                />
                <KPICard
                    title="Tempo Médio até Fechar"
                    value={timing.tempoMedioAteFechamento === 0 ? '—' : timing.tempoMedioAteFechamento.toFixed(1) + 'd'}
                    variation={variation.tempoMedioAteFechamento}
                    subtitle="Dias para WON"
                    inverseVariation={true}
                />
                <KPICard
                    title="Tempo Médio do Ciclo"
                    value={timing.tempoMedioCiclo === 0 ? '—' : timing.tempoMedioCiclo.toFixed(1) + 'd'}
                    variation={variation.tempoMedioCiclo}
                    subtitle="Dias totais no funil"
                    inverseVariation={true}
                />
                <KPICard
                    title="Tempo entre Contatos"
                    value={timing.tempoMedioEntreContatos === 0 ? '—' : timing.tempoMedioEntreContatos.toFixed(1) + 'd'}
                    variation={variation.tempoMedioEntreContatos}
                    subtitle="Dias médios sem falar"
                    inverseVariation={true}
                />
            </div>

            {/* 2. Distribuição */}
            <div className="bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Distribuição do Ciclo de Vendas</h3>
                        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">Duração dos negócios encerrados (WON/LOST)</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <TimingBar
                        label="Até 7 dias"
                        count={timing.ciclo_0_7}
                        percent={getPercent(timing.ciclo_0_7)}
                        colorClass="bg-emerald-500"
                        icon={<FastForward size={16} className="text-emerald-500" />}
                        subLabel="Fechamento Rápido"
                    />
                    <TimingBar
                        label="8 a 15 dias"
                        count={timing.ciclo_8_15}
                        percent={getPercent(timing.ciclo_8_15)}
                        colorClass="bg-blue-500"
                        icon={<Clock size={16} className="text-blue-500" />}
                        subLabel="Ciclo Curto"
                    />
                    <TimingBar
                        label="16 a 30 dias"
                        count={timing.ciclo_16_30}
                        percent={getPercent(timing.ciclo_16_30)}
                        colorClass="bg-amber-500"
                        icon={<CalendarDays size={16} className="text-amber-500" />}
                        subLabel="Ciclo Médio"
                    />
                    <TimingBar
                        label="Mais de 30 dias"
                        count={timing.ciclo_30_plus}
                        percent={getPercent(timing.ciclo_30_plus)}
                        colorClass="bg-rose-500"
                        icon={<Timer size={16} className="text-rose-500" />}
                        subLabel="Ciclo Longo"
                    />
                </div>
            </div>
        </div>
    );
}

function KPICard({ title, value, variation, subtitle, inverseVariation }: any) {
    return (
        <div className="flex flex-col gap-1 p-5 bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm">
            <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF] tracking-widest">{title}</span>
            <div className="flex items-baseline gap-3 my-1">
                <span className="text-4xl font-semibold tracking-tighter text-[#111827] dark:text-[#F9FAFB]">{value}</span>
                <VariationBadge value={variation} inverse={inverseVariation} />
            </div>
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium">{subtitle}</span>
        </div>
    );
}

function TimingBar({ label, count, percent, colorClass, icon, subLabel }: any) {
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
