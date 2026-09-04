import { supabase } from '@/lib/supabase';
import { ContentDailyEntry } from './contentService';
import { Activity } from '@/types/schema';

export interface CreateDailyEntryInput {
  rawContent: string;
  sourceType: 'text' | 'voice' | 'crm_sync' | 'file';
  entryDate?: string;
  activityId?: string | null;
  dealId?: string | null;
}

const LOCAL_STORAGE_KEY = 'vamus_daily_entries_fallback';

function getLocalFallback(date: string): ContentDailyEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) 
      ? parsed
          .filter(e => e.entryDate === date)
          .map(e => ({ ...e, isLocalOnly: true }))
      : [];
  } catch {
    return [];
  }
}

function saveLocalFallback(entry: ContentDailyEntry) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: ContentDailyEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(e => e.id !== entry.id);
    filtered.push(entry);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Failed to save daily entry fallback:', err);
  }
}

function removeLocalFallback(id: string) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const list: ContentDailyEntry[] = JSON.parse(raw);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.filter(e => e.id !== id)));
  } catch (err) {
    console.warn('Failed to remove daily entry fallback:', err);
  }
}

/**
 * Maps Supabase snake_case row to frontend ContentDailyEntry model
 */
function mapRowToEntry(row: any): ContentDailyEntry {
  return {
    id: row.id,
    userId: row.user_id,
    entryDate: row.entry_date,
    entryTime: row.entry_time,
    rawContent: row.raw_content,
    sourceType: row.source_type,
    activityId: row.activity_id,
    dealId: row.deal_id,
    aiStatus: row.ai_status,
    aiSummary: row.ai_summary,
    aiSignals: row.ai_signals,
    isLocalOnly: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches all entries for a specific day
 */
export async function fetchDailyEntries(date: string): Promise<ContentDailyEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getLocalFallback(date);

  try {
    const { data, error } = await supabase
      .from('content_daily_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('entry_date', date)
      .order('created_at', { ascending: true });

    if (error) {
      // If table doesn't exist yet in Supabase, gracefully use local storage
      if (error.code === 'PGRST205') {
        console.info('ℹ️ Table content_daily_entries not found on Supabase. Run supabase_content_daily.sql in Supabase SQL Editor. Using local fallback.');
        return getLocalFallback(date);
      }
      console.error('Error fetching daily entries from Supabase:', error);
      return getLocalFallback(date);
    }

    return (data || []).map(mapRowToEntry);
  } catch (err) {
    console.error('Exception fetching daily entries:', err);
    return getLocalFallback(date);
  }
}

/**
 * Creates a new daily entry
 */
export async function createDailyEntry(input: CreateDailyEntryInput): Promise<ContentDailyEntry> {
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous';

  const now = new Date();
  const todayStr = input.entryDate || now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `daily_${Date.now()}`;

  const optimisticEntry: ContentDailyEntry = {
    id: tempId,
    userId,
    entryDate: todayStr,
    entryTime: timeStr,
    rawContent: input.rawContent,
    sourceType: input.sourceType,
    activityId: input.activityId || null,
    dealId: input.dealId || null,
    aiStatus: 'pending',
    aiSummary: null,
    aiSignals: null,
    isLocalOnly: true,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Always save to fallback
  saveLocalFallback(optimisticEntry);

  if (!user) {
    return optimisticEntry;
  }

  try {
    const { data, error } = await supabase
      .from('content_daily_entries')
      .insert({
        id: tempId,
        user_id: user.id,
        entry_date: todayStr,
        entry_time: timeStr,
        raw_content: input.rawContent,
        source_type: input.sourceType,
        activity_id: input.activityId || null,
        deal_id: input.dealId || null,
        ai_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205') {
        // Table doesn't exist yet, return optimistic
        return optimisticEntry;
      }
      console.warn('Could not persist daily entry to Supabase:', error);
      return optimisticEntry;
    }

    const savedEntry = mapRowToEntry(data);
    saveLocalFallback(savedEntry);

    // Trigger AI analysis asynchronously in the background (fire-and-forget)
    triggerDailyAnalysis(savedEntry).catch(err => {
      console.warn('Asynchronous Daily AI analysis failed:', err);
    });

    return savedEntry;
  } catch (err) {
    console.error('Exception creating daily entry:', err);
    return optimisticEntry;
  }
}

/**
 * Deletes a daily entry by ID
 */
export async function deleteDailyEntry(id: string): Promise<boolean> {
  removeLocalFallback(id);

  try {
    const { error } = await supabase
      .from('content_daily_entries')
      .delete()
      .eq('id', id);

    if (error && error.code !== 'PGRST205') {
      console.error('Error deleting daily entry from Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception deleting daily entry:', err);
    return true;
  }
}

/**
 * Updates a daily entry by ID
 */
export async function updateDailyEntry(id: string, updates: Partial<ContentDailyEntry>): Promise<boolean> {
  try {
    const snakeUpdates: any = {};
    if (updates.rawContent !== undefined) snakeUpdates.raw_content = updates.rawContent;
    if (updates.aiStatus !== undefined) snakeUpdates.ai_status = updates.aiStatus;
    if (updates.aiSummary !== undefined) snakeUpdates.ai_summary = updates.aiSummary;
    if (updates.aiSignals !== undefined) snakeUpdates.ai_signals = updates.aiSignals;
    snakeUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('content_daily_entries')
      .update(snakeUpdates)
      .eq('id', id);

    if (error && error.code !== 'PGRST205') {
      console.error('Error updating daily entry:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception updating daily entry:', err);
    return false;
  }
}

/**
 * Fetches activities from CRM scheduled for the given date
 */
export async function fetchTodayCRMActivities(dateStr?: string): Promise<Activity[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const targetDate = dateStr || new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', `${targetDate}T00:00:00`)
      .lte('date', `${targetDate}T23:59:59`)
      .order('date', { ascending: true });

    if (error) {
      console.warn('Could not fetch CRM activities for Daily:', error);
      return [];
    }

    return (data || []).map((a: any) => ({
      ...a,
      dealId: a.deal_id,
      userId: a.user_id,
      createdAt: a.created_at,
      dueDate: a.date,
      completed: a.completed,
      status: a.status || (a.completed ? 'completed' : 'pending'),
      completedAt: a.completed_at,
      houveResposta: a.houve_resposta,
      originStage: a.origin_stage,
      isAutomatic: a.is_automatic,
      sequenceStep: a.sequence_step,
    }));
  } catch (err) {
    console.error('Exception fetching CRM activities for Daily:', err);
    return [];
  }
}

/**
 * Triggers backend AI analysis endpoint asynchronously
 */
export async function triggerDailyAnalysis(entry: ContentDailyEntry): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    console.debug('Cannot trigger daily AI analysis: No active auth session');
    return;
  }

  try {
    fetch('/api/content/daily/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        entryId: entry.id,
      })
    }).catch(err => console.debug('Daily AI analyze fetch error (quiet):', err));
  } catch (err) {
    console.debug('Failed to trigger daily analysis:', err);
  }
}
