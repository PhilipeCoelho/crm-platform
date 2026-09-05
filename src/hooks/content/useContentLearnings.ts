import { useState, useEffect, useCallback, useMemo } from 'react';
import { ContentLearning } from '@/services/contentService';
import { 
  fetchLearnings, 
  createLearning, 
  confirmLearning, 
  discardLearning,
  CreateLearningInput 
} from '@/services/contentPerformanceService';

export interface LearningsFilterOptions {
  status?: string;
  type?: string;
}

export function useContentLearnings(initialFilters?: LearningsFilterOptions) {
  const [learnings, setLearnings] = useState<ContentLearning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState<LearningsFilterOptions>(initialFilters || {
    status: 'all',
    type: 'all',
  });

  const loadLearnings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLearnings(filters);
      setLearnings(data);
    } catch (err) {
      console.error('Error fetching learnings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLearnings();
  }, [loadLearnings]);

  const setStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status }));
  };

  const setTypeFilter = (type: string) => {
    setFilters(prev => ({ ...prev, type }));
  };

  const saveLearning = async (input: CreateLearningInput): Promise<ContentLearning> => {
    setIsSubmitting(true);
    try {
      const created = await createLearning(input);
      setLearnings(prev => [created, ...prev.filter(l => l.id !== created.id)]);
      return created;
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirm = async (id: string): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const ok = await confirmLearning(id);
      if (ok) {
        setLearnings(prev => prev.map(l => l.id === id ? { ...l, status: 'confirmed' as const, updatedAt: new Date().toISOString() } : l));
      }
      return ok;
    } finally {
      setIsSubmitting(false);
    }
  };

  const discard = async (id: string): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const ok = await discardLearning(id);
      if (ok) {
        setLearnings(prev => prev.map(l => l.id === id ? { ...l, status: 'discarded' as const, updatedAt: new Date().toISOString() } : l));
      }
      return ok;
    } finally {
      setIsSubmitting(false);
    }
  };

  const suggestedLearnings = useMemo(() => 
    learnings.filter(l => l.status === 'suggested'),
    [learnings]
  );

  const confirmedLearnings = useMemo(() => 
    learnings.filter(l => l.status === 'confirmed'),
    [learnings]
  );

  const discardedLearnings = useMemo(() => 
    learnings.filter(l => l.status === 'discarded'),
    [learnings]
  );

  return {
    learnings,
    suggestedLearnings,
    confirmedLearnings,
    discardedLearnings,
    isLoading,
    isSubmitting,
    filters,
    setStatusFilter,
    setTypeFilter,
    saveLearning,
    confirm,
    discard,
    refresh: loadLearnings,
  };
}
