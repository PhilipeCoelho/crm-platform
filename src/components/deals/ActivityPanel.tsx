import { useState } from 'react';
import { isBefore, isToday, startOfToday, parseISO } from 'date-fns';
import { Deal, Activity } from '@/types/schema';
import { CheckSquare, FileText, Mail, File } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import Timeline from '../activities/Timeline';
import ActivityList from '../activities/ActivityList';
import EditActivityModal from '../activities/EditActivityModal';
import CompleteActivityModal from '../activities/CompleteActivityModal';

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
    const { activities, logs, updateActivity, deleteActivity, deleteLog } = useCRM();
    const dealActivities = activities.filter(a => a.dealId === deal.id);
    const dealLogs = logs.filter(l => l.dealId === deal.id);
    const [activeTab, setActiveTab] = useState<TabType>('activity');
    const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);
    const [activityToComplete, setActivityToComplete] = useState<Activity | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activityFilter, setActivityFilter] = useState<'all' | 'overdue' | 'today' | 'future'>('all');

    // Filter by period logic
    const today = startOfToday();
    const isOverdue = (dateStr?: string) => dateStr && isBefore(parseISO(dateStr), today);
    const isTodayActivity = (dateStr?: string) => dateStr && isToday(parseISO(dateStr));
    const isFuture = (dateStr?: string) => !dateStr || (!isBefore(parseISO(dateStr), today) && !isToday(parseISO(dateStr)));

    // Sort: Open (Due date asc), Completed (Created/Completed date desc)
    const openActivities = dealActivities
        .filter(a => !a.completed)
        .filter(a => {
            if (activityFilter === 'all') return true;
            if (activityFilter === 'overdue') return isOverdue(a.dueDate);
            if (activityFilter === 'today') return isTodayActivity(a.dueDate);
            if (activityFilter === 'future') return isFuture(a.dueDate);
            return true;
        })
        .sort((a, b) => new Date(a.dueDate || a.createdAt).getTime() - new Date(b.dueDate || b.createdAt).getTime());

    const historyActivities = dealActivities
        .filter(a => a.completed)
        .sort((a, b) => new Date(b.completedAt || b.dueDate || b.createdAt).getTime() - new Date(a.completedAt || a.dueDate || a.createdAt).getTime());

    const tabs = [
        { id: 'activity', label: 'Atividades', icon: CheckSquare },
        { id: 'note', label: 'Anotações', icon: FileText },
        { id: 'files', label: 'Anexos', icon: File },
        { id: 'email', label: 'E-mail', icon: Mail },
    ];

    const handleActivityToggle = (id: string) => {
        const activity = dealActivities.find(a => a.id === id);
        if (!activity) return;

        if (!activity.completed) {
            // Opening Modal for completion notes
            setActivityToComplete(activity);
        } else {
            // Just reopening
            updateActivity(id, { completed: false, status: 'pending' });
        }
    };

    const handleDeleteActivity = (id: string) => {
        // Resolve if it's an activity or a log
        const isActivity = activities.some(a => a.id === id);
        if (isActivity) {
            deleteActivity(id);
        } else {
            deleteLog(id);
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
            <div className="flex items-center gap-1 sm:gap-4 px-0.5 border-b border-border dark:border-border/60 overflow-x-auto no-scrollbar bg-transparent">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    const isShowingContent = isActive && !isCollapsed;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id as TabType)}
                            className={`relative py-1.5 sm:py-1 text-[9px] sm:text-[9px] font-bold uppercase tracking-[0.05em] transition-all whitespace-nowrap flex-1 sm:flex-none flex flex-col items-center gap-0.5
                                      ${isShowingContent
                                    ? 'text-primary dark:text-primary'
                                    : 'text-muted-foreground/60 dark:text-muted-foreground/40 hover:text-foreground dark:hover:text-foreground/80'
                                }`}
                        >
                            <span className="px-0.5">{tab.label}</span>
                            <div className={`absolute bottom-0 left-0 w-full h-[1.5px] transition-all duration-200 ${isShowingContent ? 'bg-primary dark:bg-primary opacity-100' : 'bg-transparent opacity-0'}`} />
                        </button>
                    );
                })}
            </div>

            {/* Content Area - ÁREA DE AÇÃO (Expansion behavior) */}
            <div className={`
                bg-white/50 dark:bg-card/40 rounded-xl border border-border dark:border-border shadow-sm overflow-hidden transition-all duration-300
                ${isCollapsed ? 'max-h-0 border-none mt-0' : 'max-h-[800px] mt-2 opacity-100'}
            `}>
                <div className="p-0">
                    {renderContent()}
                </div>
            </div>


            {/* Activities List (Scrollable) - HISTÓRICO EM TIMELINE */}
            <div className="flex-1 mt-4">
                <div className="space-y-4">

                    {/* Focus / Planned Section */}
                    {(dealActivities.filter(a => !a.completed).length > 0) && (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-[8px] font-bold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                    Atividades Planejadas
                                </h3>
                                
                                {/* Filtros */}
                                <div className="flex bg-muted/20 dark:bg-muted/10 p-0.5 rounded-lg border border-border/50">
                                    <button 
                                        onClick={() => setActivityFilter('all')} 
                                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${activityFilter === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground/60 hover:text-foreground'}`}
                                    >Todas</button>
                                    <button 
                                        onClick={() => setActivityFilter('overdue')} 
                                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${activityFilter === 'overdue' ? 'bg-destructive/10 text-destructive shadow-sm' : 'text-muted-foreground/60 hover:text-destructive'}`}
                                    >Atrasadas</button>
                                    <button 
                                        onClick={() => setActivityFilter('today')} 
                                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${activityFilter === 'today' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground/60 hover:text-primary'}`}
                                    >Hoje</button>
                                    <button 
                                        onClick={() => setActivityFilter('future')} 
                                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${activityFilter === 'future' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground/60 hover:text-foreground'}`}
                                    >Futuras</button>
                                </div>
                            </div>

                            {openActivities.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic pl-3 border-l-2 border-border/50">Nenhuma atividade neste filtro.</p>
                            ) : (
                                <div className="space-y-0 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-muted dark:before:bg-border">
                                    <ActivityList
                                        activities={openActivities}
                                        onToggle={handleActivityToggle}
                                        onDelete={readOnly ? undefined : handleDeleteActivity}
                                        onEdit={readOnly ? undefined : setActivityToEdit}
                                    />
                                </div>
                            )}
                        </section>
                    )}

                    {/* Hint if no planned activities - REMOVED AS REQUESTED */}

                    {/* History Section - TIMELINE LIMPA */}
                    {historyActivities.length > 0 && (
                        <section>
                            <h3 className="text-[8px] font-bold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted dark:bg-muted/40" />
                                Histórico do Negócio
                            </h3>
                            <div className="space-y-0 relative before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-0.5 before:bg-muted dark:before:bg-border">
                                <Timeline
                                    activities={historyActivities}
                                    logs={dealLogs}
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

            <CompleteActivityModal
                isOpen={!!activityToComplete}
                onClose={() => setActivityToComplete(null)}
                activity={activityToComplete}
            />
        </div>
    );
}
