import { useState } from 'react';
import { 
  Sparkles, 
  Lightbulb, 
  Trash2, 
  Link2, 
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle
} from 'lucide-react';
import { ContentOpportunity } from '@/services/contentService';
import { useNavigate } from 'react-router-dom';

interface OpportunityCardProps {
  opportunity: ContentOpportunity;
  index: number;
  onActionCreate: (opp: ContentOpportunity) => void;
  onActionViewConnection: (opp: ContentOpportunity) => void;
  onActionDismiss: (id: string) => void;
}

export default function OpportunityCard({
  opportunity,
  index,
  onActionCreate,
  onActionViewConnection,
  onActionDismiss,
}: OpportunityCardProps) {
  const navigate = useNavigate();
  const [isDismissing, setIsDismissing] = useState(false);

  const isHighOpportunity = (opportunity.score && opportunity.score >= 80) || opportunity.priority === 1;
  const rankLabel = `0${index + 1} — ${isHighOpportunity ? 'Alta oportunidade' : 'Boa oportunidade'}`;

  // Analyze sources
  const sources = opportunity.sources || [];
  const hasDaily = sources.some(s => s.sourceType === 'daily');
  const hasCrm = sources.some(s => s.sourceType === 'crm_signal');
  const hasIdea = sources.some(s => s.sourceType === 'content_idea') || !!opportunity.connectedIdeaId;

  let sourceBadgeText = 'Conexão';
  if (hasDaily && hasCrm) {
    sourceBadgeText = 'Daily + CRM';
  } else if (hasDaily) {
    sourceBadgeText = 'Daily de Experiência';
  } else if (hasCrm) {
    sourceBadgeText = 'Dor de CRM';
  }

  const handleDismiss = async () => {
    setIsDismissing(true);
    try {
      await onActionDismiss(opportunity.id);
    } finally {
      setIsDismissing(false);
    }
  };

  const isConverted = opportunity.status === 'convertida';
  const isDismissed = opportunity.status === 'descartada';

  return (
    <div className={`group relative rounded-2xl border p-5 transition-all duration-200 shadow-xs ${
      isConverted 
        ? 'border-emerald-500/30 bg-emerald-500/5' 
        : isDismissed 
        ? 'border-border/60 bg-muted/20 opacity-60' 
        : isHighOpportunity 
        ? 'border-primary/30 bg-card hover:border-primary/50 hover:shadow-md' 
        : 'border-border bg-card hover:border-border/80 hover:shadow-md'
    }`}>
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {/* Rank Tag */}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-md tracking-wide ${
            isHighOpportunity
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-muted text-foreground font-semibold'
          }`}>
            {rankLabel}
          </span>

          {/* Sources Badge */}
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border/50">
            {hasDaily && <Clock size={11} className="text-blue-500" />}
            {hasCrm && <TrendingUp size={11} className="text-emerald-500" />}
            {hasIdea && <Lightbulb size={11} className="text-amber-500" />}
            <span>{sourceBadgeText}</span>
          </span>

          {/* Connected idea indicator */}
          {opportunity.connectedIdeaId && (
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/50">
              Ideia existente conectada
            </span>
          )}
        </div>

        {/* Relevance Score & Status */}
        <div className="flex items-center gap-2">
          {opportunity.score !== null && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Relevância: {opportunity.score}%
            </span>
          )}

          {isConverted && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
              <CheckCircle size={12} />
              Convertida em Ideia
            </span>
          )}

          {isDismissed && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Descartada
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug tracking-tight mb-2">
        {opportunity.title}
      </h3>

      {/* Description / Angle */}
      {opportunity.description && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-3">
          {opportunity.description}
        </p>
      )}

      {/* Por que apareceu Box */}
      {opportunity.whyNow && (
        <div className="p-3 bg-muted/40 rounded-xl border border-border/50 mb-4 flex items-start gap-2 text-xs">
          <Sparkles size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-foreground/90">Por que apareceu: </span>
            <span className="text-muted-foreground">{opportunity.whyNow}</span>
          </div>
        </div>
      )}

      {/* Actions Toolbar */}
      <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Ver Conexão */}
          <button
            type="button"
            onClick={() => onActionViewConnection(opportunity)}
            className="text-xs font-medium inline-flex items-center gap-1 text-muted-foreground hover:text-foreground h-8 px-2.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Link2 size={13} />
            <span>Ver conexão</span>
          </button>

          {/* Descartar */}
          {!isConverted && !isDismissed && (
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isDismissing}
              className="text-xs font-medium inline-flex items-center gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2.5 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
              <span>Descartar</span>
            </button>
          )}
        </div>

        {/* Primary Action Button */}
        <div>
          {opportunity.connectedIdeaId ? (
            <button
              type="button"
              onClick={() => navigate('/content/ideas')}
              className="text-xs font-semibold inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50 transition-colors shadow-xs"
            >
              <Lightbulb size={13} className="text-amber-500" />
              <span>Usar ideia existente</span>
              <ArrowRight size={13} />
            </button>
          ) : isConverted ? (
            <button
              type="button"
              onClick={() => navigate('/content/ideas')}
              className="text-xs font-medium inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border hover:bg-muted text-foreground transition-colors"
            >
              <span>Ver no Banco de Ideias</span>
              <ArrowRight size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onActionCreate(opportunity)}
              className="text-xs font-semibold inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs active:scale-95"
            >
              <Lightbulb size={13} />
              <span>Criar conteúdo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
