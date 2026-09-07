import { useState, useEffect, useCallback } from 'react';
import { 
  fetchDailyEntries, 
  createDailyEntry, 
  deleteDailyEntry, 
  updateDailyEntry,
  analyzeDailyEntryDirectly,
  fetchTodayCRMActivities,
  sortEntriesChronologically,
  extractEntryDisplayTime,
} from '@/services/contentDailyService';
import { 
  fetchAllGoogleCalendarsEvents, 
  isGoogleCalendarConnected,
  GoogleCalendarEvent 
} from '@/services/googleCalendarService';
import { ContentDailyEntry } from '@/services/contentService';
import { Activity, DealLog, Deal, Contact, Pipeline } from '@/types/schema';
import { getLeadStageInfo } from '@/components/content/daily/DailyPlannedSection';

export interface IngestPlannedItemsParams {
  targetDate: string;
  calendarEvents?: GoogleCalendarEvent[];
  activities?: Activity[];
  logs?: DealLog[];
  deals?: Deal[];
  contacts?: Contact[];
  pipelines?: Record<string, Pipeline>;
}

export function useContentDaily() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [entries, setEntries] = useState<ContentDailyEntry[]>([]);
  const [crmActivities, setCrmActivities] = useState<Activity[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isCalendarConnectedState, setIsCalendarConnectedState] = useState<boolean>(() => isGoogleCalendarConnected());
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<string[]>([]);

  const autoIngestPlannedItems = useCallback(async (
    params: IngestPlannedItemsParams,
    existingEntries: ContentDailyEntry[]
  ): Promise<ContentDailyEntry[]> => {
    const { targetDate, calendarEvents, activities, logs, deals = [], contacts = [], pipelines = {} } = params;
    let currentEntries = [...existingEntries];

    // 1. RECONCILE GOOGLE CALENDAR EVENTS (Delete removed, relocate moved/changed, insert new)
    if (calendarEvents !== undefined) {
      // Find all existing Google Agenda sync entries on targetDate
      const existingGcalEntries = currentEntries.filter(
        e => e.entryDate === targetDate && 
             e.sourceType === 'crm_sync' && 
             !e.activityId && 
             !e.dealId && 
             (e.rawContent.includes('[Google Agenda') || e.rawContent.includes('gcal_id:'))
      );

      // A) Delete any entry that no longer exists in calendarEvents (deleted or relocated to another day)
      for (const oldEntry of existingGcalEntries) {
        const stillInCalendar = calendarEvents.some(ev => {
          if (oldEntry.rawContent.includes(`<!-- gcal_id:${ev.id} -->`)) return true;
          return oldEntry.rawContent.includes(ev.title);
        });

        if (!stillInCalendar) {
          try {
            await deleteDailyEntry(oldEntry.id);
            currentEntries = currentEntries.filter(e => e.id !== oldEntry.id);
          } catch (delErr) {
            console.warn('Failed to delete removed calendar event from daily:', delErr);
          }
        }
      }

      // B) Update relocated/rescheduled events or insert new events
      for (const ev of calendarEvents) {
        const matchingEntry = currentEntries.find(e => 
          e.entryDate === targetDate && (
            e.rawContent.includes(`<!-- gcal_id:${ev.id} -->`) ||
            e.rawContent.includes(ev.title)
          )
        );

        const timeLabel = ev.startTime ? ` às ${ev.startTime}${ev.endTime ? ` - ${ev.endTime}` : ''}` : '';
        const calLabel = ev.calendarName ? `[Google Agenda • ${ev.calendarName}]` : '[Google Agenda]';
        const expectedContent = `${calLabel} ${ev.title}${timeLabel}${ev.description ? `\n${ev.description}` : ''}${ev.location ? `\nLocal: ${ev.location}` : ''}<!-- gcal_id:${ev.id} -->`;
        const expectedTime = ev.startTime ? (ev.startTime.length === 5 ? `${ev.startTime}:00` : ev.startTime) : '08:00:00';

        if (matchingEntry) {
          // Check if time or details were relocated/updated
          const currentDisplay = extractEntryDisplayTime(matchingEntry);
          const timeChanged = currentDisplay !== (ev.startTime || '08:00');
          const contentChanged = matchingEntry.rawContent !== expectedContent;

          if (timeChanged || contentChanged) {
            try {
              await updateDailyEntry(matchingEntry.id, {
                rawContent: expectedContent,
                entryTime: expectedTime,
              });
              currentEntries = currentEntries.map(e => e.id === matchingEntry.id ? {
                ...e,
                rawContent: expectedContent,
                entryTime: expectedTime,
              } : e);
            } catch (updErr) {
              console.warn('Failed to update relocated calendar event in daily:', updErr);
            }
          }
        } else {
          // New event on this day
          try {
            const newEntry = await createDailyEntry({
              rawContent: expectedContent,
              sourceType: 'crm_sync',
              entryDate: targetDate,
              entryTime: expectedTime,
              entryType: 'planejado',
            });
            currentEntries.push(newEntry);
          } catch (err) {
            console.warn('Failed to auto-create daily entry from calendar event:', err);
          }
        }
      }
    }

    // 2. RECONCILE CRM ACTIVITIES (Delete removed/rescheduled, update changed, insert new)
    if (activities !== undefined && activities.length >= 0) {
      const activeActivitiesToday = activities.filter(act => 
        act.status !== 'canceled' && 
        act.dueDate && 
        (act.dueDate.startsWith(targetDate) || act.dueDate.slice(0, 10) === targetDate)
      );

      // Existing CRM activity entries on targetDate
      const existingActivityEntries = currentEntries.filter(
        e => e.entryDate === targetDate && e.sourceType === 'crm_sync' && Boolean(e.activityId)
      );

      // A) Delete entries whose activity is no longer scheduled for targetDate
      for (const oldActEntry of existingActivityEntries) {
        const stillActiveToday = activeActivitiesToday.some(a => a.id === oldActEntry.activityId);
        if (!stillActiveToday) {
          try {
            await deleteDailyEntry(oldActEntry.id);
            currentEntries = currentEntries.filter(e => e.id !== oldActEntry.id);
          } catch (delErr) {
            console.warn('Failed to delete removed activity from daily:', delErr);
          }
        }
      }

      // B) Update or insert CRM activities
      for (const act of activeActivitiesToday) {
        const deal = deals.find(d => d.id === act.dealId);
        const contact = contacts.find(c => c.id === act.contactId);
        const stageInfo = getLeadStageInfo(deal, pipelines);
        const stageTitle = stageInfo?.title || 'Lead';

        let time = '09:00:00';
        if (act.dueDate && act.dueDate.includes('T')) {
          try {
            const d = new Date(act.dueDate);
            if (!isNaN(d.getTime())) {
              time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
          } catch {}
        }

        const dealLabel = deal ? ` — ${deal.title}` : (contact ? ` — ${contact.name}` : '');
        const timeLabel = act.dueDate && act.dueDate.includes('T') ? ` às ${time.slice(0, 5)}` : '';
        const expectedContent = `[Atividade CRM • ${stageTitle}] ${act.title}${dealLabel}${timeLabel}${act.notes ? `\nNota: ${act.notes}` : ''}`;

        const matching = currentEntries.find(e => e.entryDate === targetDate && e.activityId === act.id);
        if (matching) {
          if (matching.rawContent !== expectedContent || matching.entryTime !== time) {
            try {
              await updateDailyEntry(matching.id, {
                rawContent: expectedContent,
                entryTime: time,
              });
              currentEntries = currentEntries.map(e => e.id === matching.id ? {
                ...e,
                rawContent: expectedContent,
                entryTime: time,
              } : e);
            } catch (err) {}
          }
        } else {
          try {
            const newEntry = await createDailyEntry({
              rawContent: expectedContent,
              sourceType: 'crm_sync',
              entryDate: targetDate,
              entryTime: time,
              entryType: 'planejado',
              activityId: act.id,
              dealId: act.dealId || null,
            });
            currentEntries.push(newEntry);
          } catch (err) {}
        }
      }
    }

    // 3. RECONCILE CRM NOTES & COMMENTS
    if (logs && logs.length > 0) {
      for (const log of logs) {
        if (log.logType === 'system' || !log.content?.trim()) continue;
        const createdDateMatches = log.createdAt && (log.createdAt.startsWith(targetDate) || log.createdAt.slice(0, 10) === targetDate);
        if (!createdDateMatches) continue;

        const alreadyExists = currentEntries.some(
          e => e.entryDate === targetDate && (
            (e.dealId && e.dealId === log.dealId && e.rawContent.includes(log.content.slice(0, 30))) ||
            e.rawContent.includes(log.content.slice(0, 40))
          )
        );

        if (!alreadyExists) {
          const deal = deals.find(d => d.id === log.dealId);
          const stageInfo = getLeadStageInfo(deal, pipelines);
          const stageTitle = stageInfo?.title || 'Lead';

          let time = '10:00:00';
          try {
            const d = new Date(log.createdAt);
            if (!isNaN(d.getTime())) {
              time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }
          } catch {}

          const content = `[Nota do Lead • ${stageTitle}] ${deal ? `${deal.title}: ` : ''}${log.content}`;

          try {
            const newEntry = await createDailyEntry({
              rawContent: content,
              sourceType: 'crm_sync',
              entryDate: targetDate,
              entryTime: time,
              entryType: 'planejado',
              dealId: log.dealId || null,
            });
            currentEntries.push(newEntry);
          } catch (err) {}
        }
      }
    }

    return sortEntriesChronologically(currentEntries);
  }, []);

  const syncCalendar = useCallback(async (date: string, silent = false) => {
    if (!isGoogleCalendarConnected()) {
      setCalendarEvents([]);
      setIsCalendarConnectedState(false);
      setEntries(prev => {
        autoIngestPlannedItems({ targetDate: date, calendarEvents: [] }, prev).then(reconciled => {
          setEntries(reconciled);
        });
        return prev;
      });
      return;
    }

    setIsCalendarConnectedState(true);
    if (!silent) setIsSyncingCalendar(true);
    try {
      const res = await fetchAllGoogleCalendarsEvents(date);
      if (res.success) {
        setCalendarEvents(res.events);
        setEntries(prev => {
          autoIngestPlannedItems({ targetDate: date, calendarEvents: res.events }, prev).then(reconciled => {
            setEntries(reconciled);
          });
          return prev;
        });
      }
    } catch (err) {
      console.warn('Could not sync calendar events:', err);
    } finally {
      if (!silent) setIsSyncingCalendar(false);
    }
  }, [autoIngestPlannedItems]);

  const loadData = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      const promises: [Promise<ContentDailyEntry[]>, Promise<Activity[]>] = [
        fetchDailyEntries(date),
        fetchTodayCRMActivities(date),
      ];

      const [fetchedEntries, fetchedActivities] = await Promise.all(promises);
      setCrmActivities(fetchedActivities);

      let currentEntries = fetchedEntries;

      // Also sync calendar if connected
      if (isGoogleCalendarConnected()) {
        setIsCalendarConnectedState(true);
        try {
          const calRes = await fetchAllGoogleCalendarsEvents(date);
          if (calRes.success) {
            setCalendarEvents(calRes.events);
            currentEntries = await autoIngestPlannedItems(
              { targetDate: date, calendarEvents: calRes.events, activities: fetchedActivities },
              currentEntries
            );
          }
        } catch (calErr) {
          console.warn('Calendar sync error on loadData:', calErr);
        }
      } else {
        setIsCalendarConnectedState(false);
        setCalendarEvents([]);
        currentEntries = await autoIngestPlannedItems(
          { targetDate: date, calendarEvents: [], activities: fetchedActivities },
          currentEntries
        );
      }

      setEntries(sortEntriesChronologically(currentEntries));
    } catch (err) {
      console.error('Error loading Daily data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [autoIngestPlannedItems]);

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate, loadData]);

  // Auto-sync calendar whenever user returns to tab or window, plus periodic 60s background poll
  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && isGoogleCalendarConnected()) {
        syncCalendar(selectedDate, true);
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && isGoogleCalendarConnected()) {
        syncCalendar(selectedDate, true);
      }
    }, 60000);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      clearInterval(interval);
    };
  }, [selectedDate, syncCalendar]);

  const addEntry = async (rawContent: string, sourceType: 'text' | 'voice' = 'text') => {
    if (!rawContent.trim()) return;
    setIsSubmitting(true);
    try {
      const newEntry = await createDailyEntry({
        rawContent: rawContent.trim(),
        sourceType,
        entryDate: selectedDate,
        entryType: 'acontecimento',
      });

      // Optimistic addition in strict chronological order
      setEntries(prev => sortEntriesChronologically([...prev, newEntry]));
    } catch (err) {
      console.error('Error adding daily entry:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const ingestPlannedItems = useCallback(async (params: IngestPlannedItemsParams) => {
    setEntries(prev => {
      autoIngestPlannedItems(params, prev).then(newlyIngested => {
        if (newlyIngested.length > 0) {
          setEntries(curr => sortEntriesChronologically([...curr, ...newlyIngested]));
        }
      });
      return prev;
    });
  }, [autoIngestPlannedItems]);

  const removeEntry = async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    await deleteDailyEntry(id);
  };

  const updateEntryText = async (id: string, newContent: string) => {
    const target = entries.find(e => e.id === id);
    if (!target) return;

    const updatedEntry: ContentDailyEntry = {
      ...target,
      rawContent: newContent,
      updatedAt: new Date().toISOString(),
    };

    setEntries(prev => sortEntriesChronologically(prev.map(e => e.id === id ? updatedEntry : e)));
    await updateDailyEntry(id, { rawContent: newContent });
  };

  const analyzeEntry = async (entry: ContentDailyEntry) => {
    if (analyzingIds.includes(entry.id)) return;
    setAnalyzingIds(prev => [...prev, entry.id]);
    try {
      const analyzed = await analyzeDailyEntryDirectly(entry);
      if (analyzed) {
        setEntries(prev => sortEntriesChronologically(prev.map(e => e.id === entry.id ? analyzed : e)));
      }
    } finally {
      setAnalyzingIds(prev => prev.filter(item => item !== entry.id));
    }
  };

  const changeDate = (date: string) => {
    setSelectedDate(date);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const goToPreviousDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return {
    selectedDate,
    isToday,
    entries,
    crmActivities,
    calendarEvents,
    isCalendarConnected: isCalendarConnectedState,
    isSyncingCalendar,
    analyzingIds,
    isLoading,
    isSubmitting,
    addEntry,
    removeEntry,
    updateEntryText,
    analyzeEntry,
    ingestPlannedItems,
    syncCalendar: () => syncCalendar(selectedDate),
    changeDate,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    refresh: () => loadData(selectedDate),
  };
}
