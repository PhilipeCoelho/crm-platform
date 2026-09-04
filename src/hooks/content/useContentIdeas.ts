import { useState, useEffect, useCallback } from 'react';
import { 
  fetchContentIdeas, 
  createContentIdea, 
  updateContentIdea, 
  deleteContentIdea, 
  CreateContentIdeaInput, 
  IdeaFilterOptions 
} from '@/services/contentIdeasService';
import { ContentIdea } from '@/services/contentService';

export function useContentIdeas(initialFilters?: IdeaFilterOptions) {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filters, setFilters] = useState<IdeaFilterOptions>(initialFilters || {
    status: 'all',
    sourceType: 'all',
    sortBy: 'updated',
    search: '',
  });

  const loadIdeas = useCallback(async (currentFilters?: IdeaFilterOptions) => {
    setIsLoading(true);
    try {
      const data = await fetchContentIdeas(currentFilters || filters);
      setIdeas(data);
    } catch (err) {
      console.error('Error in useContentIdeas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadIdeas(filters);
  }, [filters, loadIdeas]);

  const setSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search }));
  };

  const setStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status }));
  };

  const setSourceFilter = (sourceType: string) => {
    setFilters(prev => ({ ...prev, sourceType }));
  };

  const setPriorityFilter = (priority: number | undefined) => {
    setFilters(prev => ({ ...prev, priority }));
  };

  const setSortBy = (sortBy: 'updated' | 'priority' | 'oldest') => {
    setFilters(prev => ({ ...prev, sortBy }));
  };

  const addIdea = async (input: CreateContentIdeaInput): Promise<ContentIdea> => {
    setIsSubmitting(true);
    try {
      const created = await createContentIdea(input);
      setIdeas(prev => [created, ...prev.filter(i => i.id !== created.id)]);
      return created;
    } finally {
      setIsSubmitting(false);
    }
  };

  const editIdea = async (id: string, updates: Partial<ContentIdea>): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const ok = await updateContentIdea(id, updates);
      if (ok) {
        setIdeas(prev => prev.map(item => item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item));
      }
      return ok;
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeIdea = async (id: string): Promise<boolean> => {
    setIdeas(prev => prev.filter(i => i.id !== id));
    return deleteContentIdea(id);
  };

  return {
    ideas,
    isLoading,
    isSubmitting,
    filters,
    setSearch,
    setStatusFilter,
    setSourceFilter,
    setPriorityFilter,
    setSortBy,
    addIdea,
    editIdea,
    removeIdea,
    refresh: () => loadIdeas(filters),
  };
}
