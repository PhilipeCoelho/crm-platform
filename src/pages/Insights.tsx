import { useState } from 'react';
import { InsightsProvider } from '@/contexts/InsightsContext';
import InsightsFilter from '@/components/insights/InsightsFilter';
import DashboardsView from '@/components/insights/DashboardsView';
import ReportsView from '@/components/insights/ReportsView';
import GoalsView from '@/components/insights/GoalsView';
import { BarChart3, FileText, Target } from 'lucide-react';

type InsightsView = 'dashboards' | 'reports' | 'goals';

export default function Insights() {
    const [activeView, setActiveView] = useState<InsightsView>('dashboards');

    const renderView = () => {
        switch (activeView) {
            case 'dashboards':
                return <DashboardsView />;
            case 'reports':
                return <ReportsView />;
            case 'goals':
                return <GoalsView />;
            default:
                return <DashboardsView />;
        }
    };

    return (
        <InsightsProvider>
            <div className="flex h-full w-full bg-[#F7F9FC] dark:bg-[#0B1220]">
                {/* Main Content Area */}
                <main className="flex-1 flex flex-col overflow-hidden w-full">
                    <InsightsFilter />

                    {/* Horizontal Navigation (Replaces old Sidebar) */}
                    <div className="bg-[#FFFFFF] dark:bg-[#111827] border-b border-[#E5E7EB] dark:border-[#1F2937] px-6">
                        <div className="max-w-[1200px] mx-auto flex gap-8">
                            <button
                                onClick={() => setActiveView('dashboards')}
                                className={`flex items-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 ${activeView === 'dashboards' ? 'border-primary text-primary' : 'border-transparent text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]'}`}
                            >
                                <BarChart3 size={16} /> Painéis
                            </button>
                            <button
                                onClick={() => setActiveView('reports')}
                                className={`flex items-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 ${activeView === 'reports' ? 'border-primary text-primary' : 'border-transparent text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]'}`}
                            >
                                <FileText size={16} /> Relatórios
                            </button>
                            <button
                                onClick={() => setActiveView('goals')}
                                className={`flex items-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 ${activeView === 'goals' ? 'border-primary text-primary' : 'border-transparent text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]'}`}
                            >
                                <Target size={16} /> Metas
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto w-full">
                        {renderView()}
                    </div>
                </main>
            </div>
        </InsightsProvider>
    );
}
