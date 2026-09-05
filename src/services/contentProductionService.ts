import { supabase } from '@/lib/supabase';
import { 
  ContentIdea, 
  ExecutionStage, 
  ContentPlatform, 
  ContentMetricsData 
} from './contentService';

export interface WorkspaceData {
  title?: string;
  hook?: string;
  angle?: string;
  bodyScript?: string;
  cta?: string;
  notes?: string;
  nextAction?: string;
  format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null;
  priority?: number;
}

export interface PublishData {
  platform: ContentPlatform;
  publishedAt?: string;
  publicationUrl?: string;
}

export interface ExecutionQueueData {
  currentFocus: ContentIdea | null;
  nextItems: ContentIdea[];
  wipCount: number;
  totalIdeas: number;
  publishedCount: number;
  inProductionCount: number;
}

const LOCAL_STORAGE_KEY = 'vamus_content_ideas_fallback';

function getLocalIdeas(): ContentIdea[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalIdeas(ideas: ContentIdea[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ideas));
  } catch (err) {
    console.warn('Failed to save ideas to local storage:', err);
  }
}

function getDefaultNextAction(stage: ExecutionStage): string {
  switch (stage) {
    case 'producao':
      return 'Estruturar roteiro';
    case 'gravado':
      return 'Editar e publicar';
    case 'publicado':
      return 'Aguardar coleta de métricas';
    case 'aguardando_metricas':
      return 'Registrar métricas';
    case 'analisado':
      return 'Conteúdo analisado';
    default:
      return 'Produzir';
  }
}

function mapRowToIdea(row: any): ContentIdea {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || '',
    format: row.format || null,
    status: row.status || 'capturada',
    priority: row.priority || 2,
    sourceType: row.source_type || 'manual',
    sourceId: row.source_id || null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    insightIds: Array.isArray(row.insight_ids) ? row.insight_ids : [],
    executionStage: row.execution_stage || null,
    nextAction: row.next_action || null,
    hook: row.hook || '',
    angle: row.angle || '',
    bodyScript: row.body_script || '',
    cta: row.cta || '',
    notes: row.notes || '',
    publishedAt: row.published_at || null,
    platform: row.platform || null,
    publicationUrl: row.publication_url || null,
    metrics: row.metrics || {},
    metricsRecordedAt: row.metrics_recorded_at || null,
    stageUpdatedAt: row.stage_updated_at || row.updated_at,
    isLocalOnly: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches all items currently in the execution pipeline (execution_stage is not null)
 */
export async function fetchProductionItems(): Promise<ContentIdea[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const local = getLocalIdeas();
    return local.filter(i => i.executionStage);
  }

  try {
    const { data, error } = await supabase
      .from('content_ideas')
      .select('*')
      .eq('user_id', user.id)
      .not('execution_stage', 'is', null)
      .order('priority', { ascending: true })
      .order('stage_updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchProductionItems error, using fallback:', error.message);
      const local = getLocalIdeas();
      return local.filter(i => i.executionStage);
    }

    return (data || []).map(mapRowToIdea);
  } catch (err) {
    console.error('Unexpected error in fetchProductionItems:', err);
    return getLocalIdeas().filter(i => i.executionStage);
  }
}

/**
 * Computes the Execution Queue:
 * - AGORA: #1 top focus item (in producao or gravado, prioritized by priority=1 and urgency)
 * - PRÓXIMOS: next 2 to 4 items
 * - WIP count: items currently in 'producao'
 * - Execution stats
 */
export async function fetchExecutionQueue(): Promise<ExecutionQueueData> {
  const items = await fetchProductionItems();
  const { data: { user } } = await supabase.auth.getUser();

  // Active items waiting for action (producao or gravado)
  const activeItems = items.filter(i => i.executionStage === 'producao' || i.executionStage === 'gravado');

  // Sort active items: priority 1 first, then producao before gravado, then most recently updated
  activeItems.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.executionStage === 'producao' && b.executionStage !== 'producao') return -1;
    if (a.executionStage !== 'producao' && b.executionStage === 'producao') return 1;
    return new Date(b.stageUpdatedAt || b.updatedAt).getTime() - new Date(a.stageUpdatedAt || a.updatedAt).getTime();
  });

  const currentFocus = activeItems[0] || null;
  const nextItems = activeItems.slice(1, 5); // 2 to 4 items

  const wipCount = items.filter(i => i.executionStage === 'producao').length;
  const inProductionCount = wipCount;
  const publishedCount = items.filter(i => i.executionStage === 'publicado' || i.executionStage === 'aguardando_metricas' || i.executionStage === 'analisado').length;

  let totalIdeas = items.length;
  if (user) {
    try {
      const { count } = await supabase
        .from('content_ideas')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      totalIdeas = count || totalIdeas;
    } catch {
      // fallback
    }
  }

  return {
    currentFocus,
    nextItems,
    wipCount,
    totalIdeas,
    publishedCount,
    inProductionCount,
  };
}

/**
 * Updates the operational stage of an idea (producao -> gravado -> publicado -> aguardando_metricas -> analisado)
 */
