import { useState, useRef, useEffect } from 'react';
import {
    MoreHorizontal,
    Download,
    Upload,
    Eraser,
    Settings2,
    Trash2,
    Eye,
    FileSpreadsheet,
    FileText,
    ChevronRight,
    Monitor,
    Maximize
} from 'lucide-react';
import { Activity, Deal, Contact, Company } from '@/types/schema';
import { format } from 'date-fns';

interface Props {
    filteredActivities: Activity[];
    deals: Deal[];
    contacts: Contact[];
    companies: Company[];
    visibleColumns: string[];
}

export default function ActivitiesMoreActions({
    filteredActivities,
    deals,
    contacts,
    companies,
    visibleColumns
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [showViewOptions, setShowViewOptions] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setShowExportOptions(false);
                setShowViewOptions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const exportToCSV = () => {
        const headers = visibleColumns.map(col => {
            const labels: Record<string, string> = {
                title: 'Assunto',
                dealId: 'Negócio',
                priority: 'Prioridade',
                contactId: 'Pessoa de contato',
                email: 'E-mail',
                phone: 'Telefone',
                companyId: 'Organização',
                dueDate: 'Vencimento',
                duration: 'Duração',
                ownerId: 'Responsável',
                type: 'Tipo',
                status: 'Status',
                completed: 'Concluído'
            };
            return labels[col] || col;
        });

        const rows = filteredActivities.map(activity => {
            return visibleColumns.map(col => {
                const deal = deals.find(d => d.id === activity.dealId);
                const contact = contacts.find(c => c.id === activity.contactId);
                const company = companies.find(c => c.id === activity.companyId);

                if (col === 'dealId') return deal?.title || '';
                if (col === 'contactId') return contact?.name || '';
                if (col === 'companyId') return company?.name || '';
                if (col === 'completed') return activity.completed ? 'Sim' : 'Não';

                return (activity as any)[col] || '';
            }).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `atividades_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2.5 rounded-xl transition-all border ${isOpen ? 'bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/10 text-primary' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 border-transparent hover:border-slate-200 dark:hover:border-white/10'}`}
            >
                <MoreHorizontal size={20} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#11141D] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200">

                    {/* Export Submenu Trigger */}
                    <div className="relative">
                        <button
                            onMouseEnter={() => { setShowExportOptions(true); setShowViewOptions(false); }}
                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <Download size={18} className="text-slate-400 group-hover:text-primary" />
                                <span>Exportar resultados</span>
                            </div>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                        </button>

                        {showExportOptions && (
                            <div
                                className="absolute right-full top-0 mr-1 w-48 bg-white dark:bg-[#11141D] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl py-1 animate-in slide-in-from-right-2 duration-200"
                                onMouseLeave={() => setShowExportOptions(false)}
                            >
                                <button
                                    onClick={exportToCSV}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                                >
                                    <FileText size={16} />
                                    CSV (Vírgula)
                                </button>
                                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5 transition-all opacity-50 cursor-not-allowed">
                                    <FileSpreadsheet size={16} />
                                    Excel (.xlsx)
                                </button>
                            </div>
                        )}
                    </div>

                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                        <Upload size={18} className="text-slate-400 group-hover:text-blue-500" />
                        <span>Importação de dados</span>
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-white/5 mx-2 my-1" />

                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                        <Eraser size={18} className="text-slate-400 group-hover:text-amber-500" />
                        <span>Abrir limpeza de dados</span>
                    </button>

                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                        <Settings2 size={18} className="text-slate-400 group-hover:text-[#141414] dark:group-hover:text-white" />
                        <span>Configurações de atividade</span>
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-white/5 mx-2 my-1" />

                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-red-500/80 hover:text-red-600">
                        <Trash2 size={18} className="text-red-400" />
                        <span>Restaurar dados</span>
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-white/5 mx-2 my-1" />

                    {/* View Options Submenu */}
                    <div className="relative">
                        <button
                            onMouseEnter={() => { setShowViewOptions(true); setShowExportOptions(false); }}
                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <Eye size={18} className="text-slate-400 group-hover:text-primary" />
                                <span>Visualização de detalhes</span>
                            </div>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                        </button>

                        {showViewOptions && (
                            <div
                                className="absolute right-full top-0 mr-1 w-64 bg-white dark:bg-[#11141D] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl py-2 animate-in slide-in-from-right-2 duration-200"
                                onMouseLeave={() => setShowViewOptions(false)}
                            >
                                <div className="px-4 py-2 border-b border-slate-100 dark:border-white/5 mb-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Preferência Global</span>
                                </div>
                                <button className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-primary hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                                    <div className="flex items-center gap-3">
                                        <Monitor size={16} />
                                        <span>Janela Modal</span>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                </button>
                                <button className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                                    <div className="flex items-center gap-3">
                                        <Maximize size={16} />
                                        <span>Tela Cheia</span>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
