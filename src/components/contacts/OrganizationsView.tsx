import { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Search, Filter, Plus, MoreHorizontal, Edit, Trash2, Building2, ArrowUpDown, Columns, ChevronRight, Sparkles, ChevronDown, MapPin, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PrivacyText } from '../ui/PrivacyMask';

type ColumnId = 'name' | 'address' | 'people' | 'closedDeals' | 'openDeals' | 'nextActivity' | 'owner';

interface Column {
    id: ColumnId;
    label: string;
    visible: boolean;
    sortable: boolean;
}

export default function OrganizationsView() {
    const { companies, contacts, deals, activities } = useCRM();
    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [showViewSelector, setShowViewSelector] = useState(false);
    const [showOwnerFilter, setShowOwnerFilter] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [sortColumn, setSortColumn] = useState<ColumnId | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [selectedView, setSelectedView] = useState('Todos os nomes');
    const [selectedOwner, setSelectedOwner] = useState('Philippe');
    const navigate = useNavigate();

    const [columns, setColumns] = useState<Column[]>([
        { id: 'name', label: 'Nome', visible: true, sortable: true },
        { id: 'address', label: 'Endereço', visible: true, sortable: true },
        { id: 'people', label: 'Pessoas', visible: true, sortable: true },
        { id: 'closedDeals', label: 'Negócios Fechados', visible: true, sortable: true },
        { id: 'openDeals', label: 'Negócios em Aberto', visible: true, sortable: true },
        { id: 'nextActivity', label: 'Próxima Atividade em', visible: true, sortable: true },
        { id: 'owner', label: 'Proprietário', visible: true, sortable: true },
    ]);

    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
            setShowColumnPicker(false);
            setShowViewSelector(false);
            setShowOwnerFilter(false);
            setShowMoreActions(false);
        };
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

    const getPeopleCount = (companyId: string) => {
        return contacts.filter(c => c.companyId === companyId || (c as any).company_id === companyId).length;
    };

    const getOpenDealsCount = (companyId: string) => {
        return deals.filter(d => d.companyId === companyId && d.status !== 'won' && d.status !== 'lost').length;
    };

    const getClosedDealsCount = (companyId: string) => {
        return deals.filter(d => d.companyId === companyId && (d.status === 'won' || d.status === 'lost')).length;
    };

    const getNextActivity = (companyId: string) => {
        const companyContacts = contacts.filter(c => c.companyId === companyId || (c as any).company_id === companyId);
        const contactIds = companyContacts.map(c => c.id);

        return activities
            .filter(a => contactIds.includes(a.contactId || '') && !a.completed)
            .sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
            })[0];
    };

    const filteredAndSortedCompanies = useMemo(() => {
        let result = companies.filter(company => {
            const searchLower = searchTerm.toLowerCase();
            return company.name.toLowerCase().includes(searchLower);
        });

        if (sortColumn) {
            result = [...result].sort((a, b) => {
                let aVal: any;
                let bVal: any;

                switch (sortColumn) {
                    case 'name':
                        aVal = a.name.toLowerCase();
                        bVal = b.name.toLowerCase();
                        break;
                    case 'address':
                        aVal = (a as any).address || '';
                        bVal = (b as any).address || '';
                        break;
                    case 'people':
                        aVal = getPeopleCount(a.id);
                        bVal = getPeopleCount(b.id);
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
                    case 'owner':
                        aVal = (a as any).owner || '';
                        bVal = (b as any).owner || '';
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
    }, [companies, searchTerm, sortColumn, sortDirection, contacts, deals, activities]);

    const toggleSelectAll = () => {
        if (selectedOrgs.size === filteredAndSortedCompanies.length) {
            setSelectedOrgs(new Set());
        } else {
            setSelectedOrgs(new Set(filteredAndSortedCompanies.map(c => c.id)));
        }
    };

    const toggleSelectOrg = (orgId: string) => {
        const newSet = new Set(selectedOrgs);
        if (newSet.has(orgId)) {
            newSet.delete(orgId);
        } else {
            newSet.add(orgId);
        }
        setSelectedOrgs(newSet);
    };

    const visibleColumns = columns.filter(col => col.visible);

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Breadcrumb */}
            <div className="px-6 pt-4 pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="hover:text-foreground cursor-pointer transition-colors">Contatos</span>
                    <ChevronRight size={14} />
                    <span className="text-foreground font-medium">Organizações</span>
                </div>
            </div>

            {/* Header with Actions */}
            <div className="px-6 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                    {/* Left: Primary Actions */}
                    <div className="flex items-center gap-2">
                        <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm hover:shadow">
                            <Plus size={16} strokeWidth={2.5} />
                            Organização
                        </button>
                        <button className="border border-input hover:bg-muted px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                            <Sparkles size={14} />
                            Enrich items
                        </button>
                    </div>

                    {/* Right: Filters and Controls */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                            {filteredAndSortedCompanies.length} {filteredAndSortedCompanies.length === 1 ? 'organização' : 'organizações'}
                        </span>

                        {/* View Selector */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowViewSelector(!showViewSelector);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-lg hover:bg-muted transition-colors text-sm"
                            >
                                <span>{selectedView}</span>
                                <ChevronDown size={14} />
                            </button>
                            {showViewSelector && (
                                <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                    {['Todos os nomes', 'Ativos', 'Inativos', 'Favoritos'].map((view) => (
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

                        {/* Owner Filter */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowOwnerFilter(!showOwnerFilter);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 border border-input rounded-lg hover:bg-muted transition-colors text-sm"
                            >
                                <span>{selectedOwner}</span>
                                <ChevronDown size={14} />
                            </button>
                            {showOwnerFilter && (
                                <div className="absolute right-0 mt-2 w-40 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                    {['Philippe', 'Todos', 'Sem proprietário'].map((owner) => (
                                        <button
                                            key={owner}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedOwner(owner);
                                                setShowOwnerFilter(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedOwner === owner ? 'bg-muted font-medium' : ''}`}
                                        >
                                            {owner}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* More Actions */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMoreActions(!showMoreActions);
                                }}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                <MoreHorizontal size={18} />
                            </button>
                            {showMoreActions && (
                                <div className="absolute right-0 mt-2 w-44 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                                        Exportar
                                    </button>
                                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                                        Importar
                                    </button>
                                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                                        Configurações
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Column Controls */}
            <div className="px-6 py-3 border-b border-border bg-muted/20">
                <div className="flex gap-3 items-center">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por nome da organização..."
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="flex items-center gap-2 px-3 py-2 border border-input rounded-lg hover:bg-muted transition-colors text-sm font-medium">
                        <Filter size={16} />
                        Filtros
                    </button>
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
            </div>

            {/* Bulk Actions Bar */}
            {selectedOrgs.size > 0 && (
                <div className="px-6 py-2 bg-primary/10 border-b border-primary/20">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                            {selectedOrgs.size} {selectedOrgs.size === 1 ? 'organização selecionada' : 'organizações selecionadas'}
                        </span>
                        <div className="flex gap-2">
                            <button className="px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary/20 rounded-md transition-colors">
                                Exportar
                            </button>
                            <button className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors">
                                Deletar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground font-medium text-xs border-b border-border sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 w-12">
                                <input
                                    type="checkbox"
                                    checked={selectedOrgs.size === filteredAndSortedCompanies.length && filteredAndSortedCompanies.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-input cursor-pointer"
                                />
                            </th>
                            {visibleColumns.map((col) => (
                                <th key={col.id} className="px-4 py-3 text-left">
                                    {col.sortable ? (
                                        <button
                                            onClick={() => handleSort(col.id)}
                                            className="flex items-center gap-1 hover:text-foreground transition-colors group uppercase"
                                        >
                                            {col.label}
                                            <ArrowUpDown
                                                size={12}
                                                className={`transition-all ${sortColumn === col.id ? 'text-primary' : 'opacity-0 group-hover:opacity-100'}`}
                                            />
                                        </button>
                                    ) : (
                                        <span className="uppercase">{col.label}</span>
                                    )}
                                </th>
                            ))}
                            <th className="px-4 py-3 w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background">
                        {filteredAndSortedCompanies.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length + 2} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <Building2 size={48} className="text-muted-foreground/30" />
                                        <p className="text-muted-foreground font-medium">Nenhuma organização encontrada</p>
                                        {companies.length === 0 && (
                                            <p className="text-sm text-muted-foreground">Crie sua primeira organização!</p>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredAndSortedCompanies.map((company) => {
                                const nextActivity = getNextActivity(company.id);
                                const isOverdue = nextActivity?.dueDate && nextActivity.dueDate < new Date().toISOString().split('T')[0];

                                return (
                                    <tr
                                        key={company.id}
                                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                                        onClick={() => navigate(`/companies/${company.id}`)}
                                    >
                                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedOrgs.has(company.id)}
                                                onChange={() => toggleSelectOrg(company.id)}
                                                className="w-4 h-4 rounded border-input cursor-pointer"
                                            />
                                        </td>
                                        {visibleColumns.map((col) => {
                                            switch (col.id) {
                                                case 'name':
                                                    return (
                                                        <td key={col.id} className="px-4 py-2.5">
                                                            <span className="font-medium text-foreground">
                                                                <PrivacyText text={company.name} type="company" />
                                                            </span>
                                                        </td>
                                                    );
                                                case 'address':
                                                    return (
                                                        <td key={col.id} className="px-4 py-2.5">
                                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                                <MapPin size={12} />
                                                                <span className="text-sm">
                                                                    {(company as any).address || '-'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    );
                                                case 'people':
                                                    return (
                                                        <td key={col.id} className="px-4 py-2.5">
                                                            <span className="text-foreground">{getPeopleCount(company.id)}</span>
                                                        </td>
                                                    );
                                                case 'closedDeals':
                                                    return (
                                                        <td key={col.id} className="px-4 py-2.5">
                                                            <span className="text-foreground">{getClosedDealsCount(company.id)}</span>
                                                        </td>
                                                    );
                                                case 'openDeals':
                                                    return (
                                                        <td key={col.id} className="px-4 py-2.5">
                                                            <span className="text-foreground">{getOpenDealsCount(company.id)}</span>
                                                        </td>
                                                    );
                                                case 'nextActivity':
                                                    return (
                                                        <td key={col.id} className="px-4 py-2.5">
                                                            {nextActivity ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Calendar size={12} className={isOverdue ? 'text-red-500' : 'text-muted-foreground'} />
                                                                    <span className={`text-sm ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                                                                        {nextActivity.dueDate ? new Date(nextActivity.dueDate).toLocaleDateString('pt-BR') : '-'}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                case 'owner':
                                                    return (
                                                        <td key={col.id} className="px-4 py-2.5">
                                                            <span className="text-foreground text-sm">
                                                                {(company as any).owner || selectedOwner}
                                                            </span>
                                                        </td>
                                                    );
                                                default:
                                                    return null;
                                            }
                                        })}
                                        <td className="px-4 py-2.5 text-right relative">
                                            <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <button
                                                    className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === company.id ? null : company.id);
                                                    }}
                                                >
                                                    <MoreHorizontal size={16} />
                                                </button>
                                                {openMenuId === company.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-36 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                                                        >
                                                            <Edit size={14} />
                                                            Editar
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (window.confirm('Tem certeza que deseja excluir esta organização?')) {
                                                                    alert('Funcionalidade de exclusão será implementada');
                                                                    setOpenMenuId(null);
                                                                }
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                            Excluir
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
