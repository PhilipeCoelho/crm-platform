import { useInsights } from '@/contexts/InsightsContext';
import VariationBadge from './VariationBadge';
import { MessageCircle, Mail, Phone, CalendarCheck2, CheckCircle2, TrendingUp } from 'lucide-react';

export default function ChannelModule() {
    const { data, loading } = useInsights();

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const { channel } = data.current;
    const { variation } = data;

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
            {/* 1. Titulo Central */}
            <div className="flex items-center gap-3 mb-2">
                <TrendingUp size={28} className="text-primary" />
                <h2 className="text-2xl font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Eficácia por Canal</h2>
            </div>

            {/* 2. Distribuição de Uso */}
            <div className="bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 w-full">
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Distribuição de Canais Dominantes</h3>
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">Canal mais utilizado por negócio</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <ChannelDistributionItem
                        label="WhatsApp/Mensagem"
                        percent={channel.percentMessage}
                        icon={<MessageCircle size={20} className="text-emerald-500" />}
                        colorClass="bg-emerald-500"
                    />
                    <ChannelDistributionItem
                        label="Email"
                        percent={channel.percentEmail}
                        icon={<Mail size={20} className="text-blue-500" />}
                        colorClass="bg-blue-500"
                    />
                    <ChannelDistributionItem
                        label="Ligação/Vídeo"
                        percent={channel.percentCall}
                        icon={<Phone size={20} className="text-purple-500" />}
                        colorClass="bg-purple-500"
                    />
                </div>
            </div>

            {/* 3. Taxas de Avanço */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* 3.1 Avanço para Reunião */}
                <div className="bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl">
                            <CalendarCheck2 size={24} className="text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Taxa de Agendamento</h3>
                            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] uppercase font-bold tracking-wider">Deals que chegam a reunião</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <ChannelRateItem
                            label="Mensagem"
                            rate={channel.taxaReuniaoMessage}
                            variation={variation.taxaReuniaoMessage}
                            colorClass="bg-emerald-500"
                        />
                        <ChannelRateItem
                            label="Email"
                            rate={channel.taxaReuniaoEmail}
                            variation={variation.taxaReuniaoEmail}
                            colorClass="bg-blue-500"
                        />
                        <ChannelRateItem
                            label="Ligação"
                            rate={channel.taxaReuniaoCall}
                            variation={variation.taxaReuniaoCall}
                            colorClass="bg-purple-500"
                        />
                    </div>
                </div>

                {/* 3.2 Avanço para Fechamento */}
                <div className="bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 space-y-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                            <CheckCircle2 size={24} className="text-emerald-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Taxa de Fechamento</h3>
                            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] uppercase font-bold tracking-wider">Deals que convertem em vendas</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <ChannelRateItem
                            label="Mensagem"
                            rate={channel.taxaFechamentoMessage}
                            variation={variation.taxaFechamentoMessage}
                            colorClass="bg-emerald-500"
                        />
                        <ChannelRateItem
                            label="Email"
                            rate={channel.taxaFechamentoEmail}
                            variation={variation.taxaFechamentoEmail}
                            colorClass="bg-blue-500"
                        />
                        <ChannelRateItem
                            label="Ligação"
                            rate={channel.taxaFechamentoCall}
                            variation={variation.taxaFechamentoCall}
                            colorClass="bg-purple-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ChannelDistributionItem({ label, percent, icon, colorClass }: any) {
    return (
        <div className="flex items-center gap-4 py-4 border-b border-[#E5E7EB] dark:border-[#1F2937] border-dashed last:border-0">
            <div className="p-3 bg-[#F7F9FC] dark:bg-[#1F2937] rounded-full border border-[#E5E7EB] dark:border-[#374151]">
                {icon}
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-semibold tracking-tight text-[#111827] dark:text-[#F9FAFB]">{label}</span>
                    <span className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#F9FAFB]">{percent === 0 ? '—' : percent.toFixed(1) + '%'}</span>
                </div>
                <div className="h-2 w-full bg-[#E5E7EB] dark:bg-[#1F2937] rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 ${colorClass}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

function ChannelRateItem({ label, rate, variation, colorClass }: any) {
    return (
        <div className="flex items-center justify-between group">
            <div className="flex-1 mr-6">
                <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-[#6B7280] dark:text-[#9CA3AF]">{label}</span>
                    <span className="font-bold text-[#111827] dark:text-[#F9FAFB]">{rate === 0 ? '—' : rate.toFixed(1) + '%'}</span>
                </div>
                <div className="h-2 w-full bg-[#E5E7EB] dark:bg-[#1F2937] rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 ${colorClass}`}
                        style={{ width: `${rate}%` }}
                    />
                </div>
            </div>
            <div className="w-20 flex justify-end">
                <VariationBadge value={variation} />
            </div>
        </div>
    );
}
