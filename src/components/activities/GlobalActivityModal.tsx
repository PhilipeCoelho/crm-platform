import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import {
    X,
    Users,
    Building2,
    CheckCircle2,
    Phone,
    Mail,
    MessageSquare,
    Search,
    Plus,
    Check,
    AlertCircle,
    BarChart3,
    Video
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const TYPES = [
    { value: 'message', label: 'Mensagem', icon: MessageSquare },
    { value: 'email', label: 'E-mail', icon: Mail },
    { value: 'call', label: 'Ligação', icon: Phone },
    { value: 'task', label: 'Tarefa', icon: CheckCircle2 },
    { value: 'meeting', label: 'Reunião', icon: Users },
    { value: 'analysis', label: 'Análise', icon: BarChart3 },
    { value: 'audit', label: 'Auditoria', icon: Video },
];

const PRIORITIES = [
    { value: 'low', label: 'Baixa', color: 'text-slate-500 bg-slate-50 border-slate-200' },
    { value: 'medium', label: 'Normal', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { value: 'high', label: 'Urgente', color: 'text-red-600 bg-red-50 border-red-200' },
];

export default function GlobalActivityModal({ isOpen, onClose }: Props) {
    const { deals, contacts, addActivity } = useCRM();

    // Form State
    const [type, setType] = useState('message');
    const [title, setTitle] = useState('');
    const [contactId, setContactId] = useState('');
    const [dealId, setDealId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(() => {
        const now = new Date();
        now.setHours(now.getHours() + 1);
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });
    const [duration, setDuration] = useState(30);
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [notes, setNotes] = useState('');

    // Search States
    const [contactSearch, setContactSearch] = useState('');
    const [dealSearch, setDealSearch] = useState('');
    const [showContactResults, setShowContactResults] = useState(false);
    const [showDealResults, setShowDealResults] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filtered results
    const filteredContacts = useMemo(() => {
        if (!contactSearch) return [];
        return contacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase())).slice(0, 5);
    }, [contacts, contactSearch]);

    const filteredDeals = useMemo(() => {
        if (!dealSearch) return [];
        return deals.filter(d => d.title.toLowerCase().includes(dealSearch.toLowerCase())).slice(0, 5);
    }, [deals, dealSearch]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || isSubmitting) return;

        if (!contactId && !dealId) {
            alert('A atividade deve estar vinculada a pelo menos um Negócio ou Contato.');
            return;
        }

        setIsSubmitting(true);
        try {
            await addActivity({
                type: type as any,
                title,
                dealId: dealId || undefined,
                contactId: contactId || undefined,
                dueDate: `${date}T${time}:00.000`,
                duration,
                notes,
                priority,
                completed: false,
                status: 'pending'
            });
            resetAndClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetAndClose = () => {
        setTitle('');
        setContactId('');
        setDealId('');
        setContactSearch('');
        setDealSearch('');
        setNotes('');
        setPriority('medium');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#090B11]/80 p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#11141D] w-full max-w-xl sm:rounded-3xl shadow-2xl border border-border dark:border-white/10 flex flex-col h-[90vh] sm:h-auto max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500">

                <div className="flex items-center justify-between p-6 border-b border-border dark:border-white/5 bg-[#FBFCFD] dark:bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/20 text-white flex items-center justify-center">
                            <Plus size={24} className="stroke-[3]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-[#141414] dark:text-white tracking-tight">Nova Atividade</h2>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Centro Operacional de Tarefas</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl text-slate-400 transition-all">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">

                    <div className="space-y-4">
                        <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Plus size={12} className="text-primary" />
                            Tipo de Atividade
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {TYPES.map(t => {
                                const Icon = t.icon;
                                const isSelected = type === t.value;
                                return (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => setType(t.value)}
                                        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border
                                            ${isSelected
                                                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105'
                                                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 hover:border-primary/50'}`}
                                    >
                                        <Icon size={16} className={isSelected ? 'stroke-[2.5]' : ''} />
                                        <span>{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Assunto / Título</label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: Reunião de apresentação, Ligar para follow-up..."
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-slate-400"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-3 relative">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Users size={12} className="text-primary" />
                                Pessoa de Contato
                            </label>
                            <div className="relative group">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar pessoa..."
                                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                                    value={contactSearch}
                                    onChange={e => {
                                        setContactSearch(e.target.value);
                                        setShowContactResults(true);
                                        if (!e.target.value) setContactId('');
                                    }}
                                    onFocus={() => setShowContactResults(true)}
                                />
                                {contactId && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 animate-in zoom-in-0">
                                        <Check size={18} className="stroke-[3]" />
                                    </div>
                                )}
                            </div>

                            {showContactResults && filteredContacts.length > 0 && (
                                <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white dark:bg-[#1A1D26] border border-border dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    {filteredContacts.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-4 transition-colors"
                                            onClick={() => {
                                                setContactId(c.id);
                                                setContactSearch(c.name);
                                                setShowContactResults(false);
                                            }}
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                                                {c.name.charAt(0)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{c.name}</span>
                                                <span className="text-[10px] text-slate-500 font-bold">{c.email}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 relative">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Building2 size={12} className="text-primary" />
                                Negócio Vinculado
                            </label>
                            <div className="relative group">
                                <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Buscar negócio..."
                                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                                    value={dealSearch}
                                    onChange={e => {
                                        setDealSearch(e.target.value);
                                        setShowDealResults(true);
                                        if (!e.target.value) setDealId('');
                                    }}
                                    onFocus={() => setShowDealResults(true)}
                                />
                                {dealId && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 animate-in zoom-in-0">
                                        <Check size={18} className="stroke-[3]" />
                                    </div>
                                )}
                            </div>

                            {showDealResults && filteredDeals.length > 0 && (
                                <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white dark:bg-[#1A1D26] border border-border dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    {filteredDeals.map(d => (
                                        <button
                                            key={d.id}
                                            type="button"
                                            className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-4 transition-colors"
                                            onClick={() => {
                                                setDealId(d.id);
                                                setDealSearch(d.title);
                                                setShowDealResults(false);
                                            }}
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs">
                                                $
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{d.title}</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Valor: {d.value}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Data de Vencimento</label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Hora</label>
                            <input
                                type="text"
                                placeholder="HH:mm"
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/5 transition-all text-center"
                                value={time}
                                onChange={e => setTime(e.target.value)}
                            />
                        </div>
                        <div className="space-y-3 col-span-2 sm:col-span-1">
                            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Duração</label>
                            <div className="flex items-center gap-2">
                                {[15, 30, 60].map(d => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setDuration(d)}
                                        className={`flex-1 py-3.5 px-2 rounded-2xl text-[11px] font-black transition-all border
                                            ${duration === d
                                                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/10'
                                                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 hover:border-primary/50'}`}
                                    >
                                        {d}m
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <AlertCircle size={12} className="text-primary" />
                            Definir Prioridade
                        </label>
                        <div className="flex items-center gap-3">
                            {PRIORITIES.map(p => (
                                <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => setPriority(p.value as any)}
                                    className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] transition-all border
                                        ${priority === p.value
                                            ? `${p.color} border-current scale-105 shadow-md`
                                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-400 hover:border-slate-300'}`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observações / Detalhes</label>
                        <textarea
                            rows={3}
                            placeholder="Adicione detalhes sobre o que precisa ser feito..."
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                </form>

                <div className="p-8 border-t border-border dark:border-white/5 bg-[#FBFCFD] dark:bg-white/[0.02] flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!title.trim() || isSubmitting}
                        className="px-10 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black uppercase tracking-[0.15em] transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 flex items-center gap-3"
                    >
                        {isSubmitting ? 'Gerando...' : (
                            <>
                                <Check size={18} className="stroke-[3]" />
                                Agendar Atividade
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="absolute inset-0 z-[-1]" onClick={onClose} />
        </div>
    );
}
