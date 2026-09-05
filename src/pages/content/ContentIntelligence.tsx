import { useState } from 'react';
import { 
  Brain, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Loader2, 
  ArrowRight,
  Lightbulb,
  ShieldCheck
} from 'lucide-react';
import { useContentPerformance } from '@/hooks/content/useContentPerformance';
import { useContentLearnings } from '@/hooks/content/useContentLearnings';
import { ContentIdea } from '@/services/contentService';
import { PerformanceMetricCard } from '@/components/content/performance/PerformanceMetricCard';
import { PerformanceAnalysisModal } from '@/components/content/performance/PerformanceAnalysisModal';
import { LearningCard } from '@/components/content/performance/LearningCard';
import { calculateDerivedMetrics } from '@/services/contentMetricsCalculation';

export default function ContentIntelligence() {
  const {
    publishedIdeas,
    needsAnalysis,
    analyzedIdeas,
    isLoading: isPerfLoading,
    isAnalyzingId,
    analyzeContent,
    getAnalysisForIdea,
  } = useContentPerformance();

  const {
    suggestedLearnings,
    confirmedLearnings,
    confirm,
    discard,
    isLoading: isLearningsLoading,
  } = useContentLearnings();

  const [selectedIdeaForModal, setSelectedIdeaForModal] = useState<ContentIdea | null>(null);
  const [learningTypeFilter, setLearningTypeFilter] = useState<string>('all');
  const [processingLearningId, setProcessingLearningId] = useState<string | null>(null);

  const handleConfirmLearning = async (id: string) => {
    setProcessingLearningId(id);
    try {
      await confirm(id);
    } finally {
      setProcessingLearningId(null);
    }
  };

  const handleDiscardLearning = async (id: string) => {
    setProcessingLearningId(id);
    try {
      await discard(id);
    } finally {
      setProcessingLearningId(null);
    }
  };

  const handleAnalyzeFromList = async (ideaId: string) => {
    try {
      const res = await analyzeContent(ideaId);
      if (res) {
        const idea = publishedIdeas.find(i => i.id === ideaId);
        if (idea) setSelectedIdeaForModal(idea);
      }
    } catch (err) {
      // Error handled inside hook
    }
  };

  const filteredConfirmedLearnings = learningTypeFilter === 'all'
    ? confirmedLearnings
    : confirmedLearnings.filter(l => l.type === learningTypeFilter);

  const isLoading = isPerfLoading || isLearningsLoading;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8">
      {/* 1. Header do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Brain className="text-primary w-6 h-6" />
            <span>Inteligência de Performance & Aprendizados</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Transforme métricas de conteúdos publicados em aprendizados aplicáveis para seus próximos roteiros.
          </p>
        </div>

        {/* Contadores Rápidos de Decisão */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="px-3 py-1.5 rounded-xl bg-card border border-border text-center shadow-sm">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Publicados</span>
            <span className="text-sm font-extrabold text-foreground">{publishedIdeas.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-card border border-border text-center shadow-sm">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Analisados</span>
            <span className="text-sm font-extrabold text-blue-500">{analyzedIdeas.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-card border border-border text-center shadow-sm">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Aprendizados</span>
            <span className="text-sm font-extrabold text-emerald-500">{confirmedLearnings.length}</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-24 bg-card border border-border rounded-2xl animate-pulse" />
          <div className="h-48 bg-card border border-border rounded-2xl animate-pulse" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* SEÇÃO 1: PRECISA DE ANÁLISE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-amber-500" />
                <span>Precisa de Análise ({needsAnalysis.length})</span>
              </h2>
              <span className="text-xs text-muted-foreground">
                Conteúdos publicados com métricas registradas aguardando diagnóstico da IA
              </span>
            </div>

            {needsAnalysis.length === 0 ? (
              <div className="p-5 rounded-2xl bg-card/40 border border-dashed border-border text-center text-xs text-muted-foreground">
                <CheckCircle2 size={20} className="text-emerald-500 mx-auto mb-1.5" />
                <p className="font-semibold text-foreground">Tudo em dia!</p>
                <p className="mt-0.5">Todos os conteúdos com métricas cadastradas já foram analisados pela IA.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {needsAnalysis.map(idea => {
                  const isAnalyzing = isAnalyzingId === idea.id;
                  const derived = calculateDerivedMetrics(idea.metrics);

                  return (
                    <div key={idea.id} className="p-4 bg-card border border-border rounded-2xl space-y-3 flex flex-col justify-between shadow-sm">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            {idea.platform || 'Publicado'}
                          </span>
                          {idea.publishedAt && (
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(idea.publishedAt).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-sm text-foreground leading-snug">
                          {idea.title}
                        </h3>

                        <PerformanceMetricCard
                          metrics={idea.metrics}
                          derived={derived}
                          compact={true}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAnalyzeFromList(idea.id)}
                        disabled={isAnalyzing}
                        className="w-full py-2 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        <span>{isAnalyzing ? 'Diagnosticando com IA...' : 'Analisar desempenho'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SEÇÃO 2: ÚLTIMOS APRENDIZADOS SUGERIDOS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={16} className="text-blue-500" />
                <span>Aprendizados Sugeridos ({suggestedLearnings.length})</span>
              </h2>
              <span className="text-xs text-muted-foreground">
                A IA sugere. O Phil decide se o aprendizado é válido para futuros conteúdos.
              </span>
            </div>

            {suggestedLearnings.length === 0 ? (
              <div className="p-5 rounded-2xl bg-card/40 border border-dashed border-border text-center text-xs text-muted-foreground">
                <Brain size={20} className="text-blue-400 mx-auto mb-1.5" />
                <p className="font-semibold text-foreground">Nenhuma sugestão pendente</p>
                <p className="mt-0.5">Analise conteúdos publicados para descobrir novas hipóteses e aprendizados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestedLearnings.map(l => (
                  <LearningCard
                    key={l.id}
                    learning={l}
                    onConfirm={handleConfirmLearning}
                    onDiscard={handleDiscardLearning}
                    isProcessing={processingLearningId === l.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* SEÇÃO 3: O QUE ESTAMOS APRENDENDO (CONFIRMADO) */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-500" />
                  <span>O Que Estamos Aprendendo ({confirmedLearnings.length})</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Princípios confirmados baseados no seu próprio histórico para orientar a criação.
                </p>
              </div>

              {/* Filtro por Tipo de Aprendizado */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { value: 'all', label: 'Todos' },
                  { value: 'hook', label: 'Hooks' },
                  { value: 'angle', label: 'Ângulos' },
                  { value: 'format', label: 'Formatos' },
                  { value: 'cta', label: 'CTAs' },
                  { value: 'topic', label: 'Temas' },
                ].map(tab => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setLearningTypeFilter(tab.value)}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                      learningTypeFilter === tab.value
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredConfirmedLearnings.length === 0 ? (
              <div className="p-6 rounded-2xl bg-card/40 border border-dashed border-border text-center text-xs text-muted-foreground">
                <Lightbulb size={24} className="text-amber-500 mx-auto mb-2" />
                <p className="font-semibold text-foreground text-sm">Ainda não há aprendizados confirmados nesta categoria</p>
                <p className="max-w-md mx-auto mt-1">
                  Confirme as sugestões da IA ou registre aprendizados práticos a partir das suas publicações.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredConfirmedLearnings.map(l => (
                  <LearningCard
                    key={l.id}
                    learning={l}
                  />
                ))}
              </div>
            )}
          </div>

          {/* SEÇÃO 4: HISTÓRICO DE CONTEÚDOS ANALISADOS */}
          {analyzedIdeas.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={16} className="text-zinc-400" />
                <span>Conteúdos Analisados ({analyzedIdeas.length})</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {analyzedIdeas.map(idea => {
                  const analysis = getAnalysisForIdea(idea.id);

                  return (
                    <div
                      key={idea.id}
                      onClick={() => setSelectedIdeaForModal(idea)}
                      className="p-3.5 bg-card border border-border rounded-xl hover:border-primary/40 cursor-pointer transition-all space-y-2 group shadow-sm"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">{idea.platform || 'Publicação'}</span>
                        {idea.publishedAt && <span>{new Date(idea.publishedAt).toLocaleDateString('pt-BR')}</span>}
                      </div>
                      <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {idea.title}
                      </h4>
                      {analysis?.analysis?.summary && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {analysis.analysis.summary}
                        </p>
                      )}
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-primary font-medium">
                        <span>Ver diagnóstico completo</span>
                        <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Análise Detalhada */}
      {selectedIdeaForModal && (
        <PerformanceAnalysisModal
          idea={selectedIdeaForModal}
          analysis={getAnalysisForIdea(selectedIdeaForModal.id)}
          isOpen={Boolean(selectedIdeaForModal)}
          onClose={() => setSelectedIdeaForModal(null)}
          allPublishedIdeas={publishedIdeas}
          onReanalyze={async (id) => {
            await analyzeContent(id);
          }}
          isAnalyzing={isAnalyzingId === selectedIdeaForModal.id}
        />
      )}
    </div>
  );
}
