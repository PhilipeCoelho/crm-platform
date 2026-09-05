import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchContentReferences,
  createReference,
  updateReference,
  deleteReference,
  archiveReference,
  analyzeReference,
  convertReferenceToIdea,
  checkDuplicateUrl,
  CreateReferenceInput,
  ReferenceFilterOptions,
} from '@/services/contentReferenceService';
import { ContentReference } from '@/services/contentService';

export function useContentReferences(initialFilters?: ReferenceFilterOptions) {
  const [references, setReferences] = useState<ContentReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null); // referenceId being analyzed
  const [filters, setFilters] = useState<ReferenceFilterOptions>(initialFilters || {
    status: 'all',
    platform: 'all',
    sortBy: 'recent',
    search: '',
  });

  const loadReferences = useCallback(async (currentFilters?: ReferenceFilterOptions) => {
    setIsLoading(true);
    try {
      const data = await fetchContentReferences(currentFilters || filters);
      setReferences(data);
    } catch (err) {
      console.error('Error in useContentReferences:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReferences(filters);
  }, [filters, loadReferences]);

  // Filter setters
  const setSearch = (search: string) => {
    setFilters(prev => ({ ...prev, search }));
  };

  const setStatusFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status }));
  };

  const setPlatformFilter = (platform: string) => {
    setFilters(prev => ({ ...prev, platform }));
  };

  const setSortBy = (sortBy: 'recent' | 'oldest' | 'analyzed') => {
    setFilters(prev => ({ ...prev, sortBy }));
  };

  // Actions
  const addReference = async (input: CreateReferenceInput): Promise<ContentReference> => {
    setIsSubmitting(true);
    try {
      const created = await createReference(input);
      setReferences(prev => [created, ...prev.filter(r => r.id !== created.id)]);
      return created;
    } finally {
      setIsSubmitting(false);
    }
  };

  const editReference = async (id: string, updates: Partial<ContentReference>): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const ok = await updateReference(id, updates);
      if (ok) {
        setReferences(prev => prev.map(item =>
          item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
        ));
      }
      return ok;
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeReference = async (id: string): Promise<boolean> => {
    setReferences(prev => prev.filter(r => r.id !== id));
    return deleteReference(id);
  };

  const archive = async (id: string): Promise<boolean> => {
    const ok = await archiveReference(id);
    if (ok) {
      setReferences(prev => prev.map(item =>
        item.id === id ? { ...item, status: 'arquivada' as const, updatedAt: new Date().toISOString() } : item
      ));
    }
    return ok;
  };

  const analyze = async (id: string): Promise<boolean> => {
    setIsAnalyzing(id);
    // Optimistic: mark as analyzing
    setReferences(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'analisando' as const } : item
    ));

    try {
      const analysis = await analyzeReference(id);
      if (analysis) {
        const now = new Date().toISOString();
        setReferences(prev => prev.map(item =>
          item.id === id ? {
            ...item,
            status: 'analisada' as const,
            analysis,
            analyzedAt: now,
            updatedAt: now,
          } : item
        ));
        return true;
      } else {
        // Revert status
        setReferences(prev => prev.map(item =>
          item.id === id ? { ...item, status: 'salva' as const } : item
        ));
        return false;
      }
    } catch {
      // Revert status
      setReferences(prev => prev.map(item =>
        item.id === id ? { ...item, status: 'salva' as const } : item
      ));
      return false;
    } finally {
      setIsAnalyzing(null);
    }
  };

  const convertToIdea = async (
    referenceId: string,
    ideaData: { title: string; description?: string; format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null; priority?: number }
  ): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      return await convertReferenceToIdea(referenceId, ideaData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkDuplicate = async (url: string) => {
    return checkDuplicateUrl(url);
  };

  // Anti-accumulation metrics
  const unanalyzedCount = useMemo(() =>
    references.filter(r => r.status === 'salva').length,
    [references]
  );

  const analyzedButUnusedCount = useMemo(() =>
    references.filter(r => r.status === 'analisada').length,
    [references]
  );

  const showAntiAccumulationWarning = unanalyzedCount >= 5;
  const showAnalyzedUnusedWarning = analyzedButUnusedCount >= 5;

  return {
    references,
    isLoading,
    isSubmitting,
    isAnalyzing,
    filters,
    setSearch,
    setStatusFilter,
    setPlatformFilter,
    setSortBy,
    addReference,
    editReference,
    removeReference,
    archive,
    analyze,
    convertToIdea,
    checkDuplicate,
    refresh: () => loadReferences(filters),
    // Anti-accumulation
    unanalyzedCount,
    analyzedButUnusedCount,
    showAntiAccumulationWarning,
    showAnalyzedUnusedWarning,
  };
}
