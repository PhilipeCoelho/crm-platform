import { useState, useMemo } from 'react';
import { Download, Edit2, Copy, X, Calendar, Filter, RefreshCw, BarChart } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { ReportConfig } from './ReportBuilderCorrected';
import { BarChart as RechartsBarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ReportViewerProps {
    report: ReportConfig & { id: string; createdAt: string; lastModified: string };
    onClose: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
    onExport?: () => void;
    isInDashboard?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ReportViewer({
    report,
    onClose,
    onEdit,
    onDuplicate,
    onExport,
    isInDashboard = false
}: ReportViewerProps) {
    const { deals, contacts, activities, users } = useCRM();

    // Estado para filtros temporários (NÃO salvam)
    const [tempTimeRange, setTempTimeRange] = useState(report.timeRange);
    const [tempGroupBy, setTempGroupBy] = useState(report.groupBy);
    const [showFilters, setShowFilters] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Calcular dados do relatório
    const reportData = useMemo(() => {
        let sourceData: any[] = [];
        const now = new Date();

        // Calcular período baseado no filtro temporal
        let startDate = new Date();
        switch (tempTimeRange) {
            case 'today':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                startDate.setDate(startDate.getDate() - 1);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'last7days':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'last30days':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case 'last90days':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case 'thisMonth':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'lastMonth':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                break;
            case 'thisQuarter':
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                break;
            case 'lastQuarter':
                const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
                startDate = new Date(now.getFullYear(), lastQuarter * 3, 1);
                break;
            case 'thisYear':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'lastYear':
                startDate = new Date(now.getFullYear() - 1, 0, 1);
                break;
            default:
                startDate.setDate(startDate.getDate() - 30);
        }

        // Obter dados baseado na fonte
        switch (report.dataSource) {
            case 'deals':
                sourceData = deals.filter(d => new Date(d.createdAt) >= startDate);
                break;
            case 'contacts':
                sourceData = contacts.filter(c => new Date(c.createdAt) >= startDate);
                break;
            case 'activities':
                sourceData = activities.filter(a => new Date(a.dueDate) >= startDate);
                break;
            default:
                sourceData = [];
        }

        // Se não houver dados, retornar vazio
        if (sourceData.length === 0) {
            return [];
        }

        // Agrupar dados
        const grouped: Record<string, any> = {};

        sourceData.forEach(item => {
            let groupKey = '';

            switch (tempGroupBy) {
                case 'user':
                    const user = users.find(u => u.id === (item.ownerId || item.userId));
                    groupKey = user?.name || 'Sem proprietário';
                    break;
                case 'status':
                    groupKey = item.status || 'Sem status';
                    break;
                case 'stage':
                    groupKey = item.stage || 'Sem etapa';
                    break;
                case 'pipeline':
                    groupKey = item.pipelineId || 'Sem pipeline';
                    break;
                case 'day':
                    const dayDate = new Date(item.createdAt || item.dueDate || new Date());
                    groupKey = dayDate.toLocaleDateString('pt-BR');
                    break;
                case 'week':
                    const weekDate = new Date(item.createdAt || item.dueDate || new Date());
                    const weekNum = Math.ceil((weekDate.getDate()) / 7);
                    groupKey = `Semana ${weekNum}`;
                    break;
                case 'month':
                    const monthDate = new Date(item.createdAt || item.dueDate || new Date());
                    groupKey = monthDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                    break;
                case 'quarter':
                    const quarterDate = new Date(item.createdAt || item.dueDate || new Date());
                    const q = Math.floor(quarterDate.getMonth() / 3) + 1;
                    groupKey = `Q${q} ${quarterDate.getFullYear()}`;
                    break;
                case 'year':
                    const yearDate = new Date(item.createdAt || item.dueDate || new Date());
                    groupKey = yearDate.getFullYear().toString();
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

            report.metrics.forEach(metric => {
                switch (metric.aggregation) {
                    case 'count':
                        if (metric.id === 'won_count') {
                            result[metric.name] = group.items.filter((i: any) => i.status === 'won').length;
                        } else if (metric.id === 'lost_count') {
                            result[metric.name] = group.items.filter((i: any) => i.status === 'lost').length;
                        } else if (metric.id === 'open_count') {
                            result[metric.name] = group.items.filter((i: any) => i.status === 'open').length;
                        } else if (metric.id === 'completed_count') {
                            result[metric.name] = group.items.filter((i: any) => i.done).length;
                        } else if (metric.id === 'overdue_count') {
                            result[metric.name] = group.items.filter((i: any) => !i.done && new Date(i.dueDate) < new Date()).length;
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
                        } else if (metric.id === 'completion_rate') {
                            const total = group.items.length;
                            const completed = group.items.filter((i: any) => i.done).length;
                            result[metric.name] = total > 0 ? (completed / total) * 100 : 0;
                        }
                        break;
                }
            });

            return result;
        });
    }, [report, tempTimeRange, tempGroupBy, deals, contacts, activities, users]);

    // Renderizar gráfico baseado no tipo
    const renderChart = () => {
        if (reportData.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <BarChart size={48} className="mb-4 opacity-50" />
                    <p className="text-sm font-medium">Nenhum dado disponível</p>
                    <p className="text-xs mt-1">Ajuste os filtros ou o período para visualizar dados</p>
                </div>
            );
        }

        switch (report.chartType) {
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <RechartsBarChart data={reportData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <Tooltip contentStyle={{ fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            {report.metrics.map((metric, index) => (
                                <Bar key={metric.id} dataKey={metric.name} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </RechartsBarChart>
                    </ResponsiveContainer>
                );

            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={reportData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <Tooltip contentStyle={{ fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            {report.metrics.map((metric, index) => (
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
                if (report.metrics.length > 0) {
                    const metric = report.metrics[0];
                    return (
                        <ResponsiveContainer width="100%" height={400}>
                            <PieChart>
                                <Pie
                                    data={reportData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                                    outerRadius={120}
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
                if (report.metrics.length > 0 && reportData.length > 0) {
                    const total = reportData.reduce((sum, row) => sum + (row[report.metrics[0].name] || 0), 0);
                    return (
                        <div className="flex flex-col items-center justify-center h-64">
                            <p className="text-6xl font-bold text-foreground">
                                {report.metrics[0].field === 'value'
                                    ? total.toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' })
                                    : report.metrics[0].aggregation === 'rate'
                                        ? `${total.toFixed(1)}%`
                                        : total.toLocaleString('pt-BR')}
                            </p>
                            <p className="text-sm text-muted-foreground mt-4">{report.metrics[0].name}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                                {tempTimeRange === 'last30days' && 'Últimos 30 dias'}
                                {tempTimeRange === 'last7days' && 'Últimos 7 dias'}
                                {tempTimeRange === 'thisMonth' && 'Este mês'}
                                {tempTimeRange === 'thisYear' && 'Este ano'}
                            </p>
                        </div>
                    );
                }
                return null;

            case 'table':
                return (
                    <div className="overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">
                                        {tempGroupBy === 'user' && 'Usuário'}
                                        {tempGroupBy === 'status' && 'Status'}
                                        {tempGroupBy === 'month' && 'Mês'}
                                        {tempGroupBy === 'stage' && 'Etapa'}
                                        {tempGroupBy === 'pipeline' && 'Pipeline'}
                                    </th>
                                    {report.metrics.map(metric => (
                                        <th key={metric.id} className="px-4 py-2 text-right font-medium">
                                            {metric.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((row, index) => (
                                    <tr key={index} className="border-b border-border">
                                        <td className="px-4 py-2">{row.name}</td>
                                        {report.metrics.map(metric => (
                                            <td key={metric.id} className="px-4 py-2 text-right">
                                                {metric.field === 'value'
                                                    ? row[metric.name].toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' })
                                                    : metric.aggregation === 'rate'
                                                        ? `${row[metric.name].toFixed(1)}%`
                                                        : row[metric.name].toLocaleString('pt-BR')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );

            default:
                return null;
        }
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 500);
    };

    if (isInDashboard) {
        // Versão compacta para painel
        return (
            <div className="bg-card rounded-lg border border-border p-4 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground">{report.name}</h3>
                    <button
                        onClick={handleRefresh}
                        className="p-1 hover:bg-muted rounded"
                        disabled={isRefreshing}
                    >
                        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
                <div className="flex-1">
                    {renderChart()}
                </div>
            </div>
        );
    }

    // Versão completa para visualização standalone
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border max-w-6xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold text-foreground">{report.name}</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Fonte: {report.dataSource === 'deals' && 'Negócios'}
                            {report.dataSource === 'leads' && 'Leads'}
                            {report.dataSource === 'activities' && 'Atividades'}
                            {report.dataSource === 'contacts' && 'Contatos'}
                            {report.dataSource === 'emails' && 'E-mails'}
                            {report.dataSource === 'products' && 'Produtos'}
                            {report.dataSource === 'campaigns' && 'Campanhas'}
                            {' • '}
                            {report.metrics.length} métrica(s)
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-2">
                        {/* Filtro de Período (Temporário) */}
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-muted-foreground" />
                            <select
                                value={tempTimeRange}
                                onChange={(e) => setTempTimeRange(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background"
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

                        {/* Agrupamento (Temporário) */}
                        <select
                            value={tempGroupBy}
                            onChange={(e) => setTempGroupBy(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background"
                        >
                            <option value="day">Por dia</option>
                            <option value="week">Por semana</option>
                            <option value="month">Por mês</option>
                            <option value="quarter">Por trimestre</option>
                            <option value="year">Por ano</option>
                            <option value="user">Por usuário</option>
                            {report.dataSource === 'deals' && <option value="stage">Por etapa</option>}
                            {report.dataSource === 'deals' && <option value="pipeline">Por pipeline</option>}
                            <option value="status">Por status</option>
                        </select>

                        <button
                            onClick={handleRefresh}
                            className="p-1.5 hover:bg-muted rounded"
                            disabled={isRefreshing}
                        >
                            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {onExport && (
                            <button
                                onClick={onExport}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted"
                            >
                                <Download size={14} />
                                Exportar
                            </button>
                        )}
                        {onDuplicate && (
                            <button
                                onClick={onDuplicate}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted"
                            >
                                <Copy size={14} />
                                Duplicar
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={onEdit}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                            >
                                <Edit2 size={14} />
                                Editar
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {renderChart()}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground">
                    <p>
                        Criado em {new Date(report.createdAt).toLocaleDateString('pt-BR')}
                        {' • '}
                        Última modificação em {new Date(report.lastModified).toLocaleDateString('pt-BR')}
                        {' • '}
                        <span className="text-amber-600">Filtros temporários não alteram o relatório salvo</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
