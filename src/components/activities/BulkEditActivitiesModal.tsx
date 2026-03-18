import { useState } from 'react';
import {
    X,
    Check,
    Calendar,
    Clock,
    AlertCircle,
    Activity as ActivityIcon
} from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
    onSuccess: () => void;
}

const TYPES = [
    { value: 'call', label: 'Chamada' },
    { value: 'meeting', label: 'Reunião' },
    { value: 'task', label: 'Tarefa' },
    { value: 'email', label: 'Email' },
    { value: 'followup', label: 'Prazo' },
];

const PRIORITIES = [
    { value: 'low', label: 'Baixa' },
    { value: 'medium', label: 'Normal' },
    { value: 'high', label: 'Urgente' },
];

export default function BulkEditActivitiesModal({ isOpen, onClose, selectedIds, onSuccess }: Props) {
    const { updateActivity } = useCRM();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Selection state (which fields to update)
    const [fieldsToUpdate, setFieldsToUpdate] = useState<{
        type?: boolean;
        priority?: boolean;
        date?: boolean;
        owner?: boolean;
    }>({});

    // Values state
    const [type, setType] = useState('call');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('10:00');

    const handleSave = async () => {
        if (Object.values(fieldsToUpdate).every(v => !v)) {
            alert('Por favor, selecione pelo menos um campo para editar.');
            return;
        }

        setIsSubmitting(true);
        try {
            const updates: any = {};
            if (fieldsToUpdate.type) updates.type = type;
            if (fieldsToUpdate.priority) updates.priority = priority;
            if (fieldsToUpdate.date) updates.dueDate = `${date}T${time}:00.000Z`;

            // Apply updates to all selected IDs (optimistic update is handled in updateActivity)
            await Promise.all(selectedIds.map(id => updateActivity(id, updates)));

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error in bulk update:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#11141D] w-full max-w-lg rounded-3xl shadow-2xl border border-border dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="p-6 border-b border-border dark:border-white/5 bg-[#FBFCFD] dark:bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <ActivityIcon size={20} className="stroke-[2.5]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-[#141414] dark:text-white tracking-tight">Editar em Massa</h2>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                                {selectedIds.length} Atividades Selecionadas
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-900/30 p-4 rounded-2xl flex items-start gap-3">
                        <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 leading-relaxed">
                            Selecione os campos que deseja atualizar. Os novos valores serão aplicados a todas as {selectedIds.length} atividades selecionadas.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {/* Type Field */}
                        <div className={`p-4 rounded-2xl border transition-all ${fieldsToUpdate.type ? 'bg-primary/[0.02] border-primary/30 ring-1 ring-primary/10' : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-primary focus:ring-primary/20"
                                        checked={fieldsToUpdate.type}
                                        onChange={e => setFieldsToUpdate(prev => ({ ...prev, type: e.target.checked }))}
                                    />
                                    <span className={`text-[11px] font-semibold uppercase tracking-widest ${fieldsToUpdate.type ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`}>Tipo de Atividade</span>
                                </label>
                            </div>
                            <div className={`transition-all duration-300 ${fieldsToUpdate.type ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
                                <select
                                    className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold outline-none"
                                    value={type}
                                    onChange={e => setType(e.target.value)}
                                >
                                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Priority Field */}
                        <div className={`p-4 rounded-2xl border transition-all ${fieldsToUpdate.priority ? 'bg-primary/[0.02] border-primary/30 ring-1 ring-primary/10' : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-primary focus:ring-primary/20"
                                        checked={fieldsToUpdate.priority}
                                        onChange={e => setFieldsToUpdate(prev => ({ ...prev, priority: e.target.checked }))}
                                    />
                                    <span className={`text-[11px] font-semibold uppercase tracking-widest ${fieldsToUpdate.priority ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`}>Prioridade</span>
                                </label>
                            </div>
                            <div className={`flex gap-2 transition-all duration-300 ${fieldsToUpdate.priority ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
                                {PRIORITIES.map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => setPriority(p.value as any)}
                                        className={`flex-1 py-2 px-1 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all border
                                            ${priority === p.value
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date & Time Field */}
                        <div className={`p-4 rounded-2xl border transition-all ${fieldsToUpdate.date ? 'bg-primary/[0.02] border-primary/30 ring-1 ring-primary/10' : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-primary focus:ring-primary/20"
                                        checked={fieldsToUpdate.date}
                                        onChange={e => setFieldsToUpdate(prev => ({ ...prev, date: e.target.checked }))}
                                    />
                                    <span className={`text-[11px] font-semibold uppercase tracking-widest ${fieldsToUpdate.date ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`}>Data e Hora</span>
                                </label>
                            </div>
                            <div className={`grid grid-cols-2 gap-3 transition-all duration-300 ${fieldsToUpdate.date ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="date"
                                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold"
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                    />
                                </div>
                                <div className="relative">
                                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="HH:mm"
                                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold"
                                        value={time}
                                        onChange={e => setTime(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border dark:border-white/5 bg-[#FBFCFD] dark:bg-white/[0.02] flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-black uppercase tracking-[0.15em] transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 flex items-center gap-2"
                    >
                        {isSubmitting ? 'Atualizando...' : (
                            <>
                                <Check size={18} className="stroke-[3]" />
                                Aplicar Alterações
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
