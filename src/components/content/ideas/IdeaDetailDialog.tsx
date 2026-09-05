import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { ContentIdea, ContentPerformanceAnalysis, ContentLearning } from '@/services/contentService';
import { 
  CalendarDays, 
  Brain, 
  Sparkles, 
  Star, 
  Edit3, 
  Clock,
  ArrowRight,
  Flame,
  TrendingUp,
  BookmarkCheck
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { sendIdeaToProduction } from '@/services/contentProductionService';
import { fetchPerformanceAnalysis, fetchLearnings, analyzePerformanceWithAI } from '@/services/contentPerformanceService';
import { PerformanceMetricCard } from '@/components/content/performance/PerformanceMetricCard';
import { PerformanceAnalysisModal } from '@/components/content/performance/PerformanceAnalysisModal';
import { calculateDerivedMetrics } from '@/services/contentMetricsCalculation';

interface IdeaDetailDialogProps {
  idea: ContentIdea | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (idea: ContentIdea) => void;
}

export default function IdeaDetailDialog({
  idea,
  isOpen,
  onClose,
  onEdit,
}: IdeaDetailDialogProps) {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<ContentPerformanceAnalysis | null>(null);
  const [learnings, setLearnings] = useState<ContentLearning[]>([]);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (idea && isOpen) {
      // Fetch performance analysis
      fetchPerformanceAnalysis(idea.id).then(setAnalysis).catch(() => setAnalysis(null));
      // Fetch associated learnings
      fetchLearnings().then(all => {
        setLearnings(all.filter(l => l.sourceContentId === idea.id));
      }).catch(() => setLearnings([]));
    } else {
      setAnalysis(null);
      setLearnings([]);
    }
  }, [idea, isOpen]);

  const handleAnalyze = async (ideaId: string) => {
    setIsAnalyzing(true);
    try {
      const res = await analyzePerformanceWithAI(ideaId);
      setAnalysis(res);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!idea) return null;

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 5: return '5 — Prioridade Máxima';
      case 4: return '4 — Alta';
      case 3: return '3 — Relevante';
      case 2: return '2 — Normal';
      default: return '1 — Baixa';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'validada': return 'Validada (Pronta para Produção)';
      case 'em_producao': return 'Em Produção';
      case 'descartada': return 'Descartada';
      default: return 'Capturada (Em análise)';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {getStatusLabel(idea.status)}
            </span>
            {idea.format && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
                {idea.format}
              </span>
            )}
          </div>
          <DialogTitle className="text-lg font-bold text-foreground leading-snug pt-1">
            {idea.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          {/* Descrição */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Contexto e Descrição
            </h4>
            {idea.description ? (
              <p className="text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-3 rounded-xl border border-border/60">
                {idea.description}
              </p>
            ) : (
              <p className="text-muted-foreground italic text-xs">
                Nenhuma descrição registrada para esta ideia.
              </p>
            )}
          </div>

          {/* Origem e Rastreabilidade */}
          <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Origem da Ideia
            </h4>
            {idea.sourceType === 'daily' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <CalendarDays size={14} />
                  <span>Originada a partir de uma anotação do <strong>Daily</strong></span>
                </div>
                <Link
                  to="/content/today"
                  onClick={onClose}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <span>Abrir Daily</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            )}
            {idea.sourceType === 'crm_signal' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  <Brain size={14} />
                  <span>Originada de um sinal da <strong>Inteligência Comercial</strong></span>
                </div>
                <Link
                  to="/knowledge-base"
                  onClick={onClose}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <span>Ver na Central</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            )}
            {idea.sourceType === 'manual' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Sparkles size={14} />
                <span>Criada manualmente</span>
              </div>
            )}
          </div>

          {/* Seção DESEMPENHO (se publicado ou com métricas) */}
          {(idea.executionStage === 'publicado' || Boolean(idea.publishedAt) || (idea.metrics && Object.keys(idea.metrics).length > 0)) && (
            <div className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-blue-500" />
                  <span>Desempenho</span>
                </h4>
                {idea.publishedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    Publicado em {new Date(idea.publishedAt).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>

              {/* Métricas Compactas */}
              <PerformanceMetricCard
                metrics={idea.metrics}
                derived={calculateDerivedMetrics(idea.metrics)}
                compact={true}
              />

              {/* Status da Análise & Ações */}
              <div className="pt-2 border-t border-border/50 flex items-center justify-between flex-wrap gap-2">
                {analysis?.status === 'analyzed' ? (
                  <div className="space-y-1">
                    <p className="text-xs text-foreground font-semibold flex items-center gap-1">
                      <Brain size={12} className="text-blue-500" />
                      <span>Análise de IA concluída</span>
                    </p>
                    {analysis.analysis?.summary && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-sm">
                        {analysis.analysis.summary}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    Ainda sem análise de diagnóstico da IA.
                  </p>
                )}

                <div className="flex items-center gap-2">
                  {analysis?.status === 'analyzed' ? (
                    <button
                      type="button"
                      onClick={() => setIsAnalysisModalOpen(true)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                    >
                      Ver análise completa
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAnalyze(idea.id)}
                      disabled={isAnalyzing}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isAnalyzing ? 'Analisando...' : 'Analisar desempenho'}
                    </button>
                  )}
                </div>
              </div>

              {/* Aprendizados vinculados */}
              {learnings.length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <BookmarkCheck size={11} className="text-emerald-500" />
                    <span>Aprendizados gerados ({learnings.length})</span>
                  </span>
                  <div className="space-y-1">
                    {learnings.map(l => (
                      <div key={l.id} className="text-xs p-2 rounded-lg bg-card border border-border/60 flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground text-[11px]">"{l.learning}"</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          l.status === 'confirmed' ? 'text-emerald-500' : 'text-zinc-400'
                        }`}>
                          {l.status === 'confirmed' ? 'Confirmado' : 'Sugerido'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metadados: Prioridade e Datas */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-muted/20 border border-border/60 rounded-xl">
              <span className="text-muted-foreground block text-[11px] mb-0.5">Prioridade</span>
              <span className="font-semibold text-foreground flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Star size={13} fill="currentColor" />
                {getPriorityLabel(idea.priority || 2)}
              </span>
            </div>

            <div className="p-2.5 bg-muted/20 border border-border/60 rounded-xl">
              <span className="text-muted-foreground block text-[11px] mb-0.5">Criada em</span>
              <span className="font-medium text-foreground flex items-center gap-1">
                <Clock size={12} className="text-muted-foreground" />
                {formatDate(idea.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(idea);
            }}
            className="px-3.5 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted/60 transition-all flex items-center gap-1.5"
          >
            <Edit3 size={13} />
            <span>Editar Ideia</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!idea.executionStage) {
                await sendIdeaToProduction(idea.id);
              }
              onClose();
              navigate('/content/production');
            }}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Flame size={13} />
            <span>{idea.executionStage ? 'Ver na Produção' : 'Mover para Produção'}</span>
          </button>
        </DialogFooter>
      </DialogContent>

      <PerformanceAnalysisModal
        idea={idea}
        analysis={analysis}
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        allPublishedIdeas={[]}
        onReanalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
      />
    </Dialog>
  );
}
