import { supabase } from '@/lib/supabase';
import { 
  ContentPerformanceAnalysis, 
  ContentLearning, 
  LearningType, 
  LearningConfidence, 
  LearningStatus 
} from './contentService';

const PERF_LOCAL_STORAGE_KEY = 'vamus_content_perf_fallback';
const LEARNINGS_LOCAL_STORAGE_KEY = 'vamus_content_learnings_fallback';

// ==============================================================================
// LOCAL FALLBACK HELPERS
// ==============================================================================
function getLocalPerfAnalyses(): ContentPerformanceAnalysis[] {
  try {
    const raw = localStorage.getItem(PERF_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalPerfAnalysis(analysis: ContentPerformanceAnalysis) {
  try {
    const list = getLocalPerfAnalyses();
    const idx = list.findIndex(a => a.contentIdeaId === analysis.contentIdeaId);
    if (idx >= 0) {
      list[idx] = analysis;
    } else {
      list.unshift(analysis);
    }
    localStorage.setItem(PERF_LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save local performance analysis:', err);
  }
}

function getLocalLearnings(): ContentLearning[] {
  try {
    const raw = localStorage.getItem(LEARNINGS_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalLearning(learning: ContentLearning) {
  try {
    const list = getLocalLearnings();
    const idx = list.findIndex(l => l.id === learning.id);
    if (idx >= 0) {
      list[idx] = learning;
    } else {
      list.unshift(learning);
    }
    localStorage.setItem(LEARNINGS_LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save local learning:', err);
  }
}

function mapRowToAnalysis(row: any): ContentPerformanceAnalysis {
  return {
    id: row.id,
    userId: row.user_id,
    contentIdeaId: row.content_idea_id,
    status: row.status,
    analysis: row.analysis || {
      summary: '',
      observations: [],
      strengths: [],
      weaknesses: [],
      hypotheses: [],
      recommendations: [],
      evidence: { sampleSize: 0, baselineAvailable: false, confidence: 'low' },
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    analyzedAt: row.analyzed_at || null,
    isLocalOnly: false,
  };
}

function mapRowToLearning(row: any): ContentLearning {
  return {
    id: row.id,
    userId: row.user_id,
    sourceContentId: row.source_content_id || null,
    learning: row.learning,
    type: row.type,
    evidence: row.evidence || null,
    confidence: row.confidence,
    status: row.status,
    application: row.application || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isLocalOnly: false,
  };
}

// ==============================================================================
// PERFORMANCE ANALYSES SERVICE
// ==============================================================================

/**
 * Fetches performance analysis for a specific content idea.
 */
export async function fetchPerformanceAnalysis(contentIdeaId: string): Promise<ContentPerformanceAnalysis | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return getLocalPerfAnalyses().find(a => a.contentIdeaId === contentIdeaId) || null;
  }

  try {
    const { data, error } = await supabase
      .from('content_performance_analyses')
      .select('*')
      .eq('content_idea_id', contentIdeaId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205') {
        return getLocalPerfAnalyses().find(a => a.contentIdeaId === contentIdeaId) || null;
      }
      console.warn('Error fetching performance analysis from Supabase:', error.message);
      return getLocalPerfAnalyses().find(a => a.contentIdeaId === contentIdeaId) || null;
    }

    if (!data) return null;
    return mapRowToAnalysis(data);
  } catch (err) {
    console.error('Exception fetching performance analysis:', err);
    return getLocalPerfAnalyses().find(a => a.contentIdeaId === contentIdeaId) || null;
  }
}

/**
 * Fetches all performance analyses for the current user.
 */
export async function fetchAllPerformanceAnalyses(): Promise<ContentPerformanceAnalysis[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getLocalPerfAnalyses();

  try {
    const { data, error } = await supabase
      .from('content_performance_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') return getLocalPerfAnalyses();
      console.warn('Error fetching all performance analyses:', error.message);
      return getLocalPerfAnalyses();
    }

    return (data || []).map(mapRowToAnalysis);
  } catch {
    return getLocalPerfAnalyses();
  }
}

/**
 * Calls the backend AI endpoint to analyze performance on-demand.
 */
export async function analyzePerformanceWithAI(contentIdeaId: string): Promise<ContentPerformanceAnalysis | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('Sessão expirada ou usuário não autenticado.');
  }

  const response = await fetch('/api/content/performance/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ contentIdeaId }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.message || errorBody?.error || `Erro ${response.status} na análise de performance`;
    throw new Error(message);
  }

  const result = await response.json();
  if (!result.success || !result.analysis) {
    throw new Error('Resposta inválida do servidor de inteligência de performance');
  }

  const savedAnalysis: ContentPerformanceAnalysis = {
    id: result.id || `perf_${Date.now()}`,
    userId: session.user.id,
    contentIdeaId,
    status: 'analyzed',
    analysis: result.analysis,
    createdAt: result.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analyzedAt: new Date().toISOString(),
    isLocalOnly: false,
  };

  saveLocalPerfAnalysis(savedAnalysis);
  return savedAnalysis;
}

// ==============================================================================
// CONTENT LEARNINGS SERVICE
// ==============================================================================

export interface CreateLearningInput {
  sourceContentId?: string | null;
  learning: string;
  type: LearningType;
  evidence?: string | null;
  confidence: LearningConfidence;
  application?: string | null;
  status?: LearningStatus;
}

/**
 * Fetches learnings for the current user with optional filters.
 */
export async function fetchLearnings(filter?: { status?: string; type?: string }): Promise<ContentLearning[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    let list = getLocalLearnings();
    if (filter?.status && filter.status !== 'all') {
      list = list.filter(l => l.status === filter.status);
    }
    if (filter?.type && filter.type !== 'all') {
      list = list.filter(l => l.type === filter.type);
    }
    return list;
  }

  try {
    let query = supabase
      .from('content_learnings')
      .select('*')
      .eq('user_id', user.id);

    if (filter?.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }

    if (filter?.type && filter.type !== 'all') {
      query = query.eq('type', filter.type);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST205') {
        let list = getLocalLearnings();
        if (filter?.status && filter.status !== 'all') list = list.filter(l => l.status === filter.status);
        if (filter?.type && filter.type !== 'all') list = list.filter(l => l.type === filter.type);
        return list;
      }
      console.warn('Error fetching learnings from Supabase:', error.message);
      return getLocalLearnings();
    }

    return (data || []).map(mapRowToLearning);
  } catch {
    return getLocalLearnings();
  }
}

/**
 * Creates a new learning record (starts as 'suggested' by default).
 */
export async function createLearning(input: CreateLearningInput): Promise<ContentLearning> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous';
  const now = new Date().toISOString();
  const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `learn_${Date.now()}`;

  const optimistic: ContentLearning = {
    id: tempId,
    userId,
    sourceContentId: input.sourceContentId || null,
    learning: input.learning.trim(),
    type: input.type,
    evidence: input.evidence?.trim() || null,
    confidence: input.confidence || 'low',
    status: input.status || 'suggested',
    application: input.application?.trim() || null,
    createdAt: now,
    updatedAt: now,
    isLocalOnly: true,
  };

  saveLocalLearning(optimistic);

  if (!user) return optimistic;

  try {
    const { data, error } = await supabase
      .from('content_learnings')
      .insert({
        id: tempId,
        user_id: user.id,
        source_content_id: optimistic.sourceContentId,
        learning: optimistic.learning,
        type: optimistic.type,
        evidence: optimistic.evidence,
        confidence: optimistic.confidence,
        status: optimistic.status,
        application: optimistic.application,
      })
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205') return optimistic;
      console.warn('Could not persist learning to Supabase:', error.message);
      return optimistic;
    }

    const saved = mapRowToLearning(data);
    saveLocalLearning(saved);
    return saved;
  } catch {
    return optimistic;
  }
}

