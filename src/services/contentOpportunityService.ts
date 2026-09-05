import { supabase } from '@/lib/supabase';
import { 
  type ContentOpportunity, 
  type ContentOpportunitySource, 
  type OpportunityStatus, 
  type OpportunityType,
  type OpportunitySourceType 
} from './contentService';
import { createContentIdea } from './contentIdeasService';

export type { 
  ContentOpportunity, 
  ContentOpportunitySource, 
  OpportunityStatus, 
  OpportunityType, 
  OpportunitySourceType 
};

export interface OpportunityFilterOptions {
  status?: OpportunityStatus | 'all';
  sortBy?: 'score' | 'priority' | 'newest' | 'oldest';
  opportunityType?: OpportunityType | 'all';
}

export interface GenerateOpportunitiesResponse {
  success: boolean;
  count: number;
  opportunities: ContentOpportunity[];
  message?: string;
  error?: string;
}

const LOCAL_STORAGE_KEY_OPPS = 'vamus_content_opportunities_fallback';
const LOCAL_STORAGE_KEY_SOURCES = 'vamus_content_opp_sources_fallback';

function getLocalFallbackOpps(): ContentOpportunity[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_OPPS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(o => ({ ...o, isLocalOnly: true })) : [];
  } catch {
    return [];
  }
}

function getLocalFallbackSources(): ContentOpportunitySource[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_SOURCES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalFallbackOpps(opps: ContentOpportunity[], sources?: ContentOpportunitySource[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_OPPS, JSON.stringify(opps));
    if (sources) {
      const existingSources = getLocalFallbackSources();
      const combined = [...sources, ...existingSources.filter(s => !sources.some(ns => ns.id === s.id))];
      localStorage.setItem(LOCAL_STORAGE_KEY_SOURCES, JSON.stringify(combined));
    }
  } catch (err) {
    console.warn('Failed to save content opportunities fallback:', err);
  }
}

/**
 * Maps Supabase snake_case row to frontend ContentOpportunity model
 */
function mapRowToOpportunity(row: any, sourcesMap: Record<string, ContentOpportunitySource[]> = {}): ContentOpportunity {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || '',
    whyNow: row.why_now || '',
    opportunityType: row.opportunity_type || 'conexao',
    status: row.status || 'nova',
    priority: row.priority || 1,
    score: row.score !== undefined && row.score !== null ? Number(row.score) : null,
    connectedIdeaId: row.connected_idea_id || null,
    sources: sourcesMap[row.id] || [],
    isLocalOnly: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches all opportunities for current user with filtering, sorting, and linked sources
 */
export async function fetchContentOpportunities(options?: OpportunityFilterOptions): Promise<ContentOpportunity[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return filterAndSortOpps(getLocalFallbackOpps(), options);
  }

  try {
    let query = supabase
      .from('content_opportunities')
      .select('*')
      .eq('user_id', user.id);

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.opportunityType && options.opportunityType !== 'all') {
      query = query.eq('opportunity_type', options.opportunityType);
    }

    // Default sorting
    if (options?.sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (options?.sortBy === 'priority') {
      query = query.order('priority', { ascending: true }).order('score', { ascending: false, nullsFirst: false });
    } else if (options?.sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else {
      // Default: sort by score desc, then priority asc, then created_at desc
      query = query.order('score', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    }

    const { data: oppRows, error: oppError } = await query;

    if (oppError) {
      console.warn('Supabase opportunities error, falling back to local:', oppError.message);
      return filterAndSortOpps(getLocalFallbackOpps(), options);
    }

    if (!oppRows || oppRows.length === 0) {
      // If table exists but empty, return empty list
      return [];
    }

    // Fetch sources for these opportunities
    const oppIds = oppRows.map(r => r.id);
    const { data: sourceRows, error: srcError } = await supabase
      .from('content_opportunity_sources')
      .select('*')
      .in('opportunity_id', oppIds);

    const sourcesMap: Record<string, ContentOpportunitySource[]> = {};
    if (!srcError && sourceRows) {
      sourceRows.forEach(sr => {
        const src: ContentOpportunitySource = {
          id: sr.id,
          opportunityId: sr.opportunity_id,
          sourceType: sr.source_type,
          sourceId: sr.source_id,
          sourceContext: sr.source_context,
          createdAt: sr.created_at
        };
        if (!sourcesMap[sr.opportunity_id]) {
          sourcesMap[sr.opportunity_id] = [];
        }
        sourcesMap[sr.opportunity_id].push(src);
      });
    }

    return oppRows.map(r => mapRowToOpportunity(r, sourcesMap));
  } catch (err) {
    console.error('Unexpected error fetching opportunities:', err);
    return filterAndSortOpps(getLocalFallbackOpps(), options);
  }
}

function filterAndSortOpps(opps: ContentOpportunity[], options?: OpportunityFilterOptions): ContentOpportunity[] {
  let filtered = [...opps];

  if (options?.status && options.status !== 'all') {
    filtered = filtered.filter(o => o.status === options.status);
  }

  if (options?.opportunityType && options.opportunityType !== 'all') {
    filtered = filtered.filter(o => o.opportunityType === options.opportunityType);
  }

  if (options?.sortBy === 'oldest') {
    filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (options?.sortBy === 'priority') {
    filtered.sort((a, b) => a.priority - b.priority || (b.score || 0) - (a.score || 0));
  } else if (options?.sortBy === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    // Default score desc
    filtered.sort((a, b) => (b.score || 0) - (a.score || 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return filtered;
}

/**
 * Triggers AI Connection Engine via backend endpoint
 */
export async function generateOpportunities(): Promise<GenerateOpportunitiesResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Não autenticado. Faça login para analisar conexões.');
  }

  const response = await fetch('/api/content/opportunities/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    }
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || result.message || `Erro ${response.status} ao gerar oportunidades.`);
  }

  return result;
}

/**
 * Updates status of an opportunity ('vista', 'aceita', 'descartada', 'convertida')
 */
export async function updateOpportunityStatus(id: string, status: OpportunityStatus): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Update local fallback
    const opps = getLocalFallbackOpps();
    const target = opps.find(o => o.id === id);
    if (target) {
      target.status = status;
      target.updatedAt = new Date().toISOString();
      saveLocalFallbackOpps(opps);
      return true;
    }
    return false;
  }

  try {
    const { error } = await supabase
      .from('content_opportunities')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.warn('Error updating opportunity status in Supabase:', error.message);
      // fallback
      const opps = getLocalFallbackOpps();
      const target = opps.find(o => o.id === id);
      if (target) {
        target.status = status;
        saveLocalFallbackOpps(opps);
      }
      return false;
    }

    return true;
  } catch (err) {
    console.error('Unexpected error updating opportunity status:', err);
    return false;
  }
}

