import React from 'react';
import { 
  Check, 
  X, 
  ShieldCheck 
} from 'lucide-react';
import { ContentLearning } from '@/services/contentService';

interface LearningCardProps {
  learning: ContentLearning;
  onConfirm?: (id: string) => Promise<void>;
  onDiscard?: (id: string) => Promise<void>;
  isProcessing?: boolean;
}

export const LearningCard: React.FC<LearningCardProps> = ({
  learning,
  onConfirm,
  onDiscard,
  isProcessing = false,
}) => {
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'hook': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'angle': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'format': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'cta': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'topic': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getConfidenceLabel = (conf: string) => {
    switch (conf) {
      case 'high': return { label: 'Padrão consistente', color: 'text-emerald-500' };
      case 'medium': return { label: 'Padrão emergente', color: 'text-amber-500' };
      default: return { label: 'Sinal inicial', color: 'text-muted-foreground' };
    }
  };

  const confInfo = getConfidenceLabel(learning.confidence);

  return (
    <div className="p-4 bg-card border border-border rounded-2xl space-y-3 shadow-sm hover:border-border/80 transition-all flex flex-col justify-between">
      <div className="space-y-2">
        {/* Badges Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getTypeBadgeColor(learning.type)}`}>
              {learning.type}
            </span>
            <span className={`text-[11px] font-medium flex items-center gap-1 ${confInfo.color}`}>
              <ShieldCheck size={12} />
              {confInfo.label}
            </span>
          </div>

          {/* Status Tag */}
          {learning.status === 'confirmed' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Confirmado
            </span>
          )}
          {learning.status === 'discarded' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground line-through opacity-70">
              Descartado
            </span>
          )}
          {learning.status === 'suggested' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Sugerido
            </span>
          )}
        </div>

        {/* Learning Statement */}
        <p className="font-bold text-sm text-foreground leading-snug">
          "{learning.learning}"
        </p>

        {/* Evidence */}
        {learning.evidence && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground/80">Evidência:</strong> {learning.evidence}
          </p>
        )}

        {/* Application */}
        {learning.application && (
          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-foreground/90 space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
              💡 Como Aplicar:
            </span>
            <p className="leading-relaxed">{learning.application}</p>
          </div>
        )}
      </div>

      {/* Action Buttons for Suggested Learnings */}
      {learning.status === 'suggested' && onConfirm && onDiscard && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
          <button
            type="button"
            onClick={() => onDiscard(learning.id)}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"
          >
            <X size={12} />
            <span>Descartar</span>
          </button>
          <button
            type="button"
            onClick={() => onConfirm(learning.id)}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1 shadow-sm"
          >
            <Check size={12} />
            <span>Confirmar Aprendizado</span>
          </button>
        </div>
      )}
    </div>
  );
};
