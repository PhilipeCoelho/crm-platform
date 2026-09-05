import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ContentIdea, 
  ExecutionStage 
} from '@/services/contentService';
import { 
  fetchProductionItems, 
  updateExecutionStage, 
  updateProductionWorkspace, 
  markAsPublished, 
  recordMetrics, 
  WorkspaceData, 
  PublishData 
} from '@/services/contentProductionService';
import { ContentMetricsData } from '@/services/contentService';

export function useContentProduction() {
  const [items, setItems] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'kanban'>('queue');

  // Modals state
  const [selectedWorkspaceIdea, setSelectedWorkspaceIdea] = useState<ContentIdea | null>(null);
  const [selectedPublishIdea, setSelectedPublishIdea] = useState<ContentIdea | null>(null);
  const [selectedMetricsIdea, setSelectedMetricsIdea] = useState<ContentIdea | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProductionItems();
      setItems(data);
    } catch (err: any) {
      console.error('Error in useContentProduction loadData:', err);
      setError(err?.message || 'Erro ao carregar fila de execução');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived Queue
  const { currentFocus, nextItems, wipCount, kanbanColumns, metrics } = useMemo(() => {
    // 1. Kanban Columns
    const cols: Record<ExecutionStage, ContentIdea[]> = {
      producao: [],
      gravado: [],
      publicado: [],
      aguardando_metricas: [],
      analisado: []
    };

    items.forEach(item => {
      if (item.executionStage && cols[item.executionStage]) {
        cols[item.executionStage].push(item);
      }
    });

    // 2. Active items awaiting operator execution (producao or gravado)
    const active = items.filter(i => i.executionStage === 'producao' || i.executionStage === 'gravado');
    active.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.executionStage === 'producao' && b.executionStage !== 'producao') return -1;
      if (a.executionStage !== 'producao' && b.executionStage === 'producao') return 1;
      return new Date(b.stageUpdatedAt || b.updatedAt).getTime() - new Date(a.stageUpdatedAt || a.updatedAt).getTime();
    });

    const focus = active[0] || null;
    const next = active.slice(1, 5);
    const wip = cols.producao.length;

    return {
      currentFocus: focus,
      nextItems: next,
      wipCount: wip,
      kanbanColumns: cols,
      metrics: {
        inProduction: cols.producao.length,
        recorded: cols.gravado.length,
        published: cols.publicado.length,
        waitingMetrics: cols.aguardando_metricas.length,
        analyzed: cols.analisado.length,
        totalActive: active.length,
      }
    };
  }, [items]);

  // Actions
  const moveToStage = useCallback(async (ideaId: string, stage: ExecutionStage, extraData?: Partial<ContentIdea>) => {
    // Optimistic update
    const previousItems = [...items];
    setItems(prev => prev.map(i => {
      if (i.id === ideaId) {
        return {
          ...i,
          executionStage: stage,
          stageUpdatedAt: new Date().toISOString(),
          ...extraData
        };
      }
      return i;
    }));

    try {
      const ok = await updateExecutionStage(ideaId, stage, extraData);
      if (!ok) {
        setItems(previousItems);
        throw new Error('Falha ao atualizar etapa operacional');
      }
    } catch (err: any) {
      setItems(previousItems);
      throw err;
    }
  }, [items]);

  const advanceStage = useCallback((idea: ContentIdea) => {
    switch (idea.executionStage) {
      case 'producao':
        return moveToStage(idea.id, 'gravado', { nextAction: 'Editar e publicar' });
      case 'gravado':
        setSelectedPublishIdea(idea);
        break;
      case 'publicado':
        return moveToStage(idea.id, 'aguardando_metricas', { nextAction: 'Registrar métricas' });
      case 'aguardando_metricas':
        setSelectedMetricsIdea(idea);
        break;
      case 'analisado':
        // Already at final stage
        break;
      default:
        return moveToStage(idea.id, 'producao', { nextAction: 'Estruturar roteiro' });
    }
  }, [moveToStage]);

  const saveWorkspace = useCallback(async (ideaId: string, data: WorkspaceData) => {
    // Optimistic update
    setItems(prev => prev.map(i => {
      if (i.id === ideaId) {
        return {
          ...i,
          title: data.title !== undefined ? data.title : i.title,
          hook: data.hook !== undefined ? data.hook : i.hook,
          angle: data.angle !== undefined ? data.angle : i.angle,
          bodyScript: data.bodyScript !== undefined ? data.bodyScript : i.bodyScript,
          cta: data.cta !== undefined ? data.cta : i.cta,
          notes: data.notes !== undefined ? data.notes : i.notes,
          nextAction: data.nextAction !== undefined ? data.nextAction : i.nextAction,
          format: data.format !== undefined ? data.format : i.format,
          priority: data.priority !== undefined ? data.priority : i.priority,
          updatedAt: new Date().toISOString()
        };
      }
      return i;
    }));

    const ok = await updateProductionWorkspace(ideaId, data);
    if (!ok) {
      loadData();
      throw new Error('Não foi possível salvar os dados do workspace');
    }
  }, [loadData]);

  const handlePublish = useCallback(async (ideaId: string, data: PublishData) => {
    const ok = await markAsPublished(ideaId, data);
    if (ok) {
      setSelectedPublishIdea(null);
      loadData();
    } else {
      throw new Error('Erro ao registrar publicação');
    }
  }, [loadData]);

  const handleRecordMetrics = useCallback(async (ideaId: string, metricsData: ContentMetricsData) => {
    const ok = await recordMetrics(ideaId, metricsData);
    if (ok) {
      setSelectedMetricsIdea(null);
      loadData();
    } else {
      throw new Error('Erro ao registrar métricas');
    }
  }, [loadData]);

  return {
    items,
    loading,
    error,
    activeTab,
    setActiveTab,
    currentFocus,
    nextItems,
    wipCount,
    isWipOverloaded: wipCount >= 3,
    kanbanColumns,
    metrics,
    // Modals
    selectedWorkspaceIdea,
    setSelectedWorkspaceIdea,
    selectedPublishIdea,
    setSelectedPublishIdea,
    selectedMetricsIdea,
    setSelectedMetricsIdea,
    // Operations
    loadData,
    moveToStage,
    advanceStage,
    saveWorkspace,
    handlePublish,
    handleRecordMetrics,
  };
}
