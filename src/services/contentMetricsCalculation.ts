import type { 
  ContentMetricsData, 
  DerivedMetrics, 
  HistoricalComparison, 
  ContentIdea 
} from './contentService';

// ==============================================================================
// THRESHOLDS DE AMOSTRAGEM CENTRALIZADOS
// ==============================================================================
export const MIN_SAMPLE_INITIAL = 1;
export const MIN_SAMPLE_EMERGING = 5;
export const MIN_SAMPLE_STRONG = 10;

/**
 * Calculates derived performance metrics from raw metrics.
 * Protects against division by zero and returns null (never 0%) when denominator is absent.
 */
export function calculateDerivedMetrics(metrics?: ContentMetricsData | null): DerivedMetrics {
  if (!metrics) {
    return {
      engagementRateViews: null,
      engagementRateReach: null,
      leadRate: null,
      totalInteractions: 0,
    };
  }

  const likes = typeof metrics.likes === 'number' ? metrics.likes : 0;
  const comments = typeof metrics.comments === 'number' ? metrics.comments : 0;
  const shares = typeof metrics.shares === 'number' ? metrics.shares : 0;
  const saves = typeof metrics.saves === 'number' ? metrics.saves : 0;
  const totalInteractions = likes + comments + shares + saves;

  const views = typeof metrics.views === 'number' ? metrics.views : null;
  const reach = typeof metrics.reach === 'number' ? metrics.reach : null;
  const leads = typeof metrics.leads === 'number' ? metrics.leads : null;

  // Engagement por views
  const engagementRateViews = (views !== null && views > 0)
    ? totalInteractions / views
    : null;

  // Engagement por reach
  const engagementRateReach = (reach !== null && reach > 0)
    ? totalInteractions / reach
    : null;

  // Lead rate: leads / reach (ou leads / views se reach inexistente)
  let leadRate: number | null = null;
  if (leads !== null) {
    if (reach !== null && reach > 0) {
      leadRate = leads / reach;
    } else if (views !== null && views > 0) {
      leadRate = leads / views;
    }
  }

  return {
    engagementRateViews,
    engagementRateReach,
    leadRate,
    totalInteractions,
  };
}

/**
 * Calculates median of an array of numbers.
 * Reduces outlier distortion compared to mean.
 */
export function calculateMedian(numbers: number[]): number | null {
  const valid = numbers.filter(n => typeof n === 'number' && !isNaN(n));
  if (valid.length === 0) return null;

  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Compares current content idea's performance against user's historical median.
 */
export function calculateHistoricalComparison(
  currentIdea: ContentIdea,
  allPublishedIdeas: ContentIdea[]
): HistoricalComparison {
  // Filter out the current idea and keep published items that have metrics
  const comparable = allPublishedIdeas.filter(idea => 
    idea.id !== currentIdea.id && 
    idea.metrics && 
    Object.keys(idea.metrics).length > 0 &&
    (idea.metrics.views || idea.metrics.reach || idea.metrics.likes)
  );

  const sampleSize = comparable.length;

  let confidence: 'low' | 'medium' | 'high' = 'low';
  let confidenceLabel = 'Sinal inicial';

  if (sampleSize >= MIN_SAMPLE_STRONG) {
    confidence = 'high';
    confidenceLabel = 'Padrão consistente';
  } else if (sampleSize >= MIN_SAMPLE_EMERGING) {
    confidence = 'medium';
    confidenceLabel = 'Padrão emergente';
  }

  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      confidence: 'low',
      confidenceLabel: 'Sem histórico comparável',
      medianViews: null,
      medianReach: null,
      medianEngagementRate: null,
      viewsVsMedianPercent: null,
      engagementVsMedianPercent: null,
    };
  }

  const historicalViews = comparable
    .map(i => i.metrics?.views)
    .filter((v): v is number => typeof v === 'number' && v > 0);

  const historicalReach = comparable
    .map(i => i.metrics?.reach)
    .filter((r): r is number => typeof r === 'number' && r > 0);

  const historicalEngagementRates = comparable
    .map(i => {
      const derived = calculateDerivedMetrics(i.metrics);
      return derived.engagementRateReach ?? derived.engagementRateViews;
    })
    .filter((er): er is number => er !== null);

  const medianViews = calculateMedian(historicalViews);
  const medianReach = calculateMedian(historicalReach);
  const medianEngagementRate = calculateMedian(historicalEngagementRates);

  // Current values
  const currentDerived = calculateDerivedMetrics(currentIdea.metrics);
  const currentViews = currentIdea.metrics?.views ?? null;
  const currentEngagement = currentDerived.engagementRateReach ?? currentDerived.engagementRateViews;

  let viewsVsMedianPercent: number | null = null;
  if (currentViews !== null && medianViews !== null && medianViews > 0) {
    viewsVsMedianPercent = ((currentViews - medianViews) / medianViews) * 100;
  }

  let engagementVsMedianPercent: number | null = null;
  if (currentEngagement !== null && medianEngagementRate !== null && medianEngagementRate > 0) {
    engagementVsMedianPercent = ((currentEngagement - medianEngagementRate) / medianEngagementRate) * 100;
  }

  return {
    sampleSize,
    confidence,
    confidenceLabel,
    medianViews,
    medianReach,
    medianEngagementRate,
    viewsVsMedianPercent,
    engagementVsMedianPercent,
  };
}

/**
 * Format helper for rate percentages (e.g. 0.042 -> "4.2%")
 */
export function formatRatePercent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || isNaN(rate)) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format helper for change percentages (e.g. 82.5 -> "+82.5%", -15.0 -> "-15.0%")
 */
export function formatChangePercent(percent: number | null | undefined): string {
  if (percent === null || percent === undefined || isNaN(percent)) return '—';
  const prefix = percent > 0 ? '+' : '';
  return `${prefix}${percent.toFixed(0)}%`;
}
