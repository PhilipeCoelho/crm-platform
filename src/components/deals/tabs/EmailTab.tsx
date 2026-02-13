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
        <div className="space-y-6 p-5 sm:p-4 border rounded-2xl sm:rounded-lg bg-card/50">
            <div className="space-y-4 sm:space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 text-base sm:text-sm">
                    <span className="font-bold sm:font-semibold w-full sm:w-16 text-muted-foreground">Para:</span>
                    <input
                        className="flex-1 bg-transparent border-b border-border focus:border-primary outline-none text-foreground py-2 sm:py-0"
                        style={{ fontSize: '16px' }}
                        value={to}
                        onChange={e => setTo(e.target.value)}
                        placeholder="email@exemplo.com"
                        type="email"
                    />
                </div>
                {contact && !contact.email && (
                    <p className="text-xs text-red-500 sm:ml-16">Contato sem email cadastrado.</p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 text-base sm:text-sm">
                    <span className="font-bold sm:font-semibold w-full sm:w-16 text-muted-foreground">Assunto:</span>
                    <input
                        className="flex-1 bg-transparent border-b border-border focus:border-primary outline-none text-foreground py-2 sm:py-0"
                        style={{ fontSize: '16px' }}
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="Assunto do email..."
                    />
                </div>
            </div>

            <textarea
                className="w-full h-56 sm:h-40 p-4 sm:p-3 rounded-xl sm:rounded border bg-background focus:border-primary outline-none resize-none text-base sm:text-sm"
                style={{ fontSize: '16px' }}
                placeholder="Escreva seu email aqui..."
                value={body}
                onChange={e => setBody(e.target.value)}
            />

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <button className="text-primary text-sm hover:underline font-bold sm:font-normal" disabled>Modelos (Em breve)</button>
                <button
                    onClick={handleSend}
                    disabled={!to || !subject.trim() || !body.trim() || sending}
                    className={`h-12 sm:h-auto w-full sm:w-auto px-6 py-2.5 rounded-xl sm:rounded font-bold sm:font-medium text-base sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/10 active:scale-[0.98]
                        ${!to || !subject.trim() || !body.trim() || sending
                            ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                >
                    {sending ? (
                        <span className="w-5 h-5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Send size={18} className="sm:w-3.5 sm:h-3.5" />
                    )}
                    {sending ? 'Enviando...' : 'Enviar Email'}
                </button>
            </div>
        </div>
    );
}
