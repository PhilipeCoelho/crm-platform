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

    const [to, setTo] = useState(contact ? contact.email : '');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!to || !subject.trim() || !body.trim()) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        setSending(true);

        try {
            const response = await fetch('http://localhost:3001/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    deal_id: deal.id,
                    to,
                    subject,
                    body
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Sucesso: Registrar atividade
                await addActivity({
                    type: 'email',
                    title: `Email Enviado: ${subject}`,
                    notes: `Para: ${to}\n\n${body}`,
                    dealId: deal.id,
                    completed: true,
                    dueDate: new Date().toISOString()
                });

                setSubject('');
                setBody('');
                alert('Email enviado com sucesso!');
                if (onSave) onSave();
            } else {
                throw new Error(data.error || 'Falha ao enviar email');
            }
        } catch (error: any) {
            console.error('Erro ao enviar:', error);
            alert(`Erro ao enviar email: ${error.message}`);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-card/50">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold w-16 text-muted-foreground">Para:</span>
                    <input
                        className="flex-1 bg-transparent border-b border-border focus:border-primary outline-none text-foreground"
                        value={to}
                        onChange={e => setTo(e.target.value)}
                        placeholder="email@exemplo.com"
                        type="email"
                    />
                </div>
                {contact && !contact.email && (
                    <p className="text-xs text-red-500 ml-16">Contato sem email cadastrado.</p>
                )}

                <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold w-16 text-muted-foreground">Assunto:</span>
                    <input
                        className="flex-1 bg-transparent border-b border-border focus:border-primary outline-none text-foreground"
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
                <button className="text-primary text-sm hover:underline" disabled>Modelos (Em breve)</button>
                <button
                    onClick={handleSend}
                    disabled={!to || !subject.trim() || !body.trim() || sending}
                    className={`px-4 py-2 rounded font-medium text-sm flex items-center gap-2 transition-all
                        ${!to || !subject.trim() || !body.trim() || sending
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                >
                    {sending ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Send size={14} />
                    )}
                    {sending ? 'Enviando...' : 'Enviar Email'}
                </button>
            </div>
        </div>
    );
}
