import { supabase } from '@/lib/supabase';
import { ContentIdea } from './contentService';

export interface CreateContentIdeaInput {
  title: string;
  description?: string;
  format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null;
  status?: 'capturada' | 'validada' | 'em_producao' | 'descartada';
  priority?: number;
  sourceType?: 'manual' | 'daily' | 'crm_signal' | 'reference' | 'ai_suggestion' | 'opportunity';
  sourceId?: string | null;
  tags?: string[];
  insightIds?: string[];
}

export interface IdeaFilterOptions {
  status?: string;
  sourceType?: string;
  priority?: number;
  search?: string;
  sortBy?: 'updated' | 'priority' | 'oldest';
}

const LOCAL_STORAGE_KEY = 'vamus_content_ideas_fallback';

function getLocalFallback(): ContentIdea[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(i => ({ ...i, isLocalOnly: true })) : [];
  } catch {
    return [];
  }
}

function saveLocalFallback(idea: ContentIdea) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: ContentIdea[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(i => i.id !== idea.id);
    filtered.unshift(idea);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Failed to save content idea fallback:', err);
  }
}

function removeLocalFallback(id: string) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const list: ContentIdea[] = JSON.parse(raw);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.filter(i => i.id !== id)));
  } catch (err) {
    console.warn('Failed to remove content idea fallback:', err);
  }
}

/**
 * Maps Supabase snake_case row to frontend ContentIdea model
 */
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
    isLocalOnly: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches all ideas for the current user with optional filtering and sorting
 */
export async function fetchContentIdeas(options?: IdeaFilterOptions): Promise<ContentIdea[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return filterAndSortIdeas(getLocalFallback(), options);

  try {
    let query = supabase
      .from('content_ideas')
      .select('*')
      .eq('user_id', user.id);

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.sourceType && options.sourceType !== 'all') {
      query = query.eq('source_type', options.sourceType);
    }

    if (options?.priority) {
      query = query.eq('priority', options.priority);
    }

    // Apply sorting
    if (options?.sortBy === 'priority') {
      query = query.order('priority', { ascending: false }).order('updated_at', { ascending: false });
    } else if (options?.sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST205') {
        console.info('ℹ️ Table content_ideas not found on Supabase. Using local fallback.');
        return filterAndSortIdeas(getLocalFallback(), options);
      }
      console.error('Error fetching content ideas from Supabase:', error);
      return filterAndSortIdeas(getLocalFallback(), options);
    }

    const mapped = (data || []).map(mapRowToIdea);
    return filterAndSortIdeas(mapped, options);
  } catch (err) {
    console.error('Exception fetching content ideas:', err);
    return filterAndSortIdeas(getLocalFallback(), options);
  }
}

/**
 * In-memory search & filter helper
 */
function filterAndSortIdeas(ideas: ContentIdea[], options?: IdeaFilterOptions): ContentIdea[] {
  let result = [...ideas];

  if (options?.search && options.search.trim()) {
    const query = options.search.toLowerCase().trim();
    result = result.filter(idea => 
      idea.title.toLowerCase().includes(query) ||
      idea.description.toLowerCase().includes(query) ||
      idea.tags.some(t => t.toLowerCase().includes(query))
    );
  }

  if (options?.status && options.status !== 'all') {
    result = result.filter(i => i.status === options.status);
  }

  if (options?.sourceType && options.sourceType !== 'all') {
    result = result.filter(i => i.sourceType === options.sourceType);
  }

  if (options?.priority) {
    result = result.filter(i => i.priority === options.priority);
  }

  if (options?.sortBy === 'priority') {
    result.sort((a, b) => b.priority - a.priority || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } else if (options?.sortBy === 'oldest') {
    result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else {
    result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  return result;
}

/**
 * Fetches a single idea by ID
 */
export async function fetchContentIdeaById(id: string): Promise<ContentIdea | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const local = getLocalFallback().find(i => i.id === id);
    return local || null;
  }

  try {
    const { data, error } = await supabase
      .from('content_ideas')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      const local = getLocalFallback().find(i => i.id === id);
      return local || null;
    }

    return mapRowToIdea(data);
  } catch {
    const local = getLocalFallback().find(i => i.id === id);
    return local || null;
  }
}

