// Configurações de relatórios por fonte de dados (conforme PDFs Pipedrive)

export type DataSource = 'deals' | 'leads' | 'activities' | 'emails' | 'products' | 'campaigns' | 'contacts';
export type ChartType = 'bar' | 'line' | 'pie' | 'funnel' | 'scorecard' | 'table';

export interface Metric {
    id: string;
    name: string;
    field: string;
    aggregation: 'count' | 'sum' | 'avg' | 'rate';
    description: string;
}

export interface Filter {
    id: string;
    name: string;
    type: 'period' | 'select' | 'multiselect' | 'range' | 'user';
    options?: { value: string; label: string }[];
    description: string;
}

export interface VisualizationOption {
    type: ChartType;
    name: string;
    description: string;
}

// NEGÓCIOS - Métricas permitidas
export const DEALS_METRICS: Metric[] = [
    { id: 'count', name: 'Quantidade de negócios', field: 'id', aggregation: 'count', description: 'Total de negócios' },
    { id: 'value_sum', name: 'Valor total', field: 'value', aggregation: 'sum', description: 'Soma do valor de todos os negócios' },
    { id: 'value_avg', name: 'Valor médio', field: 'value', aggregation: 'avg', description: 'Média do valor dos negócios' },
    { id: 'won_count', name: 'Negócios ganhos', field: 'status', aggregation: 'count', description: 'Total de negócios ganhos' },
    { id: 'lost_count', name: 'Negócios perdidos', field: 'status', aggregation: 'count', description: 'Total de negócios perdidos' },
    { id: 'open_count', name: 'Negócios abertos', field: 'status', aggregation: 'count', description: 'Total de negócios em aberto' },
    { id: 'conversion_rate', name: 'Taxa de conversão', field: 'status', aggregation: 'rate', description: 'Percentual de negócios ganhos' },
];

// NEGÓCIOS - Filtros permitidos
export const DEALS_FILTERS: Filter[] = [
    { id: 'period', name: 'Período', type: 'period', description: 'Filtrar por período de criação ou fechamento' },
    { id: 'pipeline', name: 'Pipeline', type: 'select', description: 'Filtrar por pipeline específico' },
    { id: 'stage', name: 'Etapa', type: 'select', description: 'Filtrar por etapa do funil' },
    { id: 'owner', name: 'Proprietário', type: 'user', description: 'Filtrar por responsável' },
    {
        id: 'status', name: 'Status', type: 'select', options: [
            { value: 'won', label: 'Ganho' },
            { value: 'lost', label: 'Perdido' },
            { value: 'open', label: 'Aberto' }
        ], description: 'Filtrar por status do negócio'
    },
    { id: 'value_range', name: 'Valor', type: 'range', description: 'Filtrar por faixa de valor' },
];

// NEGÓCIOS - Visualizações permitidas
export const DEALS_VISUALIZATIONS: VisualizationOption[] = [
    { type: 'bar', name: 'Gráfico de Barras', description: 'Comparar valores entre categorias' },
    { type: 'line', name: 'Gráfico de Linha', description: 'Visualizar tendências ao longo do tempo' },
    { type: 'funnel', name: 'Funil', description: 'Visualizar conversão por etapas' },
    { type: 'scorecard', name: 'Scorecard', description: 'Exibir métrica única em destaque' },
    { type: 'table', name: 'Tabela', description: 'Visualizar dados detalhados' },
];

// LEADS - Métricas permitidas
export const LEADS_METRICS: Metric[] = [
    { id: 'count', name: 'Quantidade de leads', field: 'id', aggregation: 'count', description: 'Total de leads' },
    { id: 'converted_count', name: 'Leads convertidos', field: 'status', aggregation: 'count', description: 'Total de leads convertidos em negócios' },
    { id: 'not_converted_count', name: 'Leads não convertidos', field: 'status', aggregation: 'count', description: 'Total de leads não convertidos' },
    { id: 'conversion_rate', name: 'Taxa de conversão', field: 'status', aggregation: 'rate', description: 'Percentual de leads convertidos' },
];

// LEADS - Filtros permitidos
export const LEADS_FILTERS: Filter[] = [
    { id: 'period', name: 'Período', type: 'period', description: 'Filtrar por período de criação' },
    { id: 'source', name: 'Origem', type: 'select', description: 'Filtrar por origem do lead' },
    { id: 'owner', name: 'Proprietário', type: 'user', description: 'Filtrar por responsável' },
    {
        id: 'status', name: 'Status', type: 'select', options: [
            { value: 'converted', label: 'Convertido' },
            { value: 'not_converted', label: 'Não convertido' }
        ], description: 'Filtrar por status de conversão'
    },
];

