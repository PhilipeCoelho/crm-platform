import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { X, TrendingUp, Users, Activity, Mail, Package } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type DataSource = 'deals' | 'leads' | 'activities' | 'contacts' | 'emails' | 'products';
type ChartType = 'bar' | 'line' | 'pie' | 'table' | 'scorecard';
type TimeRange = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear' | 'custom';
type GroupBy = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'user' | 'stage' | 'pipeline' | 'status' | 'type';

interface Metric {
    id: string;
    name: string;
    field: string;
    aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

interface Filter {
    id: string;
    field: string;
    operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';
    value: any;
}

export interface ReportConfig {
    name: string;
    dataSource: DataSource;
    metrics: Metric[];
    filters: Filter[];
    groupBy: GroupBy;
    timeRange: TimeRange;
    chartType: ChartType;
    customDateRange?: { start: string; end: string };
}

const DATA_SOURCES = [
    { id: 'deals', name: 'Negócios', icon: <TrendingUp size={20} /> },
    { id: 'leads', name: 'Leads', icon: <Users size={20} /> },
    { id: 'activities', name: 'Atividades', icon: <Activity size={20} /> },
    { id: 'contacts', name: 'Contatos', icon: <Users size={20} /> },
    { id: 'emails', name: 'E-mails', icon: <Mail size={20} /> },
    { id: 'products', name: 'Produtos', icon: <Package size={20} /> },
];

const METRICS_BY_SOURCE: Record<DataSource, Metric[]> = {
    deals: [
        { id: 'count', name: 'Quantidade de negócios', field: 'id', aggregation: 'count' },
        { id: 'value_sum', name: 'Valor total', field: 'value', aggregation: 'sum' },
        { id: 'value_avg', name: 'Valor médio', field: 'value', aggregation: 'avg' },
        { id: 'won_count', name: 'Negócios ganhos', field: 'status', aggregation: 'count' },
        { id: 'lost_count', name: 'Negócios perdidos', field: 'status', aggregation: 'count' },
    ],
    leads: [
        { id: 'count', name: 'Quantidade de leads', field: 'id', aggregation: 'count' },
        { id: 'converted', name: 'Leads convertidos', field: 'converted', aggregation: 'count' },
    ],
    activities: [
        { id: 'count', name: 'Quantidade de atividades', field: 'id', aggregation: 'count' },
        { id: 'completed', name: 'Atividades concluídas', field: 'completed', aggregation: 'count' },
        { id: 'pending', name: 'Atividades pendentes', field: 'completed', aggregation: 'count' },
    ],
    contacts: [
        { id: 'count', name: 'Quantidade de contatos', field: 'id', aggregation: 'count' },
    ],
    emails: [
        { id: 'count', name: 'E-mails enviados', field: 'id', aggregation: 'count' },
    ],
    products: [
        { id: 'count', name: 'Quantidade vendida', field: 'id', aggregation: 'count' },
        { id: 'revenue', name: 'Receita por produto', field: 'price', aggregation: 'sum' },
    ],
};

const TIME_RANGES = [
    { id: 'today', name: 'Hoje' },
    { id: 'yesterday', name: 'Ontem' },
    { id: 'last7days', name: 'Últimos 7 dias' },
    { id: 'last30days', name: 'Últimos 30 dias' },
    { id: 'last90days', name: 'Últimos 90 dias' },
    { id: 'thisMonth', name: 'Este mês' },
    { id: 'lastMonth', name: 'Mês passado' },
    { id: 'thisQuarter', name: 'Este trimestre' },
    { id: 'lastQuarter', name: 'Trimestre passado' },
    { id: 'thisYear', name: 'Este ano' },
    { id: 'lastYear', name: 'Ano passado' },
    { id: 'custom', name: 'Período personalizado' },
];

const GROUP_BY_OPTIONS: Record<DataSource, { id: GroupBy; name: string }[]> = {
    deals: [
        { id: 'day', name: 'Por dia' },
        { id: 'week', name: 'Por semana' },
        { id: 'month', name: 'Por mês' },
        { id: 'quarter', name: 'Por trimestre' },
        { id: 'user', name: 'Por usuário' },
        { id: 'stage', name: 'Por etapa' },
        { id: 'pipeline', name: 'Por pipeline' },
        { id: 'status', name: 'Por status' },
    ],
    leads: [
        { id: 'day', name: 'Por dia' },
        { id: 'week', name: 'Por semana' },
        { id: 'month', name: 'Por mês' },
        { id: 'user', name: 'Por usuário' },
        { id: 'status', name: 'Por status' },
    ],
    activities: [
        { id: 'day', name: 'Por dia' },
        { id: 'week', name: 'Por semana' },
        { id: 'month', name: 'Por mês' },
        { id: 'type', name: 'Por tipo' },
        { id: 'user', name: 'Por usuário' },
    ],
    contacts: [
        { id: 'month', name: 'Por mês' },
        { id: 'status', name: 'Por status' },
    ],
    emails: [
        { id: 'day', name: 'Por dia' },
        { id: 'week', name: 'Por semana' },
        { id: 'month', name: 'Por mês' },
    ],
    products: [
        { id: 'month', name: 'Por mês' },
    ],
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

interface ReportBuilderProps {
    onSave: (config: ReportConfig) => void;
    onCancel: () => void;
    initialConfig?: Partial<ReportConfig>;
}

export default function ReportBuilder({ onSave, onCancel, initialConfig }: ReportBuilderProps) {
    const { deals, contacts, activities, users } = useCRM();

    const [config, setConfig] = useState<ReportConfig>({
        name: initialConfig?.name || '',
        dataSource: initialConfig?.dataSource || 'deals',
        metrics: initialConfig?.metrics || [],
        filters: initialConfig?.filters || [],
        groupBy: initialConfig?.groupBy || 'month',
        timeRange: initialConfig?.timeRange || 'last30days',
        chartType: initialConfig?.chartType || 'bar',
        customDateRange: initialConfig?.customDateRange,
    });

    const [step, setStep] = useState<'source' | 'metrics' | 'filters' | 'visualization'>('source');

    // Calculate report data based on configuration
    const reportData = useMemo(() => {
        if (config.metrics.length === 0) return [];

        // Filter data by time range
        const getDateRange = () => {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const last30 = new Date(today);
            last30.setDate(last30.getDate() - 30);

            switch (config.timeRange) {
                case 'today':
                    return { start: today, end: now };
                case 'yesterday':
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    return { start: yesterday, end: today };
                case 'last7days':
                    const last7 = new Date(today);
                    last7.setDate(last7.getDate() - 7);
                    return { start: last7, end: now };
                case 'last30days':
                    return { start: last30, end: now };
                case 'last90days':
                    const last90 = new Date(today);
                    last90.setDate(last90.getDate() - 90);
                    return { start: last90, end: now };
                case 'thisMonth':
                    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
                case 'lastMonth':
                    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                    return { start: lastMonthStart, end: lastMonthEnd };
                case 'thisYear':
                    return { start: new Date(now.getFullYear(), 0, 1), end: now };
                case 'custom':
                    if (config.customDateRange) {
                        return {
                            start: new Date(config.customDateRange.start),
                            end: new Date(config.customDateRange.end)
                        };
                    }
                    return { start: last30, end: now };
                default:
                    return { start: today, end: now };
            }
        };

        const dateRange = getDateRange();

        // Process data based on data source
        let sourceData: any[] = [];

        switch (config.dataSource) {
            case 'deals':
                sourceData = deals.filter(d => {
                    const createdDate = new Date(d.createdAt);
                    return createdDate >= dateRange.start && createdDate <= dateRange.end;
                });
                break;
            case 'contacts':
                sourceData = contacts.filter(c => {
                    const createdDate = new Date(c.createdAt);
                    return createdDate >= dateRange.start && createdDate <= dateRange.end;
                });
                break;
            case 'activities':
                sourceData = activities.filter(a => {
                    const dueDate = a.dueDate ? new Date(a.dueDate) : null;
                    if (!dueDate) return false;
                    return dueDate >= dateRange.start && dueDate <= dateRange.end;
                });
                break;
        }

        // Group data
        const grouped: Record<string, any> = {};

        sourceData.forEach(item => {
            let groupKey = '';

            switch (config.groupBy) {
                case 'user':
                    const user = users.find(u => u.id === (item.ownerId || item.userId));
                    groupKey = user?.name || 'Sem proprietário';
                    break;
                case 'status':
                    groupKey = item.status || 'Sem status';
                    break;
                case 'stage':
                    groupKey = item.stageId || 'Sem etapa';
                    break;
                case 'type':
                    groupKey = item.type || 'Sem tipo';
                    break;
                case 'month':
                    const date = new Date(item.createdAt || item.dueDate || new Date());
                    groupKey = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                    break;
                case 'day':
                    const dayDate = new Date(item.createdAt || item.dueDate || new Date());
                    groupKey = dayDate.toLocaleDateString('pt-BR');
                    break;
                default:
                    groupKey = 'Total';
            }

            if (!grouped[groupKey]) {
                grouped[groupKey] = { name: groupKey, items: [] };
            }
            grouped[groupKey].items.push(item);
        });

        // Calculate metrics
        return Object.values(grouped).map((group: any) => {
            const result: any = { name: group.name };

            config.metrics.forEach(metric => {
                switch (metric.aggregation) {
                    case 'count':
                        if (metric.id === 'won_count') {
                            result[metric.name] = group.items.filter((i: any) => i.status === 'won').length;
                        } else if (metric.id === 'lost_count') {
                            result[metric.name] = group.items.filter((i: any) => i.status === 'lost').length;
                        } else if (metric.id === 'completed') {
                            result[metric.name] = group.items.filter((i: any) => i.completed).length;
                        } else if (metric.id === 'pending') {
                            result[metric.name] = group.items.filter((i: any) => !i.completed).length;
                        } else {
                            result[metric.name] = group.items.length;
                        }
                        break;
                    case 'sum':
                        result[metric.name] = group.items.reduce((sum: number, i: any) => sum + (i[metric.field] || 0), 0);
                        break;
                    case 'avg':
                        const sum = group.items.reduce((s: number, i: any) => s + (i[metric.field] || 0), 0);
                        result[metric.name] = group.items.length > 0 ? sum / group.items.length : 0;
                        break;
                }
            });

            return result;
        });
    }, [config, deals, contacts, activities, users]);

    const renderChart = () => {
        if (reportData.length === 0) {
            return (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                    Configure as métricas para visualizar os dados
                </div>
            );
        }

        switch (config.chartType) {
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={reportData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip />
                            <Legend />
                            {config.metrics.map((metric, index) => (
                                <Bar key={metric.id} dataKey={metric.name} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={reportData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip />
                            <Legend />
                            {config.metrics.map((metric, index) => (
                                <Line
                                    key={metric.id}
                                    type="monotone"
                                    dataKey={metric.name}
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'pie':
                if (config.metrics.length > 0) {
                    const metric = config.metrics[0];
                    return (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={reportData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                                    outerRadius={100}
                                    dataKey={metric.name}
                                >
                                    {reportData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    );
                }
                return null;
            case 'table':
                return (
                    <div className="overflow-auto max-h-64">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b border-border sticky top-0">
                                <tr>
                                    <th className="text-left px-4 py-2 font-semibold">Grupo</th>
                                    {config.metrics.map(metric => (
                                        <th key={metric.id} className="text-right px-4 py-2 font-semibold">{metric.name}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((row, index) => (
                                    <tr key={index} className="border-b border-border">
                                        <td className="px-4 py-2">{row.name}</td>
                                        {config.metrics.map(metric => (
                                            <td key={metric.id} className="text-right px-4 py-2">
                                                {typeof row[metric.name] === 'number' && metric.field === 'value'
                                                    ? row[metric.name].toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' })
                                                    : row[metric.name]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            case 'scorecard':
                if (config.metrics.length > 0 && reportData.length > 0) {
                    const totals = config.metrics.map(metric => {
                        const total = reportData.reduce((sum, row) => sum + (row[metric.name] || 0), 0);
                        return { name: metric.name, value: total, field: metric.field };
                    });

                    return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {totals.map((total, index) => (
                                <div key={index} className="bg-card border border-border rounded-lg p-4">
                                    <p className="text-sm text-muted-foreground mb-1">{total.name}</p>
                                    <p className="text-2xl font-bold text-foreground">
                                        {total.field === 'value'
                                            ? total.value.toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' })
                                            : total.value.toLocaleString('pt-BR')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    );
                }
                return null;
        }
    };

    const toggleMetric = (metric: Metric) => {
        const exists = config.metrics.find(m => m.id === metric.id);
        if (exists) {
            setConfig({ ...config, metrics: config.metrics.filter(m => m.id !== metric.id) });
        } else {
            setConfig({ ...config, metrics: [...config.metrics, metric] });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-foreground">Criar Relatório Personalizado</h2>
                    <button onClick={onCancel} className="p-1 hover:bg-muted rounded">
                        <X size={20} />
                    </button>
                </div>

                {/* Steps */}
                <div className="px-6 py-3 border-b border-border flex gap-2">
                    {['source', 'metrics', 'filters', 'visualization'].map((s, i) => (
                        <button
                            key={s}
                            onClick={() => setStep(s as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${step === s
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                        >
                            {i + 1}. {s === 'source' ? 'Fonte' : s === 'metrics' ? 'Métricas' : s === 'filters' ? 'Filtros' : 'Visualização'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {step === 'source' && (
                        <div>
                            <h3 className="font-semibold text-foreground mb-4">Selecione a fonte de dados</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {DATA_SOURCES.map(source => (
                                    <button
                                        key={source.id}
                                        onClick={() => setConfig({ ...config, dataSource: source.id as DataSource, metrics: [] })}
                                        className={`p-4 border rounded-lg flex items-center gap-3 transition-colors ${config.dataSource === source.id
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:bg-muted'
                                            }`}
                                    >
                                        {source.icon}
                                        <span className="font-medium">{source.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'metrics' && (
                        <div>
                            <h3 className="font-semibold text-foreground mb-4">Selecione as métricas</h3>
                            <div className="space-y-2">
                                {METRICS_BY_SOURCE[config.dataSource].map(metric => (
                                    <label
                                        key={metric.id}
                                        className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={config.metrics.some(m => m.id === metric.id)}
                                            onChange={() => toggleMetric(metric)}
                                            className="w-4 h-4"
                                        />
                                        <span className="font-medium">{metric.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'filters' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Período</label>
                                <select
                                    value={config.timeRange}
                                    onChange={(e) => setConfig({ ...config, timeRange: e.target.value as TimeRange })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                                >
                                    {TIME_RANGES.map(range => (
                                        <option key={range.id} value={range.id}>{range.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Agrupar por</label>
                                <select
                                    value={config.groupBy}
                                    onChange={(e) => setConfig({ ...config, groupBy: e.target.value as GroupBy })}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                                >
                                    {GROUP_BY_OPTIONS[config.dataSource].map(option => (
                                        <option key={option.id} value={option.id}>{option.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {step === 'visualization' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Nome do relatório</label>
                                <input
                                    type="text"
                                    value={config.name}
                                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                                    placeholder="Ex: Desempenho de Vendas - Q1 2024"
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Tipo de visualização</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[
                                        { id: 'bar', name: 'Barra' },
                                        { id: 'line', name: 'Linha' },
                                        { id: 'pie', name: 'Pizza' },
                                        { id: 'table', name: 'Tabela' },
                                        { id: 'scorecard', name: 'Scorecard' },
                                    ].map(type => (
                                        <button
                                            key={type.id}
                                            onClick={() => setConfig({ ...config, chartType: type.id as ChartType })}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${config.chartType === type.id
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted hover:bg-muted/80'
                                                }`}
                                        >
                                            {type.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-3">Pré-visualização</label>
                                <div className="border border-border rounded-lg p-4 bg-background">
                                    {renderChart()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex justify-between">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                    >
                        Cancelar
                    </button>
                    <div className="flex gap-2">
                        {step !== 'source' && (
                            <button
                                onClick={() => {
                                    const steps = ['source', 'metrics', 'filters', 'visualization'];
                                    const currentIndex = steps.indexOf(step);
                                    setStep(steps[currentIndex - 1] as any);
                                }}
                                className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                            >
                                Voltar
                            </button>
                        )}
                        {step !== 'visualization' ? (
                            <button
                                onClick={() => {
                                    const steps = ['source', 'metrics', 'filters', 'visualization'];
                                    const currentIndex = steps.indexOf(step);
                                    setStep(steps[currentIndex + 1] as any);
                                }}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                            >
                                Próximo
                            </button>
                        ) : (
                            <button
                                onClick={() => onSave(config)}
                                disabled={!config.name || config.metrics.length === 0}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Salvar Relatório
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