export async function updateExecutionStage(
  ideaId: string, 
  stage: ExecutionStage, 
  extraData?: Partial<ContentIdea>
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  const nextAction = extraData?.nextAction || getDefaultNextAction(stage);
  const now = new Date().toISOString();

  const updatePayload: any = {
    execution_stage: stage,
    next_action: nextAction,
    stage_updated_at: now,
    updated_at: now,
    status: stage === 'analisado' ? 'validada' : 'em_producao',
  };

  if (extraData?.publishedAt !== undefined) updatePayload.published_at = extraData.publishedAt;
  if (extraData?.platform !== undefined) updatePayload.platform = extraData.platform;
  if (extraData?.publicationUrl !== undefined) updatePayload.publication_url = extraData.publicationUrl;
  if (extraData?.metrics !== undefined) updatePayload.metrics = extraData.metrics;
  if (extraData?.metricsRecordedAt !== undefined) updatePayload.metrics_recorded_at = extraData.metricsRecordedAt;

  if (!user) {
    const list = getLocalIdeas();
    const target = list.find(i => i.id === ideaId);
    if (target) {
      target.executionStage = stage;
      target.nextAction = nextAction;
      target.stageUpdatedAt = now;
      target.updatedAt = now;
      if (extraData?.publishedAt) target.publishedAt = extraData.publishedAt;
      if (extraData?.platform) target.platform = extraData.platform;
      if (extraData?.publicationUrl) target.publicationUrl = extraData.publicationUrl;
      if (extraData?.metrics) target.metrics = extraData.metrics;
      saveLocalIdeas(list);
      return true;
    }
    return false;
  }

  try {
    const { error } = await supabase
      .from('content_ideas')
      .update(updatePayload)
      .eq('id', ideaId)
      .eq('user_id', user.id);

    if (error) {
      console.warn('Error updating execution stage in Supabase:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error in updateExecutionStage:', err);
    return false;
  }
}

/**
 * Updates the Production Workspace contents (hook, angle, script, cta, notes)
 */
export async function updateProductionWorkspace(
  ideaId: string, 
  data: WorkspaceData
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  const updatePayload: any = {
    updated_at: now,
  };

  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.hook !== undefined) updatePayload.hook = data.hook;
  if (data.angle !== undefined) updatePayload.angle = data.angle;
  if (data.bodyScript !== undefined) updatePayload.body_script = data.bodyScript;
  if (data.cta !== undefined) updatePayload.cta = data.cta;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.nextAction !== undefined) updatePayload.next_action = data.nextAction;
  if (data.format !== undefined) updatePayload.format = data.format;
  if (data.priority !== undefined) updatePayload.priority = data.priority;

  if (!user) {
    const list = getLocalIdeas();
    const target = list.find(i => i.id === ideaId);
    if (target) {
      Object.assign(target, data, { updatedAt: now });
      saveLocalIdeas(list);
      return true;
    }
    return false;
  }

  try {
    const { error } = await supabase
      .from('content_ideas')
      .update(updatePayload)
      .eq('id', ideaId)
      .eq('user_id', user.id);

    if (error) {
      console.warn('Error updating production workspace in Supabase:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error in updateProductionWorkspace:', err);
    return false;
  }
}

/**
 * Marks a content piece as published with platform and date
 */
export async function markAsPublished(
  ideaId: string, 
  data: PublishData
): Promise<boolean> {
  const publishedAt = data.publishedAt || new Date().toISOString();
  return updateExecutionStage(ideaId, 'publicado', {
    publishedAt,
    platform: data.platform,
    publicationUrl: data.publicationUrl || null,
    nextAction: 'Aguardar coleta de métricas',
  });
}

/**
 * Records performance metrics and moves content to 'analisado'
 */
export async function recordMetrics(
  ideaId: string, 
  metrics: ContentMetricsData
): Promise<boolean> {
  const now = new Date().toISOString();
  return updateExecutionStage(ideaId, 'analisado', {
    metrics,
    metricsRecordedAt: now,
    nextAction: 'Conteúdo analisado e incorporado',
  });
}

/**
 * Sends an idea from the Idea Bank into the Execution Queue ('producao')
 */
export async function sendIdeaToProduction(ideaId: string): Promise<boolean> {
  return updateExecutionStage(ideaId, 'producao', {
    nextAction: 'Estruturar roteiro',
  });
}

/**
 * Calls backend AI assistance to draft Hook, Angle, Body/Script, and CTA
 */
export async function structureWithAI(
  ideaId: string, 
  title: string, 
  description?: string
): Promise<{ hook: string; angle: string; bodyScript: string; cta: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Não autenticado para estruturar conteúdo com IA.');
  }

  const response = await fetch('/api/content/production/structure', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      ideaId,
      title,
      description,
    })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Erro ${response.status} ao estruturar conteúdo.`);
  }

  const s = result.structure || result;
  return {
    hook: s.hook || '',
    angle: s.angle || '',
    bodyScript: s.body_script || s.bodyScript || '',
    cta: s.cta || '',
  };
}
