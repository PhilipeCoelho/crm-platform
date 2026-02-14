import { useState } from 'react';
import { Deal, Activity } from '@/types/schema';
import { CheckSquare, FileText, Mail, File } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import Timeline from '../activities/Timeline';
import ActivityList from '../activities/ActivityList';
import EditActivityModal from '../activities/EditActivityModal';

// Tab Components
import ActivityTab from './tabs/ActivityTab';
import NoteTab from './tabs/NoteTab';
import EmailTab from './tabs/EmailTab';
import FilesTab from './tabs/FilesTab';

interface ActivityPanelProps {
    deal: Deal;
    readOnly?: boolean;
}

type TabType = 'activity' | 'note' | 'email' | 'files';

export default function ActivityPanel({ deal, readOnly }: ActivityPanelProps) {
    const { activities, updateActivity, deleteActivity } = useCRM();
    const dealActivities = activities.filter(a => a.dealId === deal.id);
    const [activeTab, setActiveTab] = useState<TabType>('activity');
    const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Sort: Open (Due date asc), Completed (Created/Completed date desc)
    const openActivities = dealActivities
        .filter(a => !a.completed)
        .sort((a, b) => new Date(a.dueDate || a.createdAt).getTime() - new Date(b.dueDate || b.createdAt).getTime());

    const historyActivities = dealActivities
        .filter(a => a.completed)
        .sort((a, b) => new Date(b.dueDate || b.createdAt).getTime() - new Date(a.dueDate || a.createdAt).getTime());

    const tabs = [
        { id: 'activity', label: 'Atividade', icon: CheckSquare },
        { id: 'note', label: 'Anotações', icon: FileText },
        { id: 'email', label: 'E-mail', icon: Mail },
        { id: 'files', label: 'Arquivos', icon: File },
    ];

    const handleActivityToggle = (id: string) => {
        const activity = dealActivities.find(a => a.id === id);
        if (!activity) return;

        const newStatus = !activity.completed;
        updateActivity(id, { completed: newStatus });

        // Automated Follow-up Trigger
        if (newStatus === true) {
            const remaining = openActivities.filter(a => a.id !== id).length;
            if (remaining === 0) {
                if (activeTab === 'note' || activeTab === 'files') {
                    setActiveTab('activity');
                }
            }
        }
    };

    const handleDeleteActivity = (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir esta atividade?')) {
            deleteActivity(id);
        }
    };

    const handleTabClick = (tabId: TabType) => {
        if (activeTab === tabId && !isCollapsed) {
            setIsCollapsed(true);
        } else {
            setActiveTab(tabId);
            setIsCollapsed(false);
        }
    };

    const renderContent = () => {
        if (readOnly) {
            return (
                <div className="p-6 text-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                    <p className="text-muted-foreground font-medium">Este negócio está fechado.</p>
                    <p className="text-xs text-muted-foreground">Reabra o negócio para adicionar novas atividades.</p>
                </div>
            );
        }

        if (isCollapsed) return null;

        switch (activeTab) {
            case 'activity': return <ActivityTab deal={deal} />;
            case 'note': return <NoteTab deal={deal} />;
            case 'email': return <EmailTab deal={deal} />;
            case 'files': return <FilesTab deal={deal} />;
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Tabs Header - FOCADO EM OPERAÇÃO */}
            <div className="flex items-center gap-1 sm:gap-6 px-1 sm:px-1 border-b border-border dark:border-slate-800 overflow-x-auto no-scrollbar bg-transparent">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    const isShowingContent = isActive && !isCollapsed;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id as TabType)}
                            className={`relative py-3.5 sm:py-2.5 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] transition-all whitespace-nowrap flex-1 sm:flex-none flex flex-col items-center gap-2
                                      ${isShowingContent
                                    ? 'text-indigo-500 dark:text-indigo-400'
                                    : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'
                                }`}
                        >
                            <span className="px-1">{tab.label}</span>
                            <div className={`absolute bottom-0 left-0 w-full h-[1.5px] transition-all duration-200 ${isShowingContent ? 'bg-indigo-500 dark:bg-indigo-400 opacity-100' : 'bg-transparent opacity-0'}`} />
                        </button>
                    );
                })}
            </div>

            {/* Content Area - ÁREA DE AÇÃO (Expansion behavior) */}
            <div className={`
                bg-background dark:bg-slate-800/20 rounded-xl border border-border dark:border-slate-700/50 shadow-sm overflow-hidden transition-all duration-300
                ${isCollapsed ? 'max-h-0 border-none mt-0' : 'max-h-[800px] mt-4 opacity-100'}
            `}>
                <div className="p-0">
                    {renderContent()}
                </div>
            </div>


            {/* Activities List (Scrollable) - HISTÓRICO EM TIMELINE */}
            <div className="flex-1 mt-10">
                <div className="space-y-10">

                    {/* Focus / Planned Section */}
                    {openActivities.length > 0 && (
                        <section>
                            <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                Atividades Planejadas
                            </h3>
                            <div className="space-y-0 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                                <ActivityList
                                    activities={openActivities}
                                    onToggle={handleActivityToggle}
                                    onDelete={readOnly ? undefined : handleDeleteActivity}
                                    onEdit={readOnly ? undefined : setActivityToEdit}
                                />
                            </div>
                        </section>
                    )}

                    {/* Hint if no planned activities - REMOVED AS REQUESTED */}

                    {/* History Section - TIMELINE LIMPA */}
                    {historyActivities.length > 0 && (
                        <section>
                            <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                Histórico do Negócio
                            </h3>
                            <div className="space-y-0 relative before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                                <Timeline
                                    activities={historyActivities}
                                    onReopen={readOnly ? undefined : handleActivityToggle}
                                    onEdit={readOnly ? undefined : (id, newTitle) => updateActivity(id, { title: newTitle })}
                                    onDelete={readOnly ? undefined : handleDeleteActivity}
                                />
                            </div>
                        </section>
                    )}
                </div>
            </div>


            {/* Edit Modal */}
            <EditActivityModal
                isOpen={!!activityToEdit}
                onClose={() => setActivityToEdit(null)}
                deal={deal}
                activity={activityToEdit}
                onUpdate={updateActivity}
            />
        </div>
    );
}
