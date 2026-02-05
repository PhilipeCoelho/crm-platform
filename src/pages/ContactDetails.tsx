import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ArrowLeft, User, Building, Mail, Phone, Briefcase, Calendar, Clock, Pencil, Tag, ExternalLink, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NewContactModal from '@/components/contacts/NewContactModal';

export default function ContactDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { contacts, companies, deals, deleteContact, deleteDeal } = useCRM();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const contact = contacts.find(c => c.id === id);
    if (!contact) return <div className="p-8 text-center text-muted-foreground">Contato não encontrado</div>;

    const company = companies.find(c => c.id === contact.companyId);
    const contactDeals = deals.filter(d => d.contactId === id);

    const handleDeleteContact = () => {
        if (window.confirm("Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.")) {
            if (id) {
                deleteContact(id);
                navigate('/contacts');
            }
        }
    };

    const handleDeleteDeal = (dealId: string) => {
        if (window.confirm("Tem certeza que deseja excluir este negócio?")) {
            deleteDeal(dealId);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background">
            {/* Header */}
            <div className="bg-card border-b border-border p-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-muted-foreground" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <User size={24} className="text-primary" />
                                {contact.name}
                            </h1>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
                                            ${contact.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' :
                                    contact.status === 'lead' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                        'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                {contact.status === 'active' ? 'Ativo' : contact.status === 'lead' ? 'Lead' : 'Inativo'}
                            </span>
                        </div>
                        <p className="text-muted-foreground text-sm flex items-center gap-4 mt-1">
                            {contact.role && <span className="flex items-center gap-1"><Briefcase size={12} /> {contact.role}</span>}
                            {company && <span className="flex items-center gap-1 text-primary hover:underline cursor-pointer" onClick={() => navigate(`/companies/${company.id}`)}><Building size={12} /> {company.name}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDeleteContact}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                        title="Excluir Contato"
                    >
                        <Trash2 size={14} />
                        Excluir
                    </button>
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="px-4 py-2 bg-background border border-border hover:bg-muted rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                        <Pencil size={14} />
                        Editar Contato
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-5xl mx-auto w-full space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Info Column */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Personal Details */}
                            <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
                                <h3 className="font-semibold mb-6 text-lg flex items-center gap-2 text-foreground">
                                    <Tag size={18} className="text-primary" />
                                    Detalhes do Lead
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Email</label>
                                        <div className="flex items-center gap-2 text-foreground">
                                            <Mail size={16} className="text-muted-foreground" />
                                            {contact.email}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Telefone</label>
                                        <div className="flex items-center gap-2 text-foreground">
                                            <Phone size={16} className="text-muted-foreground" />
                                            {contact.phone || <span className="text-muted-foreground italic">Não informado</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Organização</label>
                                        <div className="flex items-center gap-2 text-foreground">
                                            <Building size={16} className="text-muted-foreground" />
                                            {company ? (
                                                <Link to={`/companies/${company.id}`} className="hover:underline hover:text-primary transition-colors">
                                                    {company.name}
                                                </Link>
                                            ) : <span className="text-muted-foreground italic">Sem empresa vinculada</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Cargo</label>
                                        <div className="flex items-center gap-2 text-foreground">
                                            <Briefcase size={16} className="text-muted-foreground" />
                                            {contact.role || <span className="text-muted-foreground italic">Não informado</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Data de Inclusão</label>
                                        <div className="flex items-center gap-2 text-foreground">
                                            <Calendar size={16} className="text-muted-foreground" />
                                            {format(new Date(contact.createdAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Última Atividade</label>
                                        <div className="flex items-center gap-2 text-foreground">
                                            <Clock size={16} className="text-muted-foreground" />
                                            {contact.lastActivity ? format(new Date(contact.lastActivity), "d 'de' MMMM", { locale: ptBR }) : <span className="text-muted-foreground italic">Nenhuma atividade</span>}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Additional section could go here */}
                        </div>

                        {/* Side Column: Related Entities */}
                        <div className="space-y-6">
                            {/* Related Deals */}
                            <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-lg">Negócios ({contactDeals.length})</h3>
                                    {/* Could add 'Add Deal' button here later */}
                                </div>
                                <div className="space-y-3">
                                    {contactDeals.length > 0 ? contactDeals.map(deal => (
                                        <div key={deal.id} className="block group relative">
                                            <Link to={`/deals/${deal.id}`} className="block">
                                                <div className="p-3 bg-muted/30 group-hover:bg-muted rounded-lg border border-transparent group-hover:border-border transition-all pr-8">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">{deal.title}</span>
                                                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-muted-foreground">{format(new Date(deal.createdAt), "d/MM/yy")}</span>
                                                        <span className="font-bold text-foreground bg-background px-2 py-0.5 rounded shadow-sm">
                                                            {deal.value.toLocaleString('pt-BR', { style: 'currency', currency: deal.currency })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleDeleteDeal(deal.id);
                                                }}
                                                className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                                                title="Excluir negócio"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
                                            <p className="text-sm">Nenhum negócio vinculado.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>

            {isEditModalOpen && (
                <NewContactModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    contactToEdit={contact}
                />
            )}
        </div>
    );
}
