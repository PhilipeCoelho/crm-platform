import { useState, useEffect } from 'react';
import { 
    Brain, RefreshCw, AlertTriangle, 
    ArrowUpRight, ArrowDownRight, Minus, 
    TrendingUp, ShieldAlert, CheckCircle2, 
    ChevronRight, Tag, Layers, MessageSquare, Flame, Sparkles,
    Trash2, Settings
} from 'lucide-react';
import { 
    fetchPendingReviews, 
    retryClassification, fetchRelatedDeals,
    triggerBackfill,
    consolidateSubcategories,
    TrendData, RelatedDeal, ContentSignalTrend, BackfillResult,
    fetchTrendsAndSignalsClient
} from '@/services/knowledgeBase';
import { supabase } from '@/lib/supabase';
import { InsightComercial } from '@/types/schema';
import { Link } from 'react-router-dom';

export default function KnowledgeBase() {
    const [period, setPeriod] = useState<'today' | '7' | '30' | '60' | '90' | 'all' | 'custom'>('30');
    const [customStart, setCustomStart] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

    const [trends, setTrends] = useState<TrendData | null>(null);
    const [pendingReviews, setPendingReviews] = useState<InsightComercial[]>([]);
    const [contentSignals, setContentSignals] = useState<ContentSignalTrend[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [activeSection, setActiveSection] = useState<'dashboard' | 'review' | 'content'>('dashboard');
    const [expandedSignals, setExpandedSignals] = useState<Record<string, boolean>>({});

    // Details Modal
    const [selectedFilter, setSelectedFilter] = useState<{ category?: string; subcategory?: string; tag?: string } | null>(null);
    const [relatedDeals, setRelatedDeals] = useState<RelatedDeal[]>([]);
    const [isLoadingDeals, setIsLoadingDeals] = useState<boolean>(false);

    // Retrying state
    const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});

    // Backfill state
    const [isBackfilling, setIsBackfilling] = useState<boolean>(false);
    const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            await consolidateSubcategories();
            
            let customRange: { start: Date; end: Date } | undefined;
            if (period === 'custom') {
                customRange = {
                    start: new Date(`${customStart}T00:00:00`),
                    end: new Date(`${customEnd}T23:59:59`)
                };
            }

            const [clientRes, reviewsRes] = await Promise.all([
                fetchTrendsAndSignalsClient(period, customRange),
                fetchPendingReviews()
            ]);

            if (clientRes) {
                setTrends(clientRes.trends);
                setContentSignals(clientRes.contentSignals);
            }
            setPendingReviews(reviewsRes);
        } catch (e) {
            console.error("Error loading knowledge base data:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [period, customStart, customEnd]);

    const handleRetry = async (item: InsightComercial) => {
        setRetryingIds(prev => ({ ...prev, [item.id]: true }));
        try {
            const success = await retryClassification(
                item.textoOrigem,
                item.negocioId || null,
                item.atividadeId || null
            );
            if (success) {
                // Wait briefly for background classification
                await new Promise(r => setTimeout(r, 1000));
                loadData();
            } else {
                alert("Erro ao reenviar classificação.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setRetryingIds(prev => ({ ...prev, [item.id]: false }));
        }
    };

    const handleBackfill = async () => {
        const confirmed = window.confirm(
            'Processar Histórico (últimos 60 dias)\n\n' +
            'Isso vai procurar todas as notas e motivos de perda ainda não classificados dos últimos 60 dias e submetê-los à IA.\n\n' +
            'O processo corre em background — o painel vai continuar a funcionar normalmente.\n\n' +
            'Confirmar?'
        );
        if (!confirmed) return;

        setIsBackfilling(true);
        setBackfillResult(null);
        try {
            const result = await triggerBackfill(60);
            if (result) {
                setBackfillResult(result);
            } else {
                alert('Erro ao iniciar o processamento. Verifica os logs do servidor.');
            }
        } catch (e) {
            console.error(e);
            alert('Erro inesperado ao iniciar o backfill.');
        } finally {
            setIsBackfilling(false);
        }
    };

    const handleReset = async () => {
        const confirmed = window.confirm(
            'Zerar Painel de Inteligência Comercial\n\n' +
            'Esta ação irá apagar PERMANENTEMENTE todos os insights, objeções e dores catalogados. Os negócios originais e e-mails não sofrerão nenhuma alteração.\n\n' +
            'Tem certeza que deseja zerar?'
        );
        if (!confirmed) return;

        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('insights_comerciais')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');

            if (error) throw error;

            alert('Painel de Inteligência Comercial zerado com sucesso!');
            await loadData();
        } catch (e: any) {
            console.error('Error clearing insights:', e);
            alert(`Erro ao zerar o painel: ${e.message}`);
            setIsLoading(false);
        }
    };

    const handleOpenDeals = async (filter: { category?: string; subcategory?: string; tag?: string }) => {
        setSelectedFilter(filter);
        setIsLoadingDeals(true);
        try {
            const deals = await fetchRelatedDeals(filter);
            setRelatedDeals(deals);
        } catch (e) {
            console.error("Error loading related deals:", e);
        } finally {
            setIsLoadingDeals(false);
        }
    };

    const formatSnakeCase = (str: string) => {
        if (!str) return '';
        return str
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    };

    const toggleSignalExpand = (signal: string) => {
        setExpandedSignals(prev => ({ ...prev, [signal]: !prev[signal] }));
    };

    // Card details
    const topDor = trends?.top_subcategories.dor?.[0];
    const topBarreira = trends?.top_subcategories.barreira_acesso?.[0];
    const topObjecao = trends?.top_subcategories.objecao?.[0];

    return (
        <div className="h-full overflow-y-auto w-full bg-background transition-all duration-300 custom-scrollbar">
            <div className="p-6 max-w-7xl mx-auto space-y-8 text-foreground">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-6">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-tr from-yellow-500 to-amber-600 rounded-xl text-white shadow-md shadow-amber-500/10">
                                <Brain size={24} className="animate-pulse" />
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text">
                                Inteligência Comercial & KB
                            </h1>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5">
                            Classificação automática de notas, objeções e barreiras via Inteligência Artificial.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-end">
                        {/* Mode selector */}
                        <div className="bg-muted/50 border border-border/80 p-0.5 rounded-lg flex text-xs">
                            <button 
                                onClick={() => setActiveSection('dashboard')}
                                className={`px-4 py-1.5 rounded-md font-medium transition-all ${activeSection === 'dashboard' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Tendências
                            </button>
                            <button 
                                onClick={() => setActiveSection('content')}
                                className={`px-4 py-1.5 rounded-md font-medium transition-all ${activeSection === 'content' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Inteligência de Conteúdo
                            </button>
                            <button 
                                onClick={() => setActiveSection('review')}
                                className={`px-4 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${activeSection === 'review' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                Pendentes de Revisão
                                {pendingReviews.length > 0 && (
                                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {pendingReviews.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Period selector */}
                        <div className="flex items-center gap-2">
                            <select 
                                value={period}
                                onChange={e => setPeriod(e.target.value as any)}
                                className="bg-background border border-border px-3 py-1.5 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500 outline-none"
                            >
                                <option value="today">Hoje</option>
                                <option value="7">Últimos 7 dias</option>
                                <option value="30">Últimos 30 dias</option>
                                <option value="60">Últimos 60 dias</option>
                                <option value="90">Últimos 90 dias</option>
                                <option value="all">Todo o período</option>
                                <option value="custom">Selecionar período...</option>
                            </select>

                            {period === 'custom' && (
                                <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                                    <input 
                                        type="date" 
                                        value={customStart} 
                                        onChange={e => setCustomStart(e.target.value)}
                                        className="bg-background border border-border px-2 py-1.5 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500 outline-none"
                                    />
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold px-0.5">a</span>
                                    <input 
                                        type="date" 
                                        value={customEnd} 
                                        onChange={e => setCustomEnd(e.target.value)}
                                        className="bg-background border border-border px-2 py-1.5 rounded-lg text-xs font-medium focus:ring-1 focus:ring-amber-500 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Settings Popover Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsSettingsOpen(prev => !prev)}
                                className={`flex items-center justify-center p-2 rounded-lg border text-muted-foreground hover:text-foreground transition-all
                                    ${isSettingsOpen ? 'bg-muted border-foreground/20' : 'bg-background border-border'}
                                `}
                                title="Configurações do Painel"
                            >
                                <Settings size={15} className={isSettingsOpen ? 'rotate-45 transition-transform duration-200' : 'transition-transform duration-200'} />
                            </button>

                            {isSettingsOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsSettingsOpen(false)} />
                                    <div className="absolute right-0 mt-2 w-52 bg-popover text-popover-foreground border border-border rounded-xl shadow-lg p-2 z-20 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                        <div className="px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/50 mb-1">
                                            Ações do Painel
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsSettingsOpen(false);
                                                handleBackfill();
                                            }}
                                            disabled={isBackfilling}
                                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium hover:bg-muted rounded-lg text-left transition-all disabled:opacity-50"
                                        >
                                            <RefreshCw size={12} className={isBackfilling ? 'animate-spin' : ''} />
                                            <span>Processar Histórico (60d)</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsSettingsOpen(false);
                                                handleReset();
                                            }}
                                            disabled={isLoading}
                                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg text-left transition-all"
                                        >
                                            <Trash2 size={12} />
                                            <span>Zerar Painel</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Backfill result banner */}
                {backfillResult && (
                    <div className={`flex items-start justify-between gap-4 p-4 rounded-xl border text-sm animate-in slide-in-from-top-2 duration-200 ${
                        backfillResult.found === 0
                            ? 'bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400'
                            : 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400'
                    }`}>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                            <div className="space-y-0.5">
                                <p className="font-semibold text-xs">{backfillResult.message}</p>
                                {backfillResult.found > 0 && (
                                    <p className="text-[11px] opacity-75">
                                        {backfillResult.found} itens enviados para classificação em background. Recarregue o painel em alguns minutos para ver os resultados.
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setBackfillResult(null)}
                            className="text-xs font-semibold opacity-60 hover:opacity-100 shrink-0 transition-opacity"
                        >
                            Fechar
                        </button>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">Carregando painel de inteligência...</p>
                    </div>
                ) : activeSection === 'dashboard' ? (
                    <div className="space-y-8">
                        {/* Top Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Dor Card */}
                            <div className="bg-card hover:bg-card/80 border border-border/40 p-5 rounded-2xl relative overflow-hidden transition-all duration-300 group hover:shadow-lg hover:shadow-amber-500/5">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tracking-wider uppercase">Dor mais Comum</span>
                                    <Layers size={16} className="text-amber-500" />
                                </div>
                                <h4 className="text-lg font-bold mt-3 text-card-foreground group-hover:text-amber-500 transition-colors">
                                    {topDor ? formatSnakeCase(topDor.subcategoria) : 'Nenhuma dor'}
                                </h4>
                                <div className="flex items-baseline gap-2 mt-4">
                                    <span className="text-3xl font-extrabold">{topDor ? topDor.total : 0}</span>
                                    <span className="text-xs text-muted-foreground">ocorrências</span>
                                </div>
                                {topDor && (
                                    <button 
                                        onClick={() => handleOpenDeals({ category: 'dor', subcategory: topDor.subcategoria })}
                                        className="text-xs text-amber-500 hover:text-amber-600 font-semibold flex items-center gap-1 mt-4 group/btn"
                                    >
                                        Ver negócios relacionados
                                        <ChevronRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                    </button>
                                )}
                            </div>

                            {/* Barreira Card */}
                            <div className="bg-card hover:bg-card/80 border border-border/40 p-5 rounded-2xl relative overflow-hidden transition-all duration-300 group hover:shadow-lg hover:shadow-amber-500/5">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-all" />
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 tracking-wider uppercase">Principal Barreira</span>
                                    <ShieldAlert size={16} className="text-rose-500" />
                                </div>
                                <h4 className="text-lg font-bold mt-3 text-card-foreground group-hover:text-rose-500 transition-colors">
                                    {topBarreira ? formatSnakeCase(topBarreira.subcategoria) : 'Nenhuma barreira'}
                                </h4>
                                <div className="flex items-baseline gap-2 mt-4">
                                    <span className="text-3xl font-extrabold">{topBarreira ? topBarreira.total : 0}</span>
                                    <span className="text-xs text-muted-foreground">bloqueios</span>
                                </div>
                                {topBarreira && (
                                    <button 
                                        onClick={() => handleOpenDeals({ category: 'barreira_acesso', subcategory: topBarreira.subcategoria })}
                                        className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1 mt-4 group/btn"
                                    >
                                        Ver negócios relacionados
                                        <ChevronRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                    </button>
                                )}
                            </div>

                            {/* Objeção Card */}
                            <div className="bg-card hover:bg-card/80 border border-border/40 p-5 rounded-2xl relative overflow-hidden transition-all duration-300 group hover:shadow-lg hover:shadow-amber-500/5">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wider uppercase">Maior Objeção</span>
                                    <AlertTriangle size={16} className="text-blue-500" />
                                </div>
                                <h4 className="text-lg font-bold mt-3 text-card-foreground group-hover:text-blue-500 transition-colors">
                                    {topObjecao ? formatSnakeCase(topObjecao.subcategoria) : 'Nenhuma objeção'}
                                </h4>
                                <div className="flex items-baseline gap-2 mt-4">
                                    <span className="text-3xl font-extrabold">{topObjecao ? topObjecao.total : 0}</span>
                                    <span className="text-xs text-muted-foreground">menções</span>
                                </div>
                                {topObjecao && (
                                    <button 
                                        onClick={() => handleOpenDeals({ category: 'objecao', subcategory: topObjecao.subcategoria })}
                                        className="text-xs text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1 mt-4 group/btn"
                                    >
                                        Ver negócios relacionados
                                        <ChevronRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Main Analytics Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Subcategories Horizontal Bar Chart */}
                            <div className="bg-card border border-border/40 p-6 rounded-2xl lg:col-span-2 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-wider">
                                        Subcategorias Mais Frequentes por Eixo
                                    </h3>
                                    <TrendingUp size={16} className="text-muted-foreground" />
                                </div>

                                <div className="space-y-8">
                                    {['dor', 'barreira_acesso', 'objecao'].map((cat) => {
                                        const items = trends?.top_subcategories[cat] || [];
                                        const maxVal = Math.max(...items.map(i => i.total), 1);
                                        
                                        const categoryLabel = cat === 'dor' ? 'Dores do Lead' : cat === 'barreira_acesso' ? 'Barreiras de Acesso' : 'Objeções de Venda';
                                        const accentColorClass = cat === 'dor' ? 'bg-amber-500' : cat === 'barreira_acesso' ? 'bg-rose-500' : 'bg-blue-500';

                                        return (
                                            <div key={cat} className="space-y-4">
                                                <h4 className="text-xs font-bold border-l-2 border-border/80 pl-2 text-foreground/80">
                                                    {categoryLabel}
                                                </h4>
                                                
                                                {items.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground italic pl-3">Nenhum insight classificado nesta categoria no período.</p>
                                                ) : (
                                                    <div className="space-y-3.5 pl-3">
                                                        {items.slice(0, 5).map(item => {
                                                            const pct = (item.total / maxVal) * 100;
                                                            return (
                                                                <div key={item.subcategoria} className="group/bar cursor-pointer" onClick={() => handleOpenDeals({ category: cat, subcategory: item.subcategoria })}>
                                                                    <div className="flex justify-between text-xs font-semibold mb-1 group-hover/bar:text-amber-500 transition-colors">
                                                                        <span>{formatSnakeCase(item.subcategoria)}</span>
                                                                        <span>{item.total}</span>
                                                                    </div>
                                                                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                                        <div 
                                                                            className={`h-full ${accentColorClass} rounded-full transition-all duration-500`}
                                                                            style={{ width: `${pct}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Thematic Tags (Eixo 2) List & Win/Loss reasons */}
                            <div className="space-y-8">
                                {/* Tags list */}
                                <div className="bg-card border border-border/40 p-6 rounded-2xl space-y-6">
                                    <h3 className="text-sm font-bold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-wider">
                                        Assuntos Mais Citados (Eixo 2)
                                    </h3>

                                    {trends?.tag_counts.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic text-center py-6">Nenhuma tag temática registrada no período.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            {trends?.tag_counts.map(tagItem => {
                                                const total = tagItem.current_total;
                                                const prev = tagItem.prev_total;
                                                const pctChange = prev === 0 ? (total > 0 ? 100 : 0) : ((total - prev) / prev) * 100;

                                                return (
                                                    <div 
                                                        key={tagItem.tag}
                                                        onClick={() => handleOpenDeals({ tag: tagItem.tag })}
                                                        className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-1.5 bg-muted rounded-lg text-muted-foreground group-hover:text-amber-500 group-hover:bg-amber-500/5 transition-all">
                                                                <Tag size={14} />
                                                            </div>
                                                            <span className="text-xs font-bold text-card-foreground group-hover:text-amber-500 transition-colors">
                                                                {formatSnakeCase(tagItem.tag)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs font-bold">{total}</span>
                                                            <div className="flex items-center text-[10px] font-bold">
                                                                {pctChange > 0 ? (
                                                                    <span className="text-green-500 flex items-center"><ArrowUpRight size={10} />+{pctChange.toFixed(0)}%</span>
                                                                ) : pctChange < 0 ? (
                                                                    <span className="text-rose-500 flex items-center"><ArrowDownRight size={10} />{pctChange.toFixed(0)}%</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground flex items-center"><Minus size={10} />0%</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Win/Loss Reasons Card */}
                                <div className="bg-card border border-border/40 p-6 rounded-2xl space-y-6">
                                    <h3 className="text-sm font-bold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-wider">
                                        Histórico de Negócios Ganho / Perdido
                                    </h3>

                                    <div className="space-y-6">
                                        {/* Motivo Ganho */}
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-green-500 flex items-center gap-1.5">
                                                <CheckCircle2 size={14} />
                                                Top Motivos de Ganho
                                            </h4>
                                            <div className="space-y-2">
                                                {(trends?.win_loss_reasons.motivo_ganho || []).slice(0, 3).map(reason => (
                                                    <div 
                                                        key={reason.subcategoria}
                                                        onClick={() => handleOpenDeals({ category: 'motivo_ganho', subcategory: reason.subcategoria })}
                                                        className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-muted/40 cursor-pointer"
                                                    >
                                                        <span className="font-semibold text-muted-foreground truncate max-w-[200px]">{formatSnakeCase(reason.subcategoria)}</span>
                                                        <span className="font-bold bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">{reason.total}</span>
                                                    </div>
                                                ))}
                                                {(!trends?.win_loss_reasons.motivo_ganho || trends.win_loss_reasons.motivo_ganho.length === 0) && (
                                                    <p className="text-[10px] text-muted-foreground italic pl-5">Sem registros.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Motivo Perda */}
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                                                <AlertTriangle size={14} />
                                                Top Motivos de Perda
                                            </h4>
                                            <div className="space-y-2">
                                                {(trends?.win_loss_reasons.motivo_perda || []).slice(0, 3).map(reason => (
                                                    <div 
                                                        key={reason.subcategoria}
                                                        onClick={() => handleOpenDeals({ category: 'motivo_perda', subcategory: reason.subcategoria })}
                                                        className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-muted/40 cursor-pointer"
                                                    >
                                                        <span className="font-semibold text-muted-foreground truncate max-w-[200px]">{formatSnakeCase(reason.subcategoria)}</span>
                                                        <span className="font-bold bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full">{reason.total}</span>
                                                    </div>
                                                ))}
                                                {(!trends?.win_loss_reasons.motivo_perda || trends.win_loss_reasons.motivo_perda.length === 0) && (
                                                    <p className="text-[10px] text-muted-foreground italic pl-5">Sem registros.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeSection === 'review' ? (
                    /* Review queue Section */
                    <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-border/40 flex justify-between items-center bg-muted/10">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={18} className="text-amber-500" />
                                <h3 className="font-bold text-sm text-card-foreground">
                                    Insights Pendentes de Revisão ou Falhos
                                </h3>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                                {pendingReviews.length} itens requerem ação
                            </span>
                        </div>

                        <div className="divide-y divide-border/40">
                            {pendingReviews.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                                    <CheckCircle2 size={40} className="text-green-500" />
                                    <p className="text-sm font-semibold">Tudo em ordem!</p>
                                    <p className="text-xs">Não há insights pendentes de revisão ou com falha de classificação.</p>
                                </div>
                            ) : (
                                pendingReviews.map(item => {
                                    const isRetrying = !!retryingIds[item.id];
                                    return (
                                        <div key={item.id} className="p-5 flex flex-col md:flex-row justify-between md:items-start gap-4 hover:bg-muted/10 transition-colors">
                                            <div className="space-y-2 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {item.classificacaoFalhou ? (
                                                        <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                                                            <AlertTriangle size={10} />
                                                            Erro de Classificação
                                                        </span>
                                                    ) : (
                                                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                                                            <ShieldAlert size={10} />
                                                            Baixa Confiança ({item.confianca ? (item.confianca * 100).toFixed(0) : 0}%)
                                                        </span>
                                                    )}
                                                    
                                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                                        Criado em: {new Date(item.criadoEm).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                <div className="bg-muted/30 p-3 rounded-lg border border-border/20 text-xs font-medium leading-relaxed italic text-foreground/80">
                                                    "{item.textoOrigem}"
                                                </div>

                                                {item.erroClassificacao && (
                                                    <p className="text-[10px] font-semibold text-rose-500 border border-rose-500/10 bg-rose-500/5 p-2 rounded-md">
                                                        Erro: {item.erroClassificacao}
                                                    </p>
                                                )}

                                                <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-3">
                                                    <span>Eixo 1 (Categoria): <strong className="text-foreground">{formatSnakeCase(item.categoria)}</strong></span>
                                                    <span>Eixo 2 (Tags): <strong className="text-foreground">{item.tagsTematicas.map(formatSnakeCase).join(', ') || 'Nenhuma'}</strong></span>
                                                </div>
                                            </div>

                                            <div className="flex md:flex-col gap-2 justify-end">
                                                <button 
                                                    onClick={() => handleRetry(item)}
                                                    disabled={isRetrying}
                                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
                                                    {isRetrying ? 'Reclassificando...' : 'Tentar Novamente'}
                                                </button>
                                                
                                                {item.negocioId && (
                                                    <Link 
                                                        to={`/deals/${item.negocioId}`}
                                                        className="px-3 py-1.5 border border-border hover:bg-muted rounded-lg text-xs font-semibold transition-colors text-center text-muted-foreground hover:text-foreground"
                                                    >
                                                        Ver Negócio
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ) : activeSection === 'content' ? (
                    <div className="space-y-6">
                        <div className="bg-card border border-border/40 p-6 rounded-2xl space-y-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="text-amber-500" size={20} />
                                <h2 className="text-lg font-bold text-card-foreground">Sinais de Conteúdo Estratégicos</h2>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Estas são teses extraídas pela IA a partir das dores, objeções e barreiras relatadas nas notas. 
                                Quando um sinal acumula múltiplas ocorrências ou atinge 5% da base de negócios, ele ganha maturidade como pauta de conteúdo prioritária (Reels, carrosséis ou anúncios).
                            </p>
                        </div>

                        {contentSignals.length === 0 ? (
                            <div className="bg-card border border-border/40 p-12 text-center rounded-2xl">
                                <MessageSquare className="w-12 h-12 text-muted-foreground/35 mx-auto mb-3" />
                                <h3 className="text-sm font-bold text-card-foreground">Nenhum sinal gerado</h3>
                                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                                    Sinais de conteúdo serão gerados e agrupados automaticamente conforme notas comerciais forem salvas e classificadas a partir de hoje.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {contentSignals.map(signal => {
                                    const totalInsights = trends?.pending_counts ? 
                                        (trends.pending_counts.revisar_manualmente + (trends.top_subcategories.dor?.reduce((a,b)=>a+b.total,0) || 0) + (trends.top_subcategories.objecao?.reduce((a,b)=>a+b.total,0) || 0) + (trends.top_subcategories.barreira_acesso?.reduce((a,b)=>a+b.total,0) || 0)) : 100;
                                    const isMature = signal.current_total >= 15 || (totalInsights > 0 && (signal.current_total / totalInsights) >= 0.05);
                                    const isExpanded = !!expandedSignals[signal.content_signal];

                                    return (
                                        <div 
                                            key={signal.content_signal} 
                                            className="bg-card border border-border/40 rounded-2xl overflow-hidden hover:border-amber-500/20 transition-all duration-200"
                                        >
                                            <div 
                                                onClick={() => toggleSignalExpand(signal.content_signal)}
                                                className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none hover:bg-muted/10 transition-all"
                                            >
                                                <div className="space-y-1.5 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-sm font-bold text-card-foreground">
                                                            "{signal.content_signal}"
                                                        </h3>
                                                        {isMature && (
                                                            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 animate-pulse">
                                                                <Flame size={10} />
                                                                Tema Maduro
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                                                        <span className="flex items-center gap-1 font-medium bg-muted px-2 py-0.5 rounded-md text-foreground">
                                                            {formatSnakeCase(signal.common_categoria)}
                                                        </span>
                                                        {signal.common_tags.map(tag => (
                                                            <span key={tag} className="flex items-center gap-0.5 text-muted-foreground/80">
                                                                <Tag size={10} />
                                                                {formatSnakeCase(tag)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 shrink-0">
                                                    <div className="text-right">
                                                        <div className="text-xl font-extrabold text-card-foreground">
                                                            {signal.current_total}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground">ocorrências</div>
                                                    </div>
                                                    <ChevronRight 
                                                        size={18} 
                                                        className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90 text-amber-500' : ''}`} 
                                                    />
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="bg-muted/10 border-t border-border/30 p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="space-y-2.5">
                                                        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Histórico de Notas (Matéria-Bruta)</h4>
                                                        <div className="space-y-2">
                                                            {signal.examples.map((example, idx) => (
                                                                <div 
                                                                    key={idx} 
                                                                    className="p-3 bg-card border border-border/20 rounded-xl text-xs leading-relaxed italic text-muted-foreground relative pl-7"
                                                                >
                                                                    <span className="absolute left-3 top-3 text-[10px] font-bold text-amber-500/50">“</span>
                                                                    {example}
                                                                    <span className="text-[10px] font-bold text-amber-500/50">”</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Related Deals Detail Modal */}
                {selectedFilter && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border/80 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-border/40 flex justify-between items-center bg-muted/10">
                                <div>
                                    <h3 className="font-bold text-sm text-card-foreground uppercase tracking-wider">
                                        Negócios Relacionados ao Tema
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {selectedFilter.category && `Eixo 1: ${formatSnakeCase(selectedFilter.category)}`}
                                        {selectedFilter.subcategory && ` — Subcategoria: ${formatSnakeCase(selectedFilter.subcategory)}`}
                                        {selectedFilter.tag && `Eixo 2 (Tag): ${formatSnakeCase(selectedFilter.tag)}`}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setSelectedFilter(null)}
                                    className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all"
                                >
                                    Fechar
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto max-h-[400px]">
                                {isLoadingDeals ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                                        <RefreshCw className="animate-spin text-amber-500" size={24} />
                                        <span className="text-xs font-semibold">Buscando negócios afetados...</span>
                                    </div>
                                ) : relatedDeals.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic text-center py-10">Nenhum negócio relacionado a este tema foi encontrado no período.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {relatedDeals.map(deal => (
                                            <div key={deal.dealId} className="p-4 border border-border/30 hover:border-amber-500/20 rounded-xl hover:bg-muted/10 transition-all flex justify-between items-center gap-4">
                                                <div className="space-y-1">
                                                    <h4 className="text-xs font-bold text-foreground">
                                                        {deal.dealTitle}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                                                        "{deal.resumo}"
                                                    </p>
                                                </div>
                                                <Link 
                                                    to={`/deals/${deal.dealId}`}
                                                    onClick={() => setSelectedFilter(null)}
                                                    className="px-3 py-1.5 bg-muted hover:bg-amber-500 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1 text-muted-foreground"
                                                >
                                                    Acessar
                                                    <ChevronRight size={12} />
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
