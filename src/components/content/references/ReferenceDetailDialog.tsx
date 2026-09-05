import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { ContentReference } from '@/services/contentService';
import { 
  ExternalLink, 
  Brain, 
  Sparkles, 
  Loader2, 
  Edit3, 
  Lightbulb
} from 'lucide-react';

interface ReferenceDetailDialogProps {
  reference: ContentReference | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (ref: ContentReference) => void;
  onAnalyze: (ref: ContentReference) => void;
  onConvertToIdea: (ref: ContentReference) => void;
  isAnalyzing?: boolean;
}

export default function ReferenceDetailDialog({
  reference,
  isOpen,
  onClose,
  onEdit,
  onAnalyze,
  onConvertToIdea,
  isAnalyzing
}: ReferenceDetailDialogProps) {
  if (!reference) return null;

  const renderAnalysisCards = () => {
    if (reference.status !== 'analisada' || !reference.analysis) return null;

    const cards = [
      { key: 'hook', label: '🎯 Gancho', content: reference.analysis.hook },
      { key: 'angle', label: '📍 Ângulo', content: reference.analysis.angle },
      { key: 'structure', label: '🏗️ Estrutura', content: reference.analysis.structure },
      { key: 'attentionMechanism', label: '🧠 Mecanismo de Atenção', content: reference.analysis.attentionMechanism },
      { key: 'cta', label: '📢 CTA', content: reference.analysis.cta },
      { key: 'whyItWorks', label: '✅ Por que funciona', content: reference.analysis.whyItWorks },
      { key: 'whatToLearn', label: '📚 O que aprender', content: reference.analysis.whatToLearn },
      { key: 'applicationToVamuss', label: '🚀 Como aplicar à Vamuss', content: reference.analysis.applicationToVamuss },
      { key: 'adaptationIdea', label: '💡 Ideia de adaptação', content: reference.analysis.adaptationIdea },
    ];

    const activeCards = cards.filter(card => card.content && card.content.trim() !== '');

    if (activeCards.length === 0) return null;

    return (
      <div className="mt-6">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Análise da IA
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeCards.map(card => (
            <div key={card.key} className="bg-card border border-border rounded-xl p-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {card.label}
              </div>
              <div className="text-sm text-foreground">
                {card.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {reference.status}
              </span>
              {reference.platform && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {reference.platform}
                </span>
              )}
            </div>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground pt-2">
            {reference.title || 'Referência sem título'}
          </DialogTitle>
          {reference.author && (
            <p className="text-sm text-muted-foreground font-medium">
              por {reference.author}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Section 1 - Referência */}
          <div className="flex flex-col gap-3">
            <a 
              href={reference.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline w-fit"
            >
              <ExternalLink size={14} />
              Acessar link original
            </a>
            
            {reference.description && (
              <p className="text-sm text-muted-foreground">
                {reference.description}
              </p>
            )}

            {reference.thumbnailUrl && (
              <img 
                src={reference.thumbnailUrl} 
                alt="Thumbnail" 
                className="max-h-32 rounded-xl object-cover w-full sm:w-auto"
              />
            )}
          </div>

          {/* Section 2 - O que chamou minha atenção */}
          {reference.notes && reference.notes.trim() !== '' && (
            <div className="bg-muted/30 rounded-xl p-4 mt-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                O que chamou minha atenção
              </h4>
              <p className="italic text-sm text-foreground">
                "{reference.notes}"
              </p>
            </div>
          )}

          {/* Section 3 - Análise da IA */}
          {reference.status === 'analisada' ? (
            renderAnalysisCards()
          ) : (
            <div className="mt-6 border border-border/60 bg-muted/20 rounded-xl p-5 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Brain size={24} />
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm">
                  Esta referência ainda não foi analisada
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  A IA pode extrair ganchos, estrutura e ideias de aplicação para a Vamuss com base neste conteúdo.
                </p>
              </div>
              <button
                onClick={() => onAnalyze(reference)}
                disabled={isAnalyzing}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Analisar referência
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-between border-t border-border pt-4 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
          >
            Fechar
          </button>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(reference);
              }}
              className="px-3.5 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted/60 transition-all flex items-center gap-1.5"
            >
              <Edit3 size={13} />
              <span>Editar</span>
            </button>
            
            {reference.status === 'analisada' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConvertToIdea(reference);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Lightbulb size={13} />
                <span>Transformar em Ideia</span>
              </button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
