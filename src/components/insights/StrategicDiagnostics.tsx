import { useInsights } from '@/contexts/InsightsContext';
import { generateStrategicRecommendations, StrategicRecommendation } from '@/services/recommendations';
import {
    BrainCircuit,
    Lightbulb
} from 'lucide-react';

export default function StrategicDiagnostics() {
    const { data, loading } = useInsights();

    if (loading || !data) return null;

    const recommendations = generateStrategicRecommendations(data);

    if (recommendations.length === 0) {
        return (
            <div className="w-full bg-[#FFFFFF] dark:bg-[#111827] py-12 px-6 border-b border-[#E5E7EB] dark:border-[#1F2937]">
                <div className="max-w-[1200px] mx-auto flex flex-col items-center justify-center text-center">
                    <BrainCircuit className="w-8 h-8 text-[#6B7280] dark:text-[#9CA3AF] opacity-50 mb-4" />
                    <h3 className="text-lg font-semibold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Diagnóstico Estratégico</h3>
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-2 max-w-md">
                        Performance alinhada aos padrões. Nenhuma anomalia crítica ou gargalo estrutural detectado no período.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-[#FFFFFF] dark:bg-[#111827] py-10 px-6 border-b border-[#E5E7EB] dark:border-[#1F2937]">
            <div className="max-w-[1200px] mx-auto">
                {/* Header do Diagnóstico */}
                <div className="flex items-center gap-3 mb-8 shrink-0">
                    <BrainCircuit className="w-6 h-6 text-primary" />
                    <div>
                        <h2 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Diagnóstico Estratégico</h2>
                        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-widest font-semibold mt-1">Visão Prioritária</p>
                    </div>
                </div>

                {/* List of Recommendations */}
                <div className="flex flex-col gap-6">
                    {recommendations.map((rec) => (
                        <RecommendationCard key={rec.prioridade} rec={rec} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function RecommendationCard({ rec }: { rec: StrategicRecommendation }) {

    // As cores de impacto agora definem apenas o badge e a borda esquerda
    const getImpactStyle = (impacto: string) => {
        switch (impacto) {
            case 'alto': return {
                border: 'border-l-rose-500',
                badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400'
            };
            case 'medio': return {
                border: 'border-l-amber-500',
                badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
            };
            case 'baixo': return {
                border: 'border-l-blue-500',
                badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400'
            };
            default: return {
                border: 'border-l-gray-500',
                badge: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
            };
        }
    };

    const impactStyle = getImpactStyle(rec.impacto);

    return (
        <div className={`p-6 bg-[#FFFFFF] dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] border-l-4 ${impactStyle.border} shadow-sm rounded-lg flex flex-col gap-4`}>

            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md ${impactStyle.badge}`}>
                            {rec.impacto}
                        </span>
                        <h4 className="font-semibold text-[#111827] dark:text-[#F9FAFB] text-lg leading-tight">
                            {rec.titulo}
                        </h4>
                    </div>
                    <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm leading-relaxed max-w-4xl">
                        {rec.mensagem}
                    </p>
                </div>

                <span className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-[#F7F9FC] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]">
                    {rec.area}
                </span>
            </div>

            <div className="bg-[#F7F9FC] dark:bg-[#1F2937]/50 rounded-md p-4 flex items-start gap-3 mt-2 border border-[#E5E7EB] dark:border-transparent">
                <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB] leading-relaxed">
                    <strong>Recomendação:</strong> {rec.recomendacao}
                </span>
            </div>

        </div>
    );
}
