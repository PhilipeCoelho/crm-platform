import { useInsights } from '@/contexts/InsightsContext';
import VariationBadge from './VariationBadge';
import { Link2, AlertCircle } from 'lucide-react';

export default function LostModule() {
    const { data, loading } = useInsights();

    if (loading || !data) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    const { lost } = data.current;
    const { variation } = data;

    const maxEtapas = Math.max(...(lost.etapas.map(e => e.quantidade) || [1]));
    const maxMotivos = Math.max(...(lost.motivos.map(m => m.quantidade) || [1]));

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
            {/* Top KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Total de Perdas"
                    value={lost.totalLost === 0 ? '—' : lost.totalLost}
                    variation={variation.totalLost}
                    subtitle="Negócios perdidos no período"
                    inverseVariation={true}
                />
                <KPICard
                    title="Taxa de Perda"
                    value={lost.taxaPerda === 0 ? '—' : lost.taxaPerda.toFixed(1) + '%'}
                    variation={variation.taxaPerda}
                    subtitle="Percentual de insucesso"
                    inverseVariation={true}
                />
                <KPICard
                    title="Tempo Médio p/ Perda"
                    value={lost.tempoMedioAtePerda === 0 ? '—' : Math.round(lost.tempoMedioAtePerda) + 'd'}
                    variation={variation.tempoMedioAtePerda}
                    subtitle="Dias até encerramento"
                    inverseVariation={true}
                />
                <KPICard
                    title="Contatos p/ Perda"
                    value={lost.mediaContatosAtePerda === 0 ? '—' : lost.mediaContatosAtePerda.toFixed(1)}
                    variation={variation.mediaContatosAtePerda}
                    subtitle="Esforço médio desperdiçado"
                    inverseVariation={true}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                {/* Center: Perdas por Etapa */}
                <div className="bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <Link2 size={24} className="text-primary" />
                        <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Perdas por Etapa</h3>
                    </div>

                    {lost.etapas.length === 0 ? (
                        <div className="py-8 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">Sem dados de perdas no período.</div>
                    ) : (
                        <div className="space-y-6">
                            {lost.etapas.map((etapa, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]">{etapa.etapa_onde_perdeu}</span>
                                        <span className="font-bold text-[#6B7280] dark:text-[#9CA3AF]">{etapa.quantidade} <span className="text-xs font-normal">({etapa.percentual === 0 ? '—' : etapa.percentual.toFixed(1) + '%'})</span></span>
                                    </div>
                                    <div className="h-2 w-full bg-[#E5E7EB] dark:bg-[#1F2937] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-rose-500 transition-all duration-1000"
                                            style={{ width: `${(etapa.quantidade / maxEtapas) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bottom: Motivos de Perda */}
                <div className="bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <AlertCircle size={24} className="text-rose-500" />
                        <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Motivos de Perda</h3>
                    </div>

                    {lost.motivos.length === 0 ? (
                        <div className="py-8 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">Sem dados de perdas no período.</div>
                    ) : (
                        <div className="space-y-6">
                            {lost.motivos.map((motivo, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-semibold text-[#111827] dark:text-[#F9FAFB]">{motivo.motivo_perda}</span>
                                        <span className="font-bold text-[#6B7280] dark:text-[#9CA3AF]">{motivo.quantidade} <span className="text-xs font-normal">({motivo.percentual === 0 ? '—' : motivo.percentual.toFixed(1) + '%'})</span></span>
                                    </div>
                                    <div className="h-2 w-full bg-[#E5E7EB] dark:bg-[#1F2937] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-orange-500 transition-all duration-1000"
                                            style={{ width: `${(motivo.quantidade / maxMotivos) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
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
