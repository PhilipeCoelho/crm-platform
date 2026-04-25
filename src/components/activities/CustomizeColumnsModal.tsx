import { useState, useMemo } from 'react';
import {
    X,
    Search,
    GripVertical,
    Plus,
    Activity as ActivityIcon,
    DollarSign,
    User,
    Building2,
    Check
} from 'lucide-react';

interface ColumnOption {
    id: string;
    label: string;
    category: 'Atividade' | 'Negócio' | 'Pessoa' | 'Organização';
}

const ALL_COLUMNS: ColumnOption[] = [
    // Atividade
    { id: 'completed', label: 'Concluído', category: 'Atividade' },
    { id: 'title', label: 'Assunto', category: 'Atividade' },
    { id: 'priority', label: 'Prioridade', category: 'Atividade' },
    { id: 'dueDate', label: 'Data de vencimento', category: 'Atividade' },
    { id: 'duration', label: 'Duração', category: 'Atividade' },
    { id: 'type', label: 'Tipo', category: 'Atividade' },
    { id: 'status', label: 'Status', category: 'Atividade' },
    { id: 'updatedAt', label: 'Atualizado em', category: 'Atividade' },
    { id: 'ownerId', label: 'Atribuído ao usuário', category: 'Atividade' },
    { id: 'createdAt', label: 'Data adicionada', category: 'Atividade' },
    { id: 'completedAt', label: 'Data e hora de conclusão', category: 'Atividade' },
    { id: 'description', label: 'Descrição pública', category: 'Atividade' },

    // Negócio
    { id: 'dealId', label: 'Negócio', category: 'Negócio' },
    { id: 'dealValue', label: 'Valor', category: 'Negócio' },
    { id: 'dealStage', label: 'Etapa', category: 'Negócio' },
    { id: 'dealPipeline', label: 'Funil', category: 'Negócio' },
    { id: 'dealProbability', label: 'Probabilidade', category: 'Negócio' },
    { id: 'dealExpectedClose', label: 'Data de fechamento esperada', category: 'Negócio' },

    // Pessoa
    { id: 'contactId', label: 'Pessoa de contato', category: 'Pessoa' },
    { id: 'email', label: 'E-mail', category: 'Pessoa' },
    { id: 'phone', label: 'Telefone', category: 'Pessoa' },
    { id: 'contactName', label: 'Nome', category: 'Pessoa' },

    // Organização
    { id: 'companyId', label: 'Organização', category: 'Organização' },
    { id: 'companyAddress', label: 'Endereço', category: 'Organização' },
];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    visibleColumns: string[];
    onSave: (columns: string[]) => void;
}

export default function CustomizeColumnsModal({ isOpen, onClose, visibleColumns, onSave }: Props) {
    const [tempVisible, setTempVisible] = useState<string[]>(visibleColumns);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredAvailable = useMemo(() => {
        return ALL_COLUMNS.filter(col =>
            !tempVisible.includes(col.id) &&
            col.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [tempVisible, searchQuery]);

    const visibleColumnOptions = useMemo(() => {
        return tempVisible.map(id => ALL_COLUMNS.find(c => c.id === id)).filter(Boolean) as ColumnOption[];
    }, [tempVisible]);

    const toggleColumn = (id: string) => {
        if (tempVisible.includes(id)) {
            setTempVisible(prev => prev.filter(c => c !== id));
        } else {
            setTempVisible(prev => [...prev, id]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/40 animate-in fade-in duration-300">
            <div className={`w-full max-w-md bg-white dark:bg-[#11141D] h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-500`}>

                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                    <div>
                        <h2 className="text-xl font-black text-[#141414] dark:text-white tracking-tight">Personalizar colunas</h2>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Configure o que deseja ver na tabela</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-6">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar campos..."
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Lists */}
                <div className="flex-1 overflow-y-auto px-6 space-y-8 custom-scrollbar pb-24">

                    {/* Visible Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Colunas Visíveis ({tempVisible.length})</h3>
                            <button
                                onClick={() => setTempVisible([])}
                                className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                            >
                                Limpar tudo
                            </button>
                        </div>
                        <div className="space-y-2">
                            {visibleColumnOptions.map((col) => (
                                <div
                                    key={col.id}
                                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl group hover:border-primary/50 transition-all"
                                >
                                    <GripVertical size={16} className="text-slate-300 group-hover:text-primary cursor-grab active:cursor-grabbing" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex-1">{col.label}</span>
                                    <button
                                        onClick={() => toggleColumn(col.id)}
                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Available Section */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Disponíveis</h3>

                        {/* Grouped by category */}
                        {['Atividade', 'Negócio', 'Pessoa', 'Organização'].map(cat => {
                            const catCols = filteredAvailable.filter(c => c.category === cat);
                            if (catCols.length === 0) return null;

                            return (
                                <div key={cat} className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        {cat === 'Atividade' && <ActivityIcon size={12} />}
                                        {cat === 'Negócio' && <DollarSign size={12} />}
                                        {cat === 'Pessoa' && <User size={12} />}
                                        {cat === 'Organização' && <Building2 size={12} />}
                                        <span className="text-[10px] font-black uppercase tracking-widest">{cat}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {catCols.map(col => (
                                            <button
                                                key={col.id}
                                                onClick={() => toggleColumn(col.id)}
                                                className="flex items-center justify-between p-3 border border-dashed border-border rounded-xl hover:border-primary/50 hover:bg-primary/[0.02] transition-all group"
                                            >
                                                <span className="text-sm font-bold text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200">{col.label}</span>
                                                <Plus size={16} className="text-slate-300 group-hover:text-primary" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border bg-white dark:bg-[#11141D] flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            onSave(tempVisible);
                            onClose();
                        }}
                        className="flex-1 px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Check size={18} />
                        <span>Salvar</span>
                    </button>
                </div>

            </div>
        </div>
    );
}
