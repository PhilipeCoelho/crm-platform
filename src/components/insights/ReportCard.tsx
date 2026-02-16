import { useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Metric {
    id: string;
    name: string;
    field: string;
    aggregation: 'count' | 'sum' | 'avg';
}

export interface ReportCardConfig {
    id: string;
    name: string;
    dataSource: 'deals' | 'leads' | 'activities' | 'contacts';
    metrics: Metric[];
    groupBy: 'day' | 'week' | 'month' | 'user' | 'stage' | 'status' | 'type';
    timeRange: string;
    chartType: 'bar' | 'line' | 'pie' | 'scorecard';
}

interface ReportCardProps {
    config: ReportCardConfig;
    onEdit?: () => void;
    onDelete?: () => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ReportCard({ config, onEdit, onDelete }: ReportCardProps) {
    const { deals, contacts, activities, users } = useCRM();

    const reportData = useMemo(() => {
        if (config.metrics.length === 0) return [];

        // Get data based on source
        let sourceData: any[] = [];
        const now = new Date();
        const last30 = new Date(now);
        last30.setDate(last30.getDate() - 30);

        switch (config.dataSource) {
            case 'deals':
                sourceData = deals.filter(d => new Date(d.createdAt) >= last30);
                break;
            case 'contacts':
                sourceData = contacts.filter(c => new Date(c.createdAt) >= last30);
                break;
            case 'activities':
                sourceData = activities.filter(a => new Date(a.dueDate) >= last30);
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
                case 'month':
                    const date = new Date(item.createdAt || item.dueDate || new Date());
                    groupKey = date.toLocaleDateString('pt-BR', { month: 'short' });
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
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                    Sem dados disponíveis
                </div>
            );
        }

        switch (config.chartType) {
            case 'scorecard':
                if (config.metrics.length > 0 && reportData.length > 0) {
                    const total = reportData.reduce((sum, row) => sum + (row[config.metrics[0].name] || 0), 0);
                    return (
                        <div className="flex flex-col items-center justify-center h-48">
                            <p className="text-4xl font-bold text-foreground">
                                {config.metrics[0].field === 'value'
                                    ? total.toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' })
                                    : total.toLocaleString('pt-BR')}
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">{config.metrics[0].name}</p>
                        </div>
                    );
                }
                return null;

            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={reportData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <Tooltip contentStyle={{ fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            {config.metrics.map((metric, index) => (
                                <Bar key={metric.id} dataKey={metric.name} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={reportData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                            <Tooltip contentStyle={{ fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
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
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={reportData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                                    outerRadius={60}
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
        }
    };

    return (
        <div className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-all">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-sm">{config.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        {config.timeRange} • {config.dataSource === 'deals' ? 'Negócios' : config.dataSource === 'leads' ? 'Leads' : config.dataSource === 'activities' ? 'Atividades' : 'Contatos'}
                    </p>
                </div>
                <div className="flex gap-1">
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="p-1 hover:bg-muted rounded transition-colors"
                        >
                            <Edit2 size={14} className="text-muted-foreground" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="p-1 hover:bg-muted rounded transition-colors"
                        >
                            <Trash2 size={14} className="text-red-600" />
                        </button>
                    )}
                </div>
            </div>

            {/* Chart */}
            <div className="mt-4">
                {renderChart()}
            </div>
        </div>
    );
}
