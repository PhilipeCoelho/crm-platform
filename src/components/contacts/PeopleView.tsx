import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Search, Filter, Plus, Columns, ArrowUpDown, Users } from 'lucide-react';
import NewContactModal from './NewContactModal';
import { Contact } from '@/types/schema';
import { List } from 'react-window';
import { ContactRow } from './ContactRow';

type ColumnId = 'name' | 'organization' | 'email' | 'phone' | 'brevoStatus' | 'marketingStatus' | 'openDeals' | 'closedDeals' | 'nextActivity';

interface Column {
    id: ColumnId;
    label: string;
    visible: boolean;
    sortable: boolean;
}

const getColumnClass = (id: ColumnId) => {
    switch (id) {
        case 'name': return 'flex-[2] min-w-[150px]';
        case 'organization': return 'flex-[1.5] min-w-[120px]';
        case 'email': return 'flex-[2] min-w-[180px]';
        case 'phone': return 'flex-[1.2] min-w-[120px]';
        case 'brevoStatus': return 'w-36 shrink-0';
        case 'marketingStatus': return 'w-28 shrink-0';
        case 'openDeals': return 'w-28 shrink-0';
        case 'closedDeals': return 'w-28 shrink-0';
        case 'nextActivity': return 'flex-[1.5] min-w-[140px]';
        default: return 'flex-1';
    }
};

