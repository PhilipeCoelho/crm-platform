import React, { useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import {
    Send,
    Zap,
    FileText,
    Settings,
    Bell,
    Info,
    ExternalLink,
    Search,
    Plus,
    HelpCircle,
    Lightbulb
} from 'lucide-react';

interface CampaignsLayoutProps {
    children: React.ReactNode;
}

export default function CampaignsLayout({ children }: CampaignsLayoutProps) {
    const location = useLocation();
    const [unreadAlerts] = useState(2);

    const getPageTitle = () => {
        const path = location.pathname;
        if (path.includes('/campaigns/automated')) return 'Campanhas automatizadas';
        if (path.includes('/campaigns/templates')) return 'Modelos de e-mail';
        if (path.includes('/campaigns/settings')) return 'Configurações';
        if (path.includes('/campaigns/alerts')) return 'Alertas e dicas';
        return 'Campanhas de e-mail';
    };

    return (
        <div className="flex h-full w-full bg-background overflow-hidden font-sans">
            {/* Campaigns Module Sidebar */}
            <aside className="w-64 border-r border-border bg-white dark:bg-card flex flex-col shrink-0 z-20">
                <div className="p-4 mb-4">
                    <h2 className="text-xl font-bold text-foreground px-2">Campaigns</h2>
                </div>

                <nav className="flex-1 px-3 space-y-1">
                    <NavLink
                        to="/campaigns/email"
                        className={({ isActive }) => `
                            flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                            ${isActive
                                ? 'bg-[#E3F2FD] text-[#0D47A1] font-semibold'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }
                        `}
                    >
                        <Send size={18} />
                        <span>Campanhas de e-mail</span>
                    </NavLink>

                    <NavLink
                        to="/campaigns/automated"
                        className={({ isActive }) => `
                            flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                            ${isActive
                                ? 'bg-[#E3F2FD] text-[#0D47A1] font-semibold'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }
                        `}
                    >
                        <Zap size={18} />
                        <span>Campanhas automatizadas</span>
                    </NavLink>

                    <NavLink
                        to="/campaigns/templates"
                        className={({ isActive }) => `
                            flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                            ${isActive
                                ? 'bg-[#E3F2FD] text-[#0D47A1] font-semibold'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }
                        `}
                    >
                        <FileText size={18} />
                        <span>Modelos de e-mail</span>
                    </NavLink>

                    <NavLink
                        to="/campaigns/settings"
                        className={({ isActive }) => `
                            flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
                            ${isActive
                                ? 'bg-[#E3F2FD] text-[#0D47A1] font-semibold'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }
                        `}
                    >
                        <Settings size={18} />
                        <span>Configurações</span>
                    </NavLink>

                    <NavLink
                        to="/campaigns/alerts"
                        className={({ isActive }) => `
                            flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-all
                            ${isActive
                                ? 'bg-[#E3F2FD] text-[#0D47A1] font-semibold'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }
                        `}
                    >
                        <div className="flex items-center gap-3">
                            <Bell size={18} />
                            <span>Alertas e dicas</span>
                        </div>
                        {unreadAlerts > 0 && (
                            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {unreadAlerts}
                            </span>
                        )}
                    </NavLink>
                </nav>

                {/* Footer Sidebar */}
                <div className="p-4 mt-auto border-t border-border space-y-4">
                    <div className="space-y-2">
                        <Link to="#" className="flex items-center justify-between text-xs text-muted-foreground hover:text-primary transition-colors">
                            <span>Obter ajuda</span>
                            <ExternalLink size={12} />
                        </Link>
                        <Link to="#" className="block text-xs text-muted-foreground hover:text-primary transition-colors">
                            Sobre preços
                        </Link>
                    </div>

                    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">0/500 inscritos</span>
                            <Info size={12} className="text-muted-foreground" />
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-0" />
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                            É necessário verificar a conta. <Link to="#" className="text-primary hover:underline">Saiba mais</Link>
                        </p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Global Header */}
                <header className="h-14 border-b border-border bg-white dark:bg-card flex items-center justify-between px-6 shrink-0 z-10">
                    <div className="flex items-center gap-4">
                        <nav className="flex items-center text-sm font-medium">
                            <span className="text-muted-foreground">Campaigns</span>
                            <span className="mx-2 text-muted-foreground/40">/</span>
                            <span className="text-foreground">{getPageTitle()}</span>
                        </nav>

                        <div className="relative ml-8 group">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Pesquisar no Pipedrive"
                                className="pl-10 pr-4 py-1.5 bg-muted/40 border border-transparent focus:border-primary focus:bg-white dark:focus:bg-slate-900 rounded-md text-sm outline-none transition-all w-64"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="h-8 w-8 rounded-md bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm">
                            <Plus size={18} />
                        </button>
                        <div className="w-px h-5 bg-border mx-1" />
                        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors relative">
                            <Bell size={18} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border-2 border-white dark:border-card rounded-full" />
                        </button>
                        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                            <HelpCircle size={18} />
                        </button>
                        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors relative">
                            <Lightbulb size={18} />
                            <span className="absolute -top-1 -right-1 bg-amber-400 text-[8px] font-bold px-1 rounded-full text-white">1+</span>
                        </button>
                        <div className="w-px h-5 bg-border mx-1" />
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20 cursor-pointer">
                            PC
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto bg-[#F9FAFB] dark:bg-slate-950/20">
                    {children}
                </main>
            </div>
        </div>
    );
}
