import { useState, useEffect, type FormEvent } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { ContentIdea } from '@/services/contentService';
import { CreateContentIdeaInput } from '@/services/contentIdeasService';
import { Sparkles, CalendarDays, Brain, Star } from 'lucide-react';

interface IdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateContentIdeaInput) => Promise<void>;
  initialIdea?: ContentIdea | null;
  defaultSourceType?: 'manual' | 'daily' | 'crm_signal';
  defaultSourceId?: string | null;
  defaultTitle?: string;
  defaultDescription?: string;
}

const FORMAT_OPTIONS = [
  { value: 'reel', label: 'Reel' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'post', label: 'Post Estático' },
  { value: 'story', label: 'Story' },
  { value: 'artigo', label: 'Artigo' },
];

const STATUS_OPTIONS = [
  { value: 'capturada', label: 'Capturada (Em análise)' },
  { value: 'validada', label: 'Validada (Pronta p/ produzir)' },
  { value: 'em_producao', label: 'Em Produção' },
  { value: 'descartada', label: 'Descartada' },
];

export default function IdeaModal({
  isOpen,
  onClose,
  onSubmit,
  initialIdea,
  defaultSourceType = 'manual',
  defaultSourceId = null,
  defaultTitle = '',
  defaultDescription = '',
}: IdeaModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | ''>('');
  const [status, setStatus] = useState<'capturada' | 'validada' | 'em_producao' | 'descartada'>('capturada');
  const [priority, setPriority] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(initialIdea);

  useEffect(() => {
    if (initialIdea) {
      setTitle(initialIdea.title);
      setDescription(initialIdea.description || '');
      setFormat(initialIdea.format || '');
      setStatus(initialIdea.status);
      setPriority(initialIdea.priority || 3);
    } else {
      setTitle(defaultTitle || '');
      setDescription(defaultDescription || '');
      setFormat('');
      setStatus('capturada');
      setPriority(3);
    }
  }, [initialIdea, defaultTitle, defaultDescription, isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        format: format ? (format as any) : null,
        status,
        priority,
        sourceType: initialIdea ? initialIdea.sourceType : defaultSourceType,
        sourceId: initialIdea ? initialIdea.sourceId : defaultSourceId,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSourceBadge = () => {
    const src = initialIdea ? initialIdea.sourceType : defaultSourceType;
    if (src === 'daily') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 w-fit">
          <CalendarDays size={13} />
          <span>Origem: <strong>Daily</strong></span>
        </div>
      );
    }
    if (src === 'crm_signal') {
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 w-fit">
          <Brain size={13} />
          <span>Origem: <strong>Inteligência Comercial</strong></span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg w-fit">
        <Sparkles size={13} />
        <span>Origem: <strong>Manual</strong></span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {isEditing ? 'Editar Ideia' : 'Nova Ideia de Conteúdo'}
          </DialogTitle>
          <div className="pt-1">
            {getSourceBadge()}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Título / Ângulo da Ideia <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Como lidar quando o lead reclama do preço..."
              className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Descrição / Contexto */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Contexto / Observações
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva a dor, o exemplo real ou o raciocínio por trás desta ideia..."
              className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Formato & Status (Grid de 2 colunas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Formato */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Formato Previsto (Opcional)
              </label>
              <select
                value={format}
                onChange={e => setFormat(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary transition-all"
              >
                <option value="">Nenhum formato definido</option>
                {FORMAT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Status da Ideia
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border text-xs text-foreground outline-none focus:border-primary transition-all"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Prioridade (1 a 5) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Prioridade</span>
              <span className="text-muted-foreground font-normal text-[11px]">
                {priority === 1 && '1 — Baixa'}
                {priority === 2 && '2 — Normal'}
                {priority === 3 && '3 — Relevante'}
                {priority === 4 && '4 — Alta'}
                {priority === 5 && '5 — Máxima'}
              </span>
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setPriority(star)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    priority >= star 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' 
                      : 'bg-muted/30 border-border text-muted-foreground/60 hover:bg-muted'
                  }`}
                >
                  <Star size={12} fill={priority >= star ? 'currentColor' : 'none'} />
                  <span>{star}</span>
                </button>
              ))}
            </div>
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
              disabled={!title.trim() || isSubmitting}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar Ideia' : 'Salvar Ideia'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
