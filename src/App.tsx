import React, { useState, useEffect } from 'react';
import { CRMProvider } from './contexts/CRMContext';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, CheckSquare, Settings, LogOut, ChevronRight, CheckSquare as CheckIcon, Loader2, Moon, Sun, Laptop } from 'lucide-react';
import { useTheme } from "@/components/theme-provider"
import KanbanBoard from '@/components/kanban/KanbanBoard';
import ContactList from '@/components/contacts/ContactList';
import Login from '@/pages/Login';
import { currencies, Currency } from '@/data/currencies';
import DealDetails from '@/pages/DealDetails';
import CompanyDetails from '@/pages/CompanyDetails';
import ContactDetails from '@/pages/ContactDetails';
import Dashboard from '@/pages/Dashboard';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

function Layout({ children }: { children: React.ReactNode }) {
    const { user, signOut } = useSupabaseAuth();
    const location = useLocation();
    const { setTheme, theme } = useTheme();

    const currentView = location.pathname.includes('contacts') ? 'contacts' :
        location.pathname.includes('activities') ? 'activities' :
            location.pathname.includes('dashboard') ? 'dashboard' : 'pipelines';

    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [isCurrencySubmenuOpen, setIsCurrencySubmenuOpen] = React.useState(false);
    const [selectedCurrency, setSelectedCurrency] = React.useState<Currency>(currencies[0]);

    // Sidebar State
    const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
        const saved = localStorage.getItem('sidebar_pinned');
        return saved === 'true';
    });
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);
    const isSidebarExpanded = isSidebarPinned || isSidebarHovered;

    useEffect(() => {
        localStorage.setItem('sidebar_pinned', String(isSidebarPinned));
    }, [isSidebarPinned]);

    if (!user) return null;

    return (
        <div className="flex h-screen text-foreground overflow-hidden">
            {/* Expandable Sidebar */}
            <aside
                className={`group flex flex-col items-center py-3 z-50 shrink-0 border-r border-[color:var(--border)] transition-all duration-300 ease-in-out relative
                    ${isSidebarExpanded ? 'w-56 items-start px-3' : 'w-14 items-center'}
                     bg-background dark:bg-[rgba(9,12,18,0.65)] dark:backdrop-blur-md
                    text-foreground dark:text-gray-200
                    `}
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
            >
                {/* Pin/Unpin Toggle Button */}
                {isSidebarExpanded && (
                    <button
                        onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                        className={`absolute right-2 top-3 p-1 rounded-md hover:bg-muted dark:hover:bg-white/10 text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-white transition-colors ${isSidebarPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        title={isSidebarPinned ? "Desafixar barra lateral" : "Fixar barra lateral"}
                    >
                        {isSidebarPinned ? <ChevronRight size={14} className="rotate-180" /> : <div className="w-2 h-2 rounded-full border-2 border-current" />}
                    </button>
                )}

                {/* App Logo / Brand */}
                <Link to="/dashboard" className={`mb-6 h-8 flex items-center transition-all duration-300 ${isSidebarExpanded ? 'w-full px-2 gap-3' : 'w-8 justify-center'}`}>
                    <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0 select-none">
                        CP
                    </div>
                    <span className={`font-bold text-foreground dark:text-white whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
                        CRM Pro
                    </span>
                </Link>

                <nav className="flex-1 flex flex-col w-full space-y-2">
                    <Link to="/dashboard" title={!isSidebarExpanded ? "Dashboard" : ""}
                        className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-200 min-h-[40px] relative
                        ${isSidebarExpanded ? 'px-3 w-full justify-start' : 'justify-center w-10 mx-auto rounded-lg'}
                        ${currentView === 'dashboard'
                                ? 'bg-muted dark:bg-[#1A2230] text-foreground dark:text-white shadow-sm dark:border-l-[3px] dark:border-[#4F7CFF]'
                                : 'hover:bg-muted dark:hover:bg-[#151C25] text-muted-foreground hover:text-foreground dark:text-[#9BA7B4] dark:hover:text-[#E6EDF3]'
                            }`}
                    >
                        <div className="shrink-0 flex items-center justify-center w-5 h-5">
                            <LayoutDashboard strokeWidth={currentView === 'dashboard' ? 2.5 : 2} size={20} />
                        </div>
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto delay-75' : 'opacity-0 w-0'}`}>Dashboard</span>
                    </Link>

                    <Link to="/pipeline" title={!isSidebarExpanded ? "Pipeline" : ""}
                        className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-200 min-h-[40px] relative
                        ${isSidebarExpanded ? 'px-3 w-full justify-start' : 'justify-center w-10 mx-auto rounded-lg'}
                        ${currentView === 'pipelines'
                                ? 'bg-muted dark:bg-[#1A2230] text-foreground dark:text-white shadow-sm dark:border-l-[3px] dark:border-[#4F7CFF]'
                                : 'hover:bg-muted dark:hover:bg-[#151C25] text-muted-foreground hover:text-foreground dark:text-[#9BA7B4] dark:hover:text-[#E6EDF3]'
                            }`}
                    >
                        <div className="shrink-0 flex items-center justify-center w-5 h-5">
                            <CheckSquare strokeWidth={currentView === 'pipelines' ? 2.5 : 2} size={20} />
                        </div>
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto delay-75' : 'opacity-0 w-0'}`}>Pipeline</span>
                    </Link>

                    <Link to="/contacts" title={!isSidebarExpanded ? "Contatos" : ""}
                        className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-200 min-h-[40px] relative
                        ${isSidebarExpanded ? 'px-3 w-full justify-start' : 'justify-center w-10 mx-auto rounded-lg'}
                        ${currentView === 'contacts'
                                ? 'bg-[#26292c] dark:bg-[#1A2230] text-white shadow-sm dark:border-l-[3px] dark:border-[#4F7CFF]'
                                : 'hover:bg-[#26292c] dark:hover:bg-[#151C25] text-gray-400 hover:text-white dark:text-[#9BA7B4] dark:hover:text-[#E6EDF3]'
                            }`}
                    >
                        <div className="shrink-0 flex items-center justify-center w-5 h-5">
                            <Users strokeWidth={currentView === 'contacts' ? 2.5 : 2} size={20} />
                        </div>
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto delay-75' : 'opacity-0 w-0'}`}>Contatos</span>
                    </Link>
                </nav>

                <div className={`flex flex-col w-full space-y-2 mt-auto pb-2 ${isSidebarExpanded ? 'items-start' : 'items-center'}`}>
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        title={!isSidebarExpanded ? "Configurações" : ""}
                        className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-200 min-h-[40px] relative
                        ${isSidebarExpanded ? 'px-3 w-full justify-start' : 'justify-center w-10 mx-auto rounded-lg'}
                        ${isSettingsOpen
                                ? 'bg-muted dark:bg-[#1A2230] text-foreground dark:text-white'
                                : 'hover:bg-muted dark:hover:bg-[#151C25] text-muted-foreground hover:text-foreground dark:text-[#9BA7B4] dark:hover:text-[#E6EDF3]'
                            }`}
                    >
                        <div className="shrink-0 flex items-center justify-center w-5 h-5">
                            <Settings size={20} />
                        </div>
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto delay-75' : 'opacity-0 w-0'}`}>Configurações</span>
                    </button>

                    <button
                        onClick={() => signOut()}
                        title={!isSidebarExpanded ? "Sair" : ""}
                        className={`group flex items-center gap-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 text-muted-foreground dark:text-gray-400 transition-all duration-200 min-h-[40px] ${isSidebarExpanded ? 'px-3 w-full justify-start' : 'justify-center w-10 mx-auto'}`}
                    >
                        <div className="shrink-0 flex items-center justify-center w-5 h-5">
                            <LogOut size={20} />
                        </div>
                        <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto delay-75' : 'opacity-0 w-0'}`}>Sair</span>
                    </button>

                    {/* User Avatar (Mini) */}
                    <div className={`flex items-center gap-3 mt-2 rounded-md border border-border/10 p-1 bg-muted/50 dark:bg-white/5 ${isSidebarExpanded ? 'w-full px-2' : 'w-8 justify-center border-none bg-transparent'}`}>
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                            {user.email?.substring(0, 1).toUpperCase() || 'U'}
                        </div>
                        <div className={`flex flex-col overflow-hidden transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
                            <span className="text-xs font-medium text-foreground dark:text-gray-200 truncate" title={user.email}>{user.email}</span>
                            <span className="text-[10px] text-muted-foreground dark:text-gray-500">Usuário</span>
                        </div>
                    </div>
                </div>

                {/* Settings Popover (Adjusted position) */}
                {isSettingsOpen && (
                    <div className={`fixed bottom-16 w-64 bg-popover border border-border rounded-lg shadow-xl z-[60] animate-in fade-in zoom-in-95 duration-200 ${isSidebarExpanded ? 'left-60' : 'left-16 ml-2'}`}>
                        <div className="p-3 border-b border-border">
                            <h3 className="font-medium text-sm">Configurações</h3>
                        </div>

                        <div className="p-2 space-y-2">
                            {/* Theme Selector */}
                            <div className="px-2 py-1">
                                <label className="text-xs text-muted-foreground font-medium mb-1 block">Aparência</label>
                                <div className="flex bg-muted/50 p-1 rounded-lg">
                                    <button onClick={() => setTheme("light")} className={`flex-1 flex items-center justify-center p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`} title="Claro">
                                        <Sun size={14} />
                                    </button>
                                    <button onClick={() => setTheme("dark")} className={`flex-1 flex items-center justify-center p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`} title="Escuro">
                                        <Moon size={14} />
                                    </button>
                                    <button onClick={() => setTheme("system")} className={`flex-1 flex items-center justify-center p-1.5 rounded-md transition-all ${theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`} title="Automático">
                                        <Laptop size={14} />
                                    </button>
                                </div>
                            </div>

                            <button onClick={() => setIsCurrencySubmenuOpen(!isCurrencySubmenuOpen)} className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors">
                                <span className="flex items-center gap-2"><div className="w-1 h-4 bg-primary/50 rounded-full"></div>Moedas</span>
                                <ChevronRight size={14} />
                            </button>
                            {isCurrencySubmenuOpen && (
                                <div className="mt-1 pl-2 space-y-0.5">
                                    {currencies.map(c => (
                                        <button key={c.code} onClick={() => { setSelectedCurrency(c); setIsSettingsOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-muted rounded-md text-xs flex items-center justify-between text-muted-foreground hover:text-foreground"
                                        >
                                            <span>{c.name} ({c.symbol})</span>
                                            {selectedCurrency.code === c.code && <CheckIcon size={12} className="text-primary" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="fixed inset-0 z-[-1]" onClick={() => setIsSettingsOpen(false)} />
                    </div>
                )}
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {/* No Global Header - Views define their own toolbars */}
                <div className="flex-1 overflow-hidden">
                    <div className="h-full w-full max-w-[1700px] mx-auto flex flex-col">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}

function App() {
    const { user, loading } = useSupabaseAuth();
    const [selectedCurrency] = useState<Currency>(currencies[0]);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!user) {
        // onLogin is handled by the auth state change in useSupabaseAuth, 
        // which triggers a re-render here with user present.
        return <Login onLogin={() => { }} />;
    }

    return (
        <CRMProvider>
            <BrowserRouter>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/pipeline" element={
                            <div className="h-full w-full flex flex-col">
                                {/* KanbanBoard now handles its own full layout */}
                                <KanbanBoard currency={selectedCurrency} />
                            </div>
                        } />
                        <Route path="/contacts" element={<div className="p-4 h-full max-w-[1500px] mx-auto"><ContactList /></div>} />
                        <Route path="/deals/:id" element={<DealDetails />} />
                        <Route path="/companies/:id" element={<CompanyDetails />} />
                        <Route path="/contacts/:id" element={<ContactDetails />} />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </CRMProvider>
    );
}

export default App;
