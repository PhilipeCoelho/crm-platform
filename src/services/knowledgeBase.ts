import { supabase } from '@/lib/supabase';
import { InsightComercial } from '@/types/schema';

export interface TrendData {
    total_active_deals: number;
    top_subcategories: Record<string, { subcategoria: string; total: number }[]>;
    tag_counts: { tag: string; current_total: number; prev_total: number }[];
    win_loss_reasons: Record<string, { subcategoria: string; total: number; tags: string[] }[]>;
    pending_counts: { revisar_manualmente: number; classificacao_falhou: number };
}

/**
 * Calls the backend native SQL aggregated trends endpoint
 */
export async function fetchTrends(days: number = 30): Promise<TrendData | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    try {
        const response = await fetch(`/api/knowledge-base/trends?days=${days}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Trends API returned status ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error("Error fetching trends from backend:", err);
        return null;
    }
}

/**
 * Fetches commercial insights marked for manual review or classification failures
 */
export async function fetchPendingReviews(): Promise<InsightComercial[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('insights_comerciais')
        .select('*')
        .or('revisar_manualmente.eq.true,classificacao_falhou.eq.true')
        .order('criado_em', { ascending: false });

    if (error) {
        console.error("Error fetching pending reviews:", error);
        return [];
    }

    return (data || []).map((item: any) => ({
        id: item.id,
        userId: item.user_id,
        negocioId: item.negocio_id,
        atividadeId: item.atividade_id,
        textoOrigem: item.texto_origem,
        categoria: item.categoria,
        tagsTematicas: item.tags_tematicas,
        subcategoria: item.subcategoria,
        resumo: item.resumo,
        confianca: item.confianca,
        revisarManualmente: item.revisar_manualmente,
        classificacaoFalhou: item.classificacao_falhou,
        erroClassificacao: item.erro_classificacao,
        criadoEm: item.criado_em
    }));
}

/**
 * Retriggers classification for a failed or low confidence insight
 */
export async function retryClassification(textoOrigem: string, negocioId: string | null, atividadeId: string | null): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    try {
        const response = await fetch('/api/insights/classify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                negocioId,
                atividadeId,
                textoOrigem,
                userId: session.user.id
            })
        });

        return response.ok;
    } catch (err) {
        console.error("Error retrying classification:", err);
        return false;
    }
}

export interface RelatedDeal {
    dealId: string;
    dealTitle: string;
    resumo: string;
    categoria: string;
    subcategoria: string;
    tagsTematicas: string[];
}

/**
 * Fetches all deals affected by a specific category, subcategory, or tag
 */
export async function fetchRelatedDeals(filter: { category?: string; tag?: string; subcategory?: string }): Promise<RelatedDeal[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase.from('insights_comerciais').select('negocio_id, resumo, categoria, tags_tematicas, subcategoria');
    
    if (filter.category) query = query.eq('categoria', filter.category);
    if (filter.subcategory) query = query.eq('subcategoria', filter.subcategory);
    if (filter.tag) query = query.contains('tags_tematicas', [filter.tag]);

    const { data: insights, error: insightsErr } = await query;
    if (insightsErr || !insights) {
        console.error("Error fetching related deals insights:", insightsErr);
        return [];
    }

    const dealIds = Array.from(new Set(insights.map(i => i.negocio_id).filter(Boolean)));
    if (dealIds.length === 0) return [];

    const { data: deals, error: dealsErr } = await supabase
        .from('deals')
        .select('id, title')
        .in('id', dealIds);

    if (dealsErr || !deals) {
        console.error("Error fetching related deals info:", dealsErr);
        return [];
    }

    return insights.map(item => {
        const deal = deals.find(d => d.id === item.negocio_id);
        return {
            dealId: item.negocio_id || '',
            dealTitle: deal ? deal.title : 'Negócio Desconhecido',
            resumo: item.resumo || '',
            categoria: item.categoria || '',
            subcategoria: item.subcategoria || '',
            tagsTematicas: item.tags_tematicas || []
        };
    });
}

export interface ContentSignalTrend {
    content_signal: string;
    current_total: number;
    prev_total: number;
    examples: string[];
    common_categoria: string;
    common_tags: string[];
}

/**
 * Calls the backend native SQL aggregated content signals trends endpoint
 */
export async function fetchContentSignals(days: number = 30): Promise<ContentSignalTrend[] | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    try {
        const response = await fetch(`/api/knowledge-base/content-signals?days=${days}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Content Signals API returned status ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error("Error fetching content signals from backend:", err);
        return null;
    }
}
export interface BackfillResult {
    found: number;
    queued: number;
    skipped: number;
    errors: number;
    duration_ms: number;
    message: string;
}

