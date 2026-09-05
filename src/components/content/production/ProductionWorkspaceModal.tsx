import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Loader2
} from 'lucide-react';
import { ContentIdea } from '@/services/contentService';
import { WorkspaceData, structureWithAI } from '@/services/contentProductionService';

interface ProductionWorkspaceModalProps {
  idea: ContentIdea;
  isOpen: boolean;
  onClose: () => void;
  onSave: (ideaId: string, data: WorkspaceData) => Promise<void>;
  onAdvanceStage: (idea: ContentIdea) => void;
}

export const ProductionWorkspaceModal: React.FC<ProductionWorkspaceModalProps> = ({
  idea,
  isOpen,
  onClose,
  onSave,
  onAdvanceStage,
}) => {
  const [title, setTitle] = useState(idea.title || '');
  const [format, setFormat] = useState<'reel' | 'carrossel' | 'post' | 'story' | 'artigo' | null>(idea.format || 'reel');
  const [priority, setPriority] = useState<number>(idea.priority || 2);
  const [nextAction, setNextAction] = useState(idea.nextAction || '');
  const [hook, setHook] = useState(idea.hook || '');
  const [angle, setAngle] = useState(idea.angle || '');
  const [bodyScript, setBodyScript] = useState(idea.bodyScript || '');
  const [cta, setCta] = useState(idea.cta || '');
  const [notes, setNotes] = useState(idea.notes || '');

  const [saving, setSaving] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (idea) {
      setTitle(idea.title || '');
      setFormat(idea.format || 'reel');
      setPriority(idea.priority || 2);
      setNextAction(idea.nextAction || '');
      setHook(idea.hook || '');
      setAngle(idea.angle || '');
      setBodyScript(idea.bodyScript || '');
      setCta(idea.cta || '');
      setNotes(idea.notes || '');
      setFeedback(null);
    }
  }, [idea]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      setFeedback(null);
      await onSave(idea.id, {
        title,
        format,
        priority,
        nextAction,
        hook,
        angle,
        bodyScript,
        cta,
        notes,
      });
      setFeedback({ type: 'success', message: 'Workspace salvo com sucesso!' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao salvar workspace' });
    } finally {
      setSaving(false);
    }
  };

  const handleStructureWithAI = async () => {
    try {
      setStructuring(true);
      setFeedback(null);
      const res = await structureWithAI(idea.id, title, idea.description);
      if (res.hook) setHook(res.hook);
      if (res.angle) setAngle(res.angle);
      if (res.bodyScript) setBodyScript(res.bodyScript);
      if (res.cta) setCta(res.cta);
      setFeedback({ type: 'success', message: 'Roteiro e estrutura gerados pela IA com sucesso!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao estruturar com IA' });
    } finally {
      setStructuring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Production Workspace
                <span className="text-xs font-normal text-zinc-400 uppercase tracking-wider bg-zinc-800 px-2 py-0.5 rounded">
                  {idea.executionStage || 'producao'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Estruturação do conteúdo, roteiro e orientações para execução
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStructureWithAI}
              disabled={structuring}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-semibold text-xs border border-purple-500/30 transition-colors disabled:opacity-50"
            >
              {structuring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{structuring ? 'Estruturando...' : 'Estruturar com IA'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 ${
            feedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-b border-rose-500/20'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metadata Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Título do Conteúdo
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500/50"
                placeholder="Ex: Como validar objeções de preço sem dar desconto"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Formato
              </label>
              <select
                value={format || 'reel'}
                onChange={(e) => setFormat(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="reel">Reel / Vídeo Curto</option>
                <option value="carrossel">Carrossel (Slides)</option>
                <option value="post">Post / Texto Curto</option>
                <option value="artigo">Artigo Longo</option>
                <option value="story">Sequência de Stories</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Próxima Ação
              </label>
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500/50"
                placeholder="Ex: Gravar introdução em pé com microfone"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Prioridade
              </label>
              <div className="flex gap-2">
                {[1, 2, 3].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                      priority === p
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    P{p} {p === 1 ? '(Alta)' : p === 2 ? '(Normal)' : '(Baixa)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 1: Hook & Angle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-400">
                🪝 Gancho Inicial (Hook - Primeiros 3s)
              </label>
              <textarea
                rows={3}
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                className="w-full bg-transparent border-0 text-sm text-zinc-100 focus:outline-none resize-none placeholder-zinc-600"
                placeholder="A primeira frase dita ou escrita para reter o leitor/espectador..."
              />
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
                🎯 Ângulo / Tese Central
              </label>
              <textarea
                rows={3}
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                className="w-full bg-transparent border-0 text-sm text-zinc-100 focus:outline-none resize-none placeholder-zinc-600"
                placeholder="Qual é a perspectiva única ou lição contra-intuitiva de vendas?"
              />
            </div>
          </div>

          {/* Section 2: Body / Script */}
          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
              📝 Corpo do Conteúdo / Roteiro Completo
            </label>
            <textarea
              rows={8}
              value={bodyScript}
              onChange={(e) => setBodyScript(e.target.value)}
              className="w-full bg-transparent border-0 text-sm text-zinc-100 focus:outline-none resize-y placeholder-zinc-600 font-mono"
              placeholder="1. Ponto de partida...&#10;2. Exemplo prático do dia a dia comercial...&#10;3. A virada de chave...&#10;4. Conclusão prática..."
            />
          </div>

          {/* Section 3: CTA & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-blue-400">
                📣 Chamada para Ação (CTA)
              </label>
              <textarea
                rows={2}
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                className="w-full bg-transparent border-0 text-sm text-zinc-100 focus:outline-none resize-none placeholder-zinc-600"
                placeholder="Ex: Comente 'PIPELINE' para receber o checklist completo..."
              />
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                💡 Dicas de Gravação / Direção
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-transparent border-0 text-sm text-zinc-100 focus:outline-none resize-none placeholder-zinc-600"
                placeholder="Ex: Gravar com luz natural, ritmo rápido, sem vinheta..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/70">
          <div className="text-xs text-zinc-500">
            {idea.updatedAt && (
              <span>Atualizado em: {new Date(idea.updatedAt).toLocaleString('pt-BR')}</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm transition-colors border border-zinc-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>

            <button
              onClick={() => {
                handleSave().then(() => {
                  onAdvanceStage(idea);
                  onClose();
                });
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-colors shadow-lg shadow-amber-500/10"
            >
              <span>Avançar Etapa</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
