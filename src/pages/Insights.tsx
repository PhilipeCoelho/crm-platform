import { InsightsProvider } from '@/contexts/InsightsContext';
import InsightsFilter from '@/components/insights/InsightsFilter';
import DashboardsView from '@/components/insights/DashboardsView';

export default function Insights() {
    return (
        <InsightsProvider>
            <div className="flex h-full w-full bg-[#F7F9FC] dark:bg-[#0B1220]">
                {/* Main Content Area */}
                <main className="flex-1 flex flex-col overflow-hidden w-full">
                    <InsightsFilter />
                    <div className="flex-1 overflow-auto w-full">
                        <DashboardsView />
                    </div>
                </main>
            </div>
        </InsightsProvider>
    );
}
