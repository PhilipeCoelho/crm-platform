import React, { useState, useEffect } from 'react';
import { CRMProvider } from './contexts/CRMContext';

import { BrowserRouter, Routes, Route, Navigate, useLocation, NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Users, CheckSquare, Settings, LogOut,
    ChevronRight, Loader2, Moon,
    Sun, Laptop as Monitor, Menu, X, CalendarDays, BarChart3,
    Zap, DollarSign, Check, Mail
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
import AlertsAndTips from './pages/campaigns/AlertsAndTips';


function Layout({ children, currency, setCurrency }: { children: React.ReactNode, currency: Currency, setCurrency: (c: Currency) => void }) {
    const { user, signOut: handleLogout } = useSupabaseAuth();
    const location = useLocation();
    const { setTheme, theme } = useTheme();
    const { isPipelineSettingsOpen, setPipelineSettingsOpen, activeFocusDealId, closeFocusDeal, togglePrivacyMode } = useCRM();
    const isMobile = useIsMobile();

    const [dashboardType, setDashboardType] = useState<'sales' | 'marketing'>('sales');

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/pipeline', label: 'Pipeline', icon: CheckSquare },
        { path: '/activities', label: 'Atividades', icon: CalendarDays },
        { path: '/contacts', label: 'Contatos', icon: Users },
        { path: '/campaigns/email', label: 'Campaigns', icon: Mail },
        { path: '/insights', label: 'Insights', icon: BarChart3 },
    ];

    // Mobile Menu State
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Submenu Control (Click-based toggle)
    const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

    // Sidebar State - Auto-Collapsed with Hover Reveal
    const [isSidebarPinned, setIsSidebarPinned] = useState(() => {
        const saved = localStorage.getItem('sidebar_pinned');
        return saved === 'true';
    });
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);

    // Determine sidebar state: auto-collapsed (18px) | hover-icons (60px) | pinned-full (224px)
    const sidebarWidth = isSidebarPinned ? 'w-56' : (isSidebarHovered ? 'w-[60px]' : 'w-[18px]');
    const showIcons = isSidebarPinned || isSidebarHovered;

    useEffect(() => {
        localStorage.setItem('sidebar_pinned', String(isSidebarPinned));
    }, [isSidebarPinned]);

    const toggleSidebar = () => setIsSidebarPinned(!isSidebarPinned);

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

    if (!user) return null;

    // Check if we are in Focus Mode (Deal/Contact/Company Detail)
    const isFocusRoute = location.pathname.includes('/deals/') ||
        location.pathname.includes('/contacts/') ||
        location.pathname.includes('/companies/');
    const isDealFocusOpen = !!activeFocusDealId || isFocusRoute;

    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

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
                    className={`group flex flex-col py-3 z-[70] overflow-y-auto overflow-x-hidden bg-white dark:bg-background text-foreground h-full
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
                        <div className={`
                            absolute left-2 top-1/2 -translate-y-1/2 z-[60] w-[28px] h-[28px] rounded-full flex items-center justify-center transition-all duration-[160ms] ease-out
                            ${isSidebarPinned
                                ? 'bg-background shadow-md opacity-100'
                                : 'bg-muted/90 dark:bg-muted/50 opacity-60 hover:opacity-100'
                            }
                            border border-border/80 dark:border-border/30
                            hover:bg-muted dark:hover:bg-muted/20
                            cursor-pointer
                        `}
                            onClick={toggleSidebar}
                        >
                            <ChevronRight size={16} strokeWidth={2.5}
                                className={`text-muted-foreground transition-transform duration-[160ms] ${isSidebarPinned ? 'rotate-180' : 'rotate-0'}`} />
                        </div>
                    )}

                    {/* Logo Section */}
                    <div className={`flex items-center gap-3 mb-8 w-full ${isSidebarPinned ? 'px-3' : 'justify-center'}`}>
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                            <Zap size={20} className="text-white" fill="currentColor" />
                        </div>
                        {isSidebarPinned && (
                            <span className="font-semibold text-foreground whitespace-nowrap overflow-hidden transition-all duration-[180ms] opacity-100 w-auto">
                                CRM Pipeline
                            </span>
                        )}
                    </div>

                    <nav className="flex-1 flex flex-col w-full space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }: { isActive: boolean }) => `
                                    group/nav flex items-center gap-3 rounded-lg transition-all duration-[180ms] min-h-[40px]
                                    ${isActive
                                            ? 'bg-muted/50 dark:bg-muted/20 text-foreground shadow-sm dark:border-l-[3px] dark:border-primary'
                                            : 'hover:bg-muted dark:hover:bg-muted/10 text-muted-foreground hover:text-foreground dark:text-muted-foreground/60 dark:hover:text-foreground'
                                        }
                                    ${(isMobile || isSidebarPinned)
                                            ? 'px-3 w-full justify-start'
                                            : (showIcons ? 'justify-center w-10 mx-auto' : 'w-0 h-0 opacity-0 pointer-events-none overflow-hidden')
                                        }
                                `}
                                    onClick={() => isMobile && setIsMobileMenuOpen(false)}
                                    title={!isSidebarPinned ? item.label : undefined}
                                >
                                    <Icon size={20} className="shrink-0" />
                                    {(isMobile || isSidebarPinned) && (
                                        <span className="text-sm font-semibold whitespace-nowrap truncate">{item.label}</span>
                                    )}
                                </NavLink>
                            );
                        })}
                    </nav>

                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`h-10 w-10 hover:bg-muted dark:hover:bg-muted/10 rounded-lg text-muted-foreground hover:text-foreground mt-auto
                                   ${isMobile || isSidebarPinned ? 'hidden' : 'flex items-center justify-center mx-auto'}`}
                    >
                        <Settings size={20} />
                    </button>

                    <button
                        onClick={handleLogout}
                        className={`group/nav flex items-center gap-3 rounded-lg transition-all duration-[180ms] min-h-[40px]
                                   hover:bg-muted dark:hover:bg-muted/10 text-muted-foreground hover:text-foreground
                                   ${isMobile || isSidebarPinned ? 'px-3 w-full justify-start' : (showIcons ? 'justify-center w-10 mx-auto' : 'w-0 h-0 opacity-0 pointer-events-none')}
                        `}
                        title={!isSidebarPinned ? 'Sair' : undefined}
                    >
                        <LogOut size={20} className="shrink-0" />
                        {(isMobile || isSidebarPinned) && (
                            <span className="text-sm font-semibold">Sair</span>
                        )}
                    </button>

                    {/* User Profile Info (Pinned Only) */}
                    {(isMobile || isSidebarPinned) && (
                        <nav className="flex flex-col gap-1 mt-auto pt-4 border-t border-border/40">
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className={`group flex items-center gap-3 rounded-lg hover:bg-muted dark:hover:bg-muted/10 text-muted-foreground hover:text-foreground transition-all duration-[180ms] min-h-[40px] px-3 w-full justify-start
                                    ${isSettingsOpen ? 'bg-muted dark:bg-muted/20 text-foreground' : ''}`}
                            >
                                <Settings size={20} className="shrink-0" />
                                <span className="text-sm font-semibold">Configurações</span>
                            </button>

                            <button
                                onClick={handleLogout}
                                className={`group flex items-center gap-3 rounded-lg hover:bg-muted dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 text-muted-foreground transition-all duration-[180ms] min-h-[40px] px-3 w-full justify-start`}
                            >
                                <LogOut size={20} className="shrink-0" />
                                <span className="text-sm font-semibold">Sair</span>
                            </button>

                            <div className={`flex items-center gap-3 mt-2 rounded-md border border-border/10 p-1 bg-muted/30 dark:bg-muted/10 ${isMobile || isSidebarPinned ? 'w-full px-2' : 'w-8 justify-center border-none bg-transparent'}`}>
                                <div className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                    {user.email?.substring(0, 2).toUpperCase() || 'U'}
                                </div>
                                {(isMobile || isSidebarPinned) && (
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-medium text-foreground truncate" title={user.email}>{user.email}</span>
                                        <span className="text-[10px] text-muted-foreground">Usuário</span>
                                        <span className="text-[9px] text-muted-foreground/40 mt-1">v1.3 (Final)</span>
                                    </div>
                                )}
                            </div>
                        </nav>
                    )}

                    {/* Settings Popover */}
                    {isSettingsOpen && (
                        <div className={`fixed bottom-16 w-64 bg-popover dark:bg-card border border-border dark:border-border rounded-lg shadow-xl z-[80] animate-in fade-in zoom-in-95 duration-200 ${isMobile ? 'left-6' : (isSidebarPinned ? 'left-60' : 'left-16 ml-2')}`}>
                            <div className="p-3 border-b border-border dark:border-border">
                                <h3 className="font-medium text-sm text-foreground">Configurações</h3>
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
                            </div>
                            <div className="fixed inset-0 z-[-1]" onClick={() => setIsSettingsOpen(false)} />
                        </div>
                    )}
                </aside>
            )}

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
                        <Route path="/contacts" element={<Contacts />} />
                        <Route path="/activities" element={<Activities currency={selectedCurrency} />} />
                        <Route path="/insights" element={<Insights />} />
                        <Route path="/deals/:id" element={<DealDetails currency={selectedCurrency} />} />
                        <Route path="/companies/:id" element={<CompanyDetails />} />
                        <Route path="/contacts/:id" element={<ContactDetails />} />

                        {/* Campaigns Module Routes */}
                        <Route path="/campaigns/*" element={
                            <CampaignsLayout>
                                <Routes>
                                    <Route path="email" element={<CampaignsDashboard />} />
                                    <Route path="automated" element={<AutomatedCampaigns />} />
                                    <Route path="templates" element={<EmailTemplates />} />
                                    <Route path="settings" element={<CampaignSettings />} />
                                    <Route path="alerts" element={<AlertsAndTips />} />
                                    <Route path="*" element={<Navigate to="email" replace />} />
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
