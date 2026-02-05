import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Deal } from '@/types/schema';
import { Send } from 'lucide-react';

interface EmailTabProps {
    deal: Deal;
    onSave?: () => void;
}

export default function EmailTab({ deal, onSave }: EmailTabProps) {
    const { addActivity, contacts } = useCRM();
    const contact = contacts.find(c => c.id === deal.contactId);

    const [to, setTo] = useState(contact ? `${contact.name} <${contact.email}>` : '');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    const handleSend = () => {
        if (!subject.trim() || !body.trim()) return;

        addActivity({
            type: 'email',
            title: `Email: ${subject}`,
            description: body,
            dealId: deal.id,
            completed: true
        });
        setSubject('');
        setBody('');
        if (onSave) onSave();
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-card/50">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold w-16 text-muted-foreground">Para:</span>
                    <input
                        className="flex-1 bg-transparent border-b border-border focus:border-primary outline-none"
                        value={to}
                        onChange={e => setTo(e.target.value)}
                        placeholder="Nome do contato..."
                    />
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold w-16 text-muted-foreground">Assunto:</span>
                    <input
                        className="flex-1 bg-transparent border-b border-border focus:border-primary outline-none"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="Assunto do email..."
                    />
                </div>
            </div>

            <textarea
                className="w-full h-40 p-3 rounded border bg-background focus:border-primary outline-none resize-none text-sm"
                placeholder="Escreva seu email aqui..."
                value={body}
                onChange={e => setBody(e.target.value)}
            />

            <div className="flex justify-between items-center">
                <button className="text-primary text-sm hover:underline">Modelos (Em breve)</button>
                <button
                    onClick={handleSend}
                    disabled={!subject.trim() || !body.trim()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-medium text-sm flex items-center gap-2"
                >
                    <Send size={14} />
                    Enviar Email
                </button>
            </div>
        </div>
    );
}
