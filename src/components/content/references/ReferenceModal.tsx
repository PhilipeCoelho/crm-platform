import { useState, useEffect, type FormEvent } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { ContentReference } from '@/services/contentService';
import { CreateReferenceInput } from '@/services/contentReferenceService';
import { AlertTriangle } from 'lucide-react';

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateReferenceInput) => Promise<void>;
  initialReference?: ContentReference | null;
  duplicateWarning?: ContentReference | null;
  onCheckDuplicate?: (url: string) => Promise<ContentReference | null>;
}

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'blog', label: 'Blog' },
  { value: 'outro', label: 'Outro' },
];

export default function ReferenceModal({
  isOpen,
  onClose,
  onSubmit,
  initialReference,
  duplicateWarning,
  onCheckDuplicate,
}: ReferenceModalProps) {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<string>('instagram');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localDuplicateWarning, setLocalDuplicateWarning] = useState<ContentReference | null>(null);

  const isEditing = Boolean(initialReference);

  useEffect(() => {
    if (initialReference) {
      setUrl(initialReference.url);
      setPlatform(initialReference.platform || 'instagram');
      setTitle(initialReference.title || '');
      setAuthor(initialReference.author || '');
      setNotes(initialReference.notes || '');
    } else {
      setUrl('');
      setPlatform('instagram');
      setTitle('');
      setAuthor('');
      setNotes('');
    }
    setLocalDuplicateWarning(null);
  }, [initialReference, isOpen]);

  useEffect(() => {
    if (duplicateWarning) {
      setLocalDuplicateWarning(duplicateWarning);
    }
  }, [duplicateWarning]);

  const handleUrlBlur = async () => {
    if (url.trim() && onCheckDuplicate && !isEditing) {
      const duplicate = await onCheckDuplicate(url.trim());
      setLocalDuplicateWarning(duplicate);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        url: url.trim(),
        platform: platform as any,
        title: title.trim() || undefined,
        author: author.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {isEditing ? 'Editar Referência' : 'Salvar Referência'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              URL da Referência <span className="text-destructive">*</span>
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={e => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            />
            {localDuplicateWarning && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 mt-1">
                <AlertTriangle size={13} />
                <span>Essa referência já está salva na sua base.</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Plataforma */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Plataforma
              </label>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary transition-all"
              >
                {PLATFORM_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Autor */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Autor (Opcional)
              </label>
              <input
                type="text"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder="Ex: John Doe"
                className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Título (Opcional)
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título ou chamada principal"
              className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Observação */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Observação (Opcional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="O que chamou sua atenção nessa referência?"
              className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-none leading-relaxed"
            />
          </div>

          <DialogFooter className="pt-3 border-t border-border flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!url.trim() || isSubmitting}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar Referência' : 'Salvar Referência'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
