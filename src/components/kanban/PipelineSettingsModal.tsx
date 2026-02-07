import { useState } from "react";
import { useCRM } from "@/contexts/CRMContext";
import { ChevronUp, ChevronDown, Trash2, Plus, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PipelineSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    pipelineId: string;
}

export default function PipelineSettingsModal({ isOpen, onClose, pipelineId }: PipelineSettingsModalProps) {
    const { pipelines, addStage, updateStage, deleteStage, reorderStages } = useCRM();
    const pipeline = pipelines[pipelineId];
    const stages = pipeline?.stages || [];

    const [newStageName, setNewStageName] = useState("");
    const [editingStageId, setEditingStageId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    const handleAddStage = async () => {
        if (!newStageName.trim()) return;
        await addStage(pipelineId, newStageName);
        setNewStageName("");
    };

    const handleUpdateStage = async (id: string) => {
        if (!editName.trim()) return;
        await updateStage(id, { title: editName });
        setEditingStageId(null);
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === stages.length - 1) return;

        const newStages = [...stages];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap
        [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];

        const newOrderIds = newStages.map(s => s.id);
        reorderStages(pipelineId, newOrderIds);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-background border-border text-foreground">
                <DialogHeader>
                    <DialogTitle>Configuração do Funil</DialogTitle>
                    <DialogDescription>
                        Gerencie as etapas do seu funil de vendas.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    {/* List Stages */}
                    <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                        {stages.map((stage, index) => (
                            <div key={stage.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card/40 hover:bg-card transition-colors">
                                <span className="text-muted-foreground/50 cursor-default">
                                    <GripVertical size={16} />
                                </span>

                                <div className="flex-1">
                                    {editingStageId === stage.id ? (
                                        <input
                                            autoFocus
                                            className="w-full bg-background border border-primary/50 rounded-sm px-2 py-1 text-sm outline-none"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onBlur={() => handleUpdateStage(stage.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdateStage(stage.id);
                                                if (e.key === 'Escape') setEditingStageId(null);
                                            }}
                                        />
                                    ) : (
                                        <div
                                            onClick={() => {
                                                setEditingStageId(stage.id);
                                                setEditName(stage.title);
                                            }}
                                            className="text-sm font-medium cursor-text hover:text-primary transition-colors"
                                        >
                                            {stage.title}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleMove(index, 'up')}
                                        disabled={index === 0}
                                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                        title="Mover para cima (esquerda)"
                                    >
                                        <ChevronUp size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleMove(index, 'down')}
                                        disabled={index === stages.length - 1}
                                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                        title="Mover para baixo (direita)"
                                    >
                                        <ChevronDown size={16} />
                                    </button>
                                    <div className="w-px h-4 bg-border mx-1" />
                                    <button
                                        onClick={() => deleteStage(stage.id)}
                                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                                        title="Excluir etapa"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Stage */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <input
                            placeholder="Nome da nova etapa..."
                            className="flex-1 bg-muted/30 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                            value={newStageName}
                            onChange={(e) => setNewStageName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                        />
                        <button
                            onClick={handleAddStage}
                            disabled={!newStageName.trim()}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
