import { supabase } from '@/lib/supabase';

export interface CalendarAccount {
  id: string;
  name: string;
  url: string;
  color?: 'blue' | 'emerald' | 'purple' | 'amber' | 'rose';
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  startTime?: string | null; // HH:mm
  endTime?: string | null;   // HH:mm
  isAllDay: boolean;
  startIso: string;
  endIso?: string | null;
  source: 'google_calendar';
  calendarName?: string;
  calendarColor?: string;
}

const CALENDARS_STORAGE_KEY = 'vamus_google_calendars_list';
const LEGACY_STORAGE_KEY = 'vamus_google_calendar_ical_url';
const LAST_SYNC_KEY = 'vamus_google_calendar_last_sync';

export function getCalendarAccounts(): CalendarAccount[] {
  try {
    const raw = localStorage.getItem(CALENDARS_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
    // Backward compatibility: migrate legacy single URL if present
    const legacyUrl = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyUrl && legacyUrl.trim()) {
      const defaultAccount: CalendarAccount = {
        id: 'default',
        name: 'Google Agenda',
        url: legacyUrl.trim(),
        color: 'blue'
      };
      saveCalendarAccounts([defaultAccount]);
      return [defaultAccount];
    }
    return [];
  } catch {
    return [];
  }
}

export function saveCalendarAccounts(accounts: CalendarAccount[]): void {
  try {
    localStorage.setItem(CALENDARS_STORAGE_KEY, JSON.stringify(accounts));
    if (accounts.length > 0) {
      localStorage.setItem(LEGACY_STORAGE_KEY, accounts[0].url);
    } else {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem(LAST_SYNC_KEY);
    }
  } catch (err) {
    console.warn('Failed to save calendar accounts:', err);
  }
}

export function addCalendarAccount(account: Omit<CalendarAccount, 'id'>): CalendarAccount {
  const accounts = getCalendarAccounts();
  const colors: Array<'blue' | 'emerald' | 'purple' | 'amber' | 'rose'> = ['blue', 'emerald', 'purple', 'amber', 'rose'];
  const nextColor = colors[accounts.length % colors.length];
  
  const newAccount: CalendarAccount = {
    ...account,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cal_${Date.now()}`,
    color: account.color || nextColor
  };
  accounts.push(newAccount);
  saveCalendarAccounts(accounts);
  return newAccount;
}

export function removeCalendarAccount(id: string): void {
  const accounts = getCalendarAccounts().filter(a => a.id !== id);
  saveCalendarAccounts(accounts);
}

export function updateCalendarAccount(id: string, updates: Partial<CalendarAccount>): void {
  const accounts = getCalendarAccounts().map(a => a.id === id ? { ...a, ...updates } : a);
  saveCalendarAccounts(accounts);
}

export function getGoogleCalendarUrl(): string | null {
  const accounts = getCalendarAccounts();
  return accounts.length > 0 ? accounts[0].url : null;
}

export function setGoogleCalendarUrl(url: string, name: string = 'Google Agenda'): void {
  const accounts = getCalendarAccounts();
  const existing = accounts.find(a => a.url.trim() === url.trim());
  if (existing) {
    updateCalendarAccount(existing.id, { name });
  } else {
    addCalendarAccount({ name, url: url.trim() });
  }
}

export function removeGoogleCalendarUrl(): void {
  saveCalendarAccounts([]);
}

export function isGoogleCalendarConnected(): boolean {
  return getCalendarAccounts().length > 0;
}

export function getLastCalendarSync(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

export function setLastCalendarSync(): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {}
}

/**
 * Fetches events from Google Calendar for the given date using our authenticated backend proxy
 */
export async function fetchGoogleCalendarEvents(
  dateStr: string,
  urlOverride?: string
): Promise<{ success: boolean; events: GoogleCalendarEvent[]; error?: string }> {
  const icalUrl = urlOverride || getGoogleCalendarUrl();

  if (!icalUrl || !icalUrl.trim()) {
    return { success: false, events: [], error: 'Nenhuma URL de agenda configurada' };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    return { success: false, events: [], error: 'Sessão de usuário não encontrada. Faça login novamente.' };
  }

  try {
    const response = await fetch('/api/calendar/fetch-ical', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        icalUrl: icalUrl.trim(),
        date: dateStr,
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        events: [], 
        error: errData.error || `Erro de conexão com a agenda (${response.status})` 
      };
    }

    const data = await response.json();
    setLastCalendarSync();

    return {
      success: true,
      events: data.events || [],
    };
  } catch (err: any) {
    console.error('Exception fetching Google Calendar events:', err);
    return {
      success: false,
      events: [],
      error: err.message || 'Falha ao conectar com o serviço de agenda',
    };
  }
}

/**
 * Fetches events from all configured Google Calendar accounts in parallel for the given date,
 * combining, deduplicating, and sorting them chronologically.
 */
export async function fetchAllGoogleCalendarsEvents(
  dateStr: string
): Promise<{ success: boolean; events: GoogleCalendarEvent[]; errors?: string[] }> {
  const accounts = getCalendarAccounts();
  if (accounts.length === 0) {
    return { success: false, events: [] };
  }

  const results = await Promise.allSettled(
    accounts.map(async account => {
      const res = await fetchGoogleCalendarEvents(dateStr, account.url);
      if (res.success) {
        return (res.events || []).map(e => ({
          ...e,
          calendarName: account.name,
          calendarColor: account.color || 'blue'
        }));
      }
      throw new Error(res.error || `Erro ao carregar ${account.name}`);
    })
  );

  const allEvents: GoogleCalendarEvent[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const acc = accounts[i];
    if (r.status === 'fulfilled') {
      for (const ev of r.value) {
        // Unique signature by title + start time
        const sig = `${ev.title?.trim().toLowerCase()}_${ev.startIso}`;
        if (!seen.has(sig)) {
          seen.add(sig);
          allEvents.push(ev);
        }
      }
    } else {
      errors.push(`${acc.name}: ${r.reason?.message || 'Falha na conexão'}`);
    }
  }

  // Sort by start time (all-day first, then by start time)
  allEvents.sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return new Date(a.startIso).getTime() - new Date(b.startIso).getTime();
  });

  setLastCalendarSync();

  return {
    success: allEvents.length > 0 || errors.length === 0,
    events: allEvents,
    errors: errors.length > 0 ? errors : undefined
  };
}

