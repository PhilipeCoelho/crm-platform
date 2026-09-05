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
import { Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null>('reel');
  const [priority, setPriority] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (opportunity) {
      setTitle(opportunity.title || '');
      setDescription(opportunity.description || '');
      setPriority(opportunity.priority || 1);
      setFormat('reel');
    }
  }, [opportunity]);

  if (!opportunity) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

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
      navigate('/content/production');
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
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                <Flame size={16} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Enviar Oportunidade para Produção
              </span>
            </div>
            <DialogTitle className="text-lg font-bold">
              Produzir Conteúdo Agora
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Esta oportunidade será convertida e entrará diretamente na sua Fila de Execução em Produção.
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
              className="text-xs font-bold inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-all shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Enviando para Produção...</span>
              ) : (
                <>
                  <Flame size={14} />
                  <span>Confirmar & Enviar para Produção</span>
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
