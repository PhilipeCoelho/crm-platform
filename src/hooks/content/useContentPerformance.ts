import { useState, useEffect, useCallback } from 'react';
import { ContentIdea, ContentPerformanceAnalysis } from '@/services/contentService';
import { fetchContentIdeas } from '@/services/contentIdeasService';
import { 
  fetchAllPerformanceAnalyses, 
  analyzePerformanceWithAI 
} from '@/services/contentPerformanceService';

export function useContentPerformance() {
  const [publishedIdeas, setPublishedIdeas] = useState<ContentIdea[]>([]);
  const [analyses, setAnalyses] = useState<ContentPerformanceAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzingId, setIsAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ideasData, analysesData] = await Promise.all([
        fetchContentIdeas({ status: 'all' }),
        fetchAllPerformanceAnalyses(),
      ]);

      // Published ideas (stage 'publicado' or has publishedAt)
      const published = ideasData.filter(idea => 
        idea.executionStage === 'publicado' || Boolean(idea.publishedAt)
      );

      setPublishedIdeas(published);
      setAnalyses(analysesData);
    } catch (err: any) {
      console.error('Error loading performance data:', err);
      setError(err?.message || 'Erro ao carregar dados de performance');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived collections
  const analyzedIdeaIds = new Set(
    analyses
      .filter(a => a.status === 'analyzed')
      .map(a => a.contentIdeaId)
  );

  // Ideas with recorded metrics
  const ideasWithMetrics = publishedIdeas.filter(idea => 
    idea.metrics && 
    Object.keys(idea.metrics).length > 0 &&
    (idea.metrics.views || idea.metrics.reach || idea.metrics.likes || idea.metrics.leads)
  );

  // Ideas needing performance analysis (published, metrics recorded, but not analyzed yet)
  const needsAnalysis = ideasWithMetrics.filter(idea => !analyzedIdeaIds.has(idea.id));

  // Ideas that have completed performance analysis
  const analyzedIdeas = publishedIdeas.filter(idea => analyzedIdeaIds.has(idea.id));

  const analyzeContent = async (ideaId: string): Promise<ContentPerformanceAnalysis | null> => {
    setIsAnalyzingId(ideaId);
    setError(null);
    try {
      const result = await analyzePerformanceWithAI(ideaId);
      if (result) {
        setAnalyses(prev => {
          const filtered = prev.filter(a => a.contentIdeaId !== ideaId);
          return [result, ...filtered];
        });
      }
      return result;
    } catch (err: any) {
      console.error('Error analyzing content:', err);
      setError(err?.message || 'Erro ao analisar performance com IA');
      throw err;
    } finally {
      setIsAnalyzingId(null);
    }
  };

  const getAnalysisForIdea = (ideaId: string): ContentPerformanceAnalysis | null => {
    return analyses.find(a => a.contentIdeaId === ideaId) || null;
  };

  return {
    publishedIdeas,
    ideasWithMetrics,
    needsAnalysis,
    analyzedIdeas,
    analyses,
    isLoading,
    isAnalyzingId,
    error,
    analyzeContent,
    getAnalysisForIdea,
    refresh: loadData,
  };
}
