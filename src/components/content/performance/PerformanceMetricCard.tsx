import React from 'react';
import { 
  Eye, 
  Users, 
  Heart, 
  MessageSquare, 
  Share2, 
  Bookmark, 
  MousePointer, 
  Sparkles,
  TrendingUp,
  TrendingDown,
  Info
} from 'lucide-react';
import { ContentMetricsData, DerivedMetrics, HistoricalComparison } from '@/services/contentService';
import { formatRatePercent, formatChangePercent } from '@/services/contentMetricsCalculation';

interface PerformanceMetricCardProps {
  metrics?: ContentMetricsData | null;
  derived?: DerivedMetrics | null;
  comparison?: HistoricalComparison | null;
  compact?: boolean;
}

export const PerformanceMetricCard: React.FC<PerformanceMetricCardProps> = ({
  metrics,
  derived,
  comparison,
  compact = false,
}) => {
  if (!metrics || Object.keys(metrics).length === 0) {
    return (
      <div className="p-4 rounded-xl bg-muted/20 border border-border/60 text-xs text-muted-foreground text-center">
        Nenhuma métrica registrada ainda.
      </div>
    );
  }

  const views = metrics.views ?? null;
  const reach = metrics.reach ?? null;
  const likes = metrics.likes ?? 0;
  const comments = metrics.comments ?? 0;
  const shares = metrics.shares ?? 0;
  const saves = metrics.saves ?? 0;
  const clicks = metrics.clicks ?? null;
  const leads = metrics.leads ?? null;

  const engagementRate = derived?.engagementRateReach ?? derived?.engagementRateViews ?? null;
  const leadRate = derived?.leadRate ?? null;

  return (
    <div className="space-y-3">
      {/* 1. Métricas Chave / KPIs */}
      <div className={`grid ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'} gap-2.5`}>
        {/* Views */}
        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
            <span className="flex items-center gap-1"><Eye size={12} /> Views</span>
            {comparison?.viewsVsMedianPercent !== null && comparison?.viewsVsMedianPercent !== undefined && (
              <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
                comparison.viewsVsMedianPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {comparison.viewsVsMedianPercent >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {formatChangePercent(comparison.viewsVsMedianPercent)}
              </span>
            )}
          </div>
          <p className="text-base font-bold text-foreground">
            {views !== null ? views.toLocaleString('pt-BR') : '—'}
          </p>
        </div>

        {/* Reach */}
        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
            <span className="flex items-center gap-1"><Users size={12} /> Alcance</span>
          </div>
          <p className="text-base font-bold text-foreground">
            {reach !== null ? reach.toLocaleString('pt-BR') : '—'}
          </p>
        </div>

        {/* Engagement Rate */}
        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
            <span className="flex items-center gap-1"><Sparkles size={12} /> Engajamento</span>
            {comparison?.engagementVsMedianPercent !== null && comparison?.engagementVsMedianPercent !== undefined && (
              <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
                comparison.engagementVsMedianPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {comparison.engagementVsMedianPercent >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {formatChangePercent(comparison.engagementVsMedianPercent)}
              </span>
            )}
          </div>
          <p className="text-base font-bold text-foreground">
            {formatRatePercent(engagementRate)}
          </p>
        </div>

        {/* Leads */}
        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
            <span className="flex items-center gap-1">🎯 Leads</span>
            {leadRate !== null && (
              <span className="text-[10px] font-medium text-emerald-500">
                {formatRatePercent(leadRate)}
              </span>
            )}
          </div>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {leads !== null ? leads : '—'}
          </p>
        </div>
      </div>

      {/* 2. Reações Detalhadas */}
      {!compact && (
        <div className="flex items-center justify-between p-2.5 bg-muted/20 border border-border/50 rounded-xl text-xs text-muted-foreground flex-wrap gap-2">
          <span className="flex items-center gap-1">
            <Heart size={12} className="text-rose-500" /> {likes} curtidas
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare size={12} className="text-blue-500" /> {comments} comentários
          </span>
          <span className="flex items-center gap-1">
            <Share2 size={12} className="text-indigo-500" /> {shares} partilhas
          </span>
          <span className="flex items-center gap-1">
            <Bookmark size={12} className="text-amber-500" /> {saves} salvos
          </span>
          {clicks !== null && (
            <span className="flex items-center gap-1">
              <MousePointer size={12} className="text-purple-500" /> {clicks} cliques
            </span>
          )}
        </div>
      )}

      {/* 3. Indicador de Comparação com Histórico / Amostra */}
      {comparison && comparison.sampleSize > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Info size={13} className="text-muted-foreground flex-shrink-0" />
            <span>Comparado com <strong>{comparison.sampleSize}</strong> conteúdos anteriores</span>
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            comparison.confidence === 'high'
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : comparison.confidence === 'medium'
              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              : 'bg-muted text-muted-foreground border-border'
          }`}>
            {comparison.confidenceLabel}
          </span>
        </div>
      )}
    </div>
  );
};
