import React, { useState } from 'react';
import { 
  X, 
  Brain, 
  Sparkles, 
  TrendingUp, 
  Lightbulb, 
  Plus, 
  Check, 
  Loader2,
  BookmarkCheck
} from 'lucide-react';
import { 
  ContentIdea, 
  ContentPerformanceAnalysis, 
  SuggestedLearning 
} from '@/services/contentService';
import { createLearning } from '@/services/contentPerformanceService';
import { PerformanceMetricCard } from './PerformanceMetricCard';
import { calculateDerivedMetrics, calculateHistoricalComparison } from '@/services/contentMetricsCalculation';

interface PerformanceAnalysisModalProps {
  idea: ContentIdea | null;
  analysis: ContentPerformanceAnalysis | null;
  isOpen: boolean;
  onClose: () => void;
  allPublishedIdeas: ContentIdea[];
  onReanalyze?: (ideaId: string) => Promise<void>;
  isAnalyzing?: boolean;
}

export const PerformanceAnalysisModal: React.FC<PerformanceAnalysisModalProps> = ({
  idea,
  analysis,
  isOpen,
  onClose,
  allPublishedIdeas,
  onReanalyze,
  isAnalyzing = false,
}) => {
  const [savedLearningIndexes, setSavedLearningIndexes] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  if (!isOpen || !idea) return null;

  const derived = calculateDerivedMetrics(idea.metrics);
  const comparison = calculateHistoricalComparison(idea, allPublishedIdeas);
  const analysisData = analysis?.analysis;

  const handleSaveLearning = async (sl: SuggestedLearning, idx: number) => {
    try {
      setSavingIndex(idx);
      await createLearning({
        sourceContentId: idea.id,
        learning: sl.learning,
        type: sl.type,
        evidence: sl.evidence || null,
        confidence: sl.confidence,
        application: sl.application || null,
        status: 'suggested',
      });
      setSavedLearningIndexes(prev => new Set(prev).add(idx));
    } catch (err) {
      console.error('Error saving suggested learning:', err);
    } finally {
      setSavingIndex(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Análise de Performance & Diagnóstico
              </h3>
              <p className="text-xs text-zinc-400">
                {idea.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onReanalyze && (
              <button
                type="button"
                onClick={() => onReanalyze(idea.id)}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 font-semibold text-xs border border-blue-500/30 transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isAnalyzing ? 'Analisando...' : 'Reanalisar com IA'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Métricas e Comparação */}
          <div className="p-4 bg-zinc-950/40 border border-zinc-800/80 rounded-2xl space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Desempenho Bruto & Histórico
            </h4>
            <PerformanceMetricCard
              metrics={idea.metrics}
              derived={derived}
              comparison={comparison}
            />
          </div>

          {/* Análise da IA */}
          {analysisData ? (
            <div className="space-y-5">
              {/* Resumo Executivo */}
              {analysisData.summary && (
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-blue-400 mb-1">
                    <Brain size={13} />
                    <span>Diagnóstico da IA</span>
                  </div>
                  {analysisData.summary}
                </div>
              )}

              {/* Observações & Hipóteses Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Observações */}
                {analysisData.observations && analysisData.observations.length > 0 && (
                  <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/80 space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <TrendingUp size={13} className="text-emerald-400" />
                      <span>Observações Baseadas em Dados</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs text-zinc-400">
                      {analysisData.observations.map((obs, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-zinc-600 mt-1">•</span>
                          <span>{obs}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Hipóteses */}
                {analysisData.hypotheses && analysisData.hypotheses.length > 0 && (
                  <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/80 space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-purple-400" />
                      <span>Hipóteses Levantadas</span>
                    </h5>
                    <ul className="space-y-1.5 text-xs text-zinc-400">
                      {analysisData.hypotheses.map((hyp, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-purple-500/60 mt-1">•</span>
                          <span>{hyp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Recomendações Práticas */}
              {analysisData.recommendations && analysisData.recommendations.length > 0 && (
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/80 space-y-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Lightbulb size={13} />
                    <span>O Que Testar nos Próximos Conteúdos</span>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {analysisData.recommendations.map((rec, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aprendizados Sugeridos */}
              {analysisData.suggestedLearnings && analysisData.suggestedLearnings.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <BookmarkCheck size={14} className="text-blue-400" />
                    <span>Aprendizados Sugeridos para o Seu Banco</span>
                  </h5>
                  <div className="space-y-2.5">
                    {analysisData.suggestedLearnings.map((sl, idx) => {
                      const isSaved = savedLearningIndexes.has(idx);
                      const isSaving = savingIndex === idx;

                      return (
                        <div key={idx} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start justify-between gap-4">
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                                {sl.type}
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                Confiança: <strong>{sl.confidence === 'high' ? 'Alta' : sl.confidence === 'medium' ? 'Média' : 'Baixa'}</strong>
                              </span>
                            </div>
                            <p className="font-semibold text-zinc-200">
                              "{sl.learning}"
                            </p>
                            {sl.application && (
                              <p className="text-zinc-400 text-[11px]">
                                <strong>Aplicação:</strong> {sl.application}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSaveLearning(sl, idx)}
                            disabled={isSaved || isSaving}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                              isSaved
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                            }`}
                          >
                            {isSaving ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : isSaved ? (
                              <>
                                <Check size={12} />
                                <span>Salvo</span>
                              </>
                            ) : (
                              <>
                                <Plus size={12} />
                                <span>Salvar como Aprendizado</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center bg-zinc-950/30 border border-dashed border-zinc-800 rounded-2xl space-y-3">
              <Brain size={32} className="text-zinc-600 mx-auto" />
              <h4 className="font-bold text-zinc-200 text-sm">Este conteúdo ainda não possui análise de IA</h4>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Execute a análise para que a IA compare este desempenho com o seu histórico e extraia hipóteses e aprendizados práticos.
              </p>
              {onReanalyze && (
                <button
                  type="button"
                  onClick={() => onReanalyze(idea.id)}
                  disabled={isAnalyzing}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors inline-flex items-center gap-1.5 shadow-sm"
                >
                  {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>{isAnalyzing ? 'Analisando...' : 'Analisar desempenho agora'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
