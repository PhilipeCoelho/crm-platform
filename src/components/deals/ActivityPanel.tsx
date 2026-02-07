import { useState } from 'react';
import { Deal, Activity } from '@/types/schema';
import { CheckSquare, FileText, Calendar, Phone, Mail, File, FileCode, Receipt, Check } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import Timeline from '../activities/Timeline';
import ActivityList from '../activities/ActivityList';
import EditActivityModal from '../activities/EditActivityModal';

// Tab Components
import ActivityTab from './tabs/ActivityTab';
import NoteTab from './tabs/NoteTab';
import CallTab from './tabs/CallTab';
import EmailTab from './tabs/EmailTab';
import MeetingTab from './tabs/MeetingTab';
import FilesTab from './tabs/FilesTab';

interface ActivityPanelProps {
    deal: Deal;
    readOnly?: boolean;
}

type TabType = 'activity' | 'note' | 'meeting' | 'call' | 'email' | 'files' | 'documents' | 'invoice';

export default function ActivityPanel({ deal, readOnly }: ActivityPanelProps) {
    const { activities, updateActivity, deleteActivity } = useCRM();
    const dealActivities = activities.filter(a => a.dealId === deal.id);
    const [activeTab, setActiveTab] = useState<TabType>('activity');
    const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);

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
        { id: 'meeting', label: 'Agendador', icon: Calendar },
        { id: 'call', label: 'Chamada', icon: Phone },
        { id: 'email', label: 'E-mail', icon: Mail },
        { id: 'files', label: 'Arquivos', icon: File },
        { id: 'documents', label: 'Documentos', icon: FileCode },
        { id: 'invoice', label: 'Fatura', icon: Receipt },
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

    const renderContent = () => {
        if (readOnly) {
            return (
                <div className="p-6 text-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                    <p className="text-muted-foreground font-medium">Este negócio está fechado.</p>
                    <p className="text-xs text-muted-foreground">Reabra o negócio para adicionar novas atividades.</p>
                </div>
            );
        }

        switch (activeTab) {
            case 'activity': return <ActivityTab deal={deal} />;
            case 'note': return <NoteTab deal={deal} />;
            case 'meeting': return <MeetingTab deal={deal} />;
            case 'call': return <CallTab deal={deal} />;
            case 'email': return <EmailTab deal={deal} />;
            case 'files': return <FilesTab deal={deal} />;
            case 'documents':
            case 'invoice':
                return (
                    <div className="p-8 text-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                        <p className="text-muted-foreground">Funcionalidade de {activeTab === 'documents' ? 'Documentos' : 'Faturas'} em breve.</p>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Tabs Header */}
            <div className="flex items-center gap-4 px-4 border-b border-border overflow-x-auto no-scrollbar bg-background">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2
                                      ${isActive
                                    ? 'border-primary text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="p-4 border-b border-border shrink-0">
                {renderContent()}
            </div>

            {/* Activities List (Scrollable) */}
            <div className="flex-1 overflow-y-auto bg-background">
                <div className="p-4 space-y-6">

                    {/* Focus / Planned Section */}
                    {openActivities.length > 0 && (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
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

                    {/* Hint if no planned activities */}
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
