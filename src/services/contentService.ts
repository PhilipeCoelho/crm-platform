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

export interface ContentIdea {
  id: string;
  userId: string;
  title: string;
  description: string;
  format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null;
  status: 'capturada' | 'validada' | 'em_producao' | 'descartada';
  priority: number; // 1 to 5
  sourceType: 'manual' | 'daily' | 'crm_signal' | 'reference' | 'ai_suggestion';
  sourceId?: string | null;
  tags: string[];
  insightIds: string[];
  isLocalOnly?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentReference {
  id: string;
  userId: string;
  title: string;
  url?: string;
  type: 'link' | 'image' | 'video' | 'pdf' | 'screenshot';
  notes?: string;
  tags: string[];
  ideaId?: string;
  filePath?: string;
  createdAt: string;
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
