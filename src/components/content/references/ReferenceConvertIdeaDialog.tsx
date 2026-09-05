import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { ContentReference } from '@/services/contentService';
import { BookMarked } from 'lucide-react';

interface ReferenceConvertIdeaDialogProps {
  reference: ContentReference | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (referenceId: string, ideaData: {
    title: string;
    description?: string;
    format?: 'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null;
    priority?: number;
  }) => Promise<boolean>;
}

export default function ReferenceConvertIdeaDialog({
  reference,
  isOpen,
  onClose,
  onSubmit,
}: ReferenceConvertIdeaDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null>('reel');
  const [priority, setPriority] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (reference && reference.analysis) {
      setTitle(reference.analysis.adaptationIdea || reference.title || '');
      
      const whatToLearn = reference.analysis.whatToLearn || '';
      const application = reference.analysis.applicationToVamuss || '';
      
      let desc = '';
      if (whatToLearn && application) {
        desc = `${whatToLearn}\n\nAplicação: ${application}`;
      } else if (whatToLearn) {
        desc = whatToLearn;
      } else if (application) {
        desc = application;
      }
      
      setDescription(desc);
      setPriority(3);
      setFormat('reel');
    }
  }, [reference]);

  if (!reference) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(reference.id, {
        title: title.trim(),
        description: description.trim(),
        format,
        priority,
      });
      onClose();
    } catch (err) {
      console.error('Error converting reference to idea:', err);
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
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <BookMarked size={14} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Origem: Referência
              </span>
            </div>
            <DialogTitle className="text-lg font-bold pt-1">
              Transformar em Ideia de Conteúdo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Título da ideia *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Como organizar sua agenda..."
                required
                className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Detalhes, insights ou estrutura da ideia..."
                className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all leading-relaxed resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Formato
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Prioridade (1 a 5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      priority === p
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-medium px-3.5 py-2 rounded-xl border border-border hover:bg-muted/60 text-foreground transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="text-xs font-bold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Criando...' : 'Criar Ideia'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
