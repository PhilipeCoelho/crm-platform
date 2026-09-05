import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ContentAction } from '@/services/contentService';
import { 
  fetchActiveActions, 
  generateNextBestActions, 
  acceptAction, 
  completeAction, 
  dismissAction 
} from '@/services/contentActionService';

export function useContentActions() {
  const [actions, setActions] = useState<ContentAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchActiveActions();
      setActions(data);
    } catch (err: any) {
      console.error('Error loading content actions:', err);
      setError(err?.message || 'Erro ao carregar ações recomendadas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const generate = async (): Promise<ContentAction[]> => {
    setIsGenerating(true);
    setError(null);
    try {
      const freshActions = await generateNextBestActions();
      setActions(freshActions);
      return freshActions;
    } catch (err: any) {
      console.error('Error generating actions:', err);
      setError(err?.message || 'Erro ao gerar próximos movimentos');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const accept = async (id: string): Promise<boolean> => {
    const ok = await acceptAction(id);
    if (ok) {
      setActions(prev => prev.map(a => a.id === id ? { ...a, status: 'accepted' as const } : a));
    }
    return ok;
  };

  const complete = async (id: string): Promise<boolean> => {
    const ok = await completeAction(id);
    if (ok) {
      setActions(prev => prev.filter(a => a.id !== id));
    }
    return ok;
  };

  const dismiss = async (id: string): Promise<boolean> => {
    const ok = await dismissAction(id);
    if (ok) {
      setActions(prev => prev.filter(a => a.id !== id));
    }
    return ok;
  };

  const primaryAction = useMemo(() => {
    return actions.length > 0 ? actions[0] : null;
  }, [actions]);

  const secondaryActions = useMemo(() => {
    return actions.length > 1 ? actions.slice(1) : [];
  }, [actions]);

  return {
    actions,
    primaryAction,
    secondaryActions,
    isLoading,
    isGenerating,
    error,
    generate,
    accept,
    complete,
    dismiss,
    refresh: loadActions,
  };
}