export default function PeopleView() {
    const { contacts, companies, activities, deals, deleteContact, openFocusContact } = useCRM();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);

    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [sortColumn, setSortColumn] = useState<ColumnId | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [selectedView, setSelectedView] = useState('Todos');
    const [showViewSelector, setShowViewSelector] = useState(false);
    
    // Brevo Filter States
    const [selectedBrevoFilter, setSelectedBrevoFilter] = useState<'Todos' | 'Sincronizado' | 'Não sincronizado' | 'Não elegível'>('Todos');
    const [showBrevoFilterSelector, setShowBrevoFilterSelector] = useState(false);



    const [selectedDataFilter, setSelectedDataFilter] = useState('Todos os Contatos');
    const [showDataFilterSelector, setShowDataFilterSelector] = useState(false);
    const [lastExportDate, setLastExportDate] = useState<string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);

    const [columns, setColumns] = useState<Column[]>([
        { id: 'name', label: 'Nome', visible: true, sortable: true },
        { id: 'organization', label: 'Organização', visible: true, sortable: true },
        { id: 'email', label: 'E-mail', visible: true, sortable: true },
        { id: 'phone', label: 'Telefone', visible: true, sortable: false },
        { id: 'brevoStatus', label: 'Brevo', visible: true, sortable: true },
        { id: 'marketingStatus', label: 'Marketing', visible: false, sortable: true },
        { id: 'openDeals', label: 'Negócios em Aberto', visible: true, sortable: true },
        { id: 'closedDeals', label: 'Negócios Fechados', visible: true, sortable: true },
        { id: 'nextActivity', label: 'Próxima Atividade', visible: true, sortable: true },
    ]);

    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
            setShowColumnPicker(false);
            setShowViewSelector(false);
            setShowDataFilterSelector(false);
            setShowBrevoFilterSelector(false);
            setShowExportMenu(false);
        };
        const savedDate = localStorage.getItem('lastContactsExportDate');
        if (savedDate) {
            setLastExportDate(savedDate);
        }
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const toggleColumn = (columnId: ColumnId) => {
        setColumns(prev => prev.map(col =>
            col.id === columnId ? { ...col, visible: !col.visible } : col
        ));
    };

    const handleSort = (columnId: ColumnId) => {
        if (sortColumn === columnId) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnId);
            setSortDirection('asc');
        }
    };

    // Precomputed O(1) Maps for rendering optimization
    const companyMap = useMemo(() => {
        const map = new Map<string, any>();
        companies.forEach(c => map.set(c.id, c));
        return map;
    }, [companies]);

    const nextActivityMap = useMemo(() => {
        const map = new Map<string, any>();
        const activitiesByContact = new Map<string, any[]>();
        activities.forEach(a => {
            if (a.contactId && !a.completed) {
                if (!activitiesByContact.has(a.contactId)) {
                    activitiesByContact.set(a.contactId, []);
                }
                activitiesByContact.get(a.contactId)!.push(a);
            }
        });

        activitiesByContact.forEach((acts, contactId) => {
            const sorted = acts.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
            });
            map.set(contactId, sorted[0]);
        });

        return map;
    }, [activities]);

    const contactDealsMap = useMemo(() => {
        const map = new Map<string, { open: number; closed: number }>();
        contacts.forEach(c => map.set(c.id, { open: 0, closed: 0 }));
        
        deals.forEach(d => {
            if (d.contactId) {
                const entry = map.get(d.contactId) || { open: 0, closed: 0 };
                if (d.status === 'open') {
                    entry.open++;
                } else if (d.status === 'won' || d.status === 'lost') {
                    entry.closed++;
                }
                map.set(d.contactId, entry);
            }
        });
        return map;
    }, [deals, contacts]);

    const contactStatusSummaryMap = useMemo(() => {
        const map = new Map<string, { isLost: boolean; isDisqualified: boolean; isWon: boolean }>();
        const dealsByContact = new Map<string, any[]>();
        deals.forEach(d => {
            if (d.contactId) {
                if (!dealsByContact.has(d.contactId)) {
                    dealsByContact.set(d.contactId, []);
                }
                dealsByContact.get(d.contactId)!.push(d);
            }
        });

        contacts.forEach(c => {
            const contactDeals = dealsByContact.get(c.id) || [];
            const isLost = contactDeals.length > 0 && contactDeals.every(d => d.status === 'lost');
            const isDisqualified = contactDeals.length > 0 && contactDeals.every(d => d.status === 'desqualificado');
            const isWon = contactDeals.length > 0 && contactDeals.every(d => d.status === 'won');
            map.set(c.id, { isLost, isDisqualified, isWon });
        });

        return map;
    }, [deals, contacts]);

    const getCompanyName = useCallback((id?: string) => {
        if (!id) return '-';
        return companyMap.get(id)?.name || '-';
    }, [companyMap]);

    const getNextActivity = useCallback((contactId: string) => {
        return nextActivityMap.get(contactId);
    }, [nextActivityMap]);

    const getOpenDealsCount = useCallback((contactId: string) => {
        return contactDealsMap.get(contactId)?.open || 0;
    }, [contactDealsMap]);

    const getClosedDealsCount = useCallback((contactId: string) => {
        return contactDealsMap.get(contactId)?.closed || 0;
    }, [contactDealsMap]);

    const filteredAndSortedContacts = useMemo(() => {
        let result = contacts.filter(contact => {
            const companyId = contact.companyId || (contact as any).company_id;
            const companyName = companyId ? (companyMap.get(companyId)?.name || '') : '';
            const searchLower = searchTerm.toLowerCase();

            const matchesSearch = (
                contact.name.toLowerCase().includes(searchLower) ||
                contact.email.toLowerCase().includes(searchLower) ||
                companyName.toLowerCase().includes(searchLower) ||
                (contact.phone && contact.phone.toLowerCase().includes(searchLower))
            );

            if (!matchesSearch) return false;

            // Deal-based status filtering using O(1) precomputed status summary
            const summary = contactStatusSummaryMap.get(contact.id) || { isLost: false, isDisqualified: false, isWon: false };
            const isLost = summary.isLost;
            const isDisqualified = summary.isDisqualified;
            const isWon = summary.isWon;

            let passViewFilter = true;
            if (selectedView === 'Perdidos') passViewFilter = isLost || isDisqualified;
            else if (selectedView === 'Ganhos') passViewFilter = isWon;
            else if (selectedView === 'Ativos') passViewFilter = !isLost && !isDisqualified && !isWon;
            else if (selectedView === 'Todos') passViewFilter = true;
            
            if (!passViewFilter) return false;

            // Data availability filtering
            if (selectedDataFilter === 'Com Telefone' && !contact.phone) return false;
            if (selectedDataFilter === 'Com E-mail' && !contact.email) return false;
            if (selectedDataFilter === 'Com Nome, Tel e E-mail' && (!contact.name || !contact.phone || !contact.email)) return false;

            // Brevo status filtering
            if (selectedBrevoFilter !== 'Todos') {
                const syncStatus = contact.brevoSyncStatus || 'nao_sincronizado';
                if (selectedBrevoFilter === 'Sincronizado' && syncStatus !== 'sincronizado') return false;
                if (selectedBrevoFilter === 'Não sincronizado' && syncStatus !== 'nao_sincronizado') return false;
                if (selectedBrevoFilter === 'Não elegível' && syncStatus !== 'nao_elegivel') return false;
            }

            return true;
        });

        // Apply sorting
        if (sortColumn) {
            result = [...result].sort((a, b) => {
                let aVal: any;
                let bVal: any;

                switch (sortColumn) {
                    case 'name':
                        aVal = a.name.toLowerCase();
                        bVal = b.name.toLowerCase();
                        break;
                    case 'organization':
                        aVal = getCompanyName(a.companyId || (a as any).company_id).toLowerCase();
                        bVal = getCompanyName(b.companyId || (b as any).company_id).toLowerCase();
                        break;
                    case 'email':
                        aVal = a.email.toLowerCase();
                        bVal = b.email.toLowerCase();
                        break;
                    case 'brevoStatus':
                        aVal = a.brevoStatus ? 1 : 0;
                        bVal = b.brevoStatus ? 1 : 0;
                        break;
                    case 'marketingStatus':
                        aVal = a.marketingStatus || 'z'; // 'z' to put undefined at the end
                        bVal = b.marketingStatus || 'z';
                        break;
                    case 'openDeals':
                        aVal = getOpenDealsCount(a.id);
                        bVal = getOpenDealsCount(b.id);
                        break;
                    case 'closedDeals':
                        aVal = getClosedDealsCount(a.id);
                        bVal = getClosedDealsCount(b.id);
                        break;
                    case 'nextActivity':
                        const nextA = getNextActivity(a.id);
                        const nextB = getNextActivity(b.id);
                        aVal = nextA?.dueDate || 'zzz';
                        bVal = nextB?.dueDate || 'zzz';
                        break;
                    default:
                        return 0;
                }

                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [contacts, companyMap, searchTerm, sortColumn, sortDirection, contactDealsMap, nextActivityMap, contactStatusSummaryMap, selectedView, selectedDataFilter, selectedBrevoFilter, getCompanyName, getNextActivity, getOpenDealsCount, getClosedDealsCount]);

    const handleEditClick = useCallback((contact: Contact, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingContact(contact);
        setIsModalOpen(true);
        setOpenMenuId(null);
    }, []);

    const handleCreateClick = () => {
        setEditingContact(undefined);
        setIsModalOpen(true);
    };

    const toggleSelectAll = useCallback(() => {
        if (selectedContacts.size === filteredAndSortedContacts.length) {
            setSelectedContacts(new Set());
        } else {
            setSelectedContacts(new Set(filteredAndSortedContacts.map(c => c.id)));
        }
    }, [selectedContacts, filteredAndSortedContacts]);

    const toggleSelectContact = useCallback((contactId: string) => {
        const newSet = new Set(selectedContacts);
        if (newSet.has(contactId)) {
            newSet.delete(contactId);
        } else {
            newSet.add(contactId);
        }
        setSelectedContacts(newSet);
    }, [selectedContacts]);

    const visibleColumns = columns.filter(col => col.visible);

    const formatMetaPhone = (phone: string) => {
        if (!phone) return '';
        let digits = phone.replace(/\D/g, '');
        // Assumindo DDI 351 (Portugal) se o número tiver 9 dígitos
        if (digits.length === 9) {
            return `351${digits}`;
        }
        return digits;
    };

    const executeExport = (format: 'csv_excel' | 'csv_universal' | 'json' | 'csv_meta') => {
        const selectedList = contacts.filter(c => selectedContacts.has(c.id));
        const headers = ['Nome', 'Organização', 'E-mail', 'Telefone', 'Status de Marketing'];
        
        let fileContent = '';
        let fileType = '';
        let fileExtension = '';

        if (format === 'json') {
            const data = selectedList.map(c => ({
                Nome: c.name,
                Organização: getCompanyName(c.companyId || (c as any).company_id),
                Email: c.email,
                Telefone: c.phone || '',
                StatusMarketing: c.marketingStatus || ''
            }));
            fileContent = JSON.stringify(data, null, 2);
            fileType = 'application/json';
            fileExtension = 'json';
        } else if (format === 'csv_meta') {
            const separator = ',';
            const metaHeaders = ['email', 'phone', 'fn', 'ln', 'value'];
            const csvContent = [
                metaHeaders.join(separator),
                ...selectedList.map(c => {
                    const names = c.name.split(' ');
                    const fn = names[0] || '';
                    const ln = names.slice(1).join(' ') || '';
                    
                    // LTV: Soma do valor de todos os negócios GANHOS da pessoa
                    const contactDeals = deals.filter(d => d.contactId === c.id && d.status === 'won');
                    const customerValue = contactDeals.reduce((sum, d) => sum + (d.value || 0), 0);
                    const valueStr = customerValue > 0 ? customerValue.toFixed(2) : '';

                    return [
                        `"${c.email ? c.email.trim().toLowerCase() : ''}"`,
                        `"${formatMetaPhone(c.phone || '')}"`,
                        `"${fn}"`,
                        `"${ln}"`,
                        `"${valueStr}"`
                    ].join(separator);
                })
            ].join('\n');
            fileContent = csvContent;
            fileType = 'text/csv;charset=utf-8;';
            fileExtension = 'csv';
        } else {
            const separator = format === 'csv_excel' ? ';' : ',';
            const csvContent = [
                headers.join(separator),
                ...selectedList.map(c => [
                    `"${c.name}"`,
                    `"${getCompanyName(c.companyId || (c as any).company_id)}"`,
                    `"${c.email}"`,
                    `"${c.phone || ''}"`,
                    `"${c.marketingStatus || ''}"`
                ].join(separator))
            ].join('\n');

            const BOM = format === 'csv_excel' ? '\uFEFF' : '';
            fileContent = BOM + csvContent;
            fileType = 'text/csv;charset=utf-8;';
            fileExtension = 'csv';
        }

        const blob = new Blob([fileContent], { type: fileType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `export_contatos_${new Date().getTime()}.${fileExtension}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const now = new Date().toLocaleString('pt-BR');
        setLastExportDate(now);
        localStorage.setItem('lastContactsExportDate', now);
        setShowExportMenu(false);
    };

    const handleDeleteSelected = useCallback(async () => {
        if (window.confirm(`Tem certeza que deseja excluir ${selectedContacts.size} ${selectedContacts.size === 1 ? 'pessoa' : 'pessoas'}?`)) {
            for (const id of Array.from(selectedContacts)) {
                await deleteContact(id);
            }
            setSelectedContacts(new Set());
        }
    }, [selectedContacts, deleteContact]);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">Pessoas</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {filteredAndSortedContacts.length} {filteredAndSortedContacts.length === 1 ? 'pessoa' : 'pessoas'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCreateClick}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm hover:shadow"
                        >
                            <Plus size={16} strokeWidth={2.5} />
                            Pessoa
                        </button>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="flex gap-3 items-center">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por nome, email, organização ou negócio..."
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    {/* View Selector */}
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowViewSelector(!showViewSelector);
                                setShowDataFilterSelector(false);
                                setShowBrevoFilterSelector(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 border border-input rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                        >
                            <Filter size={16} />
                            <span>Negócios: {selectedView}</span>
                        </button>
                        {showViewSelector && (
                            <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                {['Todos', 'Ativos', 'Ganhos', 'Perdidos'].map((view) => (
                                    <button
                                        key={view}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedView(view);
                                            setShowViewSelector(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedView === view ? 'bg-muted font-medium' : ''}`}
                                    >
                                        {view}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Data Availability Filter */}
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDataFilterSelector(!showDataFilterSelector);
                                setShowViewSelector(false);
                                setShowBrevoFilterSelector(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 border border-input rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                            title="Filtrar por preenchimento de dados"
                        >
                            <Filter size={16} />
                            <span className="max-w-[140px] truncate">{selectedDataFilter}</span>
                        </button>
                        {showDataFilterSelector && (
                            <div className="absolute left-0 mt-2 w-56 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                {['Todos os Contatos', 'Com Telefone', 'Com E-mail', 'Com Nome, Tel e E-mail'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDataFilter(filter);
                                            setShowDataFilterSelector(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedDataFilter === filter ? 'bg-muted font-medium' : ''}`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Brevo Filter */}
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowBrevoFilterSelector(!showBrevoFilterSelector);
                                setShowViewSelector(false);
                                setShowDataFilterSelector(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 border border-input rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                        >
                            <Filter size={16} />
                            <span>Brevo: {selectedBrevoFilter}</span>
                        </button>
                        {showBrevoFilterSelector && (
                            <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                {['Todos', 'Sincronizado', 'Não sincronizado', 'Não elegível'].map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedBrevoFilter(opt as any);
                                            setShowBrevoFilterSelector(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedBrevoFilter === opt ? 'bg-muted font-medium' : ''}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowColumnPicker(!showColumnPicker);
                            }}
                            className="flex items-center gap-2 px-3 py-2 border border-input rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                        >
                            <Columns size={16} />
                            Colunas
                        </button>
                        {showColumnPicker && (
                            <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-lg shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-3 py-2 border-b border-border">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase">Colunas Visíveis</p>
                                </div>
                                {columns.map((col) => (
                                    <button
                                        key={col.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleColumn(col.id);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between transition-colors"
                                    >
                                        <span className="text-foreground">{col.label}</span>
                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${col.visible ? 'bg-primary border-primary' : 'border-input'}`}>
                                            {col.visible && (
                                                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bulk Actions */}
                {selectedContacts.size > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
                        <span className="text-sm font-medium text-foreground">
                            {selectedContacts.size} {selectedContacts.size === 1 ? 'pessoa selecionada' : 'pessoas selecionadas'}
                        </span>
                        <div className="flex gap-4 items-center">
                            {lastExportDate && (
                                <span className="text-xs text-muted-foreground hidden sm:inline-block">
                                    Última exportação: {lastExportDate}
                                </span>
                            )}
                            <div className="flex gap-2 relative">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowExportMenu(!showExportMenu);
                                    }}
                                    className="px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary/20 rounded-md transition-colors"
                                >
                                    Exportar
                                </button>
                                {showExportMenu && (
                                    <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="px-3 py-1.5 border-b border-border mb-1">
                                            <p className="text-xs font-semibold text-muted-foreground">Formato de Exportação</p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                executeExport('csv_excel');
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex flex-col"
                                        >
                                            <span>CSV (Excel / Padrão BR)</span>
                                            <span className="text-[10px] text-muted-foreground">Recomendado para Excel</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                executeExport('csv_universal');
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex flex-col"
                                        >
                                            <span>CSV (Universal / Migração)</span>
                                            <span className="text-[10px] text-muted-foreground">Separado por vírgula</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                executeExport('csv_meta');
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex flex-col"
                                        >
                                            <span>CSV (Meta / Facebook Ads)</span>
                                            <span className="text-[10px] text-muted-foreground">Formato oficial para Públicos</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                executeExport('json');
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex flex-col"
                                        >
                                            <span>JSON</span>
                                            <span className="text-[10px] text-muted-foreground">Para desenvolvedores/APIs</span>
                                        </button>
                                    </div>
                                )}
                                <button 
                                    onClick={handleDeleteSelected}
                                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                >
                                    Deletar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden px-6 pb-6 flex flex-col">
                <div className="bg-card rounded-lg border border-border overflow-hidden flex flex-col flex-1 min-h-[300px]">
                    {/* Header */}
                    <div className="bg-muted/50 text-muted-foreground font-medium text-xs border-b border-border flex items-center shrink-0 py-3 pr-2 select-none">
                        <div className="px-4 w-12 shrink-0 flex items-center justify-center">
                            <input
                                type="checkbox"
                                checked={selectedContacts.size === filteredAndSortedContacts.length && filteredAndSortedContacts.length > 0}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 rounded border-input cursor-pointer"
                            />
                        </div>
                        {visibleColumns.map((col) => (
                            <div key={col.id} className={`px-4 text-left font-semibold flex items-center ${getColumnClass(col.id)}`}>
                                {col.sortable ? (
                                    <button
                                        onClick={() => handleSort(col.id)}
                                        className="flex items-center gap-1 hover:text-foreground transition-colors group"
                                    >
                                        {col.label}
                                        <ArrowUpDown
                                            size={12}
                                            className={`transition-all ${sortColumn === col.id ? 'text-primary' : 'opacity-0 group-hover:opacity-100'}`}
                                        />
                                    </button>
                                ) : (
                                    col.label
                                )}
                            </div>
                        ))}
                        <div className="px-4 w-20 shrink-0"></div>
                    </div>

                    {/* Virtualized Body */}
                    <div className="flex-1 relative overflow-hidden bg-background/50">
                        {filteredAndSortedContacts.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                <Users size={48} className="text-muted-foreground/30" />
                                <p className="text-muted-foreground font-medium">Nenhuma pessoa encontrada</p>
                                {contacts.length === 0 && (
                                    <p className="text-sm text-muted-foreground">Crie sua primeira pessoa!</p>
                                )}
                            </div>
                        ) : (
                            <List<{}>
                                rowCount={filteredAndSortedContacts.length}
                                rowHeight={56}
                                rowProps={{}}
                                rowComponent={({ index, style }: { index: number; style: React.CSSProperties }) => {
                                    const contact = filteredAndSortedContacts[index];
                                    const isSelected = selectedContacts.has(contact.id);
                                    const isMenuOpen = openMenuId === contact.id;

                                    return (
                                        <ContactRow
                                            key={contact.id}
                                            contact={contact}
                                            style={style}
                                            isSelected={isSelected}
                                            onSelect={() => toggleSelectContact(contact.id)}
                                            onEdit={handleEditClick}
                                            onDelete={(id) => {
                                                if (window.confirm('Tem certeza que deseja excluir esta pessoa?')) {
                                                    deleteContact(id);
                                                    setOpenMenuId(null);
                                                }
                                            }}
                                            onClick={() => openFocusContact(contact.id)}
                                            companyName={getCompanyName(contact.companyId || (contact as any).company_id)}
                                            openDealsCount={getOpenDealsCount(contact.id)}
                                            closedDealsCount={getClosedDealsCount(contact.id)}
                                            nextActivity={getNextActivity(contact.id)}
                                            visibleColumns={visibleColumns}
                                            isMenuOpen={isMenuOpen}
                                            onToggleMenu={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === contact.id ? null : contact.id);
                                            }}
                                        />
                                    );
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>

            <NewContactModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                contactToEdit={editingContact}
            />

        </div>
    );
}
