import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { useCRM } from '@/contexts/CRMContext';
import { Building, User, Mail, Phone, Briefcase, Activity } from 'lucide-react';
import { Contact } from '@/types/schema';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    contactToEdit?: Contact;
}

export default function NewContactModal({ isOpen, onClose, contactToEdit }: Props) {
    const { addContact, updateContact, addCompany, companies } = useCRM();

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState('');
    const [status, setStatus] = useState<'active' | 'lead' | 'inactive'>('lead');

    // Company selection/creation state
    const [companyId, setCompanyId] = useState('');
    const [isCreatingCompany, setIsCreatingCompany] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (contactToEdit) {
                setName(contactToEdit.name);
                setEmail(contactToEdit.email);
                setPhone(contactToEdit.phone || '');
                setRole(contactToEdit.role || '');
                setStatus(contactToEdit.status);
                setCompanyId(contactToEdit.companyId || '');
                setIsCreatingCompany(false);
                setNewCompanyName('');
            } else {
                setName('');
                setEmail('');
                setPhone('');
                setRole('');
                setStatus('lead');
                setCompanyId('');
                setNewCompanyName('');
                setIsCreatingCompany(false);
            }
        }
    }, [isOpen, contactToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalCompanyId = companyId;

        // Create company on the fly if needed
        if (isCreatingCompany && newCompanyName) {
            const newCo = await addCompany({ name: newCompanyName });
            finalCompanyId = newCo.id;
        }

        if (contactToEdit) {
            updateContact(contactToEdit.id, {
                name,
                email,
                phone,
                role,
                companyId: finalCompanyId || undefined,
                status
            });
        } else {
            addContact({
                name,
                email,
                phone,
                role,
                companyId: finalCompanyId || undefined,
                status
            });
        }

        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={contactToEdit ? "Editar Contato" : "Novo Contato"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                        <User size={16} className="text-muted-foreground" />
                        Nome Completo
                    </label>
                    <input
                        required
                        type="text"
                        className="w-full px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Ex: Ana Silva"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                        <Mail size={16} className="text-muted-foreground" />
                        Email
                    </label>
                    <input
                        required
                        type="email"
                        className="w-full px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="ana@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                        <Phone size={16} className="text-muted-foreground" />
                        Telefone
                    </label>
                    <input
                        type="tel"
                        className="w-full px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="(11) 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Briefcase size={16} className="text-muted-foreground" />
                            Cargo
                        </label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Ex: Gerente"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Activity size={16} className="text-muted-foreground" />
                            Status
                        </label>
                        <select
                            className="w-full px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                        >
                            <option value="lead">Lead</option>
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                        <Building size={16} className="text-muted-foreground" />
                        Empresa
                    </label>
                    {!isCreatingCompany ? (
                        <div className="flex gap-2">
                            <select
                                className="flex-1 px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                                value={companyId}
                                onChange={(e) => setCompanyId(e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setIsCreatingCompany(true)}
                                className="px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-foreground"
                                title="Nova Empresa"
                            >
                                +
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-left-2">
                            <input
                                autoFocus
                                type="text"
                                className="flex-1 px-3 py-2 border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Nome da empresa"
                                value={newCompanyName}
                                onChange={(e) => setNewCompanyName(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setIsCreatingCompany(false)}
                                className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        {contactToEdit ? "Salvar Alterações" : "Salvar Contato"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
