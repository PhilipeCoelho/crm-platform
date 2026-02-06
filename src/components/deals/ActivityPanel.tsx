import EditActivityModal from '../activities/EditActivityModal';
import { Activity } from '@/types/schema';

// ... (existing imports)

export default function ActivityPanel({ deal, readOnly }: ActivityPanelProps) {
    const { activities, updateActivity, deleteActivity } = useCRM();
    const dealActivities = activities.filter(a => a.dealId === deal.id);
    const [activeTab, setActiveTab] = useState<TabType>('activity');
    const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);

    // ... (sorting logic)

    // ... (tabs definition)

    // ... (handleActivityToggle logic)

    // ... (handleDeleteActivity logic)

    // ... (renderContent logic)

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Tabs Header */}
            {/* ... */}
            <div className="flex items-center gap-1 p-2 border-b border-border overflow-x-auto no-scrollbar bg-card/50">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap
                                      ${isActive
                                    ? 'bg-background shadow-sm text-primary ring-1 ring-border'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="p-4 bg-muted/10 border-b border-border shadow-inner shrink-0">
                {renderContent()}
            </div>

            {/* Activities List (Scrollable) */}
            <div className="flex-1 overflow-y-auto bg-background">
                <div className="p-6 space-y-8">

                    {/* Focus / Planned Section */}
                    {openActivities.length > 0 && (
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    Planejado
                                </h3>
                                <span className="text-xs text-muted-foreground">{openActivities.length} atividades</span>
                            </div>
                            <div className="pl-4 border-l-2 border-green-100 space-y-3">
                                <ActivityList
                                    activities={openActivities}
                                    onToggle={handleActivityToggle}
                                    onDelete={readOnly ? undefined : handleDeleteActivity}
                                    onEdit={readOnly ? undefined : setActivityToEdit}
                                />
                            </div>
                        </section>
                    )}

                    {/* ... (Hint if no planned activities) */}
                    {openActivities.length === 0 && !readOnly && (
                        <div className="p-4 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm flex items-center gap-3">
                            <div className="p-2 bg-yellow-100 rounded-full">
                                <Check size={16} />
                            </div>
                            <div>
                                <p className="font-medium">Tudo limpo por aqui!</p>
                                <p className="text-xs opacity-80">Nenhuma atividade pendente. Que tal agendar o próximo passo acima?</p>
                            </div>
                        </div>
                    )}

                    {/* History Section */}
                    {historyActivities.length > 0 && (
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                                    Histórico
                                </h3>
                            </div>
                            <div className="pl-4 border-l-2 border-border space-y-4 opacity-75 hover:opacity-100 transition-opacity">
                                <Timeline
                                    activities={historyActivities}
                                    onReopen={readOnly ? undefined : handleActivityToggle}
                                    onEdit={readOnly ? undefined : (id, newTitle) => updateActivity(id, { title: newTitle })}
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
