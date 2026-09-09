import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import { useCRM } from '@/contexts/CRMContext';
import { Contact } from '@/types/schema';
import { Building, Briefcase, User, DollarSign, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface ConvertToDealModalProps {
    isOpen: boolean;
    onClose: () => void;
    contact: Contact;
    onSuccess?: (dealId: string) => void;
}

const parseCurrency = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(',', '.').replace(/[^\d.]/g, '');
    return parseFloat(clean) || 0;
};

export default function ConvertToDealModal({ isOpen, onClose, contact, onSuccess }: ConvertToDealModalProps) {
    const { companies, pipelines, addCompany, updateContact, addDeal, addLog } = useCRM();

    // 1. Extrair nome da clínica / empresa automaticamente
    const extractedClinicName = useMemo(() => {
        if (!contact) return '';
        if (contact.companyId) {
            const co = companies.find(c => c.id === contact.companyId);
            if (co) return co.name;
        }
        if (contact.notes) {
            const m1 = contact.notes.match(/•\s*Clínica\s*\/\s*Empresa:\s*([^\n\r]+)/i);
            if (m1 && m1[1] && m1[1].trim() && !m1[1].toLowerCase().includes('não informada')) {
                return m1[1].trim();
            }
            const m2 = contact.notes.match(/Clínica:\s*([^\n\r]+)/i);
            if (m2 && m2[1] && m2[1].trim() && !m2[1].toLowerCase().includes('não informada')) {
                return m2[1].trim();
            }
            const m3 = contact.notes.match(/Empresa:\s*([^\n\r]+)/i);
            if (m3 && m3[1] && m3[1].trim() && !m3[1].toLowerCase().includes('não informada')) {
                return m3[1].trim();
            }
        }
        return '';
    }, [contact, companies]);

    const pipelineList = useMemo(() => Object.values(pipelines || {}), [pipelines]);
    const defaultPipelineId = pipelineList[0]?.id || 'sales';

    const [selectedPipelineId, setSelectedPipelineId] = useState(defaultPipelineId);
    const stages = useMemo(() => pipelines[selectedPipelineId]?.stages || [], [pipelines, selectedPipelineId]);

    // Localizar por padrão a etapa 'Prospect' / 'Prospects'
    const defaultStageId = useMemo(() => {
        const prospect = stages.find((s: any) => s.title?.toLowerCase().includes('prospect'));
        if (prospect) return prospect.id;
        return stages[0]?.id || '';
    }, [stages]);

    const [selectedStageId, setSelectedStageId] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [title, setTitle] = useState('');
    const [value, setValue] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && contact) {
            const clinic = extractedClinicName;
            setCompanyName(clinic);
            setTitle(clinic ? `${clinic} - ${contact.name}` : `${contact.name} - Vamuss`);
            setValue('');
            setSelectedPipelineId(defaultPipelineId);
            setSelectedStageId(defaultStageId);
            setIsSubmitting(false);
            setSuccessMessage(null);
        }
    }, [isOpen, contact, extractedClinicName, defaultPipelineId, defaultStageId]);

    // Atualizar etapa se mudar pipeline
    useEffect(() => {
        if (selectedPipelineId && defaultStageId) {
            setSelectedStageId(defaultStageId);
        }
    }, [selectedPipelineId, defaultStageId]);

    const isExistingCompany = useMemo(() => {
        if (!companyName.trim()) return false;
        return companies.some(c => c.name.toLowerCase() === companyName.trim().toLowerCase());
    }, [companies, companyName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contact || !title.trim()) return;

        setIsSubmitting(true);
        try {
            let finalCompanyId = contact.companyId;

            // 1. Criar ou Vincular Organização
            if (companyName.trim()) {
                const existing = companies.find(c => c.name.toLowerCase() === companyName.trim().toLowerCase());
                if (existing) {
                    finalCompanyId = existing.id;
                } else {
                    const newCo = await addCompany({ name: companyName.trim() });
                    if (newCo?.id) {
                        finalCompanyId = newCo.id;
                    }
                }

                // Atualiza o contato com a organização caso não esteja vinculado
                if (finalCompanyId && contact.companyId !== finalCompanyId) {
                    await updateContact(contact.id, { companyId: finalCompanyId });
                }
            }

            // 2. Criar Negócio na Coluna 'Prospects'
            const numValue = parseCurrency(value);
            const targetStage = selectedStageId || defaultStageId;

            const createdDeal = await addDeal({
                title: title.trim(),
                value: numValue,
                currency: 'EUR',
                contactId: contact.id,
                companyId: finalCompanyId || undefined,
                pipelineId: selectedPipelineId,
                stageId: targetStage,
                source: 'Landing Page Vamuss',
                status: 'open',
                priority: 'medium',
                tags: ['Landing Page', 'Prospect']
            });

            // 3. Salvar identificação no histórico do negócio e anotações: "criado pela página de captura"
            if (createdDeal?.id) {
                await addLog({
                    dealId: createdDeal.id,
                    content: "criado pela página de captura",
                    logType: 'manual_note'
                });

                // Se houver anotações acumuladas no contacto (Passo 1 + Passo 2 da LP / Tela de Obrigado), registra também no histórico do negócio
                if (contact.notes && contact.notes.trim()) {
                    await addLog({
                        dealId: createdDeal.id,
                        content: `📋 Dossiê da Captura (Dados da LP & Tela de Obrigado):\n\n${contact.notes.trim()}`,
                        logType: 'manual_note'
                    });
                }
            }

            setSuccessMessage('Negócio criado na coluna Prospects e Organização vinculada com sucesso!');
            setTimeout(() => {
                onClose();
                onSuccess?.(contact.id);
            }, 1200);
        } catch (err: any) {
            console.error('Erro ao converter contato em negócio:', err);
            alert('Ocorreu um erro ao criar o negócio: ' + (err?.message || 'Tente novamente.'));
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !contact) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Transformar Contacto em Negócio"
            maxWidth="max-w-lg"
        >
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Resumo do Lead */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <User size={16} className="text-primary" />
                            <span>{contact.name}</span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Origem: Landing Page
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <div>WhatsApp: <strong className="text-foreground font-mono">{contact.phone || 'Não informado'}</strong></div>
                        <div>E-mail: <strong className="text-foreground">{contact.email || 'Não informado'}</strong></div>
                    </div>
                </div>

                {/* Organização / Clínica */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Building size={14} className="text-primary" />
                            Organização / Clínica
                        </label>
                        {companyName.trim() && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                isExistingCompany
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}>
                                {isExistingCompany ? '✓ Organização existente' : '+ Nova organização será criada'}
                            </span>
                        )}
                    </div>
                    <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ex: Clínica Dentária Chiado"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                    <p className="text-[11px] text-muted-foreground">
                        {extractedClinicName 
                            ? 'Detectada automaticamente a partir da candidatura na Landing Page.' 
                            : 'Informe a clínica/empresa para criar e associar na aba Organizações.'}
                    </p>
                </div>

                {/* Título do Negócio */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Briefcase size={14} className="text-primary" />
                        Título do Negócio *
                    </label>
                    <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex: Clínica Chiado - Dr. João"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                </div>

                {/* Pipeline & Etapa */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Pipeline / Funil
                        </label>
                        <select
                            value={selectedPipelineId}
                            onChange={(e) => setSelectedPipelineId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                            {pipelineList.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Coluna de Destino</span>
                            <span className="text-[10px] text-primary font-semibold">Prospects</span>
                        </label>
                        <select
                            value={selectedStageId}
                            onChange={(e) => setSelectedStageId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-primary/50 bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                            {stages.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.title} {s.title.toLowerCase().includes('prospect') ? '★ (Padrão)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Valor do Negócio */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <DollarSign size={14} className="text-primary" />
                        Valor Previsto (EUR / €)
                    </label>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                            €
                        </span>
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="0,00"
                            className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-mono"
                        />
                    </div>
                </div>

                {/* Feedback de Sucesso */}
                {successMessage && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm animate-in fade-in">
                        <CheckCircle2 size={18} className="shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                )}

                {/* Botões de Ação */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !title.trim()}
                        className="px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <span>A criar negócio...</span>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                <span>Transformar em Negócio</span>
                                <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
