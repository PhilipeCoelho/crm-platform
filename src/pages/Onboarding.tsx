import React, { useState } from 'react';
import PhoneInput from '@/components/ui/PhoneInput';
import { Building2, Check, ArrowRight, Sparkles } from 'lucide-react';

interface Props {
    onComplete: (profileData: any) => void;
    onCancel?: () => void; // Optional incase we are just adding a profile from settings
}

export default function Onboarding({ onComplete, onCancel }: Props) {
    // const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        companyName: '',
        employees: '',
        website: '',
        instagram: '',
        whatsapp: '',
        email: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onComplete(formData);
    };

    return (
        <div className="min-h-screen flex w-full bg-background relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[150px] animate-pulse" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />

            <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center p-4 lg:p-12 relative z-10 h-full">

                {/* Main Card */}
                <div className="w-full bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">

                    {/* Left Side - Visual */}
                    <div className="hidden md:flex flex-col justify-between bg-muted/40 p-12 w-1/3 border-r border-border/50 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />

                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-white dark:bg-card rounded-2xl shadow-lg flex items-center justify-center mb-8 text-primary rotate-3">
                                <Building2 size={32} />
                            </div>
                            <h2 className="text-3xl font-bold mb-4">Configure sua<br />Organização</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Vamos personalizar seu ambiente. Esses dados ajudarão a gerar relatórios mais precisos e configurar seus canais de comunicação.
                            </p>
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex items-center gap-3 text-sm font-medium text-foreground/80">
                                <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-600 flex items-center justify-center"><Check size={14} strokeWidth={3} /></div>
                                <span>Pipelines personalizados</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm font-medium text-foreground/80">
                                <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-600 flex items-center justify-center"><Check size={14} strokeWidth={3} /></div>
                                <span>Automação de vendas</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm font-medium text-foreground/80">
                                <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-600 flex items-center justify-center"><Check size={14} strokeWidth={3} /></div>
                                <span>Relatórios em tempo real</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Form */}
                    <div className="flex-1 p-8 md:p-12 overflow-y-auto">
                        <div className="max-w-xl mx-auto">
                            <div className="mb-10">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
                                    <Sparkles size={12} />
                                    Passo 1 de 1
                                </div>
                                <h1 className="text-3xl font-bold text-foreground">Criar Perfil da Empresa</h1>
                                <p className="text-muted-foreground mt-2">Preencha os dados essenciais do seu negócio.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-foreground ml-1">Nome da Empresa</label>
                                        <input
                                            required
                                            className="flex h-11 w-full rounded-lg border border-input bg-muted/30 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all focus:bg-background hover:bg-muted/50"
                                            value={formData.companyName}
                                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                            placeholder="Ex: Minha Agência"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-foreground ml-1">Colaboradores</label>
                                        <select
                                            required
                                            className="flex h-11 w-full rounded-lg border border-input bg-muted/30 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all focus:bg-background hover:bg-muted/50"
                                            value={formData.employees}
                                            onChange={(e) => setFormData({ ...formData, employees: e.target.value })}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="1">Eu sou sozinho (1)</option>
                                            <option value="2-5">2 - 5</option>
                                            <option value="6-10">6 - 10</option>
                                            <option value="11-50">11 - 50</option>
                                            <option value="50+">50+</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-foreground ml-1">Email Comercial</label>
                                    <input
                                        type="email"
                                        required
                                        className="flex h-11 w-full rounded-lg border border-input bg-muted/30 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all focus:bg-background hover:bg-muted/50"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="contato@empresa.com"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-foreground ml-1">Site (Opcional)</label>
                                        <input
                                            className="flex h-11 w-full rounded-lg border border-input bg-muted/30 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all focus:bg-background hover:bg-muted/50"
                                            value={formData.website}
                                            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                            placeholder="www.exemplo.com"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-foreground ml-1">WhatsApp</label>
                                        <div className="h-11">
                                            <PhoneInput
                                                value={formData.whatsapp}
                                                onChange={(value) => setFormData({ ...formData, whatsapp: value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-foreground ml-1">Instagram</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">@</span>
                                        <input
                                            className="flex h-11 w-full rounded-lg border border-input bg-muted/30 pl-8 pr-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all focus:bg-background hover:bg-muted/50"
                                            value={formData.instagram}
                                            onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                                            placeholder="usuario"
                                        />
                                    </div>
                                </div>

                                <div className="pt-8 flex gap-4 justify-end">
                                    {onCancel && (
                                        <button
                                            type="button"
                                            onClick={onCancel}
                                            className="px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-xl font-semibold shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                                    >
                                        Finalizar Configuração
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
