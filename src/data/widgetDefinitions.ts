import { InsightsData } from '@/services/insights';
import { Percent, Users, Clock, CalendarHeart, Zap, BarChart, DollarSign, Target, BarChart3, CheckCircle2, XCircle, TrendingUp, CheckSquare, PlusSquare, ArrowUpRight, AlertCircle, Activity, MessageSquare } from 'lucide-react';
import { Currency } from '@/data/currencies';

export type WidgetKey =
    | 'receita'
    | 'pipeline'
    | 'negocios_criados'
    | 'ganhos'
    | 'perdidos'
    | 'conversao'
    | 'taxa_perda'
    | 'media_contatos'
    | 'tempo_medio_ciclo'
    | 'taxa_reuniao'
    | 'percentual_7_contatos'
    | 'canal_mais_ganho'
    | 'atividades_concluidas'
    | 'atividades_criadas'
    | 'taxa_execucao'
    | 'media_execucao'
    | 'negocios_sem_atividade'
    | 'taxa_comparecimento'
    | 'reuniao_para_proposta'
    | 'proposta_para_ganho'
    | 'media_followups'
    | 'abordagens'
    | 'taxa_resposta'
    | 'conversao_abordagem'
    | 'esforco_venda'
    | 'motivo_perda';

export type WidgetCategory = 'revenue' | 'conversion' | 'intensity' | 'velocity' | 'loss' | 'channel' | 'execution' | 'outreach';

