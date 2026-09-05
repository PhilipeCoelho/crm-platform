import { supabase } from '@/lib/supabase';
import { ContentReference, ReferenceStatus, ReferencePlatform, ReferenceAnalysis } from './contentService';

export interface CreateReferenceInput {
  url: string;
  platform?: ReferencePlatform | null;
  title?: string | null;
  author?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface ReferenceFilterOptions {
  status?: string;
  platform?: string;
  search?: string;
  sortBy?: 'recent' | 'oldest' | 'analyzed';
}

const LOCAL_STORAGE_KEY = 'vamus_content_references_fallback';

function getLocalFallback(): ContentReference[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(r => ({ ...r, isLocalOnly: true })) : [];
  } catch {
    return [];
  }
}

function saveLocalFallback(ref: ContentReference) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: ContentReference[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(r => r.id !== ref.id);
    filtered.unshift(ref);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Failed to save content reference fallback:', err);
  }
}

function removeLocalFallback(id: string) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const list: ContentReference[] = JSON.parse(raw);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.filter(r => r.id !== id)));
  } catch (err) {
    console.warn('Failed to remove content reference fallback:', err);
  }
}

/**
 * Maps Supabase snake_case row to frontend ContentReference model
 */
function mapRowToReference(row: any): ContentReference {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url || '',
    platform: row.platform || null,
    title: row.title || null,
    author: row.author || null,
    description: row.description || null,
    thumbnailUrl: row.thumbnail_url || null,
    notes: row.notes || null,
    status: row.status || 'salva',
    analysis: row.analysis && typeof row.analysis === 'object' ? {
      hook: row.analysis.hook || undefined,
      angle: row.analysis.angle || undefined,
      structure: row.analysis.structure || undefined,
      attentionMechanism: row.analysis.attention_mechanism || undefined,
      cta: row.analysis.cta || undefined,
      whyItWorks: row.analysis.why_it_works || undefined,
      whatToLearn: row.analysis.what_to_learn || undefined,
      applicationToVamuss: row.analysis.application_to_vamuss || undefined,
      adaptationIdea: row.analysis.adaptation_idea || undefined,
    } : {},
    tags: Array.isArray(row.tags) ? row.tags : [],
    analyzedAt: row.analyzed_at || null,
    isLocalOnly: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * In-memory search & filter helper
 */
function filterAndSortReferences(refs: ContentReference[], options?: ReferenceFilterOptions): ContentReference[] {
  let result = [...refs];

  if (options?.search && options.search.trim()) {
    const query = options.search.toLowerCase().trim();
    result = result.filter(ref =>
      (ref.title || '').toLowerCase().includes(query) ||
      (ref.url || '').toLowerCase().includes(query) ||
      (ref.author || '').toLowerCase().includes(query) ||
      (ref.notes || '').toLowerCase().includes(query) ||
      (ref.description || '').toLowerCase().includes(query) ||
      ref.tags.some(t => t.toLowerCase().includes(query))
    );
  }

  if (options?.status && options.status !== 'all') {
    result = result.filter(r => r.status === options.status);
  }

  if (options?.platform && options.platform !== 'all') {
    result = result.filter(r => r.platform === options.platform);
  }

  if (options?.sortBy === 'oldest') {
    result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (options?.sortBy === 'analyzed') {
    result.sort((a, b) => {
      if (a.analyzedAt && !b.analyzedAt) return -1;
      if (!a.analyzedAt && b.analyzedAt) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  } else {
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return result;
}

/**
 * Fetches all references for the current user with optional filtering
 */
export async function fetchContentReferences(options?: ReferenceFilterOptions): Promise<ContentReference[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return filterAndSortReferences(getLocalFallback(), options);

  try {
    let query = supabase
      .from('content_references')
      .select('*')
      .eq('user_id', user.id);

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.platform && options.platform !== 'all') {
      query = query.eq('platform', options.platform);
    }

    if (options?.sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (options?.sortBy === 'analyzed') {
      query = query.order('analyzed_at', { ascending: false, nullsFirst: false }).order('updated_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST205') {
        console.info('ℹ️ Table content_references not found on Supabase. Using local fallback.');
        return filterAndSortReferences(getLocalFallback(), options);
      }
      console.error('Error fetching content references from Supabase:', error);
      return filterAndSortReferences(getLocalFallback(), options);
    }

    const mapped = (data || []).map(mapRowToReference);
    return filterAndSortReferences(mapped, options);
  } catch (err) {
    console.error('Exception fetching content references:', err);
    return filterAndSortReferences(getLocalFallback(), options);
  }
}

/**
 * Fetches a single reference by ID
 */
export async function fetchReferenceById(id: string): Promise<ContentReference | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const local = getLocalFallback().find(r => r.id === id);
    return local || null;
  }

  try {
    const { data, error } = await supabase
      .from('content_references')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      const local = getLocalFallback().find(r => r.id === id);
      return local || null;
    }

    return mapRowToReference(data);
  } catch {
    const local = getLocalFallback().find(r => r.id === id);
    return local || null;
  }
}

/**
 * Checks if a URL already exists for the current user
 */
export async function checkDuplicateUrl(url: string): Promise<ContentReference | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const local = getLocalFallback().find(r => r.url === url);
    return local || null;
  }

  try {
    const { data, error } = await supabase
      .from('content_references')
      .select('*')
      .eq('user_id', user.id)
      .eq('url', url)
      .maybeSingle();

    if (error || !data) return null;
    return mapRowToReference(data);
  } catch {
    return null;
  }
}