/**
 * Triggers the historical backfill classification for unclassified notes and lost reasons.
 */
export async function triggerBackfill(dias: number = 60): Promise<BackfillResult | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    try {
        const response = await fetch('/api/knowledge-base/backfill', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ dias })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err?.error || `Backfill API returned status ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error('Error triggering backfill:', err);
        return null;
    }
}

/**
 * Automatically consolidates access barrier subcategories under sem_resposta_contacto
 */
export async function consolidateSubcategories(): Promise<void> {
    try {
        await supabase
            .from('insights_comerciais')
            .update({ subcategoria: 'sem_resposta_contacto' })
            .in('subcategoria', ['sem_resposta_mensagens', 'sem_resposta_decisor']);
    } catch (err) {
        console.error("Error consolidating subcategories:", err);
    }
}

export async function fetchTrendsAndSignalsClient(
    filter: 'today' | '7' | '30' | '60' | '90' | 'all' | 'custom',
    customRange?: { start: Date; end: Date }
): Promise<{ trends: TrendData; contentSignals: ContentSignalTrend[] } | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let currentStart: Date;
    let currentEnd = new Date();
    let prevStart: Date;
    let prevEnd: Date;

    const now = new Date();

    if (filter === 'today') {
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        prevStart = new Date(currentStart.getTime() - 24 * 60 * 60 * 1000);
        prevEnd = new Date(currentEnd.getTime() - 24 * 60 * 60 * 1000);
    } else if (filter === 'all') {
        currentStart = new Date(2020, 0, 1);
        prevStart = new Date(2010, 0, 1);
        prevEnd = new Date(2020, 0, 1);
    } else if (filter === 'custom' && customRange) {
        currentStart = customRange.start;
        currentEnd = customRange.end;
        const diff = currentEnd.getTime() - currentStart.getTime();
        prevStart = new Date(currentStart.getTime() - diff);
        prevEnd = currentStart;
    } else {
        const days = Number(filter) || 30;
        currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        prevStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);
        prevEnd = currentStart;
    }

    const { data: insights, error } = await supabase
        .from('insights_comerciais')
        .select('*')
        .eq('user_id', user.id);

    if (error) {
        console.error("Error fetching insights client-side:", error);
        return null;
    }

    const items = insights || [];

    const currentItems = items.filter(item => {
        const d = new Date(item.criado_em);
        return d >= currentStart && d <= currentEnd;
    });

    const prevItems = items.filter(item => {
        const d = new Date(item.criado_em);
        return d >= prevStart && d <= prevEnd;
    });

    const { count: activeCount } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'open');

    const total_active_deals = activeCount || 0;

    const subcatMap: Record<string, Record<string, number>> = { dor: {}, objecao: {}, barreira_acesso: {} };
    currentItems.forEach(item => {
        if (['dor', 'objecao', 'barreira_acesso'].includes(item.categoria) && item.subcategoria) {
            subcatMap[item.categoria][item.subcategoria] = (subcatMap[item.categoria][item.subcategoria] || 0) + 1;
        }
    });

    const top_subcategories: Record<string, { subcategoria: string; total: number }[]> = {};
    Object.keys(subcatMap).forEach(cat => {
        top_subcategories[cat] = Object.entries(subcatMap[cat])
            .map(([sub, total]) => ({ subcategoria: sub, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
    });

    const currentTags: Record<string, number> = {};
    currentItems.forEach(item => {
        if (Array.isArray(item.tags_tematicas)) {
            item.tags_tematicas.forEach((t: string) => {
                currentTags[t] = (currentTags[t] || 0) + 1;
            });
        }
    });

    const prevTags: Record<string, number> = {};
    prevItems.forEach(item => {
        if (Array.isArray(item.tags_tematicas)) {
            item.tags_tematicas.forEach((t: string) => {
                prevTags[t] = (prevTags[t] || 0) + 1;
            });
        }
    });

    const allTags = Array.from(new Set([...Object.keys(currentTags), ...Object.keys(prevTags)]));
    const tag_counts = allTags.map(tag => ({
        tag,
        current_total: currentTags[tag] || 0,
        prev_total: prevTags[tag] || 0
    }));

    const wlMap: Record<string, Record<string, { total: number; tags: Set<string> }>> = { motivo_ganho: {}, motivo_perda: {} };
    currentItems.forEach(item => {
        if (['motivo_ganho', 'motivo_perda'].includes(item.categoria) && item.subcategoria) {
            if (!wlMap[item.categoria][item.subcategoria]) {
                wlMap[item.categoria][item.subcategoria] = { total: 0, tags: new Set() };
            }
            wlMap[item.categoria][item.subcategoria].total += 1;
            if (Array.isArray(item.tags_tematicas)) {
                item.tags_tematicas.forEach((t: string) => wlMap[item.categoria][item.subcategoria].tags.add(t));
            }
        }
    });

    const win_loss_reasons: Record<string, { subcategoria: string; total: number; tags: string[] }[]> = {};
    Object.keys(wlMap).forEach(cat => {
        win_loss_reasons[cat] = Object.entries(wlMap[cat])
            .map(([sub, data]) => ({
                subcategoria: sub,
                total: data.total,
                tags: Array.from(data.tags)
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    });

    const pending_counts = {
        revisar_manualmente: items.filter(i => i.revisar_manualmente === true || String(i.revisar_manualmente) === 'true').length,
        classificacao_falhou: items.filter(i => i.classificacao_falhou === true || String(i.classificacao_falhou) === 'true').length
    };

    const trends: TrendData = {
        total_active_deals,
        top_subcategories,
        tag_counts,
        win_loss_reasons,
        pending_counts
    };

    const signalMap: Record<string, {
        content_signal: string;
        current_total: number;
        categories: Record<string, number>;
        examples: Set<string>;
        tags: Record<string, number>;
    }> = {};

    currentItems.forEach(item => {
        if (item.content_signal) {
            const sig = item.content_signal;
            if (!signalMap[sig]) {
                signalMap[sig] = {
                    content_signal: sig,
                    current_total: 0,
                    categories: {},
                    examples: new Set(),
                    tags: {}
                };
            }
            signalMap[sig].current_total += 1;
            signalMap[sig].categories[item.categoria] = (signalMap[sig].categories[item.categoria] || 0) + 1;
            if (item.texto_origem) {
                signalMap[sig].examples.add(item.texto_origem);
            }
            if (Array.isArray(item.tags_tematicas)) {
                item.tags_tematicas.forEach((t: string) => {
                    signalMap[sig].tags[t] = (signalMap[sig].tags[t] || 0) + 1;
                });
            }
        }
    });

    const prevSignalTotals: Record<string, number> = {};
    prevItems.forEach(item => {
        if (item.content_signal) {
            prevSignalTotals[item.content_signal] = (prevSignalTotals[item.content_signal] || 0) + 1;
        }
    });

    const contentSignals: ContentSignalTrend[] = Object.values(signalMap).map(sig => {
        const common_categoria = Object.entries(sig.categories)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutro';

        const examples = Array.from(sig.examples).slice(0, 3);

        const common_tags = Object.entries(sig.tags)
            .sort((a, b) => b[1] - a[1])
            .map(([t]) => t)
            .slice(0, 5);

        const prev_total = prevSignalTotals[sig.content_signal] || 0;

        return {
            content_signal: sig.content_signal,
            current_total: sig.current_total,
            prev_total,
            common_categoria,
            examples,
            common_tags
        };
    }).sort((a, b) => b.current_total - a.current_total);

    return { trends, contentSignals };
}

