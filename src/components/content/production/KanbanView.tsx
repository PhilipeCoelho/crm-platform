import React from 'react';
import { 
  Video, 
  Layers, 
  FileText, 
  Radio, 
  ArrowRight,
  Calendar
} from 'lucide-react';
import { ContentIdea, ExecutionStage } from '@/services/contentService';

interface KanbanViewProps {
  columns: Record<ExecutionStage, ContentIdea[]>;
  onOpenWorkspace: (idea: ContentIdea) => void;
  onAdvanceStage: (idea: ContentIdea) => void;
}

interface ColumnConfig {
  stage: ExecutionStage;
  title: string;
  description: string;
  badgeClass: string;
  borderClass: string;
  dotColor: string;
}

const KANBAN_STAGES: ColumnConfig[] = [
  {
    stage: 'producao',
    title: 'Produção',
    description: 'Roteirização e estrutura',
    badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    borderClass: 'border-amber-500/30',
    dotColor: 'bg-amber-400',
  },
  {
    stage: 'gravado',
    title: 'Gravado',
    description: 'Pronto para edição / publicação',
    badgeClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    borderClass: 'border-purple-500/30',
    dotColor: 'bg-purple-400',
  },
  {
    stage: 'publicado',
    title: 'Publicado',
    description: 'No ar nas redes',
    badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    borderClass: 'border-blue-500/30',
    dotColor: 'bg-blue-400',
  },
  {
    stage: 'aguardando_metricas',
    title: 'Aguardando Métricas',
    description: 'Janela de 24h a 72h',
    badgeClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    borderClass: 'border-orange-500/30',
    dotColor: 'bg-orange-400',
  },
  {
    stage: 'analisado',
    title: 'Analisado',
    description: 'Ciclo completo com métricas',
    badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    borderClass: 'border-emerald-500/30',
    dotColor: 'bg-emerald-400',
  },
];

export const KanbanView: React.FC<KanbanViewProps> = ({
  columns,
  onOpenWorkspace,
  onAdvanceStage,
}) => {
  const getFormatBadge = (format?: string | null) => {
    switch (format) {
      case 'reel':
        return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20"><Video className="w-3 h-3" /> Reel</span>;
      case 'carrossel':
        return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Layers className="w-3 h-3" /> Carrossel</span>;
      case 'story':
        return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"><Radio className="w-3 h-3" /> Story</span>;
      case 'artigo':
      case 'post':
        return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><FileText className="w-3 h-3" /> Post</span>;
      default:
        return null;
    }
  };

  const getActionLabel = (stage: ExecutionStage) => {
    switch (stage) {
      case 'producao':
        return 'Gravar';
      case 'gravado':
        return 'Publicar';
      case 'publicado':
        return 'Coletar';
      case 'aguardando_metricas':
        return 'Métricas';
      default:
        return 'Ver';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start overflow-x-auto pb-6">
      {KANBAN_STAGES.map((col) => {
        const items = columns[col.stage] || [];
        return (
          <div
            key={col.stage}
            className="flex flex-col rounded-2xl bg-zinc-900/50 border border-zinc-800/80 min-h-[450px] p-3 shadow-sm"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <span className="font-bold text-xs uppercase tracking-wider text-zinc-200 truncate">
                  {col.title}
                </span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${col.badgeClass}`}>
                {items.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[70vh] pr-0.5">
              {items.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-600">
                  Nenhum item nesta etapa
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 p-3 shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        {getFormatBadge(item.format) || (
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                            Conteúdo
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-500 font-medium">
                          P{item.priority}
                        </span>
                      </div>

                      <h4
                        onClick={() => onOpenWorkspace(item)}
                        className="text-xs font-semibold text-zinc-100 hover:text-amber-400 cursor-pointer line-clamp-2 leading-snug mb-2 transition-colors"
                        title="Abrir workspace de produção"
                      >
                        {item.title}
                      </h4>

                      {item.nextAction && col.stage !== 'analisado' && (
                        <div className="text-[11px] text-zinc-400 mb-2 truncate flex items-center gap-1">
                          <span className="text-zinc-600">Ação:</span>
                          <span className="text-zinc-300 font-medium truncate">{item.nextAction}</span>
                        </div>
                      )}

                      {item.publishedAt && (
                        <div className="text-[10px] text-zinc-500 mb-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-600" />
                          <span>{new Date(item.publishedAt).toLocaleDateString('pt-BR')}</span>
                          {item.platform && <span className="capitalize font-semibold text-zinc-400">· {item.platform}</span>}
                        </div>
                      )}

                      {col.stage === 'analisado' && item.metrics && (
                        <div className="flex flex-wrap gap-1.5 text-[10px] text-zinc-400 mb-2">
                          {item.metrics.views !== undefined && (
                            <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                              👁 {item.metrics.views.toLocaleString('pt-BR')}
                            </span>
                          )}
                          {item.metrics.leads !== undefined && item.metrics.leads > 0 && (
                            <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-semibold border border-emerald-500/20">
                              🎯 {item.metrics.leads} leads
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-2 border-t border-zinc-800/60 mt-1">
                      <button
                        onClick={() => onOpenWorkspace(item)}
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 font-medium transition-colors"
                      >
                        Editar
                      </button>

                      {col.stage !== 'analisado' && (
                        <button
                          onClick={() => onAdvanceStage(item)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors border border-zinc-700"
                        >
                          <span>{getActionLabel(col.stage)}</span>
                          <ArrowRight className="w-3 h-3 text-amber-400" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
