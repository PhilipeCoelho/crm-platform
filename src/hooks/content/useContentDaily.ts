import { useState, useEffect, useCallback } from 'react';
import { 
  fetchDailyEntries, 
  createDailyEntry, 
  deleteDailyEntry, 
  fetchTodayCRMActivities 
} from '@/services/contentDailyService';
import { ContentDailyEntry } from '@/services/contentService';
import { Activity } from '@/types/schema';

export function useContentDaily() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [entries, setEntries] = useState<ContentDailyEntry[]>([]);
  const [crmActivities, setCrmActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      const [fetchedEntries, fetchedActivities] = await Promise.all([
        fetchDailyEntries(date),
        fetchTodayCRMActivities(date),
      ]);
      setEntries(fetchedEntries);
      setCrmActivities(fetchedActivities);
    } catch (err) {
      console.error('Error loading Daily data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate, loadData]);

  const addEntry = async (rawContent: string, sourceType: 'text' | 'voice' = 'text') => {
    if (!rawContent.trim()) return;
    setIsSubmitting(true);
    try {
      const newEntry = await createDailyEntry({
        rawContent: rawContent.trim(),
        sourceType,
        entryDate: selectedDate,
      });

      // Optimistic addition
      setEntries(prev => [...prev, newEntry]);
    } catch (err) {
      console.error('Error adding daily entry:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeEntry = async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    await deleteDailyEntry(id);
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
    isLoading,
    isSubmitting,
    addEntry,
    removeEntry,
    changeDate,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    refresh: () => loadData(selectedDate),
  };
}
