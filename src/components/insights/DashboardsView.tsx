import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import ExecutiveSummary from './ExecutiveSummary';
import StrategicDiagnostics from './StrategicDiagnostics';
import FunnelModule from './FunnelModule';
import ActivityModule from './ActivityModule';
import IntensityModule from './IntensityModule';
import TimingModule from './TimingModule';
import ChannelModule from './ChannelModule';
import LostModule from './LostModule';
import ReportCard, { ReportCardConfig } from './ReportCard';
import ReportBuilder, { ReportConfig } from './ReportBuilder';

type TabId = 'resumo' | 'execucao' | 'velocidade' | 'canais' | 'perdas';

export default function DashboardsView() {
    const [activeTab, setActiveTab] = useState<TabId>('resumo');
    const [reports, setReports] = useState<ReportCardConfig[]>([]);
    const [showBuilder, setShowBuilder] = useState(false);
    const [activeGuide, setActiveGuide] = useState<string | null>(null);

    // Reset guide when changing tab
    useEffect(() => {
        setActiveGuide(null);
    }, [activeTab]);

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
            chartType: config.chartType === 'table' ? 'bar' : config.chartType as 'bar' | 'line' | 'pie' | 'scorecard',
        };
        setReports([...reports, newReport]);
        setShowBuilder(false);
    };

    const handleDeleteReport = (id: string) => {
        const updated = reports.filter((r: ReportCardConfig) => r.id !== id);
        setReports(updated);
        if (updated.length === 0) {
            localStorage.removeItem('insights-reports');
        }
    };

    const tabs: { id: TabId; label: string }[] = [
        { id: 'resumo', label: 'Resumo' },
        { id: 'execucao', label: 'Execução' },
        { id: 'velocidade', label: 'Velocidade' },
        { id: 'canais', label: 'Canais' },
        { id: 'perdas', label: 'Perdas' },
    ];

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#F7F9FC] dark:bg-[#0D0D0D]">
            {/* Content Container (Everything scrolls together) */}
            <div className="flex-1 overflow-auto custom-scrollbar">

                {/* Diagnóstico Estratégico Hero Block */}
                <StrategicDiagnostics />

                {/* Tabs Navigation */}
                <div className="border-b border-[#E5E7EB] dark:border-[#1F1F1F] px-6 pt-12 mb-8">
                    <div className="max-w-[1200px] mx-auto flex space-x-8 overflow-x-auto no-scrollbar min-w-max">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-3 text-sm font-semibold tracking-wide transition-colors relative ${activeTab === tab.id
                                    ? 'text-primary'
                                    : 'text-[#6B7280] dark:text-[#8A8A8A] hover:text-[#111827] dark:hover:text-[#EAEAEA]'
                                    }`}
                            >
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary bg-opacity-100 rounded-t-full transition-all duration-300" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="max-w-[1200px] mx-auto pb-24 px-6 flex flex-col gap-12">

                    {activeTab === 'resumo' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both relative">
                            <ExecutiveSummary activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                            <FunnelModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                        </div>
                    )}

                    {activeTab === 'execucao' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both relative">
                            <ActivityModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                            <IntensityModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                        </div>
                    )}

                    {activeTab === 'velocidade' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both relative">
                            <TimingModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                        </div>
                    )}

                    {activeTab === 'canais' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both relative">
                            <ChannelModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                        </div>
                    )}

                    {activeTab === 'perdas' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both relative">
                            <LostModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                        </div>
                    )}

                    {/* Custon Reports (Only show in Resumo or maybe a new Tab? Let's show at the bottom of Resumo) */}
                    {activeTab === 'resumo' && (
                        <div className="mt-8 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-foreground">Relatórios Extras</h2>
                                <button
                                    onClick={() => setShowBuilder(true)}
                                    className="flex items-center gap-2 text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                                >
                                    <Plus size={14} />
                                    Novo Relatório
                                </button>
                            </div>

                            {reports.length === 0 ? (
                                <div className="bg-muted/20 rounded-2xl border border-dashed border-border p-12 text-center">
                                    <p className="text-sm text-muted-foreground">Adicione relatórios personalizados para ver mais métricas</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {reports.map((report: ReportCardConfig) => (
                                        <ReportCard
                                            key={report.id}
                                            config={report}
                                            onDelete={() => handleDeleteReport(report.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
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
