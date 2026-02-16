import { useState } from 'react';
import { Users, Building2, Clock, GitMerge } from 'lucide-react';
import PeopleView from '@/components/contacts/PeopleView';
import OrganizationsView from '@/components/contacts/OrganizationsView';
import TimelineView from '@/components/contacts/TimelineView';
import MergeDuplicatesView from '@/components/contacts/MergeDuplicatesView';

type ContactsSubmenu = 'people' | 'organizations' | 'timeline' | 'merge';

export default function Contacts() {
    const [activeSubmenu, setActiveSubmenu] = useState<ContactsSubmenu>('people');

    const submenus = [
        { id: 'people' as ContactsSubmenu, label: 'Pessoas', icon: Users },
        { id: 'organizations' as ContactsSubmenu, label: 'Organizações', icon: Building2 },
        { id: 'timeline' as ContactsSubmenu, label: 'Linha do Tempo', icon: Clock },
        { id: 'merge' as ContactsSubmenu, label: 'Mesclar Duplicatas', icon: GitMerge },
    ];

    return (
        <div className="h-full flex bg-background">
            {/* Secondary Sidebar (Contextual - Only for Contacts Module) */}
            <aside className="w-56 border-r border-border bg-card/30 flex flex-col shrink-0">
                <div className="p-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Contatos
                    </h2>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    {submenus.map((submenu) => {
                        const Icon = submenu.icon;
                        const isActive = activeSubmenu === submenu.id;
                        return (
                            <button
                                key={submenu.id}
                                onClick={() => setActiveSubmenu(submenu.id)}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                    ${isActive
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-foreground hover:bg-muted/50 hover:text-foreground'
                                    }
                                `}
                            >
                                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                <span>{submenu.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Footer Info */}
                <div className="p-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                        Módulo de gestão de contatos
                    </p>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                {activeSubmenu === 'people' && <PeopleView />}
                {activeSubmenu === 'organizations' && <OrganizationsView />}
                {activeSubmenu === 'timeline' && <TimelineView />}
                {activeSubmenu === 'merge' && <MergeDuplicatesView />}
            </div>
        </div>
    );
}
