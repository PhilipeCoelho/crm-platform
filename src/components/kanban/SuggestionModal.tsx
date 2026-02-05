import { useState } from 'react';
import { Calendar, Phone, ArrowRight } from 'lucide-react';
import { Deal, Activity } from '@/types/schema';
import { useCRM } from '@/contexts/CRMContext'; // To add activity

interface Props {
    isOpen: boolean;
    onClose: () => void;
    deal: Deal;
    newStageTitle: string;
}

export default function SuggestionModal({ isOpen, onClose, deal, newStageTitle }: Props) {
    const { addActivity } = useCRM();
    const [note, setNote] = useState('');

    if (!isOpen || !deal) return null;

    // Hardcoded logic for now (Task 4 in Spec)
    // Stage logic mapping could be complex, simplifying for MVP
    let suggestedType: Activity['type'] = 'call';
    let suggestedTitle = 'Follow-up';
    let suggestedDays = 2;

    if (newStageTitle.toLowerCase().includes('lead')) {
        suggestedType = 'call';
        suggestedTitle = 'Ligação de Qualificação';
        suggestedDays = 0; // Today
    } else if (newStageTitle.toLowerCase().includes('proposta')) {
        suggestedType = 'followup';
        suggestedTitle = 'Follow-up da Proposta';
        suggestedDays = 2;
    } else if (newStageTitle.toLowerCase().includes('negociação')) {
        suggestedType = 'meeting';
        suggestedTitle = 'Reunião de Fechamento';
        suggestedDays = 3;
    }

    const handleConfirm = async () => {
        // Calculate date
        const date = new Date();
        date.setDate(date.getDate() + suggestedDays);
        const dateStr = date.toISOString().split('T')[0];

        await addActivity({
            title: suggestedTitle,
            type: suggestedType,
            dealId: deal.id,
            date: dateStr, // store.ts uses this
            dueDate: dateStr, // schema uses this (store maps it if updated)
            duration: 30, // default
            notes: note
        } as any);

        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-gray-100">
                <div className="p-6 bg-gradient-to-br from-primary/5 to-transparent">
                    <h3 className="text-lg font-bold text-[#191919] flex items-center gap-2">
                        🚀 Movimentação Detectada!
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        O negócio <strong>{deal.title}</strong> foi para <strong>{newStageTitle}</strong>.
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex gap-4 items-start">
                        <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
                            {suggestedType === 'call' && <Phone size={20} />}
                            {suggestedType === 'meeting' && <Calendar size={20} />}
                            {suggestedType === 'followup' && <ArrowRight size={20} />}
                        </div>
                        <div>
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Sugestão Automática</span>
                            <h4 className="font-semibold text-gray-900">{suggestedTitle}</h4>
                            <p className="text-sm text-gray-500 mt-1">
                                {suggestedDays === 0 ? 'Para Hoje' : `Para daqui a ${suggestedDays} dias`}
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Adicionar Nota (Opcional)</label>
                        <textarea
                            className="w-full text-sm border border-gray-200 rounded-md p-2 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            placeholder="Ex: Cliente pediu para ligar à tarde..."
                            rows={2}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>
                </div>

                <div className="p-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 rounded-lg transition-colors"
                    >
                        Ignorar
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/20 transition-all flex items-center gap-2"
                    >
                        <Calendar size={14} />
                        Agendar Atividade
                    </button>
                </div>
            </div>
        </div>
    );
}
