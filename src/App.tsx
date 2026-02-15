import React, { useState, useEffect } from 'react';
import { CRMProvider } from './contexts/CRMContext';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, CheckSquare, Settings, LogOut, ChevronRight, CheckSquare as CheckIcon, Loader2, Moon, Sun, Laptop, Menu, X, CalendarDays } from 'lucide-react';
import { useIsMobile } from '@/hooks/useMediaQuery';
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
import NewDealModal from '@/components/kanban/NewDealModal';
import Activities from './pages/Activities';
import { PrivacyToggle } from '@/components/ui/PrivacyToggle';
import { PrivacyBanner } from '@/components/ui/PrivacyBanner';

function Layout({ children, currency, setCurrency }: { children: React.ReactNode, currency: Currency, setCurrency: (c: Currency) => void }) {
    const { user, signOut } = useSupabaseAuth();
    const location = useLocation();
    const { setTheme, theme } = useTheme();
    const { isPipelineSettingsOpen, setPipelineSettingsOpen, activeFocusDealId, closeFocusDeal, togglePrivacyMode } = useCRM();
    const isMobile = useIsMobile();

    // Check if we are in Focus Mode (Deal/Contact/Company Detail)
    const isFocusRoute = location.pathname.includes('/deals/') ||
        location.pathname.includes('/contacts/') ||
        location.pathname.includes('/companies/');
    const isDealFocusOpen = !!activeFocusDealId || isFocusRoute;

    const currentView = location.pathname.includes('contacts') ? 'contacts' :
        location.pathname.includes('activities') ? 'activities' :
            location.pathname.includes('dashboard') ? 'dashboard' : 'pipelines';

    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

    // Mobile Menu State
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Submenu Control (Click-based toggle)
    const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

    const toggleSubmenu = (menu: string) => {
        setActiveSubmenu(prev => prev === menu ? null : menu);
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

    // Keyboard Shortcut (Cmd+Shift+P)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
                e.preventDefault();
                togglePrivacyMode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePrivacyMode]);

    if (!user) return null;

    return (
        <div className={`flex h-full w-full text-foreground overflow-hidden ${isDealFocusOpen ? 'bg-black/5' : ''}`}>
            {/* Mobile Header - Hidden in focus mode */}
            {isMobile && !isDealFocusOpen && (
                <div className="fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-40 flex items-center px-4">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        aria-label="Abrir menu"
                    >
                        <Menu size={20} className="text-foreground" />
                    </button>
                    <span className="ml-3 font-semibold text-foreground">CRM Pro</span>
                </div>
            )}

            {/* Mobile Overlay */}
            {isMobile && isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[60] animate-in fade-in duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Hover Detection Area - Invisible 5px zone on left edge (Desktop only) */}
            {!isMobile && !isDealFocusOpen && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-5 z-[45]"
                    onMouseEnter={() => setIsSidebarHovered(true)}
                    onMouseLeave={() => setIsSidebarHovered(false)}
                />
            )}

            {/* Sidebar - Hidden in focus mode */}
            {!isDealFocusOpen && (
                <aside
                    className={`group flex flex-col py-3 z-[70] overflow-y-auto overflow-x-hidden !bg-white dark:!bg-[#0E1116] !text-slate-900 dark:!text-[#E6E8EB] h-full
                        ${isMobile
                            ? `fixed top-0 left-0 bottom-0 w-64 px-3 items-start shadow-2xl transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                            }`
                            : `relative shrink-0 border-r border-border transition-[width] duration-[180ms] ease-in-out ${sidebarWidth} ${isSidebarPinned ? 'items-start px-3' : 'items-center'}`
                        }
                        `}
                    onMouseEnter={() => !isMobile && setIsSidebarHovered(true)}
                    onMouseLeave={() => !isMobile && setIsSidebarHovered(false)}
                >
                    {/* Mobile Close Button */}
                    {isMobile && (
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="self-end p-2 hover:bg-muted rounded-lg mb-2 transition-colors"
                            aria-label="Fechar menu"
                        >
                            <X size={20} className="text-foreground" />
                        </button>
                    )}

                    {/* Discrete Floating Toggle Button - Desktop Only */}
                    {!isMobile && (
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
                    )}

                    {/* App Logo / Brand */}
                    <Link
                        to="/dashboard"
                        onClick={() => isMobile && setIsMobileMenuOpen(false)}
                        className={`mb-6 h-8 flex items-center transition-all duration-[180ms] ${isMobile ? 'w-full px-2 gap-3' : (isSidebarPinned ? 'w-full px-2 gap-3' : (showIcons ? 'w-8 justify-center' : 'w-0 opacity-0'))
                            }`}
                    >
                        {(showIcons || isMobile) && (
                            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-semibold text-xs shrink-0 select-none">
                                CP
                            </div>
                        )}
                        {(showLabels || isMobile) && (
                            <span className="font-semibold !text-slate-900 dark:!text-white whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">
                                CRM Pro
                            </span>
                        )}
                    </Link>

                    <nav className="flex-1 flex flex-col w-full space-y-2">
                        <Link
                            to="/dashboard"
                            onClick={() => isMobile && setIsMobileMenuOpen(false)}
                            title={!showLabels && !isMobile ? "Dashboard" : ""}
                            className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-[180ms] min-h-[36px] relative
                        ${isMobile ? 'px-3 w-full justify-start' : (isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto rounded-lg' : 'w-0 h-0 opacity-0 pointer-events-none'))}
                        ${currentView === 'dashboard'
                                    ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-[#E6E8EB] shadow-sm dark:border-l-[3px] dark:border-primary'
                                    : 'hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-500 hover:text-slate-900 dark:text-[#9AA4AF] dark:hover:text-[#E6E8EB]'
                                }`}
                        >
                            {(showIcons || isMobile) && (
                                <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                    <LayoutDashboard strokeWidth={currentView === 'dashboard' ? 2.5 : 2} size={18} />
                                </div>
                            )}
                            {(showLabels || isMobile) && (
                                <span className="text-[13px] whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Dashboard</span>
                            )}
                        </Link>

                        <Link
                            to="/pipeline"
                            onClick={() => isMobile && setIsMobileMenuOpen(false)}
                            title={!showLabels && !isMobile ? "Pipeline" : ""}
                            className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-[180ms] min-h-[36px] relative
                        ${isMobile ? 'px-3 w-full justify-start' : (isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto rounded-lg' : 'w-0 h-0 opacity-0 pointer-events-none'))}
                        ${currentView === 'pipelines'
                                    ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-[#E6E8EB] shadow-sm dark:border-l-[3px] dark:border-primary'
                                    : 'hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-500 hover:text-slate-900 dark:text-[#9AA4AF] dark:hover:text-[#E6E8EB]'
                                }`}
                        >
                            {(showIcons || isMobile) && (
                                <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                    <CheckSquare strokeWidth={currentView === 'pipelines' ? 2.5 : 2} size={18} />
                                </div>
                            )}
                            {(showLabels || isMobile) && (
                                <span className="text-[13px] whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Pipeline</span>
                            )}
                        </Link>

                        <Link
                            to="/activities"
                            onClick={() => isMobile && setIsMobileMenuOpen(false)}
                            title={!showLabels && !isMobile ? "Atividades" : ""}
                            className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-[180ms] min-h-[36px] relative
                        ${isMobile ? 'px-3 w-full justify-start' : (isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto rounded-lg' : 'w-0 h-0 opacity-0 pointer-events-none'))}
                        ${currentView === 'activities'
                                    ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-[#E6E8EB] shadow-sm dark:border-l-[3px] dark:border-primary'
                                    : 'hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-500 hover:text-slate-900 dark:text-[#9AA4AF] dark:hover:text-[#E6E8EB]'
                                }`}
                        >
                            {(showIcons || isMobile) && (
                                <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                    <CalendarDays strokeWidth={currentView === 'activities' ? 2.5 : 2} size={18} />
                                </div>
                            )}
                            {(showLabels || isMobile) && (
                                <span className="text-[13px] whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Atividades</span>
                            )}
                        </Link>

                        <Link
                            to="/contacts"
                            onClick={() => isMobile && setIsMobileMenuOpen(false)}
                            title={!showLabels && !isMobile ? "Contatos" : ""}
                            className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-[180ms] min-h-[36px] relative
                        ${isMobile ? 'px-3 w-full justify-start' : (isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto rounded-lg' : 'w-0 h-0 opacity-0 pointer-events-none'))}
                        ${currentView === 'contacts'
                                    ? 'bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-[#E6E8EB] shadow-sm dark:border-l-[3px] dark:border-primary'
                                    : 'hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-500 hover:text-slate-900 dark:text-[#9AA4AF] dark:hover:text-[#E6E8EB]'
                                }`}
                        >
                            {(showIcons || isMobile) && (
                                <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                    <Users strokeWidth={currentView === 'contacts' ? 2.5 : 2} size={18} />
                                </div>
                            )}
                            {(showLabels || isMobile) && (
                                <span className="text-[13px] whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Contatos</span>
                            )}
                        </Link>
                    </nav>

                    <div className={`flex flex-col w-full space-y-2 mt-auto pb-2 ${isMobile || isSidebarPinned ? 'items-start' : 'items-center'}`}>
                        {/* Privacy Toggle */}
                        <div className={`w-full ${isMobile || isSidebarPinned ? 'px-0' : 'flex justify-center'}`}>
                            {(!showIcons && !isMobile) ? null : (
                                (showLabels || isMobile) ? (
                                    <PrivacyToggle
                                        variant="sidebar"
                                        className=""
                                    />
                                ) : (
                                    <PrivacyToggle
                                        variant="icon"
                                        className="h-10 w-10 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400"
                                    />
                                )
                            )}
                        </div>

                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            title={!showLabels && !isMobile ? "Configurações" : ""}
                            className={`group flex items-center gap-3 rounded-r-lg rounded-l-none transition-all duration-[180ms] min-h-[40px] relative
                        ${isMobile || isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto rounded-lg' : 'w-0 h-0 opacity-0 pointer-events-none')}
                        ${isSettingsOpen
                                    ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-slate-100'
                                    : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            {(showIcons || isMobile) && (
                                <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                    <Settings size={20} />
                                </div>
                            )}
                            {(showLabels || isMobile) && (
                                <span className="whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Configurações</span>
                            )}
                        </button>

                        <button
                            onClick={() => signOut()}
                            title={!showLabels && !isMobile ? "Sair" : ""}
                            className={`group flex items-center gap-3 rounded-lg hover:bg-slate-100 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 text-slate-500 dark:text-slate-400 transition-all duration-[180ms] min-h-[40px] ${isMobile || isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto' : 'w-0 h-0 opacity-0 pointer-events-none')}`}
                        >
                            {(showIcons || isMobile) && (
                                <div className="shrink-0 flex items-center justify-center w-5 h-5">
                                    <LogOut size={20} />
                                </div>
                            )}
                            {(showLabels || isMobile) && (
                                <span className="whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">Sair</span>
                            )}
                        </button>

                        {/* User Avatar (Mini) */}
                        {(showIcons || isMobile) && (
                            <div className={`flex items-center gap-3 mt-2 rounded-md border border-border/10 p-1 bg-slate-50 dark:bg-white/5 ${isMobile || isSidebarPinned ? 'w-full px-2' : 'w-8 justify-center border-none bg-transparent'}`}>
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                                    {user.email?.substring(0, 1).toUpperCase() || 'U'}
                                </div>
                                {(showLabels || isMobile) && (
                                    <div className="flex flex-col overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">
                                        <span className="text-xs font-medium text-slate-900 dark:text-gray-200 truncate" title={user.email}>{user.email}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-gray-500">Usuário</span>
                                        <span className="text-[9px] text-slate-400 dark:text-gray-600 mt-1">v1.3 (Final)</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Settings Popover */}
                    {isSettingsOpen && (
                        <div className={`fixed bottom-16 w-64 bg-popover dark:bg-[#0E1116] border border-border dark:border-white/10 rounded-lg shadow-xl z-[80] animate-in fade-in zoom-in-95 duration-200 ${isMobile ? 'left-6' : (isSidebarPinned ? 'left-60' : 'left-16 ml-2')}`}>
                            <div className="p-3 border-b border-border dark:border-white/10">
                                <h3 className="font-medium text-sm text-foreground">Configurações</h3>
                            </div>
                            <div className="p-2 space-y-1">
                                {/* Dashboard Group */}
                                <div className="relative w-full">
                                    <button
                                        onClick={() => toggleSubmenu('dashboard')}
                                        className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${activeSubmenu === 'dashboard' ? 'bg-slate-100 dark:bg-white/10 text-foreground' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}
                                    >
                                        <span className="flex items-center gap-2"><div className="w-1 h-4 bg-primary rounded-full"></div>Dashboard</span>
                                        <ChevronRight size={14} className={`text-muted-foreground/70 transition-transform ${activeSubmenu === 'dashboard' ? 'rotate-90' : ''}`} />
                                    </button>
                                    {/* Dashboard Submenu */}
                                    <div className={`absolute left-full top-0 -ml-1 pl-4 w-44 z-[100] transition-all duration-200 ease-in-out ${activeSubmenu === 'dashboard' ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'}`}>
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
                                <div className="relative w-full">
                                    <button
                                        onClick={() => toggleSubmenu('appearance')}
                                        className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${activeSubmenu === 'appearance' ? 'bg-slate-100 dark:bg-white/10 text-foreground' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}
                                    >
                                        <span className="flex items-center gap-2"><div className="w-1 h-4 bg-primary/30 rounded-full"></div>Aparência</span>
                                        <ChevronRight size={14} className={`text-muted-foreground/70 transition-transform ${activeSubmenu === 'appearance' ? 'rotate-90' : ''}`} />
                                    </button>
                                    {/* Appearance Submenu */}
                                    <div className={`absolute left-full top-0 -ml-1 pl-4 w-40 z-[100] transition-all duration-200 ease-in-out ${activeSubmenu === 'appearance' ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'}`}>
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
                                <div className="relative w-full">
                                    <button
                                        onClick={() => toggleSubmenu('currency')}
                                        className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${activeSubmenu === 'currency' ? 'bg-slate-100 dark:bg-white/10 text-foreground' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground'}`}
                                    >
                                        <span className="flex items-center gap-2"><div className="w-1 h-4 bg-primary/50 rounded-full"></div>Moedas</span>
                                        <ChevronRight size={14} className={`text-muted-foreground/70 transition-transform ${activeSubmenu === 'currency' ? 'rotate-90' : ''}`} />
                                    </button>
                                    {/* Currency Submenu */}
                                    <div className={`absolute left-full bottom-0 top-auto -ml-1 pl-4 w-48 z-[100] origin-bottom-left transition-all duration-200 ease-in-out ${activeSubmenu === 'currency' ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'}`}>
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
                </aside>
            )}

            <PipelineSettingsModal
                isOpen={isPipelineSettingsOpen}
                onClose={() => setPipelineSettingsOpen(false)}
                pipelineId="sales"
            />

            <NewDealModal
                currency={currency.code}
            />

            {/* Focus Mode Overlay for non-route deal opening */}
            {activeFocusDealId && !location.pathname.includes('/deals/') && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300"
                        onClick={() => closeFocusDeal()}
                    />
                    <div className="relative w-full h-full sm:h-[95vh] sm:max-w-5xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <DealDetails
                            dealId={activeFocusDealId}
                            onClose={() => closeFocusDeal()}
                            isModal={true}
                            currency={currency}
                        />
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className={`flex-1 flex flex-col h-full overflow-hidden relative ${isMobile && !isDealFocusOpen ? 'pt-14 w-full' : ''}`}>
                <div className="flex-1 flex flex-col overflow-hidden h-full">
                    <div className={`flex-1 flex flex-col overflow-hidden h-full w-full mx-auto ${isDealFocusOpen ? 'p-0 w-screen h-full' : 'max-w-[1700px]'}`}>
                        {children}
                    </div>
                </div>
            </main>
            <PrivacyBanner />
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
                                <KanbanBoard currency={selectedCurrency} />
                            </div>
                        } />
                        <Route path="/contacts" element={<div className="p-0 h-full max-w-[1500px] mx-auto"><ContactList /></div>} />
                        <Route path="/activities" element={<Activities currency={selectedCurrency} />} />
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
