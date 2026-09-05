import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { ContentOpportunity } from '@/services/contentService';
import { Sparkles, Check } from 'lucide-react';

interface OpportunityCreateIdeaDialogProps {
  opportunity: ContentOpportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    opportunityId: string,
    data: {
      title: string;
      description: string;
      format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null;
      priority?: number;
      tags?: string[];
    }
  ) => Promise<any>;
}

export default function OpportunityCreateIdeaDialog({
  opportunity,
  isOpen,
  onClose,
  onConfirm,
}: OpportunityCreateIdeaDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null>('carrossel');
  const [priority, setPriority] = useState<number>(2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (opportunity) {
      setTitle(opportunity.title || '');
      
      let initialDesc = opportunity.description || '';
      if (opportunity.whyNow) {
        initialDesc += `\n\nContexto da Conexão: ${opportunity.whyNow}`;
      }
      setDescription(initialDesc.trim());
      setPriority(opportunity.priority === 1 ? 1 : 2);
    }
  }, [opportunity]);

  if (!opportunity) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const tags = ['oportunidade', opportunity.opportunityType];
      await onConfirm(opportunity.id, {
        title: title.trim(),
        description: description.trim(),
        format,
        priority,
        tags,
      });
      onClose();
    } catch (err) {
      console.error('Error submitting idea from opportunity:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Sparkles size={16} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Transformar Oportunidade em Ideia
              </span>
            </div>
            <DialogTitle className="text-lg font-bold">
              Criar Conteúdo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Esta oportunidade será convertida em uma ideia no Banco de Ideias, mantendo a rastreabilidade da origem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            {/* Título */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Título / Gancho do Conteúdo *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Ex: Por que vender mais leads não resolve clínicas que não atendem rápido"
                required
                className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-medium"
              />
            </div>

            {/* Descrição / Ângulo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Ângulo de Abordagem & Tese
              </label>
              <textarea
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                rows={4}
                placeholder="Detalhes do ângulo, estrutura do roteiro ou tese..."
                className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all leading-relaxed resize-y"
              />
            </div>

            {/* Formato Recomendado */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Formato Inicial Sugerido
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['carrossel', 'reel', 'post', 'story', 'artigo'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all text-center capitalize ${
                      format === fmt
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                        : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Prioridade */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Prioridade de Criação
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPriority(1)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    priority === 1
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  Alta (Produzir logo)
                </button>
                <button
                  type="button"
                  onClick={() => setPriority(2)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    priority === 2
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 font-semibold'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  Média (Banco de pautas)
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-medium px-3 py-2 rounded-xl border border-border hover:bg-muted text-foreground transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="text-xs font-semibold inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>Confirmar & Salvar Ideia</span>
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
