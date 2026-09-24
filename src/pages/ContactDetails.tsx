// Imports
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { ArrowLeft, User, Building, Mail, Phone, Briefcase, Calendar, Pencil, Tag, ExternalLink, Trash2, Plus, MessageSquare, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NewContactModal from '@/components/contacts/NewContactModal';
import ActivityList from '@/components/activities-v2/ActivityList';
import NewActivityModal from '@/components/activities-v2/NewActivityModal';
import ConvertToDealModal from '@/components/contacts/ConvertToDealModal';
import { isMobileNumber, getCleanedWhatsAppLink } from '@/utils/phoneHelpers';
import { supabase } from '@/lib/supabase';
import DiagnosticDossierModal, { DiagnosticData } from '@/components/diagnostics/DiagnosticDossierModal';

interface Props {
    contactId?: string;
    onClose?: () => void;
    isModal?: boolean;
}

export default function ContactDetails({ contactId, onClose, isModal }: Props) {
    const { id: paramsId } = useParams();
    const id = contactId || paramsId;
    const navigate = useNavigate();
    const { contacts, companies, deals, activities, deleteContact, deleteDeal, updateActivity, deleteActivity, openFocusDeal, openFocusCompany, addActivity, updateContact } = useCRM();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [isConvertToDealOpen, setIsConvertToDealOpen] = useState(false);
    const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
    const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
    const [noteText, setNoteText] = useState('');

    const contact = contacts.find(c => c.id === id);
    if (!contact) return <div className="p-8 text-center text-muted-foreground">Contato não encontrado</div>;

    const company = companies.find(c => c.id === contact.companyId);

    const handleBack = () => {
        if (onClose) {
            onClose();
        } else {
            navigate(-1);
        }
    };

    // Sincronizar dados da página de obrigado / email_logs se existirem
    useEffect(() => {
        if (!id) return;
        const syncThankYouPageNotes = async () => {
            try {
                const { data: extraLogs } = await supabase
                    .from('email_logs')
                    .select('content, sent_at')
                    .eq('person_id', id)
                    .order('sent_at', { ascending: true });

                if (extraLogs && extraLogs.length > 0) {
                    let currentNotes = contact?.notes || '';
                    let changed = false;
                    for (const l of extraLogs) {
                        if (l.content && !currentNotes.includes(l.content.trim())) {
                            currentNotes = currentNotes ? `${currentNotes}\n\n${l.content.trim()}` : l.content.trim();
                            changed = true;
                        }
                    }
                    if (changed) {
                        await updateContact(id, { notes: currentNotes });
                    }
                }
            } catch (err) {
                console.warn('Erro ao sincronizar notas em ContactDetails:', err);
            }
        };
        syncThankYouPageNotes();
    }, [id, contact?.notes]);

    // Carregar Diagnóstico Estratégico da tabela diagnostics ou fallback das notas
    useEffect(() => {
        if (!id) return;
        const fetchDiagnostic = async () => {
            try {
                const { data, error } = await supabase
                    .from('diagnostics')
                    .select('*')
                    .eq('contact_id', id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (data && !error) {
                    setDiagnostic(data);
                } else if (contact?.notes && (contact.notes.includes('DOSSIÊ ESTRATÉGICO') || contact.notes.includes('Página de Obrigado') || contact.notes.includes('Auditoria'))) {
                    // Fallback resiliente a partir das notas
                    const scoreMatch = contact.notes.match(/Score[^:\d]*:\s*(\d+)/i) || contact.notes.match(/(\d+)\/100/);
                    const goalMatch = contact.notes.match(/•?\s*(?:Meta|Prioridade|Objetivo)[^:\n]*:\s*([^\n\r]+)/i);
                    const challengeMatch = contact.notes.match(/•?\s*Principal Desafio[^:\n]*:\s*([^\n\r]+)/i);
                    const budgetMatch = contact.notes.match(/•?\s*(?:Orçamento|Investimento)[^:\n]*:\s*([^\n\r]+)/i);
                    const ticketMatch = contact.notes.match(/•?\s*Ticket Médio[^:\n]*:\s*([^\n\r]+)/i);
                    const capacityMatch = contact.notes.match(/•?\s*Capacidade[^:\n]*:\s*([^\n\r]+)/i);

                    setDiagnostic({
                        contact_id: id,
                        overall_score: scoreMatch ? parseInt(scoreMatch[1], 10) : 65,
                        primary_goal: goalMatch ? goalMatch[1].trim() : undefined,
                        primary_challenge: challengeMatch ? challengeMatch[1].trim() : undefined,
                        monthly_media_budget: budgetMatch ? budgetMatch[1].trim() : undefined,
                        average_patient_value: ticketMatch ? ticketMatch[1].trim() : undefined,
                        clinic_capacity: capacityMatch ? capacityMatch[1].trim() : undefined,
                        internal_report: contact.notes,
                        top_opportunities: [
                            { title: 'Blindagem da Rota de Conversão no WhatsApp', category: 'Conversão', priority: 'Alta', evidence: 'Oportunidade identificada na auditoria dos canais.', impact: 'Elevação imediata de agendamentos.', hypothesis: 'Ativar resposta rápida e triagem comercial.' },
                            { title: 'Ativação do Rastreamento de Audiências (Meta Pixel)', category: 'Tracking', priority: 'Alta', evidence: 'Ausência de retargeting aos visitantes.', impact: 'Recuperação de pacientes indecisos.', hypothesis: 'Instalação de Pixel e eventos de conversão.' },
                            { title: 'Captura de Intenção Local no Google', category: 'Google', priority: 'Alta', evidence: 'Concorrentes locais ativos na região.', impact: 'Captação de pacientes prontos para agendar.', hypothesis: 'Campanha de Google Search geolocalizada.' }
                        ],
                        meeting_questions: [
                            'Quando um novo potencial paciente envia mensagem no WhatsApp, quem responde e em quanto tempo?',
                            'Qual é a percentagem aproximada de pacientes particulares vs acordos e seguradoras?',
                            'Quais tratamentos apresentam maior margem e horários vagos na agenda?'
                        ],
                        strategy_hypothesis: {
                            acquisitionChannels: 'Google Search Local + Meta Ads',
                            primaryObjective: goalMatch ? goalMatch[1].trim() : 'Novos Pacientes Particulares',
                            mainBottleneck: 'Conversão no Website / Ponto de Contacto'
                        },
                        reviewed_by_vamuss: false
                    });
                }
            } catch (err) {
                console.warn('Erro ao carregar diagnóstico:', err);
            }
        };
        fetchDiagnostic();
    }, [id, contact?.notes]);

    // Filter Related Data
    const contactDeals = deals.filter(d => d.contactId === id);
    const activeDeals = contactDeals.filter(d => !['lost', 'desqualificado'].includes(d.status));
    
    // Filter activities: Linked directly to Contact OR to any of the Contact's ACTIVE Deals
    const contactActivities = activities
        .filter(a => a.contactId === id || (a.dealId && activeDeals.some(d => d.id === a.dealId)))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first

    const handleDeleteContact = () => {
        if (window.confirm("Tem certeza que deseja excluir este contato? Esta ação apagará também todos os negócios e atividades vinculadas e não pode ser desfeita.")) {
            if (id) {
                deleteContact(id);
                if (onClose) {
                    onClose();
                } else {
                    navigate('/contacts');
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
                contactId: id,
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
                                <User size={24} className="text-primary" />
                                {contact.name}
                            </h1>
                        </div>
                        <p className="text-muted-foreground text-sm flex items-center gap-4 mt-1">
                            {contact.role && <span className="flex items-center gap-1"><Briefcase size={12} /> {contact.role}</span>}
                            {company && (
                                <span 
                                    className="flex items-center gap-1 text-primary hover:underline cursor-pointer" 
                                    onClick={() => isModal ? openFocusCompany(company.id) : navigate(`/companies/${company.id}`)}
                                >
                                    <Building size={12} /> {company.name}
                                </span>
                            )}
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
                    <button
                        onClick={() => setIsConvertToDealOpen(true)}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
                        title="Transformar este contacto num negócio no Pipeline (coluna Prospects)"
                    >
                        <Sparkles size={15} />
                        Transformar em Negócio
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-6xl mx-auto w-full space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* LEFT COLUMN: Main Info (3 cols) */}
                        <div className="lg:col-span-4 space-y-8">
                            {/* Card de Destaque: Diagnóstico Estratégico Vamuss__ */}
                            {diagnostic && (
                                <section className="bg-card rounded-xl border-2 border-primary/30 p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <Sparkles className="w-4 h-4 text-emerald-600" />
                                            <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                                                Diagnóstico Estratégico
                                            </h3>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                            diagnostic.reviewed_by_vamuss 
                                                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}>
                                            {diagnostic.reviewed_by_vamuss ? '✓ Revisado' : 'Pendente Revisão'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Vamuss Readiness</span>
                                            <span className="text-2xl font-extrabold text-foreground">{diagnostic.overall_score || 65}<span className="text-xs font-normal text-muted-foreground">/100</span></span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Meta Declarada</span>
                                            <span className="text-xs font-semibold text-foreground max-w-[150px] truncate block" title={diagnostic.primary_goal}>
                                                {diagnostic.primary_goal || 'Novos Pacientes'}
                                            </span>
                                        </div>
                                    </div>

                                    {diagnostic.primary_challenge && (
                                        <div className="text-xs space-y-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">Gargalo / Desafio</span>
                                            <p className="text-foreground font-medium text-xs bg-muted/30 p-2 rounded-md border border-border/60">
                                                {diagnostic.primary_challenge}
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => setIsDossierModalOpen(true)}
                                        className="w-full py-2.5 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                        <Sparkles size={13} />
                                        <span>Abrir Dossiê & Roteiro de Reunião</span>
                                    </button>
                                </section>
                            )}

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
                                        <div className="flex items-center justify-between gap-2 text-foreground text-sm group">
                                            <div className="flex items-center gap-2">
                                                <Phone size={14} className="text-muted-foreground" />
                                                <a href={contact.phone ? `tel:${contact.phone.replace(/\D/g, '')}` : '#'} className={contact.phone ? "hover:text-primary transition-colors font-medium" : "cursor-default"}>
                                                    {contact.phone || <span className="text-muted-foreground italic">Não informado</span>}
                                                </a>
                                            </div>
                                            {contact.phone && isMobileNumber(contact.phone) && (
                                                <a
                                                    href={getCleanedWhatsAppLink(contact.phone)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-emerald-500 hover:text-emerald-600 transition-colors flex items-center gap-1 text-[10px] font-bold bg-emerald-500/5 px-2 py-1 rounded-md"
                                                >
                                                    <MessageSquare size={12} />
                                                    WhatsApp
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1 pb-3 border-b border-border/50 last:border-0">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Organização</label>
                                        <div className="flex items-center gap-2 text-foreground text-sm">
                                            <Building size={14} className="text-muted-foreground" />
                                            {company ? (
                                                <button 
                                                    onClick={() => isModal ? openFocusCompany(company.id) : navigate(`/companies/${company.id}`)}
                                                    className="hover:underline hover:text-primary transition-colors text-left"
                                                >
                                                    {company.name}
                                                </button>
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
                                    {contact.notes && (
                                        <div className="space-y-2 pt-3 border-t border-border/50">
                                            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                                <Tag size={13} className="text-primary" />
                                                Notas & Origem (Landing Page)
                                            </label>
                                            <div className="text-xs text-foreground bg-muted/40 border border-border/70 rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed font-sans shadow-inner">
                                                {contact.notes}
                                            </div>
                                        </div>
                                    )}
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
                                    <button
                                        onClick={() => setIsConvertToDealOpen(true)}
                                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
                                    >
                                        <Plus size={14} />
                                        Novo Negócio
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {contactDeals.length > 0 ? contactDeals.map(deal => (
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
                                        <div className="text-center py-6 px-4 bg-muted/20 rounded-xl border border-dashed border-border space-y-3">
                                            <p className="text-sm text-muted-foreground">Nenhum negócio vinculado a este contacto.</p>
                                            <button
                                                onClick={() => setIsConvertToDealOpen(true)}
                                                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all"
                                            >
                                                <Sparkles size={14} />
                                                Transformar em Negócio (Coluna Prospects)
                                            </button>
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
                                            placeholder={activeDeals.length > 0 ? "Escreva uma anotação sobre este contato..." : "Crie um negócio primeiro para adicionar anotações."}
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
            {isConvertToDealOpen && (
                <ConvertToDealModal
                    isOpen={isConvertToDealOpen}
                    onClose={() => setIsConvertToDealOpen(false)}
                    contact={contact}
                    onSuccess={() => setIsConvertToDealOpen(false)}
                />
            )}
            {diagnostic && (
                <DiagnosticDossierModal
                    isOpen={isDossierModalOpen}
                    onClose={() => setIsDossierModalOpen(false)}
                    diagnostic={diagnostic}
                    clinicName={company?.name || contact.name}
                    contactName={contact.name}
                    onReviewedChange={(isReviewed) => {
                        setDiagnostic(prev => prev ? { ...prev, reviewed_by_vamuss: isReviewed } : null);
                    }}
                />
            )}
        </div>
    );
}
