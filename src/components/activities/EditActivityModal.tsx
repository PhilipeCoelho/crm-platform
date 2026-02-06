import { Deal, Activity } from '@/types/schema';
import ActivityForm from './ActivityForm';
import { X } from 'lucide-react';

interface EditActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    deal: Deal;
    activity: Activity | null;
    onUpdate: (id: string, updates: Partial<Activity>) => Promise<void>;
}

export default function EditActivityModal({ isOpen, onClose, deal, activity, onUpdate }: EditActivityModalProps) {
    if (!isOpen || !activity) return null;

    // Parse date and time from activity.dueDate
    let initialDate = new Date().toISOString().split('T')[0];
    let initialTime = '10:00';

    if (activity.dueDate) {
        const d = new Date(activity.dueDate);
        initialDate = d.toISOString().split('T')[0];
        initialTime = d.toISOString().split('T')[1].substring(0, 5);
    }

    const initialData = {
        title: activity.title,
        type: activity.type,
        date: initialDate,
        time: initialTime,
        duration: activity.duration || 30
    };

    const handleSave = async (data: any) => {
        // data contains full payload from form, we map it to update
        await onUpdate(activity.id, {
            title: data.title,
            type: data.type,
            dueDate: data.dueDate,
            duration: data.duration,
            // Keep status same, don't revert to incomplete on edit usually unless specified
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background w-full max-w-lg rounded-xl shadow-xl border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold">Editar Atividade</h2>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto">
                    <ActivityForm
                        deal={deal}
                        initialData={initialData}
                        onSave={handleSave}
                        submitLabel="Atualizar"
                    />
                </div>
            </div>
        </div>
    );
}
