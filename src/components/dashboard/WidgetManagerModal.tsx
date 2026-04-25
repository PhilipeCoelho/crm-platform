import { useState, useRef, useEffect } from 'react';
import { X, Check, GripVertical, Plus } from 'lucide-react';
import { WIDGET_DEFINITIONS, WidgetKey, WidgetCategory } from '@/data/widgetDefinitions';
import { UserDashboardWidget } from '@/hooks/useDashboardWidgets';

interface WidgetManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentWidgets: UserDashboardWidget[];
    onSave: (widgets: UserDashboardWidget[]) => void;
}

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
    revenue: 'Receita',
    conversion: 'Conversão',
    intensity: 'Intensidade',
    velocity: 'Velocidade',
    loss: 'Perdas',
    channel: 'Canais',
    execution: 'Execução Comercial'
};

export default function WidgetManagerModal({ isOpen, onClose, currentWidgets, onSave }: WidgetManagerModalProps) {
    const [selectedKeys, setSelectedKeys] = useState<WidgetKey[]>([]);
    const [hoveredKey, setHoveredKey] = useState<WidgetKey | null>(null);

    // Sync state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedKeys(currentWidgets.map(w => w.widget_key));
        }
    }, [isOpen, currentWidgets]);

    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    if (!isOpen) return null;

    const handleSort = () => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            let _selectedKeys = [...selectedKeys];
            const draggedItemId = _selectedKeys.splice(dragItem.current, 1)[0];
            _selectedKeys.splice(dragOverItem.current, 0, draggedItemId);
            setSelectedKeys(_selectedKeys);
        }
        dragItem.current = null;
        dragOverItem.current = null;
    };

    const addWidget = (key: WidgetKey) => {
        if (selectedKeys.length >= 8) {
            alert("Você pode ativar no máximo 8 widgets.");
            return;
        }

        const def = WIDGET_DEFINITIONS.find(d => d.key === key);
        if (def) {
            const categoryCount = selectedKeys.filter(k => WIDGET_DEFINITIONS.find(d => d.key === k)?.metric_category === def.metric_category).length;
            if (categoryCount >= 3) {
                alert(`Você só pode ter no máximo 3 widgets na categoria ${CATEGORY_LABELS[def.metric_category]}.`);
                return;
            }
        }

        setSelectedKeys([...selectedKeys, key]);
    };

    const removeWidget = (key: WidgetKey) => {
        setSelectedKeys(selectedKeys.filter(k => k !== key));
    };


    const handleSave = () => {
        const newWidgets: UserDashboardWidget[] = selectedKeys.map((key, index) => ({
            widget_key: key,
            position: index,
        }));
        onSave(newWidgets);
        onClose();
    };

    const allAvailableDefs = WIDGET_DEFINITIONS.filter(def => def.widget_available);
    const selectedDefs = selectedKeys.map(key => WIDGET_DEFINITIONS.find(d => d.key === key)!).filter(Boolean);

    // Group all by category
    const categories = allAvailableDefs.reduce((acc, def) => {
        if (!acc[def.metric_category]) acc[def.metric_category] = [];
        acc[def.metric_category].push(def);
        return acc;
    }, {} as Record<WidgetCategory, typeof allAvailableDefs>);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl border border-border/50 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-border/50">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Gerenciar Widgets</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Ative e ordene até 8 métricas estratégicas para sua visão.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 flex-1 overflow-y-auto space-y-8 custom-scrollbar">

                    {/* SELECIONADOS */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
                            Selecionados (arraste para ordenar)
                            <span className={selectedKeys.length === 8 ? 'text-orange-500 font-bold' : 'font-medium'}>
                                {selectedKeys.length} / 8 widgets ativos
                            </span>
                        </h3>

                        {selectedDefs.length === 0 ? (
                            <div className="text-center p-6 border border-dashed rounded-xl bg-muted/20 text-muted-foreground text-sm">
                                Nenhum widget selecionado. Adicione clicando abaixo.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {selectedDefs.map((def, index) => {
                                    const isHovered = hoveredKey === def.key;
                                    return (
                                        <div
                                            key={def.key}
                                            draggable
                                            onDragStart={() => { dragItem.current = index; }}
                                            onDragEnter={() => { dragOverItem.current = index; }}
                                            onDragEnd={handleSort}
                                            onDragOver={(e) => e.preventDefault()}
                                            onMouseEnter={() => setHoveredKey(def.key)}
                                            onMouseLeave={() => setHoveredKey(null)}
                                            className={`relative flex items-center justify-between p-3 rounded-xl border bg-card hover:border-primary/50 shadow-sm transition-all cursor-move group border-border/50`}
                                        >
                                            {/* Tooltip Summary */}
                                            {isHovered && (
                                                <div className="absolute bottom-full left-1/4 -translate-x-1/2 mb-2 w-48 p-2 bg-popover border border-border rounded-lg shadow-xl z-[60] animate-in zoom-in-95 fade-in duration-200 pointer-events-none">
                                                    <p className="text-[10px] leading-tight text-popover-foreground font-medium">
                                                        {def.description}
                                                    </p>
                                                    <div className="absolute top-full left-1/4 -translate-x-1/2 border-8 border-transparent border-t-popover" />
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3">
                                                <GripVertical size={16} className="text-muted-foreground opacity-50 group-hover:opacity-100" />
                                                <div className={`p-2 rounded-lg ${def.color}`}>
                                                    <def.icon size={16} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-foreground text-sm">{def.title}</h4>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[def.metric_category]}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => removeWidget(def.key)}
                                                    className="p-1.5 rounded-full hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors"
                                                    title="Remover"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* DISPONÍVEIS POR CATEGORIA */}
                    <div className="space-y-6 pt-4 border-t border-border/50">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Métricas Disponíveis
                        </h3>

                        {allAvailableDefs.filter(def => !selectedKeys.includes(def.key)).length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-xl bg-muted/5">
                                Você já selecionou todas as métricas disponíveis ou não há mais métricas para esta categoria.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {(Object.keys(categories) as WidgetCategory[]).map(category => {
                                    const items = categories[category];
                                    if (!items || items.length === 0) return null;

                                    return (
                                        <div key={category} className="space-y-3">
                                            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                                                {CATEGORY_LABELS[category]}
                                                <span className="text-muted-foreground font-normal text-[10px] bg-muted px-2 py-0.5 rounded-full">
                                                    Max 3
                                                </span>
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {items.filter(def => !selectedKeys.includes(def.key)).map(def => {
                                                    const isSelected = selectedKeys.includes(def.key);
                                                    const isHovered = hoveredKey === def.key;
                                                    return (
                                                        <div
                                                            key={def.key}
                                                            onClick={() => isSelected ? removeWidget(def.key) : addWidget(def.key)}
                                                            onMouseEnter={() => setHoveredKey(def.key)}
                                                            onMouseLeave={() => setHoveredKey(null)}
                                                            className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group shadow-sm
                                                            ${isSelected
                                                                    ? 'bg-primary/5 border-primary ring-1 ring-primary/20'
                                                                    : 'border-border/50 bg-card hover:bg-muted/50 hover:border-primary/30'}`}
                                                        >
                                                            {/* Tooltip Summary */}
                                                            {isHovered && (
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-popover border border-border rounded-lg shadow-xl z-[60] animate-in zoom-in-95 fade-in duration-200 pointer-events-none">
                                                                    <p className="text-[10px] leading-tight text-popover-foreground font-medium">
                                                                        {def.description}
                                                                    </p>
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-popover" />
                                                                </div>
                                                            )}

                                                            <div className={`p-2 rounded-lg ${def.color} shadow-sm group-hover:scale-105 transition-transform`}>
                                                                <def.icon size={16} />
                                                            </div>
                                                            <div className="flex-1 overflow-hidden">
                                                                <h4 className={`font-semibold text-xs truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                                                    {def.title}
                                                                </h4>
                                                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Insights</p>
                                                            </div>
                                                            {isSelected ? (
                                                                <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                                                                    <Check size={12} strokeWidth={3} />
                                                                </div>
                                                            ) : (
                                                                <Plus size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </div>

                <div className="p-5 border-t border-border/50 bg-muted/20">
                    <button
                        onClick={handleSave}
                        className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all active:scale-95 flex justify-center items-center gap-2"
                    >
                        <Check size={18} />
                        Salvar Configurações
                    </button>
                </div>
            </div>
        </div>
    );
}
