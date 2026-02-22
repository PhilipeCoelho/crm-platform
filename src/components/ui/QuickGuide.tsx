import { useState, useEffect } from 'react';
import { HelpCircle, Search, BarChart3, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface HelpContent {
    module_name: string;
    title: string;
    short_explanation: string;
    interpretation_tip: string;
    action_tip: string;
}

interface QuickGuideProps {
    moduleName: string;
    activeGuide: string | null;
    setActiveGuide: (name: string | null) => void;
}

const STATIC_HELP: Record<string, HelpContent> = {
    'insights_resumo': {
        module_name: 'insights_resumo',
        title: 'Resumo Executivo',
        short_explanation: 'Visão geral do volume e conversão de negócios criados no período.',
        interpretation_tip: 'Compare o total de negócios com os ganhos para entender a eficiência imediata.',
        action_tip: 'Foque em aumentar o volume de entrada se a conversão estiver alta.'
    },
    'insights_funil': {
        module_name: 'insights_funil',
        title: 'Análise de Funil',
        short_explanation: 'O funil mostra como os negócios avançam entre as etapas de venda.',
        interpretation_tip: 'Observe onde ocorre a maior queda percentual (%) entre as fases.',
        action_tip: 'A etapa com menor conversão indica o principal gargalo operacional.'
    },
    'insights_execucao': {
        module_name: 'insights_execucao',
        title: 'Métricas de Execução',
        short_explanation: 'Produtividade da equipe em atividades e contatos realizados.',
        interpretation_tip: 'Compare o total de mensagens vs e-mails para descobrir o canal preferido.',
        action_tip: 'Padronize a cadência se houver muita variação entre os contatos.'
    },
    'insights_intensidade': {
        module_name: 'insights_intensidade',
        title: 'Intensidade de Contatos',
        short_explanation: 'Mede a persistência e o esforço de contato com cada lead.',
        interpretation_tip: 'Negócios encerrados antes de 5 contatos indicam baixa insistência.',
        action_tip: 'Aumente o número de tentativas antes de considerar um lead perdido.'
    },
    'insights_tempo': {
        module_name: 'insights_tempo',
        title: 'Velocidade e Ciclo',
        short_explanation: 'Analisa a velocidade de avanço e o tempo total de fechamento.',
        interpretation_tip: 'Um aumento no tempo médio indica que os leads estão esfriando.',
        action_tip: 'Reduza o intervalo entre os contatos para manter o lead engajado.'
    },
    'insights_canais': {
        module_name: 'insights_canais',
        title: 'Performance por Canal',
        short_explanation: 'Compara o desempenho e conversão de cada canal de aquisição.',
        interpretation_tip: 'O canal com maior taxa de fechamento deve receber prioridade.',
        action_tip: 'Redistribua o esforço para o canal que gera mais vendas reais.'
    },
    'insights_perdas': {
        module_name: 'insights_perdas',
        title: 'Análise de Perdas',
        short_explanation: 'Identifica onde e por que os negócios estão sendo perdidos.',
        interpretation_tip: 'Se mais de 40% das perdas ocorrem na mesma etapa, há um problema.',
        action_tip: 'Revise a sua abordagem e os critérios de qualificação nesta fase.'
    }
};

export default function QuickGuide({ moduleName, activeGuide, setActiveGuide }: QuickGuideProps) {
    const [content, setContent] = useState<HelpContent | null>(STATIC_HELP[moduleName] || null);
    const isOpen = activeGuide === moduleName;

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const { data, error } = await supabase
                    .from('help_content')
                    .select('*')
                    .eq('module_name', moduleName)
                    .single();

                if (!error && data) {
                    setContent(data);
                }
            } catch (err) { }
        };
        fetchContent();
    }, [moduleName]);

    if (!content) return null;

    return (
        <div
            className="inline-block ml-2 align-middle relative"
            onMouseEnter={() => setActiveGuide(moduleName)}
            onMouseLeave={() => setActiveGuide(null)}
        >
            <button
                className={`p-1.5 rounded-full transition-all duration-300 flex items-center justify-center ${isOpen
                        ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-110'
                        : 'bg-primary/5 text-primary hover:bg-primary/20 hover:scale-110'
                    }`}
            >
                <HelpCircle size={16} className={isOpen ? '' : 'animate-pulse'} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-[9999] top-full left-1/2 -translate-x-1/2 mt-2 w-64"
                    >
                        <div className="bg-white dark:bg-[#0B0F1A] border border-primary/20 dark:border-primary/30 shadow-2xl rounded-xl p-4 relative overflow-hidden ring-1 ring-black/5">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

                            <div className="flex items-start gap-2 mb-3">
                                <Search size={14} className="text-primary mt-0.5" />
                                <h4 className="font-bold text-[13px] text-foreground dark:text-white leading-tight">{content.title}</h4>
                            </div>

                            <div className="space-y-4">
                                <p className="text-[11px] text-foreground/80 dark:text-zinc-400 leading-relaxed border-l-2 border-primary/10 pl-2">
                                    {content.short_explanation}
                                </p>

                                <div className="space-y-3 pt-3 border-t border-border dark:border-white/5">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-primary">
                                            <BarChart3 size={12} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Observar</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground dark:text-zinc-500 leading-snug">
                                            {content.interpretation_tip}
                                        </p>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-emerald-500">
                                            <Target size={12} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Ação</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground dark:text-zinc-500 leading-snug">
                                            {content.action_tip}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