/**
 * Creates a new content idea
 */
export async function createContentIdea(input: CreateContentIdeaInput): Promise<ContentIdea> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous';
  const now = new Date().toISOString();

  const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idea_${Date.now()}`;

  const optimisticIdea: ContentIdea = {
    id: tempId,
    userId,
    title: input.title.trim(),
    description: input.description?.trim() || '',
    format: input.format || null,
    status: input.status || 'capturada',
    priority: input.priority && input.priority >= 1 && input.priority <= 5 ? input.priority : 2,
    sourceType: input.sourceType || 'manual',
    sourceId: input.sourceId || null,
    tags: input.tags || [],
    insightIds: input.insightIds || [],
    isLocalOnly: true,
    createdAt: now,
    updatedAt: now,
  };

  saveLocalFallback(optimisticIdea);

  if (!user) {
    return optimisticIdea;
  }

  try {
    const { data, error } = await supabase
      .from('content_ideas')
      .insert({
        id: tempId,
        user_id: user.id,
        title: input.title.trim(),
        description: input.description?.trim() || '',
        format: input.format || null,
        status: input.status || 'capturada',
        priority: optimisticIdea.priority,
        source_type: optimisticIdea.sourceType,
        source_id: optimisticIdea.sourceId,
        tags: optimisticIdea.tags,
        insight_ids: optimisticIdea.insightIds,
      })
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205') {
        return optimisticIdea;
      }
      console.warn('Could not persist content idea to Supabase:', error);
      return optimisticIdea;
    }

    const savedIdea = mapRowToIdea(data);
    saveLocalFallback(savedIdea);
    return savedIdea;
  } catch (err) {
    console.error('Exception creating content idea:', err);
    return optimisticIdea;
  }
}

/**
 * Updates an existing content idea
 */
export async function updateContentIdea(id: string, updates: Partial<ContentIdea>): Promise<boolean> {
  const now = new Date().toISOString();
  
  // Update local fallback immediately
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list: ContentIdea[] = JSON.parse(raw);
      const idx = list.findIndex(i => i.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updatedAt: now };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      }
    }
  } catch (err) {
    console.warn('Failed to update local idea fallback:', err);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;

  try {
    const snakeUpdates: any = { updated_at: now };
    if (updates.title !== undefined) snakeUpdates.title = updates.title.trim();
    if (updates.description !== undefined) snakeUpdates.description = updates.description.trim();
    if (updates.format !== undefined) snakeUpdates.format = updates.format;
    if (updates.status !== undefined) snakeUpdates.status = updates.status;
    if (updates.priority !== undefined) snakeUpdates.priority = updates.priority;
    if (updates.tags !== undefined) snakeUpdates.tags = updates.tags;

    const { error } = await supabase
      .from('content_ideas')
      .update(snakeUpdates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error && error.code !== 'PGRST205') {
      console.error('Error updating content idea in Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception updating content idea:', err);
    return false;
  }
}

/**
 * Deletes a content idea by ID (preserves the source)
 */
export async function deleteContentIdea(id: string): Promise<boolean> {
  removeLocalFallback(id);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;

  try {
    const { error } = await supabase
      .from('content_ideas')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error && error.code !== 'PGRST205') {
      console.error('Error deleting content idea from Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting content idea:', err);
    return true;
  }
}

/**
 * Creates an idea originating from a Daily entry
 */
export async function createIdeaFromDaily(
  dailyEntryId: string,
  suggestedTitle: string,
  contextNote?: string
): Promise<ContentIdea> {
  return createContentIdea({
    title: suggestedTitle,
    description: contextNote || '',
    sourceType: 'daily',
    sourceId: dailyEntryId,
    status: 'capturada',
    priority: 3,
  });
}

/**
 * Creates an idea originating from a commercial CRM signal
 */
export async function createIdeaFromCRMSignal(
  signalText: string,
  insightId?: string,
  notes?: string
): Promise<ContentIdea> {
  return createContentIdea({
    title: signalText,
    description: notes || '',
    sourceType: 'crm_signal',
    sourceId: insightId || null,
    insightIds: insightId ? [insightId] : [],
    status: 'capturada',
    priority: 3,
  });
}