export interface WidgetDefinition {
    key: WidgetKey;
    title: string;
    description: string;
    icon: any;
    color: string;
    redirectLink: string;
    widget_available?: boolean;
    metric_category: WidgetCategory;
    getValue: (data: InsightsData | null, currency?: Currency) => { value: string | number, microDescription: string, variation?: number | null };
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
    {
        key: 'receita',
        title: 'Receita',
        description: 'Total em dinheiro de negócios fechados como "Ganho" no período.',
        icon: DollarSign,
        color: 'bg-emerald-500/10 text-emerald-500',
        redirectLink: '/insights',
        widget_available: true,
        metric_category: 'revenue',
        getValue: (data, currency) => {
            const val = data?.current?.dashboardFlow?.receita || 0;
            return {
                value: currency ? new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(val) : val,
                microDescription: 'Receita gerada',
                variation: data?.variation?.wonValue
            };
        }
    },
    {
        key: 'pipeline',
        title: 'Pipeline',
        description: 'Soma do valor de todos os negócios que estão atualmente em aberto nas etapas.',
        icon: Target,
        color: 'bg-primary/10 text-primary',
        redirectLink: '/insights',
        widget_available: true,
        metric_category: 'revenue',
        getValue: (data, currency) => {
            const val = data?.current?.dashboardFlow?.pipelineValue || 0;
            return {
                value: currency ? new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(val) : val,
                microDescription: 'Valor total atualmente em aberto',
                variation: data?.variation?.openValue
            };
        }
    },
    {
        key: 'negocios_criados',
        title: 'Criados',
        description: 'Quantidade total de novos negócios que entraram no funil no período.',
        icon: BarChart3,
        color: 'bg-blue-500/10 text-blue-500',
        redirectLink: '/insights',
        widget_available: true,
        metric_category: 'conversion',
        getValue: (data) => ({
            value: data?.current?.totalDeals || 0,
            microDescription: 'Negócios criados',
            variation: data?.variation?.totalDeals
        })
    },
    {
        key: 'ganhos',
        title: 'Ganhos',
        description: 'Número de negócios que foram movidos para o status de "Ganho" no período.',
        icon: CheckCircle2,
        color: 'bg-emerald-500/10 text-emerald-500',
        redirectLink: '/insights',
        widget_available: true,
        metric_category: 'conversion',
        getValue: (data) => ({
            value: data?.current?.dashboardFlow?.ganhos || 0,
            microDescription: 'Negócios fechados como ganho',
            variation: data?.variation?.totalWon
        })
    },
    {
        key: 'perdidos',
        title: 'Perdidos',
        description: 'Número de negócios que foram movidos para o status de "Perdido" no período.',
        icon: XCircle,
        color: 'bg-red-500/10 text-red-500',
        redirectLink: '/insights',
        widget_available: true,
        metric_category: 'loss',
        getValue: (data) => ({
            value: data?.current?.dashboardFlow?.perdidos || 0,
            microDescription: 'Negócios encerrados',
            variation: data?.variation?.totalLost
        })
    },
    {
        key: 'conversao',
        title: 'Conversão',
        description: 'Percentual de negócios ganhos em relação ao total de negócios encerrados.',
        icon: TrendingUp,
        color: 'bg-purple-500/10 text-purple-500',
        redirectLink: '/insights?tab=funil',
        widget_available: true,
        metric_category: 'conversion',
        getValue: (data) => ({
            value: `${data?.current?.dashboardFlow?.conversao?.toFixed(1) || 0}%`,
            microDescription: 'Taxa de fechamento',
            variation: data?.variation?.taxaFechamento
        })
    },
    {
        key: 'taxa_perda',
        title: 'Taxa de Perda',
        description: 'Percentual de negócios perdidos em relação ao total de negócios encerrados.',
        icon: Percent,
        color: 'bg-red-500/10 text-red-500',
        redirectLink: '/insights?tab=perdas',
        widget_available: true,
        metric_category: 'loss',
        getValue: (data) => ({
            value: data ? `${data.current.lost.taxaPerda.toFixed(1)}%` : '—',
            microDescription: 'Negócios perdidos no funil',
            variation: data?.variation?.lost_taxaPerda
        })
    },
    {
        key: 'media_contatos',
        title: 'Média de Contatos',
        description: 'Quantidade média de interações (chamadas, e-mails, etc) por negócio.',
        icon: Users,
        color: 'bg-blue-500/10 text-blue-500',
        redirectLink: '/insights?tab=intensidade',
        widget_available: true,
        metric_category: 'intensity',
        getValue: (data) => ({
            value: data ? data.current.intensity.mediaContatosPorNegocio.toFixed(1) : '—',
            microDescription: 'Por negócio criado',
            variation: data?.variation?.mediaContatosPorNegocio
        })
    },
    {
        key: 'tempo_medio_ciclo',
        title: 'Tempo de Ciclo',
        description: 'Média de dias que um negócio leva desde a criação até o fechamento como ganho.',
        icon: Clock,
        color: 'bg-amber-500/10 text-amber-500',
        redirectLink: '/insights?tab=timing',
        widget_available: true,
        metric_category: 'velocity',
        getValue: (data) => ({
            value: data ? `${data.current.timing.tempoMedioCiclo.toFixed(0)} dias` : '—',
            microDescription: 'Até o fechamento (ganho)',
            variation: data?.variation?.tempoMedioCiclo
        })
    },
    {
        key: 'taxa_reuniao',
        title: 'Taxa de Reunião',
        description: 'Percentual de negócios que avançaram até a etapa de reunião de diagnóstico.',
        icon: CalendarHeart,
        color: 'bg-purple-500/10 text-purple-500',
        redirectLink: '/insights?tab=funil',
        widget_available: true,
        metric_category: 'conversion',
        getValue: (data) => {
            if (!data) return { value: '—', microDescription: 'Conversão para reunião', variation: null };
            const deals = data.current.funnel.totalDeals;
            const reus = data.current.funnel.reuniaoCount;
            const pct = deals > 0 ? (reus / deals) * 100 : 0;
            return {
                value: `${pct.toFixed(1)}%`,
                microDescription: 'Conversão primária',
                variation: data?.variation?.reuniaoCount // Rough approximation
            };
        }
    },
    {
        key: 'percentual_7_contatos',
        title: 'Alta Intensidade',
        description: 'Negócios que receberam 7 ou mais atividades de acompanhamento/contato.',
        icon: Zap,
        color: 'bg-orange-500/10 text-orange-500',
        redirectLink: '/insights?tab=intensidade',
        widget_available: true,
        metric_category: 'intensity',
        getValue: (data) => ({
            value: data ? `${data.current.intensity.percent7OuMais.toFixed(1)}%` : '—',
            microDescription: 'Atingiram 7+ contatos'
        })
    },
    {
        key: 'canal_mais_ganho',
        title: 'Melhor Canal',
        description: 'Identifica qual meio de comunicação trouxe a maior taxa de conversão em vendas.',
        icon: BarChart,
        color: 'bg-emerald-500/10 text-emerald-500',
        redirectLink: '/insights?tab=canais',
        widget_available: true,
        metric_category: 'channel',
        getValue: (data) => {
            if (!data) return { value: '—', microDescription: 'Canal com maior conversão' };
            const { taxaFechamentoMessage, taxaFechamentoEmail, taxaFechamentoCall } = data.current.channel;
            const max = Math.max(taxaFechamentoMessage, taxaFechamentoEmail, taxaFechamentoCall);

            let canalStr = '—';
            if (max > 0) {
                if (max === taxaFechamentoMessage) canalStr = 'Mensagem';
                else if (max === taxaFechamentoEmail) canalStr = 'Email';
                else if (max === taxaFechamentoCall) canalStr = 'Ligação';
            }
            return {
                value: canalStr,
                microDescription: max > 0 ? `${max.toFixed(1)}% de ganho` : 'Sem dados suficientes'
            };
        }
    },
    {
        key: 'atividades_concluidas',
        title: 'Atividades concluídas',
        description: 'Total de tarefas, reuniões e chamadas marcadas como feitas pela equipe.',
        icon: CheckSquare,
        color: 'bg-emerald-500/10 text-emerald-500',
        redirectLink: '/activities?filter=Últimos%207%20dias',
        widget_available: true,
        metric_category: 'execution',
        getValue: (data) => ({
            value: data?.current?.dashboardFlow?.atividadesConcluidas || 0,
            microDescription: 'Atividades concluídas'
        })
    },
    {
        key: 'atividades_criadas',
        title: 'Atividades criadas',
        description: 'Total de novas atividades que foram agendadas para os negócios no período.',
        icon: PlusSquare,
        color: 'bg-blue-500/10 text-blue-500',
        redirectLink: '/activities?filter=Últimos%207%20dias',
        widget_available: true,
        metric_category: 'execution',
        getValue: (data) => ({
            value: data?.current?.dashboardFlow?.atividadesCriadas || 0,
            microDescription: 'Atividades criadas'
        })
    },
    {
        key: 'taxa_execucao',
        title: 'Taxa de Execução',
        description: 'Percentual de atividades concluídas em relação ao total agendado para o período.',
        icon: Activity,
        color: 'bg-purple-500/10 text-purple-500',
        redirectLink: '/activities?filter=Últimos%207%20dias',
        widget_available: true,
        metric_category: 'execution',
        getValue: (data) => ({
            value: `${data?.current?.dashboardFlow?.taxaExecucao?.toFixed(1) || 0}%`,
            microDescription: 'Percentual de atividades concluídas'
        })
    },
    {
        key: 'media_execucao',
        title: 'Média de Execução',
        description: 'Frequência média de atividades realizadas para cada negócio em aberto.',
        icon: ArrowUpRight,
        color: 'bg-indigo-500/10 text-indigo-500',
        redirectLink: '/activities?filter=Últimos%207%20dias',
        widget_available: true,
        metric_category: 'execution',
        getValue: (data) => ({
            value: data?.current?.dashboardFlow?.mediaExecucao?.toFixed(1) || 0,
            microDescription: 'Média de atividades por negócio criado'
        })
    },
    {
        key: 'negocios_sem_atividade',
        title: 'Sem Atividade',
        description: 'Quantidade de negócios ativos que não possuem nenhuma atividade agendada ou realizada.',
        icon: AlertCircle,
        color: 'bg-orange-500/10 text-orange-500',
        redirectLink: '/pipeline',
        widget_available: true,
        metric_category: 'execution',
        getValue: (data) => ({
            value: data?.current?.dashboardFlow?.negociosSemAtividade || 0,
            microDescription: 'Negócios abertos sem atividade'
        })
    },
    {
        key: 'taxa_comparecimento',
        title: 'Taxa de Comparecimento',
        description: 'Percentual de reuniões agendadas que foram efetivamente concluídas.',
        icon: Users,
        color: 'bg-emerald-500/10 text-emerald-500',
        redirectLink: '/insights?tab=funil',
        widget_available: true,
        metric_category: 'conversion',
        getValue: (data) => ({
            value: `${data?.current?.activity?.taxaComparecimento?.toFixed(1) || 0}%`,
            microDescription: 'Comparecimento em Reuniões'
        })
    },
    {
        key: 'reuniao_para_proposta',
        title: 'Reunião → Proposta',
        description: 'Percentual de reuniões que resultaram no envio de uma proposta.',
        icon: ArrowUpRight,
        color: 'bg-blue-500/10 text-blue-500',
        redirectLink: '/insights?tab=funil',
        widget_available: true,
        metric_category: 'conversion',
        getValue: (data) => ({
            value: `${data?.current?.funnel?.reuniaoToProposta?.toFixed(1) || 0}%`,
            microDescription: 'Eficiência de qualificação'
        })
    },
    {
        key: 'proposta_para_ganho',
        title: 'Proposta → Ganho',
        description: 'Percentual de propostas enviadas que foram fechadas como ganho.',
        icon: Target,
        color: 'bg-emerald-500/10 text-emerald-500',
        redirectLink: '/insights?tab=funil',
        widget_available: true,
        metric_category: 'revenue',
        getValue: (data) => ({
            value: `${data?.current?.funnel?.propostaToGanho?.toFixed(1) || 0}%`,
            microDescription: 'Taxa de fechamento de proposta'
        })
    },
    {
        key: 'media_followups',
        title: 'Follow-ups até Ganho',
        description: 'Média de atividades de acompanhamento realizadas após a reunião até o fechamento.',
        icon: Activity,
        color: 'bg-indigo-500/10 text-indigo-500',
        redirectLink: '/insights?tab=intensidade',
        widget_available: true,
        metric_category: 'intensity',
        getValue: (data) => ({
            value: data?.current?.activity?.mediaFollowUpsAteFechamento?.toFixed(1) || 0,
            microDescription: 'Toques pós-reunião'
        })
    },
    {
        key: 'abordagens',
        title: 'Abordagens',
        description: 'Quantidade de negócios únicos que receberam pelo menos 1 contato (ligação, e-mail, mensagem ou Instagram) no período.',
        icon: MessageSquare,
        color: 'bg-cyan-500/10 text-cyan-500',
        redirectLink: '/insights?tab=intensidade',
        widget_available: true,
        metric_category: 'outreach',
        getValue: (data) => {
            if (!data) return { value: '—', microDescription: 'Negócios abordados', variation: null };
            const total = data.current.abordagem.total;
            const resp = data.current.abordagem.respondidos;
            return {
                value: total,
                microDescription: `${resp} responderam (${total > 0 ? ((resp / total) * 100).toFixed(0) : 0}%)`,
                variation: data.variation?.abordagem_total
            };
        }
    },
    {
        key: 'taxa_resposta',
        title: 'Taxa de Resposta',
        description: 'Percentual de negócios abordados que avançaram para Lead Engajado ou além, indicando resposta real do lead.',
        icon: TrendingUp,
        color: 'bg-cyan-500/10 text-cyan-500',
        redirectLink: '/insights?tab=intensidade',
        widget_available: true,
        metric_category: 'outreach',
        getValue: (data) => ({
            value: data ? `${data.current.abordagem.taxaResposta.toFixed(1)}%` : '—',
            microDescription: 'Leads que responderam à abordagem',
            variation: data?.variation?.abordagem_taxaResposta
        })
    },
    {
        key: 'conversao_abordagem',
        title: 'Conv. Abordagem',
        description: 'Percentual de ganhos (won) em relação ao total de negócios abordados no período.',
        icon: TrendingUp,
        color: 'bg-emerald-500/10 text-emerald-500',
        redirectLink: '/insights',
        widget_available: true,
        metric_category: 'outreach',
        getValue: (data) => {
            if (!data || data.current.abordagem.total === 0) return { value: '—', microDescription: 'Ganhos / Abordados' };
            const pct = (data.current.totalWon / data.current.abordagem.total) * 100;
            return {
                value: `${pct.toFixed(1)}%`,
                microDescription: 'Eficiência de prospecção'
            };
        }
    },
    {
        key: 'esforco_venda',
        title: 'Esforço p/ Venda',
        description: 'Quantidade média de atividades realizadas nos negócios ganhos até o fechamento.',
        icon: Activity,
        color: 'bg-indigo-500/10 text-indigo-500',
        redirectLink: '/insights?tab=intensidade',
        widget_available: true,
        metric_category: 'intensity',
        getValue: (data) => ({
            value: data?.current?.activity?.mediaContatosAteFechamento?.toFixed(1) || '—',
            microDescription: 'Atividades para fechar 1 negócio'
        })
    },
    {
        key: 'motivo_perda',
        title: 'Principal Perda',
        description: 'Identifica o motivo mais frequente para a perda de negócios no período.',
        icon: AlertCircle,
        color: 'bg-orange-500/10 text-orange-500',
        redirectLink: '/insights?tab=perdas',
        widget_available: true,
        metric_category: 'loss',
        getValue: (data) => {
            if (!data || data.current.lost.motivos.length === 0) return { value: '—', microDescription: 'Sem motivos registrados' };
            const top = data.current.lost.motivos[0];
            return {
                value: top.motivo_perda,
                microDescription: `${top.quantidade} perdas (${top.percentual.toFixed(1)}%)`
            };
        }
    }
];
