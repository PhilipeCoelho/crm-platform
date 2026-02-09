import React, { useState, useEffect, useRef } from 'react';
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
import { useCRM } from '@/contexts/CRMContext';
import PipelineSettingsModal from '@/components/kanban/PipelineSettingsModal';

// function Layout({ children }: { children: React.ReactNode }) { // Old signature
function Layout({ children, currency, setCurrency }: { children: React.ReactNode, currency: Currency, setCurrency: (c: Currency) => void }) {
    const { user, signOut } = useSupabaseAuth();
    const location = useLocation();
    const { setTheme, theme } = useTheme();
    const { isPipelineSettingsOpen, setPipelineSettingsOpen } = useCRM();

    const currentView = location.pathname.includes('contacts') ? 'contacts' :
        location.pathname.includes('activities') ? 'activities' :
            location.pathname.includes('dashboard') ? 'dashboard' : 'pipelines';

    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    // const [selectedCurrency, setSelectedCurrency] = React.useState<Currency>(currencies[0]); // Removed local state

    // Submenu Control
    const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = (menu: string) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredMenu(menu);
        }, 120);
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredMenu(null);
        }, 50);
    };

    // Sidebar State - Auto-Collapsed with Hover Reveal
    const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
        const saved = localStorage.getItem('sidebar_pinned');
        return saved === 'true';
    });
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);

    // Determine sidebar state: auto-collapsed (18px) | hover-icons (60px) | pinned-full (224px)
    const sidebarWidth = isSidebarPinned ? 'w-56' : (isSidebarHovered ? 'w-[60px]' : 'w-[18px]');
    const showIcons = isSidebarPinned || isSidebarHovered;
    const showLabels = isSidebarPinned;

    useEffect(() => {
        localStorage.setItem('sidebar_pinned', String(isSidebarPinned));
    }, [isSidebarPinned]);

    if (!user) return null;

    return (
        <div className="flex h-screen text-foreground overflow-hidden">
            {/* Hover Detection Area - Invisible 20px zone on left edge */}
            <div
                className="absolute left-0 top-0 bottom-0 w-5 z-[45]"
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
            />

            {/* Auto-Collapsed Sidebar with Hover Reveal */}
            <aside
                className={`group flex flex-col py-3 z-50 shrink-0 border-r border-border relative overflow-hidden
                    ${sidebarWidth}
                    ${isSidebarPinned ? 'items-start px-3' : 'items-center'}
                     !bg-white dark:!bg-[#0E1116]
                    !text-slate-900 dark:!text-[#E6E8EB]
                    transition-[width] duration-[180ms] ease-in-out
                    `}
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
            >
                {/* Discrete Floating Toggle Button - Clean UX */}
                <button
                    onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                    className={`fixed left-2 top-1/2 -translate-y-1/2 z-[60] w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all duration-[160ms] ease-out
                        ${isSidebarPinned
                            ? 'bg-white dark:bg-neutral-800/50 opacity-100 shadow-sm'
                            : 'bg-slate-50/90 dark:bg-neutral-800/50 opacity-60 hover:opacity-100'
                        }
                        border border-slate-300/80 dark:border-white/25
                        hover:bg-slate-100 dark:hover:bg-neutral-700/70
                        hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)]
                        hover:scale-105
                        active:scale-95
                    `}
                    title={isSidebarPinned ? "Recolher sidebar" : "Expandir sidebar"}
                >
                    <ChevronRight
                        size={14}
                        strokeWidth={2}
                        className={`text-slate-500 dark:text-slate-300 transition-transform duration-[160ms] ${isSidebarPinned ? 'rotate-180' : 'rotate-0'}`}
                    />
                </button>

                {/* App Logo / Brand */}
                <Link to="/dashboard" className={`mb-6 h-8 flex items-center transition-all duration-[180ms] ${isSidebarPinned ? 'w-full px-2 gap-3' : (showIcons ? 'w-8 justify-center' : 'w-0 opacity-0')}`}>
                    {showIcons && (
                        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0 select-none">
                            CP
                        </div>
                    )}
                    {showLabels && (
                        <span className="font-bold !text-slate-900 dark:!text-white whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">
                            CRM Pro
                        </span>
                    )}
                </Link>

                <nav className="flex-1 flex flex-col w-full space-y-2">
                    <Link to="/dashboard" title={!showLabels ? "Dashboard" : ""}
                        className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-[180ms] min-h-[36px] relative
                        ${isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto rounded-lg' : 'w-0 h-0 opacity-0 pointer-events-none')}
                        ${currentView === 'dashboard'
                                ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-[#E6E8EB] shadow-sm dark:border-l-[3px] dark:border-primary'
                                : 'hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-500 hover:text-slate-900 dark:text-[#9AA4AF] dark:hover:text-[#E6E8EB]'
                            }`}
                    >
                        {showIcons && (
                            <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                <LayoutDashboard strokeWidth={currentView === 'dashboard' ? 2.5 : 2} size={18} />
                            </div>
                        )}
                        {showLabels && (
                            <span className="text-[13px] whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Dashboard</span>
                        )}
                    </Link>

                    <Link to="/pipeline" title={!showLabels ? "Pipeline" : ""}
                        className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-[180ms] min-h-[36px] relative
                        ${isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto rounded-lg' : 'w-0 h-0 opacity-0 pointer-events-none')}
                        ${currentView === 'pipelines'
                                ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-[#E6E8EB] shadow-sm dark:border-l-[3px] dark:border-primary'
                                : 'hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-500 hover:text-slate-900 dark:text-[#9AA4AF] dark:hover:text-[#E6E8EB]'
                            }`}
                    >
                        {showIcons && (
                            <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                <CheckSquare strokeWidth={currentView === 'pipelines' ? 2.5 : 2} size={18} />
                            </div>
                        )}
                        {showLabels && (
                            <span className="text-[13px] whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Pipeline</span>
                        )}
                    </Link>

                    <Link to="/contacts" title={!showLabels ? "Contatos" : ""}
                        className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-[180ms] min-h-[36px] relative
                        ${isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto rounded-lg' : 'w-0 h-0 opacity-0 pointer-events-none')}
                        ${currentView === 'contacts'
                                ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-[#E6E8EB] shadow-sm dark:border-l-[3px] dark:border-primary'
                                : 'hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-500 hover:text-slate-900 dark:text-[#9AA4AF] dark:hover:text-[#E6E8EB]'
                            }`}
                    >
                        {showIcons && (
                            <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                <Users strokeWidth={currentView === 'contacts' ? 2.5 : 2} size={18} />
                            </div>
                        )}
                        {showLabels && (
                            <span className="text-[13px] whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Contatos</span>
                        )}
                    </Link>
                </nav>

                <div className={`flex flex-col w-full space-y-2 mt-auto pb-2 ${isSidebarPinned ? 'items-start' : 'items-center'}`}>
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        title={!showLabels ? "Configurações" : ""}
                        className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-[180ms] min-h-[40px] relative
                        ${isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto rounded-lg' : 'w-0 h-0 opacity-0 pointer-events-none')}
                        ${isSettingsOpen
                                ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-slate-100'
                                : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                    >
                        {showIcons && (
                            <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                <Settings size={20} />
                            </div>
                        )}
                        {showLabels && (
                            <span className="whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Configurações</span>
                        )}
                    </button>

                    <button
                        onClick={() => signOut()}
                        title={!showLabels ? "Sair" : ""}
                        className={`group flex items-center gap-3 rounded-lg hover:bg-slate-100 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 text-slate-500 dark:text-slate-400 transition-all duration-[180ms] min-h-[40px] ${isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto' : 'w-0 h-0 opacity-0 pointer-events-none')}`}
                    >
                        {showIcons && (
                            <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                <LogOut size={20} />
                            </div>
                        )}
                        {showLabels && (
                            <span className="whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Sair</span>
                        )}
                    </button>

                    {/* User Avatar (Mini) */}
                    {showIcons && (
                        <div className={`flex items-center gap-3 mt-2 rounded-md border border-border/10 p-1 bg-slate-50 dark:bg-white/5 ${isSidebarPinned ? 'w-full px-2' : 'w-8 justify-center border-none bg-transparent'}`}>
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                {user.email?.substring(0, 1).toUpperCase() || 'U'}
                            </div>
                            {showLabels && (
                                <div className="flex flex-col overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">
                                    <span className="text-xs font-medium text-slate-900 dark:text-gray-200 truncate" title={user.email}>{user.email}</span>
                                    <span className="text-[10px] text-slate-500 dark:text-gray-500">Usuário</span>
                                    <span className="text-[9px] text-slate-400 dark:text-gray-600 mt-1">v1.3 (Final)</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Settings Popover (Adjusted position) */}
                {isSettingsOpen && (
                    <div className={`fixed bottom-16 w-64 bg-popover dark:bg-[#0E1116] border border-border dark:border-white/10 rounded-lg shadow-xl z-[60] animate-in fade-in zoom-in-95 duration-200 ${isSidebarPinned ? 'left-60' : 'left-16 ml-2'}`}>
                        <div className="p-3 border-b border-border dark:border-white/10">
                            <h3 className="font-medium text-sm text-foreground">Configurações</h3>
                        </div>


                        <div className="p-2 space-y-1">
                            {/* Dashboard Group */}
                            <div
                                className="relative w-full"
                                onMouseEnter={() => handleMouseEnter('dashboard')}
                                onMouseLeave={handleMouseLeave}
                            >
                                <button className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${hoveredMenu === 'dashboard' ? 'bg-slate-100 dark:bg-white/10 text-foreground' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}>
                                    <span className="flex items-center gap-2"><div className="w-1 h-4 bg-primary rounded-full"></div>Dashboard</span>
                                    <ChevronRight size={14} className="text-muted-foreground/70" />
                                </button>
                                {/* Dashboard Submenu */}
                                <div className={`absolute left-full top-0 -ml-1 pl-4 w-44 z-[100] transition-all duration-200 ease-in-out ${hoveredMenu === 'dashboard' ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'}`}>
                                    <div className="bg-popover dark:bg-[#0E1116] border border-border/60 dark:border-white/10 shadow-xl rounded-md p-1">
                                        <button
                                            onClick={() => { setPipelineSettingsOpen(true); setIsSettingsOpen(false); }}
                                            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md text-xs flex items-center gap-2 text-foreground"
                                        >
                                            <Settings size={12} className="text-muted-foreground" />
                                            Editar Funil
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-border my-1 mx-2" />

                            {/* Appearance Group */}
                            <div
                                className="relative w-full"
                                onMouseEnter={() => handleMouseEnter('appearance')}
                                onMouseLeave={handleMouseLeave}
                            >
                                <button className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${hoveredMenu === 'appearance' ? 'bg-slate-100 dark:bg-white/10 text-foreground' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}>
                                    <span className="flex items-center gap-2"><div className="w-1 h-4 bg-primary/30 rounded-full"></div>Aparência</span>
                                    <ChevronRight size={14} className="text-muted-foreground/70" />
                                </button>
                                {/* Appearance Submenu */}
                                <div className={`absolute left-full top-0 -ml-1 pl-4 w-40 z-[100] transition-all duration-200 ease-in-out ${hoveredMenu === 'appearance' ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'}`}>
                                    <div className="bg-popover dark:bg-[#0E1116] border border-border/60 dark:border-white/10 shadow-xl rounded-md p-1">
                                        <button onClick={() => setTheme("light")} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md text-xs flex items-center justify-between text-muted-foreground hover:text-foreground">
                                            <span className="flex items-center gap-2"><Sun size={12} /> Claro</span>
                                            {theme === 'light' && <CheckIcon size={12} className="text-primary" />}
                                        </button>
                                        <button onClick={() => setTheme("dark")} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md text-xs flex items-center justify-between text-muted-foreground hover:text-foreground">
                                            <span className="flex items-center gap-2"><Moon size={12} /> Escuro</span>
                                            {theme === 'dark' && <CheckIcon size={12} className="text-primary" />}
                                        </button>
                                        <button onClick={() => setTheme("system")} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md text-xs flex items-center justify-between text-muted-foreground hover:text-foreground">
                                            <span className="flex items-center gap-2"><Laptop size={12} /> Automático</span>
                                            {theme === 'system' && <CheckIcon size={12} className="text-primary" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Currency Group */}
                            <div
                                className="relative w-full"
                                onMouseEnter={() => handleMouseEnter('currency')}
                                onMouseLeave={handleMouseLeave}
                            >
                                <button className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${hoveredMenu === 'currency' ? 'bg-slate-100 dark:bg-white/10 text-foreground' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}>
                                    <span className="flex items-center gap-2"><div className="w-1 h-4 bg-primary/50 rounded-full"></div>Moedas</span>
                                    <ChevronRight size={14} className="text-muted-foreground/70" />
                                </button>
                                {/* Currency Submenu */}
                                <div className={`absolute left-full bottom-0 top-auto -ml-1 pl-4 w-48 z-[100] origin-bottom-left transition-all duration-200 ease-in-out ${hoveredMenu === 'currency' ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'}`}>
                                    <div className="bg-popover dark:bg-[#0E1116] border border-border/60 dark:border-white/10 shadow-xl rounded-md p-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {currencies.map(c => (
                                            <button key={c.code} onClick={() => { setCurrency(c); setIsSettingsOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md text-xs flex items-center justify-between text-muted-foreground hover:text-foreground"
                                            >
                                                <span>{c.name} ({c.symbol})</span>
                                                {currency.code === c.code && <CheckIcon size={12} className="text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="fixed inset-0 z-[-1]" onClick={() => setIsSettingsOpen(false)} />
                    </div>
                )}

                <PipelineSettingsModal
                    isOpen={isPipelineSettingsOpen}
                    onClose={() => setPipelineSettingsOpen(false)}
                    pipelineId="sales"
                />
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

    // Load currency from localStorage or default to Euro
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => {
        const saved = localStorage.getItem('selected_currency');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Validate that it's a valid currency by checking if it exists in currencies array
                const found = currencies.find(c => c.code === parsed.code);
                return found || currencies[0];
            } catch {
                return currencies[0];
            }
        }
        return currencies[0];
    });

    // Save currency to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('selected_currency', JSON.stringify(selectedCurrency));
    }, [selectedCurrency]);

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
                <Layout currency={selectedCurrency} setCurrency={setSelectedCurrency}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard currency={selectedCurrency} />} />
                        <Route path="/pipeline" element={
                            <div className="h-full w-full flex flex-col">
                                {/* KanbanBoard now handles its own full layout */}
                                <KanbanBoard currency={selectedCurrency} />
                            </div>
                        } />
                        <Route path="/contacts" element={<div className="p-4 h-full max-w-[1500px] mx-auto"><ContactList /></div>} />
                        <Route path="/deals/:id" element={<DealDetails currency={selectedCurrency} />} />
                        <Route path="/companies/:id" element={<CompanyDetails />} />
                        <Route path="/contacts/:id" element={<ContactDetails />} />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </CRMProvider>
    );

}

export default App;
