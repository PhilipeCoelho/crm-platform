import { useState } from 'react';
import { BarChart3, FileText, Target } from 'lucide-react';
import DashboardsView from '@/components/insights/DashboardsView';
import ReportsView from '@/components/insights/ReportsView';
import GoalsView from '@/components/insights/GoalsView';

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
        <div className="flex h-full">
            {/* Secondary Contextual Sidebar */}
            <aside className="w-64 bg-background border-r border-border p-4 shrink-0">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-foreground px-3">Insights</h2>
                    <p className="text-xs text-muted-foreground px-3 mt-1">Visualizador de dados do CRM</p>
                </div>

                <nav className="space-y-1">
                    <button
                        onClick={() => setActiveView('dashboards')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeView === 'dashboards'
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                    >
                        <BarChart3 size={18} />
                        Painéis
                    </button>

                    <button
                        onClick={() => setActiveView('reports')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeView === 'reports'
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                    >
                        <FileText size={18} />
                        Relatórios
                    </button>

                    <button
                        onClick={() => setActiveView('goals')}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeView === 'goals'
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                    >
                        <Target size={18} />
                        Metas
                    </button>
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto">
                {renderView()}
            </main>
        </div>
    );
}