/**
 * Dismisses an opportunity without deleting underlying daily/crm/idea
 */
export async function dismissOpportunity(id: string): Promise<boolean> {
  return updateOpportunityStatus(id, 'descartada');
}

/**
 * Converts an opportunity into a content idea (IDEMPOTENT):
 * 1. Checks if a content_idea already exists for this opportunity (prevents duplicate creations on double clicks)
 * 2. If it already exists, ensures status is 'convertida' and returns existing idea id
 * 3. Otherwise, creates a content_idea with source_type = 'opportunity', source_id = opportunity.id,
 *    and maps related CRM insight IDs for full traceability
 * 4. Marks the opportunity as 'convertida' (never deletes it or its sources)
 */
export async function convertOpportunityToIdea(
  opportunityId: string, 
  ideaData: {
    title: string;
    description: string;
    format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null;
    priority?: number;
    tags?: string[];
    insightIds?: string[];
  }
): Promise<{ success: boolean; ideaId?: string }> {
  const { data: { user } } = await supabase.auth.getUser();

  try {
    // 1. Idempotency Check: check if idea already created for this opportunity
    if (user) {
      const { data: existingIdea } = await supabase
        .from('content_ideas')
        .select('id')
        .eq('user_id', user.id)
        .eq('source_type', 'opportunity')
        .eq('source_id', opportunityId)
        .maybeSingle();

      if (existingIdea) {
        await updateOpportunityStatus(opportunityId, 'convertida');
        return { success: true, ideaId: existingIdea.id };
      }
    }

    // 2. Query sources of this opportunity to forward CRM insight IDs for full traceability
    let linkedInsightIds: string[] = ideaData.insightIds || [];
    if (linkedInsightIds.length === 0 && user) {
      const { data: oppSources } = await supabase
        .from('content_opportunity_sources')
        .select('source_type, source_id')
        .eq('opportunity_id', opportunityId);

      if (oppSources) {
        linkedInsightIds = oppSources
          .filter(s => s.source_type === 'crm_signal' && s.source_id)
          .map(s => s.source_id as string);
      }
    }

    // 3. Create content idea
    const newIdea = await createContentIdea({
      title: ideaData.title,
      description: ideaData.description,
      format: ideaData.format || null,
      priority: ideaData.priority || 2,
      sourceType: 'opportunity',
      sourceId: opportunityId,
      tags: ideaData.tags || [],
      insightIds: linkedInsightIds,
    });

    // 4. Mark opportunity as converted
    await updateOpportunityStatus(opportunityId, 'convertida');

    return { success: true, ideaId: newIdea.id };
  } catch (err: any) {
    console.error('Error converting opportunity to idea:', err);
    throw err;
  }
}

/**
 * Returns a map of dailyEntryId -> opportunityId for active opportunities
 * allowing DailyTimeline to show a subtle indicator without heavy queries.
 */
export async function fetchDailyOpportunityMap(): Promise<Record<string, string>> {
  try {
    const opps = await fetchContentOpportunities({ status: 'nova' });
    const map: Record<string, string> = {};
    for (const opp of opps) {
      if (opp.sources) {
        for (const src of opp.sources) {
          if (src.sourceType === 'daily' && src.sourceId) {
            map[src.sourceId] = opp.id;
          }
        }
      }
    }
    return map;
  } catch {
    return {};
  }
}
