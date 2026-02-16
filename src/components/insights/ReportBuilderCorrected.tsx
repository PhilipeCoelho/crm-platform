import { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, AlertCircle, Info } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import {
    DataSource,
    ChartType,
    Metric,
    Filter,
    getConfigForSource,
    isAllowedCombination
} from '@/config/reportConfig';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface ReportConfig {
    name: string;
    dataSource: DataSource;
    metrics: Metric[];
    filters: Record<string, any>;
    groupBy: string;
    timeRange: string;
    chartType: ChartType;
}

interface ReportBuilderProps {
    initialConfig?: Partial<ReportConfig>;
    onSave: (config: ReportConfig) => void;
    onCancel: () => void;
}

type Step = 'source' | 'metrics' | 'filters' | 'visualization';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ReportBuilderCorrected({ initialConfig, onSave, onCancel }: ReportBuilderProps) {
    const { deals, contacts, activities, users } = useCRM();

    // Estado do fluxo
    const [currentStep, setCurrentStep] = useState<Step>('source');
    const [dataSource, setDataSource] = useState<DataSource | null>(initialConfig?.dataSource || null);
    const [selectedMetrics, setSelectedMetrics] = useState<Metric[]>(initialConfig?.metrics || []);
    const [filters, setFilters] = useState<Record<string, any>>(initialConfig?.filters || {});
    const [groupBy, setGroupBy] = useState<string>(initialConfig?.groupBy || 'month');
    const [timeRange, setTimeRange] = useState<string>(initialConfig?.timeRange || 'last30days');
    const [chartType, setChartType] = useState<ChartType>(initialConfig?.chartType || 'bar');
    const [reportName, setReportName] = useState<string>(initialConfig?.name || '');

    // Obter configurações baseadas na fonte selecionada
    const sourceConfig = useMemo(() => {
        if (!dataSource) return null;
        return getConfigForSource(dataSource);
    }, [dataSource]);

    // Validação: não pode avançar sem fonte
    const canProceedFromSource = dataSource !== null;
    const canProceedFromMetrics = selectedMetrics.length > 0;
    const canProceedFromFilters = true; // Filtros são opcionais
    const canSave = reportName.trim() !== '' && dataSource !== null && selectedMetrics.length > 0;

    // Calcular dados do relatório para preview
    const reportData = useMemo(() => {
        if (!dataSource || selectedMetrics.length === 0) return [];

        let sourceData: any[] = [];
        const now = new Date();
        const last30 = new Date(now);
        last30.setDate(last30.getDate() - 30);

        // Obter dados baseado na fonte
        switch (dataSource) {
            case 'deals':
                sourceData = deals.filter(d => new Date(d.createdAt) >= last30);
                break;
            case 'contacts':
                sourceData = contacts.filter(c => new Date(c.createdAt) >= last30);
                break;
            case 'activities':
                sourceData = activities.filter(a => new Date(a.dueDate) >= last30);
                break;
            default:
                sourceData = [];
        }

        // Agrupar dados
        const grouped: Record<string, any> = {};

        sourceData.forEach(item => {
            let groupKey = '';

            switch (groupBy) {
                case 'user':
                    const user = users.find(u => u.id === (item.ownerId || item.userId));
                    groupKey = user?.name || 'Sem proprietário';
                    break;
                case 'status':
                    groupKey = item.status || 'Sem status';
                    break;
                case 'month':
                    const date = new Date(item.createdAt || item.dueDate || new Date());
                    groupKey = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                    break;
                default:
                    groupKey = 'Total';
            }

            if (!grouped[groupKey]) {
                grouped[groupKey] = { name: groupKey, items: [] };
            }
            grouped[groupKey].items.push(item);
        });

        // Calcular métricas
        return Object.values(grouped).map((group: any) => {
            const result: any = { name: group.name };

            selectedMetrics.forEach(metric => {
                switch (metric.aggregation) {
                    case 'count':
                        if (metric.id === 'won_count') {
                            result[metric.name] = group.items.filter((i: any) => i.status === 'won').length;
                        } else if (metric.id === 'lost_count') {
                            result[metric.name] = group.items.filter((i: any) => i.status === 'lost').length;
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
                    case 'rate':
                        if (metric.id === 'conversion_rate') {
                            const total = group.items.length;
                            const won = group.items.filter((i: any) => i.status === 'won').length;
                            result[metric.name] = total > 0 ? (won / total) * 100 : 0;
                        }
                        break;
                }
            });

            return result;
        });
    }, [dataSource, selectedMetrics, groupBy, deals, contacts, activities, users]);

    // Renderizar gráfico de preview
    const renderPreview = () => {
        if (reportData.length === 0) {
            return (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                    Configure as métricas para visualizar o gráfico
                </div>
            );
        }

        switch (chartType) {
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={reportData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <Tooltip contentStyle={{ fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            {selectedMetrics.map((metric, index) => (
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
                            <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <Tooltip contentStyle={{ fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            {selectedMetrics.map((metric, index) => (
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
                if (selectedMetrics.length > 0) {
                    const metric = selectedMetrics[0];
                    return (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={reportData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                                    outerRadius={80}
                                    dataKey={metric.name}
                                >
                                    {reportData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    );
                }
                return null;

            case 'scorecard':
                if (selectedMetrics.length > 0 && reportData.length > 0) {
                    const total = reportData.reduce((sum, row) => sum + (row[selectedMetrics[0].name] || 0), 0);
                    return (
                        <div className="flex flex-col items-center justify-center h-64">
                            <p className="text-5xl font-bold text-foreground">
                                {selectedMetrics[0].field === 'value'
                                    ? total.toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' })
                                    : total.toLocaleString('pt-BR')}
                            </p>
                            <p className="text-sm text-muted-foreground mt-3">{selectedMetrics[0].name}</p>
                        </div>
                    );
                }
                return null;

            default:
                return null;
        }
    };

    const handleSave = () => {
        if (!canSave || !dataSource) return;

        const config: ReportConfig = {
            name: reportName,
            dataSource,
            metrics: selectedMetrics,
            filters,
            groupBy,
            timeRange,
            chartType
        };

        onSave(config);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border max-w-5xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">Criar Relatório</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {currentStep === 'source' && 'Escolha a fonte de dados'}
                            {currentStep === 'metrics' && 'Configure as métricas'}
                            {currentStep === 'filters' && 'Aplique filtros (opcional)'}
                            {currentStep === 'visualization' && 'Escolha a visualização e salve'}
                        </p>
                    </div>
                    <button onClick={onCancel} className="p-1 hover:bg-muted rounded">
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="px-6 py-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        {['source', 'metrics', 'filters', 'visualization'].map((step, index) => (
                            <div key={step} className="flex items-center flex-1">
                                <div className={`flex items-center gap-2 ${currentStep === step ? 'text-primary' :
                                        ['source', 'metrics', 'filters', 'visualization'].indexOf(currentStep) > index ? 'text-foreground' : 'text-muted-foreground'
                                    }`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === step ? 'bg-primary text-primary-foreground' :
                                            ['source', 'metrics', 'filters', 'visualization'].indexOf(currentStep) > index ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <span className="text-sm font-medium hidden sm:block">
                                        {step === 'source' && 'Fonte'}
                                        {step === 'metrics' && 'Métricas'}
                                        {step === 'filters' && 'Filtros'}
                                        {step === 'visualization' && 'Visualização'}
                                    </span>
                                </div>
                                {index < 3 && (
                                    <div className={`flex-1 h-0.5 mx-2 ${['source', 'metrics', 'filters', 'visualization'].indexOf(currentStep) > index ? 'bg-primary' : 'bg-muted'
                                        }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* ETAPA 1: ESCOLHER FONTE */}
                    {currentStep === 'source' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                                <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold mb-1">Escolha a fonte de dados</p>
                                    <p>A fonte define quais métricas, filtros e visualizações estarão disponíveis. Esta escolha não pode ser alterada depois.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { value: 'deals' as DataSource, label: 'Negócios', description: 'Valor, conversão, duração' },
                                    { value: 'leads' as DataSource, label: 'Leads', description: 'Conversão, origem' },
                                    { value: 'activities' as DataSource, label: 'Atividades', description: 'Volume, tipo, status' },
                                    { value: 'emails' as DataSource, label: 'E-mails', description: 'Abertura, cliques' },
                                    { value: 'products' as DataSource, label: 'Produtos', description: 'Vendas, receita' },
                                    { value: 'campaigns' as DataSource, label: 'Campanhas', description: 'ROI, conversão' },
                                    { value: 'contacts' as DataSource, label: 'Contatos', description: 'Quantidade, organização' },
                                ].map((source) => (
                                    <button
                                        key={source.value}
                                        onClick={() => setDataSource(source.value)}
                                        className={`p-4 border rounded-lg text-left transition-all ${dataSource === source.value
                                                ? 'border-primary bg-primary/10'
                                                : 'border-border hover:bg-muted'
                                            }`}
                                    >
                                        <p className="font-semibold text-sm mb-1">{source.label}</p>
                                        <p className="text-xs text-muted-foreground">{source.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ETAPA 2: CONFIGURAR MÉTRICAS */}
                    {currentStep === 'metrics' && sourceConfig && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                                <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold mb-1">Métricas disponíveis para: {dataSource}</p>
                                    <p>Selecione uma ou mais métricas para analisar. As opções são limitadas pela fonte de dados escolhida.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {sourceConfig.metrics.map((metric) => (
                                    <label
                                        key={metric.id}
                                        className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedMetrics.some(m => m.id === metric.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedMetrics([...selectedMetrics, metric]);
                                                } else {
                                                    setSelectedMetrics(selectedMetrics.filter(m => m.id !== metric.id));
                                                }
                                            }}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{metric.name}</p>
                                            <p className="text-xs text-muted-foreground">{metric.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ETAPA 3: APLICAR FILTROS */}
                    {currentStep === 'filters' && sourceConfig && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                                <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold mb-1">Filtros (opcional)</p>
                                    <p>Refine os dados do relatório aplicando filtros. Você pode pular esta etapa se não precisar de filtros.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Período */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">Período</label>
                                    <select
                                        value={timeRange}
                                        onChange={(e) => setTimeRange(e.target.value)}
                                        className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                                    >
                                        <option value="today">Hoje</option>
                                        <option value="yesterday">Ontem</option>
                                        <option value="last7days">Últimos 7 dias</option>
                                        <option value="last30days">Últimos 30 dias</option>
                                        <option value="last90days">Últimos 90 dias</option>
                                        <option value="thisMonth">Este mês</option>
                                        <option value="lastMonth">Mês passado</option>
                                        <option value="thisQuarter">Este trimestre</option>
                                        <option value="lastQuarter">Trimestre passado</option>
                                        <option value="thisYear">Este ano</option>
                                        <option value="lastYear">Ano passado</option>
                                    </select>
                                </div>

                                {/* Agrupamento */}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">Agrupar por</label>
                                    <select
                                        value={groupBy}
                                        onChange={(e) => setGroupBy(e.target.value)}
                                        className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                                    >
                                        <option value="day">Dia</option>
                                        <option value="week">Semana</option>
                                        <option value="month">Mês</option>
                                        <option value="quarter">Trimestre</option>
                                        <option value="year">Ano</option>
                                        <option value="user">Usuário</option>
                                        {dataSource === 'deals' && <option value="stage">Etapa</option>}
                                        {dataSource === 'deals' && <option value="pipeline">Pipeline</option>}
                                        <option value="status">Status</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ETAPA 4: ESCOLHER VISUALIZAÇÃO */}
                    {currentStep === 'visualization' && sourceConfig && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Nome do relatório *</label>
                                <input
                                    type="text"
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    placeholder="Ex: Desempenho de Vendas"
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Tipo de visualização</label>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    {sourceConfig.visualizations.map((viz) => (
                                        <button
                                            key={viz.type}
                                            onClick={() => setChartType(viz.type)}
                                            className={`p-3 border rounded-lg text-left transition-all ${chartType === viz.type
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-border hover:bg-muted'
                                                }`}
                                        >
                                            <p className="font-medium text-xs">{viz.name}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Pré-visualização</label>
                                <div className="border border-border rounded-lg p-4 bg-background">
                                    {renderPreview()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex justify-between">
                    <button
                        onClick={() => {
                            if (currentStep === 'source') {
                                onCancel();
                            } else if (currentStep === 'metrics') {
                                setCurrentStep('source');
                            } else if (currentStep === 'filters') {
                                setCurrentStep('metrics');
                            } else if (currentStep === 'visualization') {
                                setCurrentStep('filters');
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                    >
                        <ChevronLeft size={16} />
                        {currentStep === 'source' ? 'Cancelar' : 'Voltar'}
                    </button>

                    <div className="flex gap-2">
                        {currentStep !== 'visualization' && (
                            <button
                                onClick={() => {
                                    if (currentStep === 'source' && canProceedFromSource) {
                                        setCurrentStep('metrics');
                                    } else if (currentStep === 'metrics' && canProceedFromMetrics) {
                                        setCurrentStep('filters');
                                    } else if (currentStep === 'filters') {
                                        setCurrentStep('visualization');
                                    }
                                }}
                                disabled={
                                    (currentStep === 'source' && !canProceedFromSource) ||
                                    (currentStep === 'metrics' && !canProceedFromMetrics)
                                }
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Próximo
                                <ChevronRight size={16} />
                            </button>
                        )}

                        {currentStep === 'visualization' && (
                            <button
                                onClick={handleSave}
                                disabled={!canSave}
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
