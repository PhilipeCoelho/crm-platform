import { supabase } from '@/lib/supabase';
import type { 
  ContentAction, 
  ContentActionStatus 
} from './contentService';
import { 
  evaluateCandidateActions, 
  MAX_ACTIONS 
} from './contentActionPrioritization';
import { fetchContentIdeas } from './contentIdeasService';
import { fetchContentOpportunities } from './contentOpportunityService';
import { fetchContentReferences } from './contentReferenceService';
import { fetchLearnings, fetchAllPerformanceAnalyses } from './contentPerformanceService';

const LOCAL_STORAGE_KEY = 'vamus_content_actions_fallback';

// ==============================================================================
// LOCAL FALLBACK HELPERS
// ==============================================================================
function getLocalActions(): ContentAction[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalActions(actions: ContentAction[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(actions));
  } catch (err) {
    console.warn('Failed to save local actions:', err);
  }
}

function mapRowToAction(row: any): ContentAction {
  return {
    id: row.id,
    userId: row.user_id,
    actionType: row.action_type,
    title: row.title,
    description: row.description || null,
    priority: row.priority || 1,
    score: row.score !== null ? Number(row.score) : null,
    status: row.status,
    sourceType: row.source_type,
    sourceId: row.source_id || null,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null,
    isLocalOnly: false,
  };
}

// ==============================================================================
// CONTENT ACTIONS SERVICE
// ==============================================================================

/**
 * Fetches active actions for the user (suggested or accepted), max MAX_ACTIONS (3).
 */
export async function fetchActiveActions(): Promise<ContentAction[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return getLocalActions()
      .filter(a => a.status === 'suggested' || a.status === 'accepted')
      .slice(0, MAX_ACTIONS);
  }

  try {
    const { data, error } = await supabase
      .from('content_actions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['suggested', 'accepted'])
      .order('priority', { ascending: true })
      .order('score', { ascending: false })
      .limit(MAX_ACTIONS);

    if (error) {
      if (error.code === 'PGRST205') {
        return getLocalActions()
          .filter(a => a.status === 'suggested' || a.status === 'accepted')
          .slice(0, MAX_ACTIONS);
      }
      console.warn('Error fetching active actions from Supabase:', error.message);
      return getLocalActions()
        .filter(a => a.status === 'suggested' || a.status === 'accepted')
        .slice(0, MAX_ACTIONS);
    }

    return (data || []).map(mapRowToAction);
  } catch {
    return getLocalActions()
      .filter(a => a.status === 'suggested' || a.status === 'accepted')
      .slice(0, MAX_ACTIONS);
  }
}

/**
 * Generates next best actions using deterministic prioritization + AI backend.
 * Avoids duplicate actions for the same entity and limits output to 3.
 */
export async function generateNextBestActions(): Promise<ContentAction[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const user = session?.user;

  // Try backend AI endpoint first if authenticated
  if (token && user) {
    try {
      const response = await fetch('/api/content/actions/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.actions)) {
          return result.actions;
        }
      }
    } catch (apiErr) {
      console.warn('Backend action generation failed, falling back to client evaluation:', apiErr);
    }
  }

  // Client-side fallback using deterministic rules
  const [ideas, opps, refs, learnings, analyses] = await Promise.all([
    fetchContentIdeas({ status: 'all' }).catch(() => []),
    fetchContentOpportunities({ status: 'all' }).catch(() => []),
    fetchContentReferences({ status: 'all' }).catch(() => []),
    fetchLearnings({ status: 'confirmed' }).catch(() => []),
    fetchAllPerformanceAnalyses().catch(() => []),
  ]);

  const analyzedIdeaIds = new Set(
    analyses.filter(a => a.status === 'analyzed').map(a => a.contentIdeaId)
  );

  const candidates = evaluateCandidateActions({
    ideas,
    opportunities: opps,
    references: refs,
    learnings,
    analyzedIdeaIds,
  });

  const now = new Date().toISOString();
  const userId = user?.id || 'anonymous';
  const existingLocal = getLocalActions();

  const activeActions: ContentAction[] = candidates.map(c => {
    // Check if equivalent action exists
    const existing = existingLocal.find(a => 
      a.actionType === c.actionType && 
      a.sourceId === c.sourceId && 
      a.status !== 'dismissed'
    );

    if (existing) {
      return {
        ...existing,
        title: c.title,
        reason: c.reason,
        score: c.score,
        priority: c.priority,
        updatedAt: now,
      };
    }

    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `act_${Date.now()}_${Math.random()}`,
      userId,
      actionType: c.actionType,
      title: c.title,
      description: c.description || null,
      priority: c.priority,
      score: c.score,
      status: 'suggested',
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      reason: c.reason,
      createdAt: now,
      updatedAt: now,
      isLocalOnly: !user,
    };
  });

  saveLocalActions(activeActions);

  // If user is authenticated, persist to Supabase
  if (user) {
    try {
      for (const action of activeActions) {
        const { error } = await supabase
          .from('content_actions')
          .upsert({
            id: action.id,
            user_id: user.id,
            action_type: action.actionType,
            title: action.title,
            description: action.description,
            priority: action.priority,
            score: action.score,
            status: action.status,
            source_type: action.sourceType,
            source_id: action.sourceId,
            reason: action.reason,
            updated_at: now,
          }, { onConflict: 'id' });

        if (error && error.code !== 'PGRST205') {
          console.warn('Error syncing action to Supabase:', error.message);
        }
      }
    } catch (syncErr) {
      console.warn('Exception syncing actions to Supabase:', syncErr);
    }
  }

  return activeActions.slice(0, MAX_ACTIONS);
}

/**
 * Updates an action's status: 'accepted', 'completed', or 'dismissed'.
 */
export async function updateActionStatus(id: string, status: ContentActionStatus): Promise<boolean> {
  const now = new Date().toISOString();

  // Update local fallback
  const local = getLocalActions();
  const target = local.find(a => a.id === id);
  if (target) {
    target.status = status;
    target.updatedAt = now;
    if (status === 'completed') target.completedAt = now;
    saveLocalActions(local);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;

  try {
    const payload: any = { status, updated_at: now };
    if (status === 'completed') payload.completed_at = now;

    const { error } = await supabase
      .from('content_actions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error && error.code !== 'PGRST205') {
      console.warn('Error updating action status in Supabase:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function acceptAction(id: string): Promise<boolean> {
  return updateActionStatus(id, 'accepted');
}

export async function completeAction(id: string): Promise<boolean> {
  return updateActionStatus(id, 'completed');
}

export async function dismissAction(id: string): Promise<boolean> {
  return updateActionStatus(id, 'dismissed');
}
