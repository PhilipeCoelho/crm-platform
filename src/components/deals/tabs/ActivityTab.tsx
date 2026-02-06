import { useCRM } from '@/contexts/CRMContext';
import { Deal } from '@/types/schema';
import ActivityForm from '@/components/activities/ActivityForm';

interface ActivityTabProps {
    deal: Deal;
    onSave?: () => void;
}

export default function ActivityTab({ deal, onSave }: ActivityTabProps) {
    const { addActivity, contacts } = useCRM();

    const contact = contacts.find(c => c.id === deal.contactId);
    const contactName = contact?.name || 'Cliente';

    const handleSave = async (data: any) => {
        await addActivity(data);
        if (onSave) onSave();
    };

    return (
        <div className="p-4 border rounded-lg bg-card/50">
            <ActivityForm
                deal={deal}
                onSave={handleSave}
                contactName={contactName}
                submitLabel="Agendar"
            />
        </div>
    );
}
