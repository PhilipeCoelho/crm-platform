// Imports
import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ArrowLeft, User, Building, Mail, Phone, Briefcase, Calendar, Pencil, Tag, ExternalLink, Trash2, Plus, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NewContactModal from '@/components/contacts/NewContactModal';
import ActivityList from '@/components/activities/ActivityList';
import NewActivityModal from '@/components/activities/NewActivityModal';

export default function ContactDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { contacts, companies, deals, activities, deleteContact, deleteDeal, updateActivity, deleteActivity } = useCRM();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);

    const contact = contacts.find(c => c.id === id);
    if (!contact) return <div className="p-8 text-center text-muted-foreground">Contato não encontrado</div>;

    const company = companies.find(c => c.id === contact.companyId);

    // Filter Related Data
    const contactDeals = deals.filter(d => d.contactId === id);
    // Filter activities: Linked directly to Contact OR to any of the Contact's Deals
    const contactActivities = activities
        .filter(a => a.contactId === id || (a.dealId && contactDeals.some(d => d.id === a.dealId)))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first

    const handleDeleteContact = () => {
        if (window.confirm("Tem certeza que deseja excluir este contato? Esta ação apagará também todos os negócios e atividades vinculadas e não pode ser desfeita.")) {
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
                <div className="max-w-6xl mx-auto w-full space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* LEFT COLUMN: Main Info (3 cols) */}
                        <div className="lg:col-span-4 space-y-8">
                            {/* Personal Details */}
                            <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
                                <h3 className="font-semibold mb-6 text-lg flex items-center gap-2 text-foreground">
                                    <Tag size={18} className="text-primary" />
                                    Detalhes do Lead
                                </h3>
                                <div className="space-y-4">
                                    <div className="space-y-1 pb-3 border-b border-border/50 last:border-0">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Email</label>
                                        <div className="flex items-center gap-2 text-foreground text-sm">
                                            <Mail size={14} className="text-muted-foreground" />
                                            {contact.email}
                                        </div>
                                    </div>
                                    <div className="space-y-1 pb-3 border-b border-border/50 last:border-0">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Telefone</label>
                                        <div className="flex items-center gap-2 text-foreground text-sm">
                                            <Phone size={14} className="text-muted-foreground" />
                                            {contact.phone || <span className="text-muted-foreground italic">Não informado</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-1 pb-3 border-b border-border/50 last:border-0">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Organização</label>
                                        <div className="flex items-center gap-2 text-foreground text-sm">
                                            <Building size={14} className="text-muted-foreground" />
                                            {company ? (
                                                <Link to={`/companies/${company.id}`} className="hover:underline hover:text-primary transition-colors">
                                                    {company.name}
                                                </Link>
                                            ) : <span className="text-muted-foreground italic">Sem empresa vinculada</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-1 pb-3 border-b border-border/50 last:border-0">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Cargo</label>
                                        <div className="flex items-center gap-2 text-foreground text-sm">
                                            <Briefcase size={14} className="text-muted-foreground" />
                                            {contact.role || <span className="text-muted-foreground italic">Não informado</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-1 pb-3 border-b border-border/50 last:border-0">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Data de Inclusão</label>
                                        <div className="flex items-center gap-2 text-foreground text-sm">
                                            <Calendar size={14} className="text-muted-foreground" />
                                            {format(new Date(contact.createdAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* RIGHT COLUMN: Timeline & Related (8 cols) */}
                        <div className="lg:col-span-8 space-y-8">

                            {/* Deals Section */}
                            <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <Briefcase size={18} className="text-primary" />
                                        Negócios ({contactDeals.length})
                                    </h3>
                                    {/* Could Link to create deal */}
                                </div>
                                <div className="space-y-3">
                                    {contactDeals.length > 0 ? contactDeals.map(deal => (
                                        <div key={deal.id} className="block group relative">
                                            <Link to={`/deals/${deal.id}`} className="block">
                                                <div className="p-4 bg-muted/30 group-hover:bg-muted rounded-lg border border-transparent group-hover:border-border transition-all flex justify-between items-center">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{deal.title}</span>
                                                            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold
                                                                ${deal.status === 'won' ? 'bg-green-100 text-green-700' :
                                                                    deal.status === 'lost' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {deal.status === 'won' ? 'Ganho' : deal.status === 'lost' ? 'Perdido' : 'Aberto'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            Criado em {format(new Date(deal.createdAt), "d/MM/yy")}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="font-bold text-foreground bg-background px-3 py-1 rounded shadow-sm border border-border/50">
                                                            {deal.value.toLocaleString('pt-BR', { style: 'currency', currency: deal.currency })}
                                                        </span>
                                                        <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                                    </div>
                                                </div>
                                            </Link>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleDeleteDeal(deal.id);
                                                }}
                                                className="absolute top-1 right-1 p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
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

                            {/* Activities / Timeline Section */}
                            <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <MessageSquare size={18} className="text-primary" />
                                        Atividades & Histórico
                                    </h3>
                                    <button
                                        onClick={() => setIsActivityModalOpen(true)}
                                        className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors flex items-center gap-1 font-medium"
                                    >
                                        <Plus size={14} />
                                        Nova Atividade
                                    </button>
                                </div>

                                <div className="relative pl-4 border-l-2 border-border/50 space-y-8">
                                    <ActivityList
                                        activities={contactActivities}
                                        onToggle={(id) => {
                                            const act = contactActivities.find(a => a.id === id);
                                            if (act) updateActivity(id, { completed: !act.completed });
                                        }}
                                        onDelete={deleteActivity}
                                    />
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
            {isActivityModalOpen && (
                <NewActivityModal
                    isOpen={isActivityModalOpen}
                    onClose={() => setIsActivityModalOpen(false)}
                    preselectedContactId={contact.id}
                />
            )}
        </div>
    );
}
