import { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Search, Filter, Plus, MoreHorizontal, Mail, Phone, Edit, Trash2, Columns, ArrowUpDown, Users, MessageCircle } from 'lucide-react';
import NewContactModal from './NewContactModal';
import { Contact } from '@/types/schema';
import { PrivacyText } from '../ui/PrivacyMask';
import { isMobileNumber, getCleanedWhatsAppLink, getCleanedPhoneLink } from '@/utils/phoneHelpers';

type ColumnId = 'name' | 'organization' | 'email' | 'phone' | 'marketingStatus' | 'openDeals' | 'closedDeals' | 'nextActivity';

interface Column {
    id: ColumnId;
    label: string;
    visible: boolean;
    sortable: boolean;
}

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
    const [selectedView, setSelectedView] = useState('Ativos');
    const [showViewSelector, setShowViewSelector] = useState(false);

    const [columns, setColumns] = useState<Column[]>([
        { id: 'name', label: 'Nome', visible: true, sortable: true },
        { id: 'organization', label: 'Organização', visible: true, sortable: true },
        { id: 'email', label: 'E-mail', visible: true, sortable: true },
        { id: 'phone', label: 'Telefone', visible: true, sortable: false },
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

    const getCompanyName = (id?: string) => {
        if (!id) return '-';
        return companies.find(c => c.id === id)?.name || '-';
    };

    const getNextActivity = (contactId: string) => {
        return activities
            .filter(a => a.contactId === contactId && !a.completed)
            .sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
            })[0];
    };

    const getOpenDealsCount = (contactId: string) => {
        return deals.filter(d => d.contactId === contactId && d.status === 'open').length;
    };

    const getClosedDealsCount = (contactId: string) => {
        return deals.filter(d => d.contactId === contactId && (d.status === 'won' || d.status === 'lost')).length;
    };

    const filteredAndSortedContacts = useMemo(() => {
        let result = contacts.filter(contact => {
            const companyId = contact.companyId || (contact as any).company_id;
            const company = companies.find(c => c.id === companyId);
            const companyName = company?.name || '';
            const searchLower = searchTerm.toLowerCase();

            const matchesSearch = (
                contact.name.toLowerCase().includes(searchLower) ||
                contact.email.toLowerCase().includes(searchLower) ||
                companyName.toLowerCase().includes(searchLower) ||
                (contact.phone && contact.phone.toLowerCase().includes(searchLower))
            );

            if (!matchesSearch) return false;

            // Deal-based status filtering
            const contactDeals = deals.filter(d => d.contactId === contact.id);
            const isLost = contactDeals.length > 0 && contactDeals.every(d => d.status === 'lost');
            const isDisqualified = contactDeals.length > 0 && contactDeals.every(d => d.status === 'desqualificado');
            const isWon = contactDeals.length > 0 && contactDeals.every(d => d.status === 'won');

            if (selectedView === 'Perdidos') return isLost;
            if (selectedView === 'Desqualificados') return isDisqualified;
            if (selectedView === 'Ganhos') return isWon;
            if (selectedView === 'Ativos') return !isLost && !isDisqualified && !isWon;
            
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
    }, [contacts, companies, searchTerm, sortColumn, sortDirection, deals, activities, selectedView]);

    const handleEditClick = (contact: Contact, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingContact(contact);
        setIsModalOpen(true);
        setOpenMenuId(null);
    };

    const handleCreateClick = () => {
        setEditingContact(undefined);
        setIsModalOpen(true);
    };

    const toggleSelectAll = () => {
        if (selectedContacts.size === filteredAndSortedContacts.length) {
            setSelectedContacts(new Set());
        } else {
            setSelectedContacts(new Set(filteredAndSortedContacts.map(c => c.id)));
        }
    };

    const toggleSelectContact = (contactId: string) => {
        const newSet = new Set(selectedContacts);
        if (newSet.has(contactId)) {
            newSet.delete(contactId);
        } else {
            newSet.add(contactId);
        }
        setSelectedContacts(newSet);
    };

    const visibleColumns = columns.filter(col => col.visible);

    const handleExportSelected = () => {
        const selectedList = contacts.filter(c => selectedContacts.has(c.id));
        const headers = ['Nome', 'Organização', 'E-mail', 'Telefone', 'Status de Marketing'];
        
        // Use semicolon (;) for better Excel compatibility in PT/BR/EU locales
        const csvContent = [
            headers.join(';'),
            ...selectedList.map(c => [
                `"${c.name}"`,
                `"${getCompanyName(c.companyId || (c as any).company_id)}"`,
                `"${c.email}"`,
                `"${c.phone || ''}"`,
                `"${c.marketingStatus || ''}"`
            ].join(';'))
        ].join('\n');

        // Add UTF-8 BOM (\uFEFF) so Excel recognizes accents correctly
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `export_contatos_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDeleteSelected = async () => {
        if (window.confirm(`Tem certeza que deseja excluir ${selectedContacts.size} ${selectedContacts.size === 1 ? 'pessoa' : 'pessoas'}?`)) {
            for (const id of Array.from(selectedContacts)) {
                await deleteContact(id);
            }
            setSelectedContacts(new Set());
        }
    };

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
                    <button
                        onClick={handleCreateClick}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm hover:shadow"
                    >
                        <Plus size={16} strokeWidth={2.5} />
                        Pessoa
                    </button>
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
                            }}
                            className="flex items-center gap-2 px-3 py-2 border border-input rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                        >
                            <Filter size={16} />
                            <span>{selectedView}</span>
                        </button>
                        {showViewSelector && (
                            <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                {['Ativos', 'Ganhos', 'Perdidos', 'Desqualificados'].map((view) => (
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
                        <div className="flex gap-2">
                            <button 
                                onClick={handleExportSelected}
                                className="px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary/20 rounded-md transition-colors"
                            >
                                Exportar
                            </button>
                            <button 
                                onClick={handleDeleteSelected}
                                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                            >
                                Deletar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto px-6 pb-6">
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-muted-foreground font-medium text-xs border-b border-border sticky top-0">
                            <tr>
                                <th className="px-4 py-3 w-12">
                                    <input
                                        type="checkbox"
                                        checked={selectedContacts.size === filteredAndSortedContacts.length && filteredAndSortedContacts.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-input cursor-pointer"
                                    />
                                </th>
                                {visibleColumns.map((col) => (
                                    <th key={col.id} className="px-4 py-3 text-left">
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
                                    </th>
                                ))}
                                <th className="px-4 py-3 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredAndSortedContacts.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleColumns.length + 2} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Users size={48} className="text-muted-foreground/30" />
                                            <p className="text-muted-foreground font-medium">Nenhuma pessoa encontrada</p>
                                            {contacts.length === 0 && (
                                                <p className="text-sm text-muted-foreground">Crie sua primeira pessoa!</p>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAndSortedContacts.map((contact) => (
                                    <tr
                                        key={contact.id}
                                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                                        onClick={() => openFocusContact(contact.id)}
                                    >
                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedContacts.has(contact.id)}
                                                onChange={() => toggleSelectContact(contact.id)}
                                                className="w-4 h-4 rounded border-input cursor-pointer"
                                            />
                                        </td>
                                        {visibleColumns.map((col) => {
                                            switch (col.id) {
                                                case 'name':
                                                    return (
                                                        <td key={col.id} className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                                    {contact.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="font-medium text-foreground">
                                                                    <PrivacyText text={contact.name} type="name" />
                                                                </span>
                                                            </div>
                                                        </td>
                                                    );
                                                case 'organization':
                                                    return (
                                                        <td key={col.id} className="px-4 py-3">
                                                            <div className="flex flex-col">
                                                                <span className="text-foreground">
                                                                    <PrivacyText text={getCompanyName(contact.companyId || (contact as any).company_id)} type="company" />
                                                                </span>
                                                                {contact.role && (
                                                                    <span className="text-xs text-muted-foreground">{contact.role}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                case 'email':
                                                    return (
                                                        <td key={col.id} className="px-4 py-3">
                                                            <PrivacyText text={contact.email} type="email" />
                                                        </td>
                                                    );
                                                case 'phone':
                                                    return (
                                                        <td key={col.id} className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <a
                                                                    href={getCleanedPhoneLink(contact.phone || '')}
                                                                    className="hover:text-primary transition-colors"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <PrivacyText text={contact.phone || '-'} type="phone" />
                                                                </a>
                                                                {contact.phone && isMobileNumber(contact.phone) && (
                                                                    <a
                                                                        href={getCleanedWhatsAppLink(contact.phone)}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-emerald-500 hover:text-emerald-600 transition-colors p-1 hover:bg-emerald-500/10 rounded"
                                                                        onClick={e => e.stopPropagation()}
                                                                        title="WhatsApp"
                                                                    >
                                                                        <MessageCircle size={14} />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                case 'marketingStatus':
                                                    return (
                                                        <td key={col.id} className="px-4 py-3">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${contact.marketingStatus === 'subscribed'
                                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                                : contact.marketingStatus === 'unsubscribed'
                                                                    ? 'bg-slate-50 text-slate-500 border border-slate-200'
                                                                    : 'bg-slate-50 text-slate-400 border border-slate-100'
                                                                }`}>
                                                                {contact.marketingStatus === 'subscribed' ? 'Inscrito' :
                                                                    contact.marketingStatus === 'unsubscribed' ? 'Não Inscrito' : 'Não Inscrito'}
                                                            </span>
                                                        </td>
                                                    );
                                                case 'openDeals':
                                                    return (
                                                        <td key={col.id} className="px-4 py-3">
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                                                                {getOpenDealsCount(contact.id)}
                                                            </span>
                                                        </td>
                                                    );
                                                case 'closedDeals':
                                                    return (
                                                        <td key={col.id} className="px-4 py-3">
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                                                                {getClosedDealsCount(contact.id)}
                                                            </span>
                                                        </td>
                                                    );
                                                case 'nextActivity':
                                                    const nextAct = getNextActivity(contact.id);
                                                    if (!nextAct) {
                                                        return (
                                                            <td key={col.id} className="px-4 py-3">
                                                                <span className="text-muted-foreground text-xs">-</span>
                                                            </td>
                                                        );
                                                    }
                                                    const isOverdue = nextAct.dueDate && nextAct.dueDate < new Date().toISOString().split('T')[0];
                                                    return (
                                                        <td key={col.id} className="px-4 py-3">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium text-foreground truncate max-w-[150px]" title={nextAct.title}>
                                                                    <PrivacyText text={nextAct.title} type="text" />
                                                                </span>
                                                                <span className={`text-[11px] ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                                                                    {nextAct.dueDate ? new Date(nextAct.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    );
                                                default:
                                                    return null;
                                            }
                                        })}
                                        <td className="px-4 py-3 text-right relative">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <button className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors" title="Enviar Email">
                                                    <Mail size={14} />
                                                </button>
                                                <a
                                                    href={getCleanedPhoneLink(contact.phone || '')}
                                                    className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors"
                                                    title="Ligar"
                                                >
                                                    <Phone size={14} />
                                                </a>
                                                {contact.phone && isMobileNumber(contact.phone) && (
                                                    <a
                                                        href={getCleanedWhatsAppLink(contact.phone)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-emerald-500 transition-colors"
                                                        title="WhatsApp"
                                                    >
                                                        <MessageCircle size={14} />
                                                    </a>
                                                )}
                                                <div className="relative">
                                                    <button
                                                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === contact.id ? null : contact.id);
                                                        }}
                                                    >
                                                        <MoreHorizontal size={14} />
                                                    </button>
                                                    {openMenuId === contact.id && (
                                                        <div className="absolute right-0 mt-2 w-36 bg-popover border border-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                                                            <button
                                                                onClick={(e) => handleEditClick(contact, e)}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 transition-colors"
                                                            >
                                                                <Edit size={14} />
                                                                Editar
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm('Tem certeza que deseja excluir esta pessoa?')) {
                                                                        deleteContact(contact.id);
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
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
