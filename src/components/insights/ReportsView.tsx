import { useState, useEffect } from 'react';
import { Plus, Download, Trash2, BarChart2 } from 'lucide-react';
import ReportBuilderCorrected, { ReportConfig } from './ReportBuilderCorrected';
import ReportViewer from './ReportViewer';

interface SavedReport extends ReportConfig {
    id: string;
    createdAt: string;
    lastModified: string;
}

export default function ReportsView() {
    const [reports, setReports] = useState<SavedReport[]>(() => {
        const saved = localStorage.getItem('crm_reports');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return [];
            }
        }
        return [];
    });
    const [showBuilder, setShowBuilder] = useState(false);
    const [viewingReport, setViewingReport] = useState<SavedReport | null>(null);

    // Persist reports to LocalStorage
    useEffect(() => {
        localStorage.setItem('crm_reports', JSON.stringify(reports));
    }, [reports]);

    const handleSaveReport = (config: ReportConfig) => {
        const newReport: SavedReport = {
            ...config,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
        };
        setReports([...reports, newReport]);
        setShowBuilder(false);
    };

    const handleDeleteReport = (id: string) => {
        setReports(reports.filter(r => r.id !== id));
    };

    if (viewingReport) {
        return (
            <ReportViewer
                report={viewingReport}
                onClose={() => setViewingReport(null)}
                onEdit={() => {
                    // TODO: Implement edit mode
                    alert('Modo de edição em desenvolvimento');
                }}
                onDuplicate={() => {
                    const duplicated: SavedReport = {
                        ...viewingReport,
                        id: Date.now().toString(),
                        name: `${viewingReport.name} (Cópia)`,
                        createdAt: new Date().toISOString(),
                        lastModified: new Date().toISOString(),
                    };
                    setReports([...reports, duplicated]);
                    setViewingReport(null);
                    alert('Relatório duplicado com sucesso!');
                }}
                onExport={() => {
                    // TODO: Implement export
                    alert('Exportação em desenvolvimento');
                }}
            />
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Relatórios</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Visualize e analise dados do CRM com relatórios personalizados
                        </p>
                    </div>
                    <button
                        onClick={() => setShowBuilder(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        <Plus size={18} />
                        Criar Relatório
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {reports.length === 0 ? (
                    <div className="bg-card rounded-lg border border-border p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                            <BarChart2 size={32} className="text-muted-foreground" />
                        </div>
                        <p className="text-foreground font-semibold mb-2">Nenhum relatório criado</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            Crie relatórios personalizados para visualizar seus dados do CRM
                        </p>
                        <button
                            onClick={() => setShowBuilder(true)}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            + Criar Primeiro Relatório
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {reports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-card rounded-lg border border-border p-4 hover:shadow-md transition-all cursor-pointer"
                                onClick={() => setViewingReport(report)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-foreground mb-1">{report.name}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {report.dataSource === 'deals' && 'Negócios'}
                                            {report.dataSource === 'leads' && 'Leads'}
                                            {report.dataSource === 'activities' && 'Atividades'}
                                            {report.dataSource === 'contacts' && 'Contatos'}
                                            {report.dataSource === 'emails' && 'E-mails'}
                                            {report.dataSource === 'products' && 'Produtos'}
                                            {report.dataSource === 'campaigns' && 'Campanhas'}
                                            {' • '}
                                            {report.chartType === 'bar' && 'Gráfico de Barras'}
                                            {report.chartType === 'line' && 'Gráfico de Linha'}
                                            {report.chartType === 'pie' && 'Gráfico de Pizza'}
                                            {report.chartType === 'table' && 'Tabela'}
                                            {report.chartType === 'scorecard' && 'Scorecard'}
                                            {report.chartType === 'funnel' && 'Funil'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                                    <span>
                                        {report.timeRange === 'last30days' && 'Últimos 30 dias'}
                                        {report.timeRange === 'last7days' && 'Últimos 7 dias'}
                                        {report.timeRange === 'thisMonth' && 'Este mês'}
                                        {report.timeRange === 'thisYear' && 'Este ano'}
                                        {report.timeRange === 'today' && 'Hoje'}
                                        {report.timeRange === 'yesterday' && 'Ontem'}
                                    </span>
                                    <span>{report.metrics.length} métrica(s)</span>
                                </div>

                                <div className="flex gap-2 pt-3 border-t border-border">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // TODO: Implement export
                                            alert('Exportação em desenvolvimento');
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <Download size={14} />
                                        Exportar
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Tem certeza que deseja excluir este relatório?')) {
                                                handleDeleteReport(report.id);
                                            }
                                        }}
                                        className="flex items-center justify-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-red-600"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Report Builder Modal */}
            {showBuilder && (
                <ReportBuilderCorrected
                    onSave={handleSaveReport}
                    onCancel={() => setShowBuilder(false)}
                />
            )}
        </div>
    );
}
