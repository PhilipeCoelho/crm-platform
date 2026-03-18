import React, { useState, useEffect } from 'react';
import { CRMProvider } from './contexts/CRMContext';

import { BrowserRouter, Routes, Route, Navigate, useLocation, NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Users, CheckSquare, LogOut,
    ChevronRight, ChevronLeft, Loader2, Moon,
    Sun, Laptop as Monitor, Menu, X, CalendarDays, BarChart3,
    Zap, DollarSign, Check, Mail, Eye, Inbox
} from 'lucide-react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useTheme } from "@/components/theme-provider"
import KanbanBoard from '@/components/kanban/KanbanBoard';
import Contacts from '@/pages/Contacts';
import Login from '@/pages/Login';
import { currencies, Currency, currencies as CURRENCIES } from '@/data/currencies';
import DealDetails from '@/pages/DealDetails';
import CompanyDetails from '@/pages/CompanyDetails';
import ContactDetails from '@/pages/ContactDetails';
import Dashboard from '@/pages/Dashboard';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useCRM } from '@/contexts/CRMContext';
import PipelineSettingsModal from '@/components/kanban/PipelineSettingsModal';
import NewDealModal from '@/components/kanban/NewDealModal';
import Activities from './pages/Activities';
import Insights from './pages/Insights';
import { PrivacyBanner } from '@/components/ui/PrivacyBanner';
import CampaignsLayout from './pages/campaigns/CampaignsLayout';
import CampaignsDashboard from './pages/campaigns/CampaignsDashboard';
import AutomatedCampaigns from './pages/campaigns/AutomatedCampaigns';
import EmailTemplates from './pages/campaigns/EmailTemplates';
import CampaignSettings from './pages/campaigns/CampaignSettings';
import CampaignWizard from '@/pages/campaigns/CampaignWizard';
import AlertsAndTips from './pages/campaigns/AlertsAndTips';
import EmailInbox from './pages/email/EmailInbox';
import CadenceSettings from '@/pages/settings/CadenceSettings';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"


