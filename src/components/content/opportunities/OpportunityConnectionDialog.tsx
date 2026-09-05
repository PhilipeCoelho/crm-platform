import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { ContentOpportunity } from '@/services/contentService';
import { Sparkles, TrendingUp, Lightbulb, Link2, Clock } from 'lucide-react';

interface OpportunityConnectionDialogProps {
  opportunity: ContentOpportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onActionCreate?: (opp: ContentOpportunity) => void;
}

export default function OpportunityConnectionDialog({
  opportunity,
  isOpen,
  onClose,
  onActionCreate,
}: OpportunityConnectionDialogProps) {
  if (!opportunity) return null;

  const sources = opportunity.sources || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Link2 size={16} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rastreabilidade da Conexão
            </span>
          </div>
          <DialogTitle className="text-lg font-bold leading-snug">
            {opportunity.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Entenda quais vivências e dados comerciais fundamentaram esta oportunidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Por que apareceu */}
          {opportunity.whyNow && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <Sparkles size={14} />
                <span>Por que apareceu agora:</span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                {opportunity.whyNow}
              </p>
            </div>
          )}

          {/* Ângulo / Descrição */}
          {opportunity.description && (
            <div className="p-3 bg-muted/40 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">
                Tese e Ângulo Prático:
              </span>
              <p className="text-xs text-foreground leading-relaxed">
                {opportunity.description}
              </p>
            </div>
          )}

          {/* Fontes conectadas */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Fontes Conectadas ({sources.length}):
            </span>

            {sources.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nenhuma fonte detalhada vinculada diretamente a esta oportunidade.
              </p>
            ) : (
              sources.map((src, idx) => {
                const isDaily = src.sourceType === 'daily';
                const isCrm = src.sourceType === 'crm_signal';
                const isIdea = src.sourceType === 'content_idea';

                return (
                  <div 
                    key={src.id || idx}
                    className="p-3 rounded-xl border border-border/80 bg-card/50 flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {isDaily && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/50">
                            <Clock size={12} />
                            Daily (Memória Diária)
                          </span>
                        )}
                        {isCrm && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/50">
                            <TrendingUp size={12} />
                            CRM Comercial (Insight de Vendas)
                          </span>
                        )}
                        {isIdea && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/50">
                            <Lightbulb size={12} />
                            Banco de Ideias
                          </span>
                        )}
                      </div>
                      {src.createdAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(src.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>

                    {src.sourceContext && (
                      <p className="text-foreground/90 italic bg-muted/30 p-2 rounded-lg border-l-2 border-primary/40 leading-relaxed mt-1">
                        &ldquo;{src.sourceContext}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t border-border">
          <button 
            type="button" 
            onClick={onClose}
            className="text-xs font-medium px-3 py-2 rounded-xl border border-border hover:bg-muted text-foreground transition-colors"
          >
            Fechar
          </button>

          {onActionCreate && opportunity.status !== 'convertida' && (
            <button 
              type="button" 
              onClick={() => {
                onClose();
                onActionCreate(opportunity);
              }}
              className="text-xs font-semibold inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
            >
              <Lightbulb size={14} />
              <span>Criar conteúdo desta oportunidade</span>
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
