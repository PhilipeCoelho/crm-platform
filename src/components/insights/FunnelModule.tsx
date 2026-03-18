import { useInsights } from '@/contexts/InsightsContext';
import { Target, AlertCircle, BarChart2 } from 'lucide-react';
import QuickGuide from '../ui/QuickGuide';

interface Props {
    activeGuide: string | null;
    setActiveGuide: (name: string | null) => void;
}

export default function FunnelModule({ activeGuide, setActiveGuide }: Props) {
    const { data, loading } = useInsights();

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) return null;

    const { current, goals } = data;

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
            {/* 2. Visualização do Funil */}
            <div className="bg-[#FFFFFF] dark:bg-[#141414] rounded-xl border border-[#E5E7EB] dark:border-[#262626] p-8 w-full">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <div>
                            <div className="flex items-center">
                                <h3 className="text-xl font-bold text-[#111827] dark:text-[#EAEAEA] tracking-tight">Conversão do Funil</h3>
                                <QuickGuide
                                    moduleName="insights_funil"
                                    activeGuide={activeGuide}
                                    setActiveGuide={setActiveGuide}
                                />
                            </div>
                            <p className="text-sm text-[#6B7280] dark:text-[#8A8A8A] mt-1">Visão do fluxo de negócios por etapa principal</p>
                        </div>
                    </div>
                    <div className="p-2 rounded-xl bg-primary/10">
                        <BarChart2 size={24} className="text-primary" />
                    </div>
                </div>

                <div className="space-y-4 relative max-w-4xl mx-auto">
                    <FunnelStep
                        label="Prospect"
                        count={current.funnel.prospectCount}
                        percent={100}
                    />
                    <FunnelDivider percent={current.funnel.prospectToLead} />
                    <FunnelStep
                        label="Leads"
                        count={current.funnel.leadCount}
                        percent={current.funnel.prospectToLead}
                    />
                    <FunnelDivider percent={current.funnel.leadToLeadEngajado} />
                    <FunnelStep
                        label="Leads (Engajados)"
                        count={current.funnel.leadEngajadoCount}
                        percent={current.funnel.leadToLeadEngajado}
                    />
                    <FunnelDivider percent={current.funnel.leadEngajadoToReuniao} />
                    <FunnelStep
                        label="Reuniões Realizadas"
                        count={current.funnel.reuniaoCount}
                        percent={current.funnel.leadEngajadoToReuniao}
                    />
                    <FunnelDivider percent={current.funnel.reuniaoToProposta} />
                    <FunnelStep
                        label="Proposta Enviada"
                        count={current.funnel.propostaCount}
                        percent={current.funnel.reuniaoToProposta}
                    />
                    <FunnelDivider percent={current.funnel.propostaToGanho} />
                    <FunnelStep
                        label="Fechamentos (Won)"
                        count={current.funnel.fechamentoCount}
                        percent={current.funnel.propostaToGanho}
                        isLast
                    />
                </div>
            </div>

            {/* 3. Metas vs Realizado */}
            <div className="bg-[#FFFFFF] dark:bg-[#141414] rounded-xl border border-[#E5E7EB] dark:border-[#262626] p-8 w-full">
                <div className="flex items-center gap-3 mb-8">
                    <Target size={24} className="text-primary" />
                    <h3 className="text-lg font-bold text-[#111827] dark:text-[#EAEAEA] tracking-tight">Metas vs Realizado</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {goals.length === 0 ? (
                        <div className="col-span-full text-center py-10 opacity-50">
                            <AlertCircle size={32} className="mx-auto mb-2" />
                            <p className="text-xs">Nenhuma meta definida</p>
                        </div>
                    ) : goals.map(goal => (
                        <GoalItem key={goal.metric} goal={goal} />
                    ))}
                </div>
            </div>

            <div className="bg-[#F7F9FC] dark:bg-[#1F2937]/50 rounded-xl p-6 border border-[#E5E7EB] dark:border-[#262626] w-full">
                <h4 className="text-xs font-bold text-[#111827] dark:text-[#EAEAEA] uppercase tracking-widest mb-2">Dica Estratégica</h4>
                <p className="text-sm text-[#6B7280] dark:text-[#8A8A8A] leading-relaxed">
                    {current.funnel.leadEngajadoToReuniao < 20
                        ? "Sua taxa de conversão de Lead Engajado para Reunião está abaixo da média. Foque em melhorar o pitch inicial ou a velocidade de agendamento."
                        : "Excelente conversão em reuniões! Continue mantendo esse padrão de qualificação."}
                </p>
            </div>
        </div>
    );
}

// Removed KPICard function

function FunnelStep({ label, count, percent, isLast }: any) {
    return (
        <div className="relative">
            <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-semibold text-[#6B7280] dark:text-[#8A8A8A] uppercase tracking-wider">{label}</span>
                <span className="font-bold text-[#111827] dark:text-[#EAEAEA]">{count} Negócios</span>
            </div>
            <div className="h-4 w-full bg-[#E5E7EB] dark:bg-[#1F2937] rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-1000 ease-out rounded-full ${isLast ? 'bg-primary' : 'bg-primary/60'}`}
                    style={{ width: `${Math.max(2, percent)}%` }}
                />
            </div>
        </div>
    );
}

function FunnelDivider({ percent }: any) {
    return (
        <div className="flex justify-center -my-3 relative z-10">
            <div className="flex flex-col items-center justify-center bg-[#FFFFFF] dark:bg-[#141414] px-4 py-1 border border-[#E5E7EB] dark:border-[#262626] rounded-full">
                <span className="text-xs font-bold text-primary">{percent === 0 ? '—' : percent.toFixed(1) + '%'}</span>
            </div>
        </div>
    );
}

function GoalItem({ goal }: any) {
    const label = goal.metric === 'reunioes' ? 'Reuniões'
        : goal.metric === 'fechamentos' ? 'Fechamentos'
            : 'Taxa de Fechamento';

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground capitalize">{label}</span>
                    <span className="text-[10px] text-muted-foreground">{goal.actual} de {goal.target} {goal.metric === 'taxa_fechamento' ? '%' : ''}</span>
                </div>
                <span className={`text-xs font-black ${goal.percent >= 100 ? 'text-emerald-500' : 'text-primary'}`}>
                    {goal.percent.toFixed(0)}%
                </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/30">
                <div
                    className={`h-full transition-all duration-1000 ${goal.percent >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, goal.percent)}%` }}
                />
            </div>
        </div>
    );
}
