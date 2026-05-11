import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ArrowLeft, Building, Globe, FileText, Trash2, Tag, Briefcase, Calendar, Phone, Mail, ExternalLink, MessageSquare, Plus, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ActivityList from '@/components/activities/ActivityList';
import NewActivityModal from '@/components/activities/NewActivityModal';

interface Props {
    companyId?: string;
    onClose?: () => void;
    isModal?: boolean;
}

export default function CompanyDetails({ companyId, onClose, isModal }: Props) {
    const { id: paramsId } = useParams();
    const id = companyId || paramsId;
    const navigate = useNavigate();
    const { companies, contacts, deals, activities, deleteCompany, deleteDeal, updateActivity, deleteActivity, openFocusDeal, openFocusContact, addActivity } = useCRM();
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [noteText, setNoteText] = useState('');

    const company = companies.find(c => c.id === id);
    if (!company) return <div className="p-8 text-center text-muted-foreground">Empresa não encontrada</div>;

    const handleBack = () => {
        if (onClose) {
            onClose();
        } else {
            navigate(-1);
        }
    };

    // Filter Related Data
    const companyContacts = contacts.filter(c => c.companyId === id);
    const companyDeals = deals.filter(d => d.companyId === id);
    const activeDeals = companyDeals.filter(d => !['lost', 'desqualificado'].includes(d.status));
    
    // Filter activities: Linked directly to Company OR its contacts OR to any of the Company's ACTIVE Deals
    const companyActivities = activities
        .filter(a => 
            a.companyId === id || 
            companyContacts.some(c => c.id === a.contactId) || 
            (a.dealId && activeDeals.some(d => d.id === a.dealId))
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first

    const handleDeleteCompany = () => {
        if (window.confirm("Tem certeza que deseja excluir esta organização? Esta ação não pode ser desfeita.")) {
            if (id) {
                deleteCompany(id);
                if (onClose) {
                    onClose();
                } else {
                    navigate('/companies');
                }
            }
        }
    };

    const handleDeleteDeal = (dealId: string) => {
        if (window.confirm("Tem certeza que deseja excluir este negócio?")) {
            deleteDeal(dealId);
        }
    };

    const handleAddNote = async () => {
        if (!noteText.trim() || activeDeals.length === 0) return;
        try {
            const today = new Date().toISOString().split('T')[0];
            await addActivity({
                title: 'Nota Rápida',
                type: 'note',
                companyId: id,
                dealId: activeDeals[0].id,
                notes: noteText,
                completed: true,
                status: 'completed',
                dueDate: `${today}T12:00:00.000Z`,
                duration: 0
            } as any);
            setNoteText('');
        } catch (error) {
            console.error('Erro ao adicionar nota:', error);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background">
            {/* Header */}
            <div className="bg-card border-b border-border p-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={handleBack} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-muted-foreground" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Building size={24} className="text-primary" />
                                {company.name}
                            </h1>
                        </div>
                        <p className="text-muted-foreground text-sm flex items-center gap-4 mt-1">
                            {company.website && (
                                <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                                    <Globe size={12} /> {company.website}
                                </a>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDeleteCompany}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                        title="Excluir Organização"
                    >
                        <Trash2 size={14} />
                        Excluir
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-6xl mx-auto w-full space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* LEFT COLUMN: Main Info (4 cols) */}
                        <div className="lg:col-span-4 space-y-8">
                            {/* Company Details */}
                            <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
                                <h3 className="font-semibold mb-6 text-lg flex items-center gap-2 text-foreground">
                                    <Tag size={18} className="text-primary" />
                                    Detalhes da Organização
                                </h3>
                                <div className="space-y-4">
                                    <div className="space-y-1 pb-3 border-b border-border/50 last:border-0">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Email</label>
                                        <div className="flex items-center gap-2 text-foreground text-sm">
                                            <Mail size={14} className="text-muted-foreground" />
                                            {company.email || <span className="text-muted-foreground italic">Não informado</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-1 pb-3 border-b border-border/50 last:border-0">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Telefone</label>
                                        <div className="flex items-center justify-between gap-2 text-foreground text-sm group">
                                            <div className="flex items-center gap-2">
                                                <Phone size={14} className="text-muted-foreground" />
                                                <a href={company.phone ? `tel:${company.phone.replace(/\D/g, '')}` : '#'} className={company.phone ? "hover:text-primary transition-colors font-medium" : "cursor-default"}>
                                                    {company.phone || <span className="text-muted-foreground italic">Não informado</span>}
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1 pb-3 border-b border-border/50 last:border-0">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Data de Inclusão</label>
                                        <div className="flex items-center gap-2 text-foreground text-sm">
                                            <Calendar size={14} className="text-muted-foreground" />
                                            {format(new Date(company.createdAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Contacts Module */}
                            <section className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-border bg-muted/30 font-semibold flex justify-between items-center text-foreground">
                                    <div className="flex items-center gap-2">
                                        <Users size={18} className="text-primary" />
                                        Contatos ({companyContacts.length})
                                    </div>
                                </div>
                                <div className="divide-y divide-border">
                                    {companyContacts.map(contact => (
                                        <button 
                                            key={contact.id} 
                                            onClick={() => isModal ? openFocusContact(contact.id) : navigate(`/contacts/${contact.id}`)}
                                            className="block w-full text-left p-4 hover:bg-muted/50 transition-colors group"
                                        >
                                            <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{contact.name}</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">{contact.email}</div>
                                        </button>
                                    ))}
                                    {companyContacts.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum contato vinculado</div>}
                                </div>
                            </section>
                        </div>

                        {/* RIGHT COLUMN: Timeline & Related (8 cols) */}
                        <div className="lg:col-span-8 space-y-8">

                            {/* Deals Section */}
                            <section className="bg-card rounded-xl border border-border p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-lg flex items-center gap-2">
                                        <FileText size={18} className="text-primary" />
                                        Negócios ({companyDeals.length})
                                    </h3>
                                </div>
                                <div className="space-y-3">
                                    {companyDeals.length > 0 ? companyDeals.map(deal => (
                                        <div key={deal.id} className="block group relative">
                                            <button 
                                                onClick={() => isModal ? openFocusDeal(deal.id) : navigate(`/deals/${deal.id}`)}
                                                className="block w-full text-left"
                                            >
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
                                            </button>
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

                                {/* Quick Note Box */}
                                <div className="mb-6">
                                    <div className="relative group">
                                        <textarea
                                            className="w-full text-sm bg-muted/10 border border-border rounded-xl p-4 pr-32 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary resize-none transition-all placeholder:text-muted-foreground/50 min-h-[80px]"
                                            placeholder={activeDeals.length > 0 ? "Escreva uma anotação sobre esta organização..." : "Crie um negócio primeiro para adicionar anotações."}
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            disabled={activeDeals.length === 0}
                                        />
                                        <div className="absolute bottom-3 right-3">
                                            <button
                                                onClick={handleAddNote}
                                                disabled={!noteText.trim() || activeDeals.length === 0}
                                                className="bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-0"
                                            >
                                                Salvar Nota
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative pl-4 border-l-2 border-border/50 space-y-8">
                                    <ActivityList
                                        activities={companyActivities}
                                        onToggle={(id) => {
                                            const act = companyActivities.find(a => a.id === id);
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

            {isActivityModalOpen && (
                <NewActivityModal
                    isOpen={isActivityModalOpen}
                    onClose={() => setIsActivityModalOpen(false)}
                />
            )}
        </div>
    );
}
