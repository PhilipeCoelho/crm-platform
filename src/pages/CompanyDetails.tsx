import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ArrowLeft, Building, Globe, FileText } from 'lucide-react';

export default function CompanyDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { companies, contacts, deals } = useCRM();

    const company = companies.find(c => c.id === id);
    if (!company) return <div>Empresa não encontrada</div>;

    const companyContacts = contacts.filter(c => c.companyId === id);
    const companyDeals = deals.filter(d => d.companyId === id);
    // Find activities for this company OR its contacts OR its deals
    // The relatedActivities variable was unused and has been removed.

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background">
            <div className="bg-card border-b border-border p-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-muted-foreground" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Building size={24} className="text-primary" />
                            {company.name}
                        </h1>
                        <p className="text-muted-foreground text-sm flex items-center gap-4 mt-1">
                            {company.website && <span className="flex items-center gap-1"><Globe size={12} /> {company.website}</span>}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-border p-6 overflow-y-auto bg-card/30 space-y-6">
                    {/* Contacts Module */}
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                        <div className="p-3 border-b border-border bg-muted/30 font-medium text-sm flex justify-between items-center">
                            Contatos ({companyContacts.length})
                        </div>
                        <div className="divide-y divide-border">
                            {companyContacts.map(contact => (
                                <Link to={`/contacts/${contact.id}`} key={contact.id} className="block p-3 hover:bg-muted/50 transition-colors">
                                    <div className="font-medium text-sm">{contact.name}</div>
                                    <div className="text-xs text-muted-foreground">{contact.email}</div>
                                </Link>
                            ))}
                            {companyContacts.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">Nenhum contato vinculado</div>}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Active Deals */}
                    <div>
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <FileText size={18} className="text-primary" />
                            Negócios Ativos
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {companyDeals.map(deal => (
                                <Link to={`/deals/${deal.id}`} key={deal.id} className="block p-4 bg-card rounded-lg border border-border hover:border-primary transition-all shadow-sm">
                                    <div className="font-medium mb-1">{deal.title}</div>
                                    <div className="text-sm font-bold text-primary">
                                        {deal.value.toLocaleString('pt-BR', { style: 'currency', currency: deal.currency })}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-2 uppercase tracking-wide bg-muted inline-block px-1 rounded">
                                        {deal.status}
                                    </div>
                                </Link>
                            ))}
                            {companyDeals.length === 0 && <div className="col-span-3 text-sm text-muted-foreground italic">Nenhum negócio ativo.</div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
