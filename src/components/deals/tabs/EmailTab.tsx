import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Deal, EmailTemplate } from '@/types/schema';
import { Send, Image as ImageIcon, Layout, X, Check } from 'lucide-react';

interface EmailTabProps {
    deal: Deal;
    onSave?: () => void;
}

export default function EmailTab({ deal, onSave }: EmailTabProps) {
    const { addActivity, contacts, emailTemplates } = useCRM();
    const contact = contacts.find(c => c.id === deal.contactId);

    const [to, setTo] = useState(contact ? contact.email : '');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    const applyTemplate = (template: EmailTemplate) => {
        setSubject(template.name);
        // Simple conversion of basic HTML to text for now as the editor handles markdown/text
        setBody(template.htmlContent.replace(/<[^>]*>/g, ''));
        setIsTemplateModalOpen(false);
    };

    const handleSend = async () => {
        if (!to || !subject.trim() || !body.trim()) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        setSending(true);

        try {
            const response = await fetch('/api/send-email', {
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
                    status: 'completed',
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
                <button
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="text-primary text-sm hover:underline font-bold sm:font-normal flex items-center gap-2"
                >
                    <Layout size={14} />
                    Utilizar Modelo
                </button>
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

            {/* Template Selector Modal */}
            {isTemplateModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                                <Layout size={18} className="text-primary" />
                                Escolha um Modelo
                            </h3>
                            <button onClick={() => setIsTemplateModalOpen(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                                <X size={20} className="text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
                            {emailTemplates.length === 0 ? (
                                <div className="text-center py-8 space-y-3">
                                    <ImageIcon size={48} className="mx-auto text-muted-foreground/20" />
                                    <p className="text-sm text-muted-foreground">Você ainda não criou nenhum modelo de e-mail.</p>
                                    <button
                                        onClick={() => window.open('/campaigns/templates', '_blank')}
                                        className="text-primary text-xs font-bold hover:underline"
                                    >
                                        Criar Modelos no Módulo de Campanhas
                                    </button>
                                </div>
                            ) : (
                                emailTemplates.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => applyTemplate(template)}
                                        className="w-full p-4 rounded-xl border border-border bg-white dark:bg-card/50 hover:border-primary hover:bg-primary/5 text-left transition-all group flex items-center justify-between"
                                    >
                                        <div>
                                            <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{template.name}</h4>
                                            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">Markdown Ativo</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Check size={16} />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