function Layout({ children, currency, setCurrency }: { children: React.ReactNode, currency: Currency, setCurrency: (c: Currency) => void }) {
    const { user, signOut: handleLogout } = useSupabaseAuth();
    const location = useLocation();
    const { setTheme, theme } = useTheme();
    const { isPipelineSettingsOpen, setPipelineSettingsOpen, activeFocusDealId, closeFocusDeal, togglePrivacyMode, isPrivacyMode } = useCRM();
    const isMobile = useIsMobile();

    const [dashboardType, setDashboardType] = useState<'sales' | 'marketing'>('sales');

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/pipeline', label: 'Pipeline', icon: CheckSquare },
        { path: '/activities', label: 'Atividades', icon: CalendarDays },
        { path: '/contacts', label: 'Contatos', icon: Users },
        { path: '/email', label: 'E-mail', icon: Inbox },
        { path: '/campaigns', label: 'Campaigns', icon: Mail },
        { path: '/insights', label: 'Insights', icon: BarChart3 },
    ];

    // Sidebar States: Pinned and Hovered
    const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
        const saved = localStorage.getItem('sidebar_pinned');
        return saved === 'true';
    });
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);

    // Mobile Menu State
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Submenu Control (Click-based toggle)
    const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

    // Determines sidebar width for desktop
    const isExpanded = (isSidebarPinned || isSidebarHovered) && !isMobile;
    const sidebarWidth = isExpanded ? 'w-56' : 'w-[60px]';

    const toggleSidebar = () => {
        const newState = !isSidebarPinned;
        setIsSidebarPinned(newState);
        localStorage.setItem('sidebar_pinned', String(newState));
    };

    // Keyboard Shortcut (Cmd+Shift+P) & Close Focus Mode (Esc)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
                e.preventDefault();
                togglePrivacyMode();
            }
            if (e.key === 'Escape' && activeFocusDealId) {
                closeFocusDeal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePrivacyMode, activeFocusDealId, closeFocusDeal]);

    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

    if (!user) return null;

    // Check if we are in Focus Mode (Deal/Contact/Company Detail)
    const isFocusRoute = location.pathname.includes('/deals/') ||
        location.pathname.includes('/contacts/') ||
        location.pathname.includes('/companies/');
    const isDealFocusOpen = !!activeFocusDealId || isFocusRoute;

    return (
        <TooltipProvider delayDuration={0}>
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

                {/* Sidebar - Hidden in focus mode */}
                {!isDealFocusOpen && (
                    <aside
                        onMouseEnter={() => !isMobile && setIsSidebarHovered(true)}
                        onMouseLeave={() => !isMobile && setIsSidebarHovered(false)}
                        className={`group flex flex-col z-[70] bg-[#0D0D0D] text-foreground h-full
                        ${isMobile
                                ? `fixed top-0 left-0 bottom-0 w-64 px-3 items-start shadow-2xl transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                                }`
                                : `relative shrink-0 transition-all duration-300 ease-in-out ${sidebarWidth} ${isExpanded ? 'items-stretch' : 'items-center'}`
                            }
                        `}
                    >
                        <div className="flex-1 flex flex-col w-full overflow-y-auto overflow-x-hidden py-4 custom-scrollbar relative">

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

                            {/* Logo Section */}
                            <div className={`flex items-center mb-8 h-9 w-full transition-all duration-300 ${isExpanded || isMobile ? 'px-4 justify-start' : 'justify-center'}`}>
                                <div className="w-9 h-9 flex items-center justify-center shrink-0">
                                    <Zap size={18} className="text-[var(--primary)]" strokeWidth={1.8} />
                                </div>
                                {(isExpanded || isMobile) && (
                                    <span className="font-semibold text-foreground ml-2 text-lg whitespace-nowrap overflow-hidden animate-in fade-in duration-300">
                                        CRM Pipeline
                                    </span>
                                )}
                            </div>

                            <nav className="flex-1 flex flex-col w-full space-y-2">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    const NavItemContent = (
                                        <NavLink
                                            to={item.path}
                                            className={({ isActive }: { isActive: boolean }) => `
                                            flex items-center transition-all duration-200 rounded-lg
                                            ${isActive
                                                    ? 'bg-[var(--primary)]/15 text-white'
                                                    : 'text-slate-500 hover:text-[#141414] dark:text-meta dark:hover:text-white dark:hover:bg-muted'
                                                }
                                            ${(isExpanded || isMobile)
                                                    ? 'px-3 mx-2 gap-3 min-h-[40px] justify-start w-auto'
                                                    : 'w-9 h-9 flex items-center justify-center mx-auto rounded-lg'
                                                }
                                        `}
                                            onClick={() => isMobile && setIsMobileMenuOpen(false)}
                                        >
                                            <Icon size={18} className="shrink-0" strokeWidth={1.8} />
                                            {(isExpanded || isMobile) && (
                                                <span className="text-sm font-medium whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
                                                    {item.label}
                                                </span>
                                            )}
                                        </NavLink>
                                    );

                                    if (isMobile || isExpanded) return <div key={item.path} className="w-full">{NavItemContent}</div>;

                                    return (
                                        <div key={item.path} className="w-full flex justify-center">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    {NavItemContent}
                                                </TooltipTrigger>
                                                <TooltipContent side="right" sideOffset={10} className="font-medium text-xs bg-foreground text-background border-border z-[100]">
                                                    {item.label}
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    );
                                })}
                            </nav>

                            {/* Settings & User Trigger */}
                            <div className="mt-auto flex flex-col gap-2 w-full mb-4">
                                <div className="w-full flex justify-center">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                                className={`flex items-center justify-center transition-all duration-200
                                                        ${(isMobile || isExpanded)
                                                        ? 'w-auto px-3 mx-2 gap-3 min-h-[40px] hover:bg-muted dark:hover:bg-muted/10 rounded-xl'
                                                        : 'w-9 h-9 mx-auto rounded-full hover:bg-muted dark:hover:bg-muted/10'
                                                    }`}
                                            >
                                                <div className="w-8 h-8 rounded-full text-primary flex items-center justify-center font-bold shrink-0 text-xs bg-primary/10 border border-primary/20">
                                                    {user.email?.substring(0, 2).toUpperCase()}
                                                </div>
                                                {(isMobile || isExpanded) && (
                                                    <div className="flex flex-col items-start overflow-hidden ml-3">
                                                        <span className="text-sm font-medium text-foreground truncate w-full text-left">Minha Conta</span>
                                                        <span className="text-[10px] text-muted-foreground truncate w-full text-left">Configurações</span>
                                                    </div>
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        {!isExpanded && !isMobile && (
                                            <TooltipContent side="right" sideOffset={10} className="font-medium text-xs bg-foreground text-background border-border z-[100]">
                                                Configurações & Conta
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </div>
                            </div>
                        </div>

                        {/* Floating Sidebar Toggle Button */}
                        {!isMobile && (
                            <button
                                onClick={toggleSidebar}
                                className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-background border border-border/40 rounded-full flex items-center justify-center shadow-lg z-[80] hover:scale-110 hover:bg-muted transition-all duration-300 opacity-0 group-hover:opacity-100 cursor-pointer"
                            >
                                {isSidebarPinned ? <ChevronLeft size={16} className="text-muted-foreground" strokeWidth={1.8} /> : <ChevronRight size={16} className="text-muted-foreground" strokeWidth={1.8} />}
                            </button>
                        )}

                        {/* Settings Popover */}
                        {
                            isSettingsOpen && (
                                <div className={`fixed bottom-6 w-64 bg-popover dark:bg-card border border-border dark:border-border rounded-xl shadow-2xl z-[80] animate-in fade-in zoom-in-95 duration-200 ${isMobile ? 'left-6' : 'left-16'}`}>
                                    <div className="p-4 border-b border-border dark:border-border">
                                        <h3 className="font-semibold text-sm text-foreground">Configurações</h3>
                                        <p className="text-[11px] text-muted-foreground truncate mt-1">{user.email}</p>
                                    </div>
                                    <div className="p-2 space-y-1">
                                        {/* Dashboard Group */}
                                        <div className="relative w-full">
                                            <button
                                                onClick={() => setActiveSubmenu(activeSubmenu === 'dashboard' ? null : 'dashboard')}
                                                className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${activeSubmenu === 'dashboard' ? 'bg-muted dark:bg-muted/20 text-foreground' : 'hover:bg-muted dark:hover:bg-muted/10 text-muted-foreground hover:text-foreground'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <LayoutDashboard size={14} />
                                                    <span>Dashboard</span>
                                                </div>
                                                <ChevronRight size={14} className={`transition-transform ${activeSubmenu === 'dashboard' ? 'rotate-90' : ''}`} />
                                            </button>
                                            <div className={`absolute left-full top-0 -ml-1 pl-4 w-44 z-[100] transition-all duration-200 ease-in-out ${activeSubmenu === 'dashboard' ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'}`}>
                                                <div className="bg-card border border-border rounded-lg shadow-xl p-1 overflow-hidden">
                                                    <button
                                                        onClick={() => { setDashboardType('sales'); setIsSettingsOpen(false); }}
                                                        className="w-full text-left px-3 py-1.5 hover:bg-muted dark:hover:bg-muted/10 rounded-md text-xs flex items-center gap-2 text-foreground"
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full ${dashboardType === 'sales' ? 'bg-primary' : 'bg-transparent'}`} />
                                                        Vendas
                                                    </button>
                                                    <button
                                                        onClick={() => { setDashboardType('marketing'); setIsSettingsOpen(false); }}
                                                        className="w-full text-left px-3 py-1.5 hover:bg-muted dark:hover:bg-muted/10 rounded-md text-xs flex items-center gap-2 text-foreground"
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full ${dashboardType === 'marketing' ? 'bg-primary' : 'bg-transparent'}`} />
                                                        Marketing
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Appearance Switch */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setActiveSubmenu(activeSubmenu === 'appearance' ? null : 'appearance')}
                                                className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${activeSubmenu === 'appearance' ? 'bg-muted dark:bg-muted/20 text-foreground' : 'hover:bg-muted dark:hover:bg-muted/10 text-muted-foreground hover:text-foreground'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {theme === 'dark' ? <Moon size={14} /> : theme === 'light' ? <Sun size={14} /> : <Monitor size={14} />}
                                                    <span>Aparência</span>
                                                </div>
                                                <ChevronRight size={14} className={`transition-transform ${activeSubmenu === 'appearance' ? 'rotate-90' : ''}`} />
                                            </button>
                                            <div className={`absolute left-full top-0 -ml-1 pl-4 w-40 z-[100] transition-all duration-200 ease-in-out ${activeSubmenu === 'appearance' ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'}`}>
                                                <div className="bg-card border border-border rounded-lg shadow-xl p-1 overflow-hidden">
                                                    <button onClick={() => setTheme("light")} className="w-full text-left px-3 py-1.5 hover:bg-muted dark:hover:bg-muted/10 rounded-md text-xs flex items-center justify-between text-muted-foreground hover:text-foreground">
                                                        <span>Claro</span>
                                                        {theme === 'light' && <Check size={12} className="text-primary" />}
                                                    </button>
                                                    <button onClick={() => setTheme("dark")} className="w-full text-left px-3 py-1.5 hover:bg-muted dark:hover:bg-muted/10 rounded-md text-xs flex items-center justify-between text-muted-foreground hover:text-foreground">
                                                        <span>Escuro</span>
                                                        {theme === 'dark' && <Check size={12} className="text-primary" />}
                                                    </button>
                                                    <button onClick={() => setTheme("system")} className="w-full text-left px-3 py-1.5 hover:bg-muted dark:hover:bg-muted/10 rounded-md text-xs flex items-center justify-between text-muted-foreground hover:text-foreground">
                                                        <span>Sistema</span>
                                                        {theme === 'system' && <Check size={12} className="text-primary" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Currency Selection */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setActiveSubmenu(activeSubmenu === 'currency' ? null : 'currency')}
                                                className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors ${activeSubmenu === 'currency' ? 'bg-muted dark:bg-muted/20 text-foreground' : 'hover:bg-muted dark:hover:bg-muted/10 text-muted-foreground hover:text-foreground'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <DollarSign size={14} />
                                                    <span>Moeda</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-primary">{currency.code}</span>
                                            </button>
                                            <div className={`absolute left-full bottom-0 top-auto -ml-1 pl-4 w-48 z-[100] origin-bottom-left transition-all duration-200 ease-in-out ${activeSubmenu === 'currency' ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible -translate-x-2'}`}>
                                                <div className="bg-card border border-border rounded-lg shadow-xl p-1 overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                                                    {Object.values(CURRENCIES).map(c => (
                                                        <button key={c.code} onClick={() => { setCurrency(c); setIsSettingsOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-muted dark:hover:bg-muted/10 rounded-md text-xs flex items-center justify-between text-muted-foreground hover:text-foreground">
                                                            <span>{c.name} ({c.symbol})</span>
                                                            {currency.code === c.code && <Check size={12} className="text-primary" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <button
                                                onClick={togglePrivacyMode}
                                                className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted dark:hover:bg-muted/10 text-muted-foreground hover:text-foreground`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Eye size={14} />
                                                    <span>Modo Privacidade</span>
                                                </div>
                                                <div className={`w-8 h-4 rounded-full relative transition-colors ${isPrivacyMode ? 'bg-primary' : 'bg-muted dark:bg-muted/30'}`}>
                                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isPrivacyMode ? 'right-0.5' : 'left-0.5'}`} />
                                                </div>
                                            </button>
                                        </div>

                                        {/* Cadência Switch */}
                                        <div className="relative">
                                            <NavLink
                                                to="/settings/cadence"
                                                onClick={() => setIsSettingsOpen(false)}
                                                className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted dark:hover:bg-muted/10 text-muted-foreground hover:text-foreground"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Zap size={14} className="text-primary" />
                                                    <span>Cadência Automática</span>
                                                </div>
                                                <ChevronRight size={14} />
                                            </NavLink>
                                        </div>

                                        {/* Logout Button */}
                                        <div className="pt-2 mt-2 border-t border-border">
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-2 px-2 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-md transition-colors"
                                            >
                                                <LogOut size={14} />
                                                <span>Sair da conta</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="fixed inset-0 z-[-1]" onClick={() => setIsSettingsOpen(false)} />
                                </div>
                            )}
                    </aside>
                )}

                {/* Focus Mode Overlay for non-route deal opening */}
                {
                    activeFocusDealId && !location.pathname.includes('/deals/') && (
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
                    )
                }

                <PipelineSettingsModal
                    isOpen={isPipelineSettingsOpen}
                    onClose={() => setPipelineSettingsOpen(false)}
                    pipelineId="sales"
                />

                <NewDealModal
                    currency={currency.code}
                />

                {/* Main Content Area */}
                <main className={`flex-1 flex flex-col h-full overflow-hidden relative ${isMobile && !isDealFocusOpen ? 'pt-14 w-full' : ''}`}>
                    <div className="flex-1 flex flex-col overflow-hidden h-full">
                        <div className={`flex-1 flex flex-col overflow-hidden h-full w-full mx-auto ${isDealFocusOpen ? 'p-0 w-screen h-full' : 'max-w-[1700px]'}`}>
                            {children}
                        </div>
                    </div>
                </main>

                <PrivacyBanner />
            </div >
        </TooltipProvider >
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
                        <Route path="/contacts" element={<Contacts />} />
                        <Route path="/activities" element={<Activities currency={selectedCurrency} />} />
                        <Route path="/campaigns/wizard" element={<CampaignWizard />} />
                        <Route path="/email" element={<EmailInbox />} />
                        <Route path="/insights" element={<Insights />} />
                        <Route path="/settings/cadence" element={<CadenceSettings />} />
                        <Route path="/deals/:id" element={<DealDetails currency={selectedCurrency} />} />
                        <Route path="/companies/:id" element={<CompanyDetails />} />
                        <Route path="/contacts/:id" element={<ContactDetails />} />

                        {/* Campaigns Module Routes */}
                        <Route path="/campaigns/*" element={
                            <CampaignsLayout>
                                <Routes>
                                    <Route index element={<CampaignsDashboard />} />
                                    <Route path="new" element={<CampaignWizard />} />
                                    <Route path="automated" element={<AutomatedCampaigns />} />
                                    <Route path="templates" element={<EmailTemplates />} />
                                    <Route path="settings" element={<CampaignSettings />} />
                                    <Route path="alerts" element={<AlertsAndTips />} />
                                    <Route path="*" element={<Navigate to="" replace />} />
                                </Routes>
                            </CampaignsLayout>
                        } />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </CRMProvider>
    );
}

export default App;
