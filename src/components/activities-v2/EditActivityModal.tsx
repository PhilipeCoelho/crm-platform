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
        // Use local date parts to avoid UTC shift
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        initialDate = `${year}-${month}-${day}`;

        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        initialTime = `${hours}:${minutes}`;
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
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
            <div className="bg-background w-full max-w-lg rounded-t-[20px] sm:rounded-xl shadow-2xl border-t sm:border border-border flex flex-col h-[85vh] sm:h-auto max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <h2 className="text-xl sm:text-lg font-bold">Editar Atividade</h2>
                    <button onClick={onClose} className="p-2 sm:p-1 hover:bg-muted rounded-full text-muted-foreground">
                        <X size={24} className="sm:w-5 sm:h-5" />
                    </button>
                </div>

                <div className="p-2 sm:p-4 overflow-y-auto">
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
