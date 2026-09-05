import { useState } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  History, 
  Compass, 
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { useContentOpportunities } from '@/hooks/content/useContentOpportunities';
import { ContentOpportunity } from '@/services/contentService';
import OpportunityCard from '@/components/content/opportunities/OpportunityCard';
import OpportunityConnectionDialog from '@/components/content/opportunities/OpportunityConnectionDialog';
import OpportunityCreateIdeaDialog from '@/components/content/opportunities/OpportunityCreateIdeaDialog';
import { useNavigate } from 'react-router-dom';

export default function ContentOpportunities() {
  const navigate = useNavigate();
  const {
    topOpportunities,
    historyOpportunities,
    isLoading,
    isGenerating,
    error,
    toastMessage,
    clearToast,
    refreshOpportunities,
    generateOpportunities,
    dismissOpportunity,
    convertToIdea,
  } = useContentOpportunities();

  const [activeTab, setActiveTab] = useState<'principais' | 'historico'>('principais');
  const [selectedForConnection, setSelectedForConnection] = useState<ContentOpportunity | null>(null);
  const [selectedForCreate, setSelectedForCreate] = useState<ContentOpportunity | null>(null);

  const handleCreateContent = (opp: ContentOpportunity) => {
    setSelectedForCreate(opp);
  };

  const handleViewConnection = (opp: ContentOpportunity) => {
    setSelectedForConnection(opp);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 p-4 sm:p-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className={`text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 ${
            toastMessage.variant === 'destructive'
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-emerald-600 text-white'
          }`}>
            {toastMessage.variant === 'destructive' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <div>
              <p>{toastMessage.title}</p>
              {toastMessage.description && (
                <p className="text-[11px] font-normal opacity-90">{toastMessage.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={clearToast}
              className="ml-2 p-1 hover:opacity-80 rounded"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles size={20} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Oportunidades
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            O que vale a pena transformar em conteúdo agora.
          </p>
        </div>

        {/* Action Button: Analisar Conexões */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshOpportunities}
            disabled={isLoading || isGenerating}
            title="Atualizar lista"
            className="h-9 px-3 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 inline-flex items-center justify-center"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={generateOpportunities}
            disabled={isGenerating || isLoading}
            className="h-9 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Sparkles size={15} className={isGenerating ? 'animate-spin text-amber-300' : 'text-amber-300'} />
            <span>{isGenerating ? 'Cruzando Fontes...' : 'Analisar Conexões'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2.5 text-xs text-destructive">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('principais')}
            className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'principais'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles size={15} />
            <span>Oportunidades de Hoje</span>
            {topOpportunities.length > 0 && (
              <span className="ml-1 text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                {topOpportunities.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'historico'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <History size={15} />
            <span>Histórico</span>
            {historyOpportunities.length > 0 && (
              <span className="ml-1 text-[11px] font-medium px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground">
                {historyOpportunities.length}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center text-xs text-muted-foreground font-medium">
          A IA sugere. O Phil decide.
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-5 bg-muted rounded w-32" />
                <div className="h-5 bg-muted rounded w-20" />
              </div>
              <div className="h-6 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-10 bg-muted/60 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Principais Tab */}
      {!isLoading && activeTab === 'principais' && (
        <div>
          {topOpportunities.length === 0 ? (
            <div className="text-center py-16 px-4 bg-card/60 border border-dashed border-border rounded-2xl max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Compass size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  Nenhuma oportunidade ativa no momento
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                  O Connection Engine cruza suas anotações do Daily e os dados da Central de Inteligência Comercial para encontrar ângulos certeiros.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={generateOpportunities}
                  disabled={isGenerating}
                  className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  <Sparkles size={14} className="text-amber-300" />
                  <span>{isGenerating ? 'Analisando...' : 'Analisar Conexões Agora'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/content/today')}
                  className="px-3.5 py-2 rounded-xl border border-border hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Registrar no Daily</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Product rule note */}
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-xl px-3.5 py-2">
                <span>
                  Mostrando as <strong>{topOpportunities.length} melhores oportunidades</strong> para reduzir sobrecarga de decisão.
                </span>
                <span className="text-[11px] italic hidden sm:inline">
                  Menos pensar no que produzir. Mais produzir.
                </span>
              </div>

              {/* Opportunity Cards */}
              <div className="space-y-4">
                {topOpportunities.map((opp, idx) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    index={idx}
                    onActionCreate={handleCreateContent}
                    onActionViewConnection={handleViewConnection}
                    onActionDismiss={dismissOpportunity}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Histórico Tab */}
      {!isLoading && activeTab === 'historico' && (
        <div>
          {historyOpportunities.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground italic">
              Nenhuma oportunidade foi convertida ou descartada até agora.
            </div>
          ) : (
            <div className="space-y-3">
              {historyOpportunities.map((opp, idx) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  index={idx}
                  onActionCreate={handleCreateContent}
                  onActionViewConnection={handleViewConnection}
                  onActionDismiss={dismissOpportunity}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <OpportunityConnectionDialog
        opportunity={selectedForConnection}
        isOpen={!!selectedForConnection}
        onClose={() => setSelectedForConnection(null)}
        onActionCreate={handleCreateContent}
      />

      <OpportunityCreateIdeaDialog
        opportunity={selectedForCreate}
        isOpen={!!selectedForCreate}
        onClose={() => setSelectedForCreate(null)}
        onConfirm={convertToIdea}
      />
    </div>
  );
}