/**
 * Creates a new content reference
 */
export async function createReference(input: CreateReferenceInput): Promise<ContentReference> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous';
  const now = new Date().toISOString();

  const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ref_${Date.now()}`;

  const optimistic: ContentReference = {
    id: tempId,
    userId,
    url: input.url.trim(),
    platform: input.platform || null,
    title: input.title?.trim() || null,
    author: input.author?.trim() || null,
    description: input.description?.trim() || null,
    thumbnailUrl: input.thumbnailUrl || null,
    notes: input.notes?.trim() || null,
    status: 'salva',
    analysis: {},
    tags: input.tags || [],
    analyzedAt: null,
    isLocalOnly: true,
    createdAt: now,
    updatedAt: now,
  };

  saveLocalFallback(optimistic);

  if (!user) return optimistic;

  try {
    const { data, error } = await supabase
      .from('content_references')
      .insert({
        id: tempId,
        user_id: user.id,
        url: input.url.trim(),
        platform: input.platform || null,
        title: input.title?.trim() || null,
        author: input.author?.trim() || null,
        description: input.description?.trim() || null,
        thumbnail_url: input.thumbnailUrl || null,
        notes: input.notes?.trim() || null,
        status: 'salva',
        analysis: {},
        tags: input.tags || [],
      })
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205') return optimistic;
      if (error.code === '23505') {
        // Duplicate URL — unique constraint violation
        console.warn('Duplicate reference URL:', input.url);
        throw new Error('DUPLICATE_URL');
      }
      console.warn('Could not persist reference to Supabase:', error);
      return optimistic;
    }

    const saved = mapRowToReference(data);
    saveLocalFallback(saved);
    return saved;
  } catch (err: any) {
    if (err?.message === 'DUPLICATE_URL') throw err;
    console.error('Exception creating reference:', err);
    return optimistic;
  }
}

/**
 * Updates an existing reference
 */
export async function updateReference(id: string, updates: Partial<ContentReference>): Promise<boolean> {
  const now = new Date().toISOString();

  // Update local fallback immediately
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list: ContentReference[] = JSON.parse(raw);
      const idx = list.findIndex(r => r.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updatedAt: now };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      }
    }
  } catch (err) {
    console.warn('Failed to update local reference fallback:', err);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;

  try {
    const snakeUpdates: any = { updated_at: now };
    if (updates.url !== undefined) snakeUpdates.url = updates.url.trim();
    if (updates.platform !== undefined) snakeUpdates.platform = updates.platform;
    if (updates.title !== undefined) snakeUpdates.title = updates.title;
    if (updates.author !== undefined) snakeUpdates.author = updates.author;
    if (updates.description !== undefined) snakeUpdates.description = updates.description;
    if (updates.thumbnailUrl !== undefined) snakeUpdates.thumbnail_url = updates.thumbnailUrl;
    if (updates.notes !== undefined) snakeUpdates.notes = updates.notes;
    if (updates.status !== undefined) snakeUpdates.status = updates.status;
    if (updates.tags !== undefined) snakeUpdates.tags = updates.tags;
    if (updates.analysis !== undefined) {
      // Convert camelCase analysis to snake_case for DB storage
      snakeUpdates.analysis = {
        hook: updates.analysis.hook,
        angle: updates.analysis.angle,
        structure: updates.analysis.structure,
        attention_mechanism: updates.analysis.attentionMechanism,
        cta: updates.analysis.cta,
        why_it_works: updates.analysis.whyItWorks,
        what_to_learn: updates.analysis.whatToLearn,
        application_to_vamuss: updates.analysis.applicationToVamuss,
        adaptation_idea: updates.analysis.adaptationIdea,
      };
    }
    if (updates.analyzedAt !== undefined) snakeUpdates.analyzed_at = updates.analyzedAt;

    const { error } = await supabase
      .from('content_references')
      .update(snakeUpdates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error && error.code !== 'PGRST205') {
      console.error('Error updating reference in Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception updating reference:', err);
    return false;
  }
}

/**
 * Deletes a reference by ID
 */
export async function deleteReference(id: string): Promise<boolean> {
  removeLocalFallback(id);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true;

  try {
    const { error } = await supabase
      .from('content_references')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error && error.code !== 'PGRST205') {
      console.error('Error deleting reference from Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting reference:', err);
    return true;
  }
}

/**
 * Archives a reference (soft-delete)
 */
export async function archiveReference(id: string): Promise<boolean> {
  return updateReference(id, { status: 'arquivada' as ReferenceStatus });
}

/**
 * Calls the AI analysis endpoint for a reference
 */
export async function analyzeReference(id: string): Promise<ReferenceAnalysis | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    console.error('No session for reference analysis');
    return null;
  }

  try {
    const response = await fetch('/api/content/references/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ referenceId: id }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Reference analysis failed:', errData);
      return null;
    }

    const result = await response.json();
    if (result.success && result.analysis) {
      // Map snake_case response to camelCase
      return {
        hook: result.analysis.hook || undefined,
        angle: result.analysis.angle || undefined,
        structure: result.analysis.structure || undefined,
        attentionMechanism: result.analysis.attention_mechanism || undefined,
        cta: result.analysis.cta || undefined,
        whyItWorks: result.analysis.why_it_works || undefined,
        whatToLearn: result.analysis.what_to_learn || undefined,
        applicationToVamuss: result.analysis.application_to_vamuss || undefined,
        adaptationIdea: result.analysis.adaptation_idea || undefined,
      };
    }
    return null;
  } catch (err) {
    console.error('Exception analyzing reference:', err);
    return null;
  }
}

/**
 * Creates an idea from a reference (with source traceability)
 */
export async function convertReferenceToIdea(
  referenceId: string,
  ideaData: {
    title: string;
    description?: string;
    format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null;
    priority?: number;
  }
): Promise<boolean> {
  // Import dynamically to avoid circular dependency
  const { createContentIdea } = await import('./contentIdeasService');

  try {
    await createContentIdea({
      title: ideaData.title,
      description: ideaData.description || '',
      format: ideaData.format,
      priority: ideaData.priority || 3,
      sourceType: 'reference',
      sourceId: referenceId,
      status: 'capturada',
    });
    return true;
  } catch (err) {
    console.error('Exception converting reference to idea:', err);
    return false;
  }
}
