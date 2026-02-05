import { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Search, Filter, Plus, MoreHorizontal, Mail, Phone, Edit, Trash2 } from 'lucide-react';
import NewContactModal from './NewContactModal';
import { useNavigate } from 'react-router-dom';
import { Contact } from '@/types/schema';

export default function ContactList() {
    const { contacts, companies, deleteContact } = useCRM();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const navigate = useNavigate();

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const filteredContacts = contacts.filter(contact => {
        const company = companies.find(c => c.id === contact.companyId);
        const companyName = company?.name || '';
        const searchLower = searchTerm.toLowerCase();

        return (
            contact.name.toLowerCase().includes(searchLower) ||
            contact.email.toLowerCase().includes(searchLower) ||
            companyName.toLowerCase().includes(searchLower)
        );
    });

    const getCompanyName = (id?: string) => {
        if (!id) return '-';
        return companies.find(c => c.id === id)?.name || '-';
    };

    const handleEditClick = (contact: Contact, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click
        setEditingContact(contact);
        setIsModalOpen(true);
        setOpenMenuId(null);
    };

    const handleCreateClick = () => {
        setEditingContact(undefined);
        setIsModalOpen(true);
    };

    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Contatos</h2>
                <button
                    onClick={handleCreateClick}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
                >
                    <Plus size={16} />
                    Novo Contato
                </button>
            </div>

            {/* Filters Bar */}
            <div className="flex gap-4 items-center bg-card p-4 rounded-lg border border-border">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nome, email ou empresa..."
                        className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="flex items-center gap-2 px-3 py-2 border border-input rounded-md hover:bg-muted transition-colors text-sm font-medium">
                    <Filter size={16} />
                    Filtros
                </button>
            </div>

            {/* Table */}
            <div className="bg-card rounded-lg border border-border flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto min-h-[400px]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-xs border-b border-border sticky top-0">
                            <tr>
                                <th className="px-6 py-3">Nome</th>
                                <th className="px-6 py-3">Empresa</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Última Atividade</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredContacts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                        Nenhum contato encontrado.
                                        {contacts.length === 0 && " Crie seu primeiro contato!"}
                                    </td>
                                </tr>
                            ) : (
                                filteredContacts.map((contact) => (
                                    <tr
                                        key={contact.id}
                                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                                        onClick={() => navigate(`/contacts/${contact.id}`)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                        {contact.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {contact.name}
                                                </span>
                                                <span className="text-muted-foreground text-xs ml-8">{contact.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-foreground">{getCompanyName(contact.companyId)}</span>
                                                <span className="text-muted-foreground text-xs">{contact.role || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                            ${contact.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    contact.status === 'lead' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                {contact.status === 'active' ? 'Ativo' : contact.status === 'lead' ? 'Lead' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {contact.lastActivity ? new Date(contact.lastActivity).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <button className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-primary" title="Enviar Email">
                                                    <Mail size={16} />
                                                </button>
                                                <button className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-primary" title="Ligar">
                                                    <Phone size={16} />
                                                </button>
                                                <div className="relative">
                                                    <button
                                                        className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground active:bg-muted"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === contact.id ? null : contact.id);
                                                        }}
                                                    >
                                                        <MoreHorizontal size={16} />
                                                    </button>
                                                    {openMenuId === contact.id && (
                                                        <div className="absolute right-0 mt-2 w-32 bg-popover border border-border rounded-md shadow-lg z-50 py-1">
                                                            <button
                                                                onClick={(e) => handleEditClick(contact, e)}
                                                                className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
                                                            >
                                                                <Edit size={14} />
                                                                Editar
                                                            </button>
                                                            {/* Deleting not implemented yet strictly but could add placeholder */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm('Tem certeza que deseja excluir este contato?')) {
                                                                        deleteContact(contact.id);
                                                                        setOpenMenuId(null);
                                                                    }
                                                                }}
                                                                className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 transition-colors"
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
