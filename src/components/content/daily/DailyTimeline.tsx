import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Clock, 
  Mic, 
  FileText, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  Lightbulb,
  CloudOff,
  AlertTriangle
} from 'lucide-react';
import { ContentDailyEntry } from '@/services/contentService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface DailyTimelineProps {
  entries: ContentDailyEntry[];
  onDeleteEntry: (id: string) => Promise<void>;
  onCreateIdea?: (data: { title: string; description: string; sourceType: 'daily'; sourceId: string }) => void;
  isLoading?: boolean;
  dailyOpportunityMap?: Record<string, string>;
}

export default function DailyTimeline({
  entries,
  onDeleteEntry,
  onCreateIdea,
  isLoading = false,
  dailyOpportunityMap,
}: DailyTimelineProps) {
  const [entryToDelete, setEntryToDelete] = useState<ContentDailyEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteEntry(entryToDelete.id);
      setEntryToDelete(null);
    } finally {
      setIsDeleting(false);
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
    <>
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
                  <div className="flex items-center gap-2 flex-wrap">
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
                    {entry.isLocalOnly && (
                      <span 
                        title="Registro salvo no navegador local. Execute o script supabase_content_daily.sql no Supabase para sincronização em nuvem."
                        className="text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-500/20"
                      >
                        <CloudOff size={9} />
                        Salvo localmente
                      </span>
                    )}
                    {entry.aiStatus === 'pending' && (
                      <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1 italic">
                        <Sparkles size={9} className="animate-spin text-primary" />
                        Analisando...
                      </span>
                    )}

                    {dailyOpportunityMap?.[entry.id] && (
                      <Link
                        to="/content/opportunities"
                        className="text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded border border-primary/20 flex items-center gap-1 transition-colors"
                        title="Este acontecimento gerou uma oportunidade de conteúdo"
                      >
                        <Sparkles size={10} className="text-amber-500" />
                        <span>Ver oportunidade</span>
                      </Link>
                    )}
                  </div>

                  {/* Excluir com confirmação */}
                  <button
                    type="button"
                    onClick={() => setEntryToDelete(entry)}
                    title="Excluir este registro"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
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
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg p-2.5"
                      >
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <Lightbulb size={13} className="shrink-0 mt-0.5 text-primary" />
                          <span className="leading-snug">
                            <strong className="font-semibold">Sinal de Conteúdo:</strong> &ldquo;{sinal}&rdquo;
                          </span>
                        </div>
                        {onCreateIdea && (
                          <button
                            type="button"
                            onClick={() => onCreateIdea({
                              title: sinal,
                              description: `Originado do Daily em ${entry.entryDate} (${formatTime(entry.entryTime)}):\n"${entry.rawContent}"`,
                              sourceType: 'daily',
                              sourceId: entry.id
                            })}
                            className="shrink-0 self-end sm:self-auto text-[11px] font-semibold bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary px-2.5 py-1 rounded-md transition-all active:scale-95"
                          >
                            Transformar em ideia
                          </button>
                        )}
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

                {/* Ação manual de transformar nota simples em ideia */}
                {!hasContentSignals && onCreateIdea && (
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onCreateIdea({
                        title: entry.rawContent.length > 70 ? `${entry.rawContent.substring(0, 70)}...` : entry.rawContent,
                        description: `Originado do Daily em ${entry.entryDate} (${formatTime(entry.entryTime)}):\n"${entry.rawContent}"`,
                        sourceType: 'daily',
                        sourceId: entry.id
                      })}
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium"
                    >
                      <Lightbulb size={11} />
                      <span>Criar ideia desta anotação</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Confirmação de Exclusão (Radix UI) */}
      <Dialog open={!!entryToDelete} onOpenChange={(open) => { if (!open) setEntryToDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertTriangle size={18} />
              <DialogTitle className="text-base font-bold text-foreground">
                Excluir registro do Daily?
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Tem certeza que deseja excluir esta memória? Esta ação removerá a entrada e seus sinais de inteligência associados.
            </DialogDescription>
          </DialogHeader>

          {entryToDelete && (
            <div className="p-3 bg-muted/50 border border-border rounded-xl text-xs text-foreground/80 italic line-clamp-3">
              &ldquo;{entryToDelete.rawContent}&rdquo;
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-end mt-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setEntryToDelete(null)}
              className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="px-3.5 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir registro'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
