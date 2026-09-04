import { useState } from 'react';
import { 
  Clock, 
  Mic, 
  FileText, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  Lightbulb
} from 'lucide-react';
import { ContentDailyEntry } from '@/services/contentService';

interface DailyTimelineProps {
  entries: ContentDailyEntry[];
  onDeleteEntry: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export default function DailyTimeline({
  entries,
  onDeleteEntry,
  isLoading = false,
}: DailyTimelineProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteEntry(id);
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const parts = timeStr.split(':');
      if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
      }
      return timeStr;
    } catch {
      return timeStr;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 py-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-card border border-border rounded-xl p-4 flex gap-3">
            <div className="w-10 h-6 bg-muted rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-12 px-4 text-center bg-card/40 border border-dashed border-border rounded-2xl">
        <div className="w-12 h-12 rounded-full bg-muted/70 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
          <Clock size={22} />
        </div>
        <h3 className="font-semibold text-foreground text-sm">Nenhum registro para este dia</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1.5 leading-relaxed">
          Grave um áudio ou digite acima para guardar fatos, reuniões, vitórias ou obstáculos da sua rotina.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
      {entries.map((entry) => {
        const isVoice = entry.sourceType === 'voice';
        const signals = entry.aiSignals;
        const hasContentSignals = signals?.sinais_conteudo && signals.sinais_conteudo.length > 0;
        const hasLearning = Boolean(signals?.aprendizado);

        return (
          <div key={entry.id} className="relative group">
            {/* Timeline Dot */}
            <div className="absolute -left-6 top-3 w-5 h-5 rounded-full border-2 border-background bg-card flex items-center justify-center text-muted-foreground group-hover:border-primary group-hover:text-primary transition-colors shadow-sm">
              {isVoice ? <Mic size={10} /> : <FileText size={10} />}
            </div>

            {/* Entry Card */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-border/80 transition-all">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-muted-foreground flex items-center gap-1">
                    <Clock size={12} className="text-muted-foreground/70" />
                    {formatTime(entry.entryTime)}
                  </span>
                  {isVoice && (
                    <span className="text-[10px] font-medium bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Mic size={9} />
                      Áudio
                    </span>
                  )}
                  {entry.aiStatus === 'pending' && (
                    <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1 italic">
                      <Sparkles size={9} className="animate-spin text-primary" />
                      Analisando...
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  title="Excluir este registro"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Raw Content */}
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {entry.rawContent}
              </p>

              {/* AI Extracted Signals (Non-intrusive) */}
              {(hasContentSignals || hasLearning || signals?.emocao_contexto) && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  {hasContentSignals && signals!.sinais_conteudo!.map((sinal, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-1.5 text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-2.5 py-1.5"
                    >
                      <Lightbulb size={13} className="shrink-0 mt-0.5 text-primary" />
                      <span className="leading-snug">
                        <strong className="font-semibold">Sinal de Conteúdo:</strong> &ldquo;{sinal}&rdquo;
                      </span>
                    </div>
                  ))}

                  {hasLearning && (
                    <div className="flex items-start gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-lg px-2.5 py-1.5">
                      <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        <strong className="font-semibold">Aprendizado:</strong> {signals!.aprendizado}
                      </span>
                    </div>
                  )}

                  {signals?.emocao_contexto && (
                    <span className="inline-block text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {signals.emocao_contexto}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
