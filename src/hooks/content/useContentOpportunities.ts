import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  type ContentOpportunity, 
  fetchContentOpportunities, 
  generateOpportunities, 
  dismissOpportunity, 
  convertOpportunityToIdea,
  updateOpportunityStatus 
} from '@/services/contentOpportunityService';

export interface ToastState {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useContentOpportunities() {
  const [opportunities, setOpportunities] = useState<ContentOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastState | null>(null);

  const showToast = useCallback((toast: ToastState) => {
    setToastMessage(toast);
    setTimeout(() => {
      setToastMessage(prev => prev === toast ? null : prev);
    }, 4500);
  }, []);

  const loadOpportunities = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchContentOpportunities();
      setOpportunities(data);
    } catch (err: any) {
      console.error('Error loading opportunities:', err);
      setError(err.message || 'Falha ao carregar oportunidades');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  // Active opportunities (nova, vista, aceita)
  const activeOpportunities = useMemo(() => {
    return opportunities.filter(o => o.status === 'nova' || o.status === 'vista' || o.status === 'aceita');
  }, [opportunities]);

  // Top 3 primary opportunities (strictly limited to 3 as requested by product spec)
  const topOpportunities = useMemo(() => {
    return activeOpportunities.slice(0, 3);
  }, [activeOpportunities]);

  // History opportunities (convertida, descartada)
  const historyOpportunities = useMemo(() => {
    return opportunities.filter(o => o.status === 'convertida' || o.status === 'descartada');
  }, [opportunities]);

  /**
   * Triggers the AI Connection Engine
   */
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await generateOpportunities();
      if (res.count === 0) {
        showToast({
          title: 'Nenhuma nova oportunidade',
          description: res.message || 'Adicione mais anotações no Daily ou registre interações comerciais para gerar novas conexões.',
        });
      } else {
        showToast({
          title: `${res.count} nova(s) oportunidade(s) encontrada(s)`,
          description: 'A IA cruzou seu Daily e sinais comerciais do CRM.',
        });
        await loadOpportunities();
      }
    } catch (err: any) {
      console.error('Error generating opportunities:', err);
      const msg = err.message || 'Erro ao conectar fontes de conteúdo.';
      setError(msg);
      showToast({
        title: 'Erro na análise de conexões',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Dismiss an opportunity safely (never deletes daily/crm/idea)
   */
  const handleDismiss = async (id: string) => {
    // Optimistic update
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: 'descartada' } : o));
    try {
      await dismissOpportunity(id);
      showToast({
        title: 'Oportunidade descartada',
        description: 'Os registros originais do Daily e CRM foram preservados intactos.',
      });
    } catch (err: any) {
      console.error('Error dismissing opportunity:', err);
      await loadOpportunities(); // Revert on failure
      showToast({
        title: 'Erro ao descartar',
        description: err.message || 'Não foi possível descartar a oportunidade.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Convert an opportunity to a content idea
   */
  const handleConvertToIdea = async (
    opportunityId: string,
    data: {
      title: string;
      description: string;
      format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null;
      priority?: number;
      tags?: string[];
    }
  ) => {
    try {
      const result = await convertOpportunityToIdea(opportunityId, data);
      
      // Optimistic update
      setOpportunities(prev => prev.map(o => o.id === opportunityId ? { ...o, status: 'convertida' } : o));

      showToast({
        title: 'Ideia criada com sucesso!',
        description: 'Oportunidade convertida e salva no Banco de Ideias com rastreabilidade da origem.',
      });

      return result;
    } catch (err: any) {
      console.error('Error converting opportunity:', err);
      showToast({
        title: 'Erro ao criar ideia',
        description: err.message || 'Não foi possível converter a oportunidade.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  /**
   * Mark an opportunity as viewed
   */
  const handleMarkAsViewed = async (id: string) => {
    const opp = opportunities.find(o => o.id === id);
    if (opp && opp.status === 'nova') {
      setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: 'vista' } : o));
      await updateOpportunityStatus(id, 'vista');
    }
  };

  return {
    opportunities,
    activeOpportunities,
    topOpportunities,
    historyOpportunities,
    isLoading,
    isGenerating,
    error,
    toastMessage,
    clearToast: () => setToastMessage(null),
    refreshOpportunities: loadOpportunities,
    generateOpportunities: handleGenerate,
    dismissOpportunity: handleDismiss,
    convertToIdea: handleConvertToIdea,
    markAsViewed: handleMarkAsViewed,
  };
}
