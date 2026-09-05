import React, { useState } from 'react';
import { X, Send, Instagram, Linkedin, Youtube, Globe, Link2, Calendar, Loader2 } from 'lucide-react';
import { ContentIdea, ContentPlatform } from '@/services/contentService';
import { PublishData } from '@/services/contentProductionService';

interface PublishModalProps {
  idea: ContentIdea;
  isOpen: boolean;
  onClose: () => void;
  onPublish: (ideaId: string, data: PublishData) => Promise<void>;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  idea,
  isOpen,
  onClose,
  onPublish,
}) => {
  const [platform, setPlatform] = useState<ContentPlatform>(idea.platform || 'instagram');
  const [publishedAt, setPublishedAt] = useState<string>(
    idea.publishedAt ? new Date(idea.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [publicationUrl, setPublicationUrl] = useState<string>(idea.publicationUrl || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await onPublish(idea.id, {
        platform,
        publishedAt: new Date(publishedAt).toISOString(),
        publicationUrl: publicationUrl.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao registrar publicação');
    } finally {
      setSubmitting(false);
    }
  };

  const platforms: { id: ContentPlatform; label: string; icon: any }[] = [
    { id: 'instagram', label: 'Instagram', icon: Instagram },
    { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
    { id: 'youtube', label: 'YouTube', icon: Youtube },
    { id: 'tiktok', label: 'TikTok', icon: Globe },
    { id: 'twitter', label: 'Twitter / X', icon: Globe },
    { id: 'blog', label: 'Blog / Site', icon: Globe },
    { id: 'outro', label: 'Outro', icon: Globe },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <h3 className="text-sm font-bold text-zinc-100">
              Registrar Publicação
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold block mb-1">
              Conteúdo
            </span>
            <p className="text-sm font-bold text-zinc-200 line-clamp-2">
              {idea.title}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Plataforma
            </label>
            <div className="grid grid-cols-2 gap-2">
              {platforms.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      platform === p.id
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Data da Publicação
            </label>
            <input
              type="date"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-zinc-400" />
              Link do Post (Opcional)
            </label>
            <input
              type="url"
              value={publicationUrl}
              onChange={(e) => setPublicationUrl(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
              placeholder="https://instagram.com/p/..."
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-medium">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/10"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{submitting ? 'Registrando...' : 'Confirmar Publicação'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
