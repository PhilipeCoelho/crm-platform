import { useState, useEffect } from 'react';
import { Plus, Download, Trash2, BarChart2, CheckCircle2 } from 'lucide-react';
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
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

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
                onEdit={() => showToast('Modo de edição em breve')}
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
                    showToast('Relatório duplicado com sucesso!');
                }}
                onExport={() => showToast('Exportação em breve (CSV/XLS)')}
            />
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Inline Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#111827] dark:bg-[#EAEAEA] text-white dark:text-[#111827] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-3 duration-300">
                    <CheckCircle2 size={15} className="text-emerald-400 dark:text-emerald-600 shrink-0" />
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E5E7EB] dark:border-[#1F1F1F] bg-[#FFFFFF] dark:bg-[#0D0D0D]">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-[#111827] dark:text-[#EAEAEA] tracking-tight">Relatórios</h1>
                        <p className="text-xs text-[#6B7280] dark:text-[#8A8A8A] mt-0.5">
                            Crie e analise relatórios personalizados com os dados do CRM
                        </p>
                    </div>
                    <button
                        onClick={() => setShowBuilder(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                        <Plus size={16} />
                        Criar Relatório
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 bg-[#F7F9FC] dark:bg-[#0D0D0D]">
                {reports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-[#FFFFFF] dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] flex items-center justify-center mx-auto mb-5 shadow-sm">
                            <BarChart2 size={28} className="text-[#6B7280] dark:text-[#8A8A8A]" />
                        </div>
                        <h2 className="text-base font-bold text-[#111827] dark:text-[#EAEAEA] mb-2">Nenhum relatório criado</h2>
                        <p className="text-sm text-[#6B7280] dark:text-[#8A8A8A] mb-6 leading-relaxed">
                            Crie relatórios personalizados escolhendo uma fonte de dados, métricas e visualização.
                        </p>
                        <button
                            onClick={() => setShowBuilder(true)}
                            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                        >
                            <Plus size={15} />
                            Criar Primeiro Relatório
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

                                <div className="flex gap-2 pt-3 border-t border-[#E5E7EB] dark:border-[#262626]">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            showToast('Exportação em breve (CSV/XLS)');
                                        }}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-[#E5E7EB] dark:border-[#262626] rounded-lg text-[#6B7280] dark:text-[#8A8A8A] hover:bg-[#F3F4F6] dark:hover:bg-[#1F1F1F] transition-colors"
                                    >
                                        <Download size={13} />
                                        Exportar
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm('Excluir este relatório?')) {
                                                handleDeleteReport(report.id);
                                            }
                                        }}
                                        className="flex items-center justify-center gap-2 px-3 py-2 text-xs border border-[#E5E7EB] dark:border-[#262626] rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                    >
                                        <Trash2 size={13} />
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
