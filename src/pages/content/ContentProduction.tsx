import { 
  Flame, 
  Layers, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2
} from 'lucide-react';
import { useContentProduction } from '@/hooks/content/useContentProduction';
import { ExecutionQueueView } from '@/components/content/production/ExecutionQueueView';
import { KanbanView } from '@/components/content/production/KanbanView';
import { ProductionWorkspaceModal } from '@/components/content/production/ProductionWorkspaceModal';
import { PublishModal } from '@/components/content/production/PublishModal';
import { MetricsModal } from '@/components/content/production/MetricsModal';

export default function ContentProduction() {
  const {
    items,
    loading,
    error,
    activeTab,
    setActiveTab,
    currentFocus,
    nextItems,
    wipCount,
    isWipOverloaded,
    kanbanColumns,
    metrics,
    // Modals state
    selectedWorkspaceIdea,
    setSelectedWorkspaceIdea,
    selectedPublishIdea,
    setSelectedPublishIdea,
    selectedMetricsIdea,
    setSelectedMetricsIdea,
    // Operations
    loadData,
    advanceStage,
    saveWorkspace,
    handlePublish,
    handleRecordMetrics,
  } = useContentProduction();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Produção & Execução
            </h1>
          </div>
          <p className="text-sm text-zinc-400">
            A ponte direta entre <strong className="text-zinc-300">saber o que produzir</strong> e{' '}
            <strong className="text-amber-400">produzir agora</strong>.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* WIP badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              isWipOverloaded
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800'
            }`}
            title="Work In Progress: máximo recomendado de 3 conteúdos simultâneos em produção"
          >
            <span>WIP:</span>
            <strong className={isWipOverloaded ? 'text-amber-400 font-bold' : 'text-zinc-100'}>
              {wipCount}/3
            </strong>
          </div>

          {/* Published / Analyzed counter */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-zinc-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              <strong className="text-zinc-200">{metrics.published + metrics.analyzed}</strong> concluídos
            </span>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors disabled:opacity-50"
            title="Recarregar fila"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* View Mode Switcher */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'queue'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Fila de Execução</span>
            </button>
            <button
              onClick={() => setActiveTab('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'kanban'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && items.length === 0 ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-44 bg-zinc-900/60 rounded-2xl border border-zinc-800" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-32 bg-zinc-900/40 rounded-xl border border-zinc-800" />
            <div className="h-32 bg-zinc-900/40 rounded-xl border border-zinc-800" />
          </div>
        </div>
      ) : activeTab === 'queue' ? (
        <ExecutionQueueView
          currentFocus={currentFocus}
          nextItems={nextItems}
          wipCount={wipCount}
          isWipOverloaded={isWipOverloaded}
          onOpenWorkspace={(idea) => setSelectedWorkspaceIdea(idea)}
          onAdvanceStage={advanceStage}
        />
      ) : (
        <KanbanView
          columns={kanbanColumns}
          onOpenWorkspace={(idea) => setSelectedWorkspaceIdea(idea)}
          onAdvanceStage={advanceStage}
        />
      )}

      {/* Modals */}
      {selectedWorkspaceIdea && (
        <ProductionWorkspaceModal
          idea={selectedWorkspaceIdea}
          isOpen={true}
          onClose={() => setSelectedWorkspaceIdea(null)}
          onSave={saveWorkspace}
          onAdvanceStage={advanceStage}
        />
      )}

      {selectedPublishIdea && (
        <PublishModal
          idea={selectedPublishIdea}
          isOpen={true}
          onClose={() => setSelectedPublishIdea(null)}
          onPublish={handlePublish}
        />
      )}

      {selectedMetricsIdea && (
        <MetricsModal
          idea={selectedMetricsIdea}
          isOpen={true}
          onClose={() => setSelectedMetricsIdea(null)}
          onRecordMetrics={handleRecordMetrics}
        />
      )}
    </div>
  );
}
