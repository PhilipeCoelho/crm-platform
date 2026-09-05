import React, { useState } from 'react';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { ContentIdea, ContentMetricsData } from '@/services/contentService';

interface MetricsModalProps {
  idea: ContentIdea;
  isOpen: boolean;
  onClose: () => void;
  onRecordMetrics: (ideaId: string, metrics: ContentMetricsData) => Promise<void>;
}

export const MetricsModal: React.FC<MetricsModalProps> = ({
  idea,
  isOpen,
  onClose,
  onRecordMetrics,
}) => {
  const existingMetrics = idea.metrics || {};
  const [views, setViews] = useState<number | ''>(existingMetrics.views ?? '');
  const [reach, setReach] = useState<number | ''>(existingMetrics.reach ?? '');
  const [likes, setLikes] = useState<number | ''>(existingMetrics.likes ?? '');
  const [comments, setComments] = useState<number | ''>(existingMetrics.comments ?? '');
  const [shares, setShares] = useState<number | ''>(existingMetrics.shares ?? '');
  const [saves, setSaves] = useState<number | ''>(existingMetrics.saves ?? '');
  const [clicks, setClicks] = useState<number | ''>(existingMetrics.clicks ?? '');
  const [leads, setLeads] = useState<number | ''>(existingMetrics.leads ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const metricsData: ContentMetricsData = {};
      if (views !== '') metricsData.views = Number(views);
      if (reach !== '') metricsData.reach = Number(reach);
      if (likes !== '') metricsData.likes = Number(likes);
      if (comments !== '') metricsData.comments = Number(comments);
      if (shares !== '') metricsData.shares = Number(shares);
      if (saves !== '') metricsData.saves = Number(saves);
      if (clicks !== '') metricsData.clicks = Number(clicks);
      if (leads !== '') metricsData.leads = Number(leads);

      await onRecordMetrics(idea.id, metricsData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar métricas');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-zinc-100">
                Registrar Métricas do Conteúdo
              </h3>
              <p className="text-xs text-zinc-400">
                Alimenta a inteligência e o aprendizado de performance
              </p>
            </div>
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
            <p className="text-sm font-bold text-zinc-200 line-clamp-1">
              {idea.title}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Visualizações / Views
              </label>
              <input
                type="number"
                min="0"
                value={views}
                onChange={(e) => setViews(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="Ex: 4500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Alcance / Contas
              </label>
              <input
                type="number"
                min="0"
                value={reach}
                onChange={(e) => setReach(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="Ex: 3800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Curtidas / Likes
              </label>
              <input
                type="number"
                min="0"
                value={likes}
                onChange={(e) => setLikes(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="Ex: 240"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Comentários
              </label>
              <input
                type="number"
                min="0"
                value={comments}
                onChange={(e) => setComments(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="Ex: 35"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Compartilhamentos
              </label>
              <input
                type="number"
                min="0"
                value={shares}
                onChange={(e) => setShares(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="Ex: 50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Salvamentos
              </label>
              <input
                type="number"
                min="0"
                value={saves}
                onChange={(e) => setSaves(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="Ex: 110"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Cliques no Link
              </label>
              <input
                type="number"
                min="0"
                value={clicks}
                onChange={(e) => setClicks(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="Ex: 28"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                🎯 Leads Gerados
              </label>
              <input
                type="number"
                min="0"
                value={leads}
                onChange={(e) => setLeads(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-zinc-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                placeholder="Ex: 4"
              />
            </div>
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/10"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{submitting ? 'Salvando...' : 'Salvar Métricas & Concluir Ciclo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