// LEADS - Visualizações permitidas
export const LEADS_VISUALIZATIONS: VisualizationOption[] = [
    { type: 'bar', name: 'Gráfico de Barras', description: 'Comparar quantidade entre categorias' },
    { type: 'pie', name: 'Gráfico de Pizza', description: 'Visualizar distribuição por origem' },
    { type: 'funnel', name: 'Funil', description: 'Visualizar conversão de leads' },
    { type: 'scorecard', name: 'Scorecard', description: 'Exibir métrica única em destaque' },
];

// ATIVIDADES - Métricas permitidas
export const ACTIVITIES_METRICS: Metric[] = [
    { id: 'count', name: 'Quantidade de atividades', field: 'id', aggregation: 'count', description: 'Total de atividades' },
    { id: 'completed_count', name: 'Atividades concluídas', field: 'status', aggregation: 'count', description: 'Total de atividades concluídas' },
    { id: 'overdue_count', name: 'Atividades atrasadas', field: 'status', aggregation: 'count', description: 'Total de atividades atrasadas' },
    { id: 'completion_rate', name: 'Taxa de conclusão', field: 'status', aggregation: 'rate', description: 'Percentual de atividades concluídas' },
];

// ATIVIDADES - Filtros permitidos
export const ACTIVITIES_FILTERS: Filter[] = [
    { id: 'period', name: 'Período', type: 'period', description: 'Filtrar por período' },
    {
        id: 'type', name: 'Tipo', type: 'select', options: [
            { value: 'meeting', label: 'Reunião' },
            { value: 'call', label: 'Chamada' },
            { value: 'task', label: 'Tarefa' },
            { value: 'email', label: 'E-mail' }
        ], description: 'Filtrar por tipo de atividade'
    },
    {
        id: 'status', name: 'Status', type: 'select', options: [
            { value: 'completed', label: 'Concluída' },
            { value: 'overdue', label: 'Atrasada' },
            { value: 'upcoming', label: 'Futura' }
        ], description: 'Filtrar por status'
    },
    { id: 'owner', name: 'Proprietário', type: 'user', description: 'Filtrar por responsável' },
];

// ATIVIDADES - Visualizações permitidas
export const ACTIVITIES_VISUALIZATIONS: VisualizationOption[] = [
    { type: 'bar', name: 'Gráfico de Barras', description: 'Comparar quantidade por tipo ou usuário' },
    { type: 'line', name: 'Gráfico de Linha', description: 'Visualizar tendências ao longo do tempo' },
    { type: 'scorecard', name: 'Scorecard', description: 'Exibir métrica única em destaque' },
    { type: 'table', name: 'Tabela', description: 'Visualizar dados detalhados' },
];

// E-MAILS - Métricas permitidas
export const EMAILS_METRICS: Metric[] = [
    { id: 'count', name: 'Quantidade de e-mails', field: 'id', aggregation: 'count', description: 'Total de e-mails' },
    { id: 'open_rate', name: 'Taxa de abertura', field: 'opened', aggregation: 'rate', description: 'Percentual de e-mails abertos' },
    { id: 'click_rate', name: 'Taxa de clique', field: 'clicked', aggregation: 'rate', description: 'Percentual de e-mails com cliques' },
];

// E-MAILS - Filtros permitidos
export const EMAILS_FILTERS: Filter[] = [
    { id: 'period', name: 'Período', type: 'period', description: 'Filtrar por período de envio' },
    { id: 'sender', name: 'Remetente', type: 'user', description: 'Filtrar por remetente' },
    {
        id: 'status', name: 'Status', type: 'select', options: [
            { value: 'sent', label: 'Enviado' },
            { value: 'opened', label: 'Aberto' },
            { value: 'clicked', label: 'Clicado' }
        ], description: 'Filtrar por status do e-mail'
    },
];

// E-MAILS - Visualizações permitidas
export const EMAILS_VISUALIZATIONS: VisualizationOption[] = [
    { type: 'bar', name: 'Gráfico de Barras', description: 'Comparar quantidade' },
    { type: 'scorecard', name: 'Scorecard', description: 'Exibir taxa de abertura' },
    { type: 'table', name: 'Tabela', description: 'Visualizar dados detalhados' },
];

// PRODUTOS - Métricas permitidas
export const PRODUCTS_METRICS: Metric[] = [
    { id: 'count', name: 'Quantidade vendida', field: 'id', aggregation: 'count', description: 'Total de produtos vendidos' },
    { id: 'revenue', name: 'Receita por produto', field: 'value', aggregation: 'sum', description: 'Receita total por produto' },
];

// PRODUTOS - Filtros permitidos
export const PRODUCTS_FILTERS: Filter[] = [
    { id: 'period', name: 'Período', type: 'period', description: 'Filtrar por período' },
    { id: 'category', name: 'Categoria', type: 'select', description: 'Filtrar por categoria' },
    { id: 'price_range', name: 'Preço', type: 'range', description: 'Filtrar por faixa de preço' },
];

