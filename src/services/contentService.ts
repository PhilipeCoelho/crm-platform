/**
 * Content Intelligence Service Layer
 * 
 * This service will be the single point of access for all Content module data.
 * Currently a structural stub — no database tables exist yet.
 * 
 * Future modules:
 * - Daily entries
 * - Ideas
 * - References
 * - Productions
 * - Publications
 * - Opportunities (consuming insights_comerciais + deal_analytics)
 * - Metrics
 * - Learnings
 * 
 * IMPORTANT: This service must NOT duplicate logic from:
 * - knowledgeBase.ts (commercial intelligence)
 * - recommendations.ts (strategic recommendations)
 * - store.ts (CRM state)
 * 
 * When Content Intelligence needs commercial data, it should
 * import and consume from the existing services above.
 */

import { supabase } from '@/lib/supabase';

// ============================================
// Types (structural — no tables yet)
// ============================================

export interface ContentDailyEntry {
  id: string;
  userId: string;
  entryDate: string; // YYYY-MM-DD
  entryTime: string; // HH:MM:SS
  rawContent: string;
  sourceType: 'text' | 'voice' | 'crm_sync' | 'file';
  activityId?: string | null;
  dealId?: string | null;
  aiStatus: 'pending' | 'processed' | 'failed' | 'skipped';
  aiSummary?: string | null;
  aiSignals?: {
    fatos?: string[];
    emocao_contexto?: string | null;
    aprendizado?: string | null;
    sinais_conteudo?: string[];
  } | null;
  isLocalOnly?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExecutionStage = 'producao' | 'gravado' | 'publicado' | 'aguardando_metricas' | 'analisado';
export type ContentPlatform = 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'twitter' | 'blog' | 'outro';

export interface ContentMetricsData {
  views?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  leads?: number;
  conversions?: number;
}

export interface ContentIdea {
  id: string;
  userId: string;
  title: string;
  description: string;
  format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null;
  status: 'capturada' | 'validada' | 'em_producao' | 'descartada';
  priority: number; // 1 to 5
  sourceType: 'manual' | 'daily' | 'crm_signal' | 'reference' | 'ai_suggestion' | 'opportunity';
  sourceId?: string | null;
  tags: string[];
  insightIds: string[];
  executionStage?: ExecutionStage | null;
  nextAction?: string | null;
  hook?: string;
  angle?: string;
  bodyScript?: string;
  cta?: string;
  notes?: string;
  publishedAt?: string | null;
  platform?: ContentPlatform | null;
  publicationUrl?: string | null;
  metrics?: ContentMetricsData;
  metricsRecordedAt?: string | null;
  stageUpdatedAt?: string;
  isLocalOnly?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityType = 'experiencia' | 'dor_comercial' | 'insight' | 'opiniao' | 'educacional' | 'tendencia' | 'conexao';
export type OpportunityStatus = 'nova' | 'vista' | 'aceita' | 'descartada' | 'convertida';
export type OpportunitySourceType = 'daily' | 'crm_signal' | 'content_idea' | 'reference' | 'performance';

export interface ContentOpportunitySource {
  id: string;
  opportunityId: string;
  sourceType: OpportunitySourceType;
  sourceId?: string | null;
  sourceContext?: string | null;
  createdAt: string;
}

export interface ContentOpportunity {
  id: string;
  userId: string;
  title: string;
  description: string;
  whyNow: string;
  opportunityType: OpportunityType;
  status: OpportunityStatus;
  priority: number;
  score: number | null;
  connectedIdeaId?: string | null;
  sources?: ContentOpportunitySource[];
  isLocalOnly?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReferenceStatus = 'salva' | 'analisando' | 'analisada' | 'arquivada';
export type ReferencePlatform = 'instagram' | 'youtube' | 'tiktok' | 'linkedin' | 'twitter' | 'facebook' | 'blog' | 'outro';

export interface ReferenceAnalysis {
  hook?: string;
  angle?: string;
  structure?: string;
  attentionMechanism?: string;
  cta?: string;
  whyItWorks?: string;
  whatToLearn?: string;
  applicationToVamuss?: string;
  adaptationIdea?: string;
}

export interface ContentReference {
  id: string;
  userId: string;
  url: string;
  platform?: ReferencePlatform | null;
  title?: string | null;
  author?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  notes?: string | null;
  status: ReferenceStatus;
  analysis: ReferenceAnalysis;
  tags: string[];
  analyzedAt?: string | null;
  isLocalOnly?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentProduction {
  id: string;
  userId: string;
  ideaId: string;
  title: string;
  format: 'carrossel' | 'reel' | 'post' | 'story';
  status: 'rascunho' | 'em_revisao' | 'aprovado' | 'agendado' | 'publicado';
  copyText?: string;
  visualNotes?: string;
  scheduledDate?: string;
  publishedAt?: string;
  platform: 'instagram' | 'linkedin' | 'tiktok';
  externalUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentMetrics {
  id: string;
  userId: string;
  productionId: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  leadsGenerated: number;
  measuredAt: string;
}

// --- Etapa 7: Performance Intelligence & Learning Engine Types ---

export type PerformanceAnalysisStatus = 'pending' | 'analyzing' | 'analyzed';

export interface PerformanceEvidence {
  sampleSize: number;
  baselineAvailable: boolean;
  confidence: 'low' | 'medium' | 'high';
}

export type LearningType = 'hook' | 'angle' | 'format' | 'topic' | 'cta' | 'structure' | 'audience' | 'timing' | 'general';
export type LearningConfidence = 'low' | 'medium' | 'high';
export type LearningStatus = 'suggested' | 'confirmed' | 'discarded';

export interface SuggestedLearning {
  learning: string;
  type: LearningType;
  evidence?: string;
  confidence: LearningConfidence;
  application?: string;
}

export interface PerformanceAnalysisData {
  summary: string;
  observations: string[];
  strengths: string[];
  weaknesses: string[];
  hypotheses: string[];
  recommendations: string[];
  evidence: PerformanceEvidence;
  suggestedLearnings?: SuggestedLearning[];
}

export interface ContentPerformanceAnalysis {
  id: string;
  userId: string;
  contentIdeaId: string;
  status: PerformanceAnalysisStatus;
  analysis: PerformanceAnalysisData;
  createdAt: string;
  updatedAt: string;
  analyzedAt?: string | null;
  isLocalOnly?: boolean;
}

export interface ContentLearning {
  id: string;
  userId: string;
  sourceContentId?: string | null;
  learning: string;
  type: LearningType;
  evidence?: string | null;
  confidence: LearningConfidence;
  status: LearningStatus;
  application?: string | null;
  createdAt: string;
  updatedAt: string;
  isLocalOnly?: boolean;
}

export interface DerivedMetrics {
  engagementRateViews: number | null; // (likes + comments + shares + saves) / views
  engagementRateReach: number | null; // (likes + comments + shares + saves) / reach
  leadRate: number | null;            // leads / reach (or leads / views)
  totalInteractions: number;          // likes + comments + shares + saves
}

export interface HistoricalComparison {
  sampleSize: number;
  confidence: 'low' | 'medium' | 'high';
  confidenceLabel: string; // 'Sinal inicial' (1-4), 'Padrão emergente' (5-9), 'Padrão consistente' (10+)
  medianViews: number | null;
  medianReach: number | null;
  medianEngagementRate: number | null;
  viewsVsMedianPercent: number | null;
  engagementVsMedianPercent: number | null;
}

// --- Etapa 8: Intelligence Orchestration & Next Best Action ---

export type ContentActionType = 
  | 'analisar_performance'
  | 'registrar_metricas'
  | 'analisar_referencia'
  | 'usar_oportunidade'
  | 'continuar_producao'
  | 'criar_ideia'
  | 'aplicar_aprendizado'
  | 'revisar_aprendizado';

export type ContentActionStatus = 'suggested' | 'accepted' | 'completed' | 'dismissed';

export type ContentActionSourceType = 
  | 'content_idea'
  | 'content_opportunity'
  | 'content_reference'
  | 'content_learning'
  | 'daily'
  | 'crm_signal';

export interface ContentAction {
  id: string;
  userId: string;
  actionType: ContentActionType;
  title: string;
  description?: string | null;
  priority: number;
  score?: number | null;
  status: ContentActionStatus;
  sourceType: ContentActionSourceType;
  sourceId?: string | null;
  reason: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  isLocalOnly?: boolean;
}

// ============================================
// Service stubs (no-op until tables are created)
// ============================================

/** Check if the current user is authenticated */
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// --- Daily ---
export const dailyService = {
  // Will be implemented in Etapa 2
};

// --- Ideas ---
export const ideasService = {
  // Will be implemented in Etapa 3
};

// --- References ---
export const referencesService = {
  // Will be implemented in Etapa 4
};

// --- Productions ---
export const productionsService = {
  // Will be implemented in Etapa 7
};

// --- Publications ---
export const publicationsService = {
  // Will be implemented in Etapa 8
};

// --- Opportunities ---
// NOTE: Will consume from knowledgeBase.ts (fetchContentSignals, fetchTrends)
// and recommendations.ts — NOT duplicate them.
export const opportunitiesService = {
  // Will be implemented in Etapa 6
};

// --- Metrics ---
export const metricsService = {
  // Will be implemented in Etapa 8
};

// --- Learnings ---
export const learningsService = {
  // Will be implemented in Etapa 9
};

export default {
  getCurrentUserId,
  daily: dailyService,
  ideas: ideasService,
  references: referencesService,
  productions: productionsService,
  publications: publicationsService,
  opportunities: opportunitiesService,
  metrics: metricsService,
  learnings: learningsService,
};
