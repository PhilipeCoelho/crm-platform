import { useInsights } from '@/contexts/InsightsContext';
import VariationBadge from './VariationBadge';
import { MessageCircle, Mail, PhoneCall } from 'lucide-react';

export default function ActivityModule() {
    const { data, loading } = useInsights();

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const { activity } = data.current;
    const { variation } = data;

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
            {/* 1. KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Total de Atividades"
                    value={activity.totalAtividades === 0 ? '—' : activity.totalAtividades}
                    variation={variation.totalAtividades}
                    subtitle="Total no período"
                />
                <KPICard
                    title="Média por Negócio"
                    value={activity.mediaAtividadesPorNegocio === 0 ? '—' : activity.mediaAtividadesPorNegocio.toFixed(1)}
                    variation={variation.mediaAtividadesPorNegocio}
                    subtitle="Intensidade comercial"
                />
                <KPICard
                    title="Até Reunião"
                    value={activity.mediaContatosAteReuniao === 0 ? '—' : activity.mediaContatosAteReuniao.toFixed(1)}
                    variation={variation.mediaContatosAteReuniao}
                    subtitle="Contatos médios"
                />
                <KPICard
                    title="Até Fechamento"
                    value={activity.mediaContatosAteFechamento === 0 ? '—' : activity.mediaContatosAteFechamento.toFixed(1)}
                    variation={variation.mediaContatosAteFechamento}
                    subtitle="Contatos médios (Won)"
                />
            </div>

            {/* 2. Distribuição */}
            <div className="bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 w-full">
                <h3 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight mb-8">Distribuição de Atividades</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <DistributionItem
                        icon={<MessageCircle size={24} className="text-emerald-500" />}
                        label="Mensagens (WhatsApp)"
                        count={activity.totalMensagens}
                        percent={activity.percentMensagens}
                        colorClass="bg-emerald-500"
                    />
                    <DistributionItem
                        icon={<Mail size={24} className="text-blue-500" />}
                        label="E-mails"
                        count={activity.totalEmails}
                        percent={activity.percentEmails}
                        colorClass="bg-blue-500"
                    />
                    <DistributionItem
                        icon={<PhoneCall size={24} className="text-rose-500" />}
                        label="Ligações"
                        count={activity.totalLigacoes}
                        percent={activity.percentLigacoes}
                        colorClass="bg-rose-500"
                    />
                </div>

                {/* Visual Bar */}
                <div className="mt-8 flex h-4 rounded-full overflow-hidden border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F7F9FC] dark:bg-[#1F2937]">
                    <div style={{ width: `${activity.percentMensagens}%` }} className="bg-emerald-500 transition-all duration-1000" title="Mensagens" />
                    <div style={{ width: `${activity.percentEmails}%` }} className="bg-blue-500 transition-all duration-1000" title="E-mails" />
                    <div style={{ width: `${activity.percentLigacoes}%` }} className="bg-rose-500 transition-all duration-1000" title="Ligações" />
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

function DistributionItem({ icon, label, count, percent }: any) {
    return (
        <div className="flex items-center gap-4 py-4 border-b border-[#E5E7EB] dark:border-[#1F2937] border-dashed last:border-0">
            <div className="p-3 bg-[#F7F9FC] dark:bg-[#1F2937] rounded-full border border-[#E5E7EB] dark:border-[#374151]">
                {icon}
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold tracking-tight text-[#111827] dark:text-[#F9FAFB] text-sm">{label}</span>
                    <span className="font-bold text-[#6B7280] dark:text-[#9CA3AF] text-xs">{percent === 0 ? '—' : percent.toFixed(1) + '%'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">{count}</span>
                    <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-[#9CA3AF]">realizadas</span>
                </div>
            </div>
        </div>
    );
}