// PRODUTOS - Visualizações permitidas
export const PRODUCTS_VISUALIZATIONS: VisualizationOption[] = [
    { type: 'bar', name: 'Gráfico de Barras', description: 'Comparar vendas por produto' },
    { type: 'pie', name: 'Gráfico de Pizza', description: 'Visualizar distribuição de vendas' },
    { type: 'scorecard', name: 'Scorecard', description: 'Exibir métrica única' },
    { type: 'table', name: 'Tabela', description: 'Visualizar dados detalhados' },
];

// CAMPANHAS - Métricas permitidas
export const CAMPAIGNS_METRICS: Metric[] = [
    { id: 'leads_generated', name: 'Leads gerados', field: 'leads', aggregation: 'count', description: 'Total de leads gerados' },
    { id: 'conversion_rate', name: 'Taxa de conversão', field: 'converted', aggregation: 'rate', description: 'Percentual de conversão' },
    { id: 'roi', name: 'ROI', field: 'roi', aggregation: 'avg', description: 'Retorno sobre investimento' },
];

// CAMPANHAS - Filtros permitidos
export const CAMPAIGNS_FILTERS: Filter[] = [
    { id: 'period', name: 'Período', type: 'period', description: 'Filtrar por período' },
    { id: 'type', name: 'Tipo', type: 'select', description: 'Filtrar por tipo de campanha' },
    { id: 'status', name: 'Status', type: 'select', description: 'Filtrar por status' },
];

// CAMPANHAS - Visualizações permitidas
export const CAMPAIGNS_VISUALIZATIONS: VisualizationOption[] = [
    { type: 'bar', name: 'Gráfico de Barras', description: 'Comparar desempenho' },
    { type: 'scorecard', name: 'Scorecard', description: 'Exibir ROI' },
    { type: 'table', name: 'Tabela', description: 'Visualizar dados detalhados' },
];

// CONTATOS - Métricas permitidas
export const CONTACTS_METRICS: Metric[] = [
    { id: 'count', name: 'Quantidade de contatos', field: 'id', aggregation: 'count', description: 'Total de contatos' },
    { id: 'active_count', name: 'Contatos ativos', field: 'active', aggregation: 'count', description: 'Total de contatos ativos' },
];

// CONTATOS - Filtros permitidos
export const CONTACTS_FILTERS: Filter[] = [
    { id: 'period', name: 'Período', type: 'period', description: 'Filtrar por período de criação' },
    { id: 'organization', name: 'Organização', type: 'select', description: 'Filtrar por organização' },
    { id: 'owner', name: 'Proprietário', type: 'user', description: 'Filtrar por responsável' },
];

// CONTATOS - Visualizações permitidas
export const CONTACTS_VISUALIZATIONS: VisualizationOption[] = [
    { type: 'bar', name: 'Gráfico de Barras', description: 'Comparar quantidade' },
    { type: 'scorecard', name: 'Scorecard', description: 'Exibir total' },
    { type: 'table', name: 'Tabela', description: 'Visualizar dados detalhados' },
];

// COMBINAÇÕES PERMITIDAS DE DADOS
export const ALLOWED_COMBINATIONS: Record<DataSource, DataSource[]> = {
    deals: ['activities', 'products'],
    leads: ['campaigns'],
    activities: ['deals'],
    emails: [],
    products: ['deals'],
    campaigns: ['leads'],
    contacts: [],
};

// FUNÇÃO PARA OBTER CONFIGURAÇÕES POR FONTE
export function getConfigForSource(source: DataSource) {
    const configs = {
        deals: {
            metrics: DEALS_METRICS,
            filters: DEALS_FILTERS,
            visualizations: DEALS_VISUALIZATIONS,
        },
        leads: {
            metrics: LEADS_METRICS,
            filters: LEADS_FILTERS,
            visualizations: LEADS_VISUALIZATIONS,
        },
        activities: {
            metrics: ACTIVITIES_METRICS,
            filters: ACTIVITIES_FILTERS,
            visualizations: ACTIVITIES_VISUALIZATIONS,
        },
        emails: {
            metrics: EMAILS_METRICS,
            filters: EMAILS_FILTERS,
            visualizations: EMAILS_VISUALIZATIONS,
        },
        products: {
            metrics: PRODUCTS_METRICS,
            filters: PRODUCTS_FILTERS,
            visualizations: PRODUCTS_VISUALIZATIONS,
        },
        campaigns: {
            metrics: CAMPAIGNS_METRICS,
            filters: CAMPAIGNS_FILTERS,
            visualizations: CAMPAIGNS_VISUALIZATIONS,
        },
        contacts: {
            metrics: CONTACTS_METRICS,
            filters: CONTACTS_FILTERS,
            visualizations: CONTACTS_VISUALIZATIONS,
        },
    };

    return configs[source];
}

// FUNÇÃO PARA VALIDAR SE COMBINAÇÃO É PERMITIDA
export function isAllowedCombination(source1: DataSource, source2: DataSource): boolean {
    return ALLOWED_COMBINATIONS[source1]?.includes(source2) || false;
}
