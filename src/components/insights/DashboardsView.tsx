import { useState, useEffect } from 'react';
import ExecutiveSummary from './ExecutiveSummary';
import StrategicDiagnostics from './StrategicDiagnostics';
import FunnelModule from './FunnelModule';
import ActivityModule from './ActivityModule';
import IntensityModule from './IntensityModule';
import TimingModule from './TimingModule';
import ChannelModule from './ChannelModule';
import LostModule from './LostModule';

export type DashboardTabId = 'resumo' | 'execucao' | 'velocidade' | 'canais' | 'perdas';

interface DashboardsViewProps {
    activeTab: DashboardTabId;
}

export default function DashboardsView({ activeTab }: DashboardsViewProps) {
    const [activeGuide, setActiveGuide] = useState<string | null>(null);

    // Reset guide when tab changes
    useEffect(() => {
        setActiveGuide(null);
    }, [activeTab]);

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#F7F9FC] dark:bg-[#0D0D0D]">
            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="max-w-[1200px] mx-auto pb-24 px-6 pt-8 flex flex-col gap-12">

                    {activeTab === 'resumo' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                            <StrategicDiagnostics />
                            <ExecutiveSummary activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                            <FunnelModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                        </div>
                    )}

                    {activeTab === 'execucao' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                            <ActivityModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                            <IntensityModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                        </div>
                    )}

                    {activeTab === 'velocidade' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                            <TimingModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                        </div>
                    )}

                    {activeTab === 'canais' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                            <ChannelModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                        </div>
                    )}

                    {activeTab === 'perdas' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                            <LostModule activeGuide={activeGuide} setActiveGuide={setActiveGuide} />
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
