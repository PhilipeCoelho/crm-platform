import { supabase } from '@/lib/supabase';
import { ContentDailyEntry, DailyEntryType } from './contentService';
import { Activity } from '@/types/schema';

export interface CreateDailyEntryInput {
  rawContent: string;
  sourceType: 'text' | 'voice' | 'crm_sync' | 'file';
  entryDate?: string;
  entryTime?: string;
  activityId?: string | null;
  dealId?: string | null;
  entryType?: DailyEntryType;
}

const LOCAL_STORAGE_KEY = 'vamus_daily_entries_fallback';

export function extractEntryDisplayTime(entry: ContentDailyEntry): string {
  if (entry.entryTime) {
    const parts = entry.entryTime.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
  }
  const match = entry.rawContent?.match(/às\s+(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  if (entry.createdAt) {
    try {
      const d = new Date(entry.createdAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch {}
  }
  return '';
}

export function cleanEntryContent(content?: string | null): string {
  if (!content) return '';
  return content.replace(/<!--\s*gcal_id:[^>]+-->/g, '').trim();
}

export function sortEntriesChronologically(entries: ContentDailyEntry[]): ContentDailyEntry[] {
  return [...entries].sort((a, b) => {
    const timeA = extractEntryDisplayTime(a) || '99:99';
    const timeB = extractEntryDisplayTime(b) || '99:99';
    if (timeA !== timeB) {
      return timeA.localeCompare(timeB);
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function getLocalFallback(date: string): ContentDailyEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) 
      ? sortEntriesChronologically(
          parsed
            .filter(e => e.entryDate === date)
            .map(e => ({
              ...e,
              isLocalOnly: true,
              entryType: e.entryType || (e.sourceType === 'crm_sync' ? 'planejado' : 'acontecimento'),
            }))
        )
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
  const isSync = row.source_type === 'crm_sync';
  return {
    id: row.id,
    userId: row.user_id,
    entryDate: row.entry_date,
    entryTime: row.entry_time,
    rawContent: row.raw_content,
    sourceType: row.source_type,
    activityId: row.activity_id,
    dealId: row.deal_id,
    entryType: row.entry_type || (isSync ? 'planejado' : 'acontecimento'),
    aiStatus: row.ai_status,
    aiSummary: row.ai_summary,
    aiSignals: row.ai_signals,
    isLocalOnly: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches all entries for a specific day in chronological order
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
      .order('entry_time', { ascending: true });

    if (error) {
      // If table doesn't exist yet in Supabase, gracefully use local storage
      if (error.code === 'PGRST205') {
        console.info('ℹ️ Table content_daily_entries not found on Supabase. Run supabase_content_daily.sql in Supabase SQL Editor. Using local fallback.');
        return getLocalFallback(date);
      }
      console.error('Error fetching daily entries from Supabase:', error);
      return getLocalFallback(date);
    }

    const mapped = (data || []).map(mapRowToEntry);
    return sortEntriesChronologically(mapped);
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
  let timeStr = input.entryTime || now.toTimeString().split(' ')[0];
  if (timeStr && timeStr.length === 5) {
    timeStr = `${timeStr}:00`;
  }
  const isSync = input.sourceType === 'crm_sync';
  const entryType = input.entryType || (isSync ? 'planejado' : 'acontecimento');

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
    entryType,
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
  // Update local fallback immediately
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list: ContentDailyEntry[] = JSON.parse(raw);
      const idx = list.findIndex(e => e.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      }
    }
  } catch (err) {
    console.warn('Failed to update daily entry fallback:', err);
  }

  try {
    const snakeUpdates: any = {};
    if (updates.rawContent !== undefined) snakeUpdates.raw_content = updates.rawContent;
    if (updates.entryTime !== undefined) snakeUpdates.entry_time = updates.entryTime;
    if (updates.entryDate !== undefined) snakeUpdates.entry_date = updates.entryDate;
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
        rawContent: entry.rawContent,
      })
    }).catch(err => console.debug('Daily AI analyze fetch error (quiet):', err));
  } catch (err) {
    console.debug('Failed to trigger daily analysis:', err);
  }
}

/**
 * Triggers backend AI analysis and returns the updated entry with signals
 */
export async function analyzeDailyEntryDirectly(entry: ContentDailyEntry): Promise<ContentDailyEntry | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    console.warn('Cannot trigger daily AI analysis: No active auth session');
    return null;
  }

  try {
    const response = await fetch('/api/content/daily/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        entryId: entry.id,
        rawContent: entry.rawContent,
      })
    });

    if (!response.ok) {
      console.warn('AI analysis request returned error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.success && data.analysis) {
      const updated: ContentDailyEntry = {
        ...entry,
        aiStatus: 'processed',
        aiSignals: data.analysis,
        aiSummary: data.analysis.aprendizado || (data.analysis.fatos && data.analysis.fatos[0]) || null,
        updatedAt: new Date().toISOString()
      };

      saveLocalFallback(updated);

      updateDailyEntry(entry.id, {
        aiStatus: 'processed',
        aiSignals: data.analysis,
        aiSummary: updated.aiSummary,
      }).catch(() => {});

      return updated;
    }
    return null;
  } catch (err) {
    console.error('Exception analyzing daily entry:', err);
    return null;
  }
}