/**
 * Confirms a suggested learning (status = 'confirmed').
 */
export async function confirmLearning(id: string): Promise<boolean> {
  return updateLearningStatus(id, 'confirmed');
}

/**
 * Discards a suggested learning (status = 'discarded').
 */
export async function discardLearning(id: string): Promise<boolean> {
  return updateLearningStatus(id, 'discarded');
}

async function updateLearningStatus(id: string, status: LearningStatus): Promise<boolean> {
  const now = new Date().toISOString();

  // Update local fallback immediately
  const localList = getLocalLearnings();
  const target = localList.find(l => l.id === id);
  if (target) {
    target.status = status;
    target.updatedAt = now;
    saveLocalLearning(target);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;

  try {
    const { error } = await supabase
      .from('content_learnings')
      .update({ status, updated_at: now })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error && error.code !== 'PGRST205') {
      console.warn('Failed to update learning status:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns strictly confirmed learnings for a user.
 * Prepared for future integration with Opportunity Engine / Idea Generator.
 */
export async function getConfirmedContentLearnings(userId?: string): Promise<ContentLearning[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const targetUserId = userId || user?.id;

  if (!targetUserId) {
    return getLocalLearnings().filter(l => l.status === 'confirmed');
  }

  try {
    const { data, error } = await supabase
      .from('content_learnings')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        return getLocalLearnings().filter(l => l.status === 'confirmed');
      }
      console.warn('Error fetching confirmed learnings:', error.message);
      return getLocalLearnings().filter(l => l.status === 'confirmed');
    }

    return (data || []).map(mapRowToLearning);
  } catch {
    return getLocalLearnings().filter(l => l.status === 'confirmed');
  }
}
