import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import ReportCard, { ReportCardConfig } from './ReportCard';
import ReportBuilder, { ReportConfig } from './ReportBuilder';

export default function DashboardsView() {
    const [reports, setReports] = useState<ReportCardConfig[]>([]);
    const [showBuilder, setShowBuilder] = useState(false);

    // Load reports from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('insights-reports');
        if (saved) {
            try {
                setReports(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load reports:', e);
            }
        }
    }, []);

    // Save reports to localStorage whenever they change
    useEffect(() => {
        if (reports.length > 0) {
            localStorage.setItem('insights-reports', JSON.stringify(reports));
        }
    }, [reports]);

    const handleSaveReport = (config: ReportConfig) => {
        // Filter metrics to only include compatible aggregations
        const compatibleMetrics = config.metrics.filter(m =>
            m.aggregation === 'count' || m.aggregation === 'sum' || m.aggregation === 'avg'
        );

        const newReport: ReportCardConfig = {
            id: Date.now().toString(),
            name: config.name,
            dataSource: config.dataSource as any,
            metrics: compatibleMetrics as any,
            groupBy: config.groupBy as any,
            timeRange: config.timeRange,
            // Convert 'table' to 'bar' for compatibility
            chartType: config.chartType === 'table' ? 'bar' : config.chartType as 'bar' | 'line' | 'pie' | 'scorecard',
        };
        setReports([...reports, newReport]);
        setShowBuilder(false);
    };

    const handleDeleteReport = (id: string) => {
        const updated = reports.filter(r => r.id !== id);
        setReports(updated);
        if (updated.length === 0) {
            localStorage.removeItem('insights-reports');
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Meu Painel</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Visualize seus relatórios em tempo real
                        </p>
                    </div>
                    <button
                        onClick={() => setShowBuilder(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        <Plus size={18} />
                        Gerar Relatório
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {reports.length === 0 ? (
                    <div className="bg-card rounded-lg border border-border p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                            <Plus size={32} className="text-muted-foreground" />
                        </div>
                        <p className="text-foreground font-semibold mb-2">Nenhum relatório no painel</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Crie relatórios personalizados para visualizar seus dados
                        </p>
                        <button
                            onClick={() => setShowBuilder(true)}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            + Gerar Primeiro Relatório
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {reports.map((report) => (
                            <ReportCard
                                key={report.id}
                                config={report}
                                onDelete={() => handleDeleteReport(report.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Report Builder Modal */}
            {showBuilder && (
                <ReportBuilder
                    onSave={handleSaveReport}
                    onCancel={() => setShowBuilder(false)}
                />
            )}
        </div>
    );
}
