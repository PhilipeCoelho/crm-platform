import React from 'react';
import { 
  Flame, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  FileEdit, 
  Sparkles, 
  AlertTriangle,
  Video,
  Layers,
  FileText,
  Radio
} from 'lucide-react';
import { ContentIdea } from '@/services/contentService';
import { Link } from 'react-router-dom';

interface ExecutionQueueViewProps {
  currentFocus: ContentIdea | null;
  nextItems: ContentIdea[];
  wipCount: number;
  isWipOverloaded: boolean;
  onOpenWorkspace: (idea: ContentIdea) => void;
  onAdvanceStage: (idea: ContentIdea) => void;
}

export const ExecutionQueueView: React.FC<ExecutionQueueViewProps> = ({
  currentFocus,
  nextItems,
  wipCount,
  isWipOverloaded,
  onOpenWorkspace,
  onAdvanceStage,
}) => {
  const getFormatBadge = (format?: string | null) => {
    switch (format) {
      case 'reel':
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20"><Video className="w-3 h-3" /> Reel / Vídeo</span>;
      case 'carrossel':
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Layers className="w-3 h-3" /> Carrossel</span>;
      case 'story':
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><Radio className="w-3 h-3" /> Story</span>;
      case 'artigo':
      case 'post':
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><FileText className="w-3 h-3" /> Post / Artigo</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">Conteúdo</span>;
    }
  };

  const getStageBadge = (stage?: string | null) => {
    switch (stage) {
      case 'producao':
        return <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Em Produção</span>;
      case 'gravado':
        return <span className="text-xs font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">Gravado</span>;
      default:
        return null;
    }
  };

  const getAdvanceButtonLabel = (stage?: string | null) => {
    if (stage === 'producao') return 'Marcar como Gravado';
    if (stage === 'gravado') return 'Registrar Publicação';
    return 'Avançar Etapa';
  };

  return (
    <div className="space-y-6">
      {/* Anti-accumulation warning banner if WIP >= 3 */}
      {isWipOverloaded && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <div className="text-sm">
              <span className="font-semibold">Atenção ao WIP:</span> Você tem{' '}
              <span className="font-bold underline">{wipCount} conteúdos</span> simultâneos em produção. O princípio do Vamus é{' '}
              <strong>"Menos pensar no que produzir. Mais produzir."</strong> Evite acumular rascunhos sem gravar ou publicar.
            </div>
          </div>
        </div>
      )}

      {/* Empty State if no active items */}
      {!currentFocus && nextItems.length === 0 && (
        <div className="text-center py-16 px-4 bg-zinc-900/50 rounded-2xl border border-zinc-800/80">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Flame className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-100 mb-1">
            Fila de Execução Vazia
          </h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
            Nenhum conteúdo está sendo executado no momento. Escolha uma oportunidade quente ou envie uma ideia para a produção.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/content/opportunities"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Ver Oportunidades
            </Link>
            <Link
              to="/content/ideas"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-sm transition-colors border border-zinc-700"
            >
              Banco de Ideias
            </Link>
          </div>
        </div>
      )}

      {/* AGORA (Card Principal de Foco) */}
      {currentFocus && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-900/90 via-zinc-900/60 to-zinc-950/80 p-6 shadow-xl backdrop-blur-sm">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500" />
          
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold tracking-wider bg-amber-500 text-zinc-950 shadow-md">
                <Flame className="w-3.5 h-3.5 fill-zinc-950" />
                FOCO AGORA
              </span>
              {getStageBadge(currentFocus.executionStage)}
              {getFormatBadge(currentFocus.format)}
            </div>

            {currentFocus.nextAction && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-700/60">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Próxima ação: <strong className="text-zinc-200">{currentFocus.nextAction}</strong></span>
              </div>
            )}
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-zinc-100 mb-2 leading-tight">
            {currentFocus.title}
          </h2>

          {currentFocus.description && (
            <p className="text-sm text-zinc-400 mb-5 leading-relaxed line-clamp-3">
              {currentFocus.description}
            </p>
          )}

          {/* Quick Preview of structured components if available */}
          {(currentFocus.hook || currentFocus.angle) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs">
              {currentFocus.hook && (
                <div>
                  <span className="text-zinc-500 font-medium block mb-1">🪝 Gancho (Hook):</span>
                  <p className="text-zinc-200 font-medium italic">"{currentFocus.hook}"</p>
                </div>
              )}
              {currentFocus.angle && (
                <div>
                  <span className="text-zinc-500 font-medium block mb-1">🎯 Ângulo Central:</span>
                  <p className="text-zinc-300">{currentFocus.angle}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-800/60">
            <div className="text-xs text-zinc-500">
              Prioridade: <strong className="text-zinc-300">P{currentFocus.priority}</strong>
              {currentFocus.sourceType && (
                <span className="ml-3">
                  Origem: <strong className="text-zinc-400 capitalize">{currentFocus.sourceType}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onOpenWorkspace(currentFocus)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-sm transition-colors border border-zinc-700 hover:border-zinc-600"
              >
                <FileEdit className="w-4 h-4 text-amber-400" />
                Abrir Workspace
              </button>
              <button
                onClick={() => onAdvanceStage(currentFocus)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-colors shadow-lg shadow-amber-500/10"
              >
                <CheckCircle2 className="w-4 h-4" />
                {getAdvanceButtonLabel(currentFocus.executionStage)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRÓXIMOS NA FILA */}
      {nextItems.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-500" />
              Próximos na Fila ({nextItems.length})
            </h3>
            <span className="text-xs text-zinc-500">
              Ordem calculada por prioridade e prontidão
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {nextItems.map((item, idx) => (
              <div 
                key={item.id}
                className="group relative flex flex-col justify-between p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/90 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-500 bg-zinc-800/70 w-5 h-5 rounded-full flex items-center justify-center">
                        {idx + 2}
                      </span>
                      {getFormatBadge(item.format)}
                      {getStageBadge(item.executionStage)}
                    </div>
                    <span className="text-xs text-zinc-500 font-medium">P{item.priority}</span>
                  </div>

                  <h4 className="text-sm font-bold text-zinc-200 mb-1 line-clamp-2 group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </h4>

                  {item.nextAction && (
                    <div className="text-xs text-zinc-400 mb-3 flex items-center gap-1.5">
                      <span className="text-zinc-600">Ação:</span>
                      <span className="text-zinc-300 font-medium truncate">{item.nextAction}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/50 mt-2">
                  <button
                    onClick={() => onOpenWorkspace(item)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    Workspace
                  </button>
                  <button
                    onClick={() => onAdvanceStage(item)}
                    className="p-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700"
                  >
                    <span>Avançar</span>
                    <ArrowRight className="w-3 h-3 text-amber-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
