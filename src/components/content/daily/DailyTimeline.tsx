import { useState } from 'react';
import { 
  Clock, 
  Mic, 
  FileText, 
  Trash2, 
  Sparkles, 
  CloudOff,
  AlertTriangle,
  Edit3,
  Check,
  X,
  Loader2,
  Calendar,
  CalendarCheck2,
  Building,
  CheckSquare,
  Activity
} from 'lucide-react';
import { ContentDailyEntry } from '@/services/contentService';
import { 
  sortEntriesChronologically, 
  extractEntryDisplayTime,
  cleanEntryContent
} from '@/services/contentDailyService';
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
  onUpdateEntry?: (id: string, newContent: string) => Promise<void>;
  isLoading?: boolean;
  onOpenDeal?: (dealId: string) => void;
}

export default function DailyTimeline({
  entries,
  onDeleteEntry,
  onUpdateEntry,
  isLoading = false,
  onOpenDeal,
}: DailyTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'planejado' | 'acontecimento'>('all');
  const [entryToDelete, setEntryToDelete] = useState<ContentDailyEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  const handleStartEdit = (entry: ContentDailyEntry) => {
    setEditingId(entry.id);
    setEditContent(cleanEntryContent(entry.rawContent));
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim() || !onUpdateEntry) return;
    setIsSavingEdit(true);
    try {
      await onUpdateEntry(id, editContent.trim());
      setEditingId(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const parts = timeStr.split(':');
      if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
      return timeStr;
    } catch {
      return timeStr;
    }
  };

  // 1. Sort all entries in chronological order
  const sortedEntries = sortEntriesChronologically(entries);

  // 2. Classify entries: Planejado vs Acontecimento
  const isEntryPlanned = (entry: ContentDailyEntry) => {
    return entry.entryType === 'planejado' || entry.sourceType === 'crm_sync';
  };

  const plannedEntries = sortedEntries.filter(isEntryPlanned);
  const happeningEntries = sortedEntries.filter(e => !isEntryPlanned(e));

  // 3. Apply active filter
  const displayedEntries = activeFilter === 'planejado'
    ? plannedEntries
    : activeFilter === 'acontecimento'
    ? happeningEntries
    : sortedEntries;

  // Helper for stage styling
  const getStageColor = (stageName?: string | null) => {
    if (!stageName) return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
    const norm = stageName.toLowerCase();
    if (norm.includes('prospect')) {
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30';
    }
    if (norm.includes('engaj') || norm.includes('contact')) {
      return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
    }
    if (norm.includes('reun') || norm.includes('meet') || norm.includes('call')) {
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
    }
    if (norm.includes('fech') || norm.includes('propos') || norm.includes('nego')) {
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    }
    return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
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

  return (
    <div className="space-y-4">
      {/* Filter Tabs: Tudo (Cronológico) | Planejado | Acontecimentos */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border/60 rounded-xl text-xs font-medium w-fit">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            activeFilter === 'all'
              ? 'bg-card text-foreground shadow-sm font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock size={12} className={activeFilter === 'all' ? 'text-primary' : ''} />
          <span>Tudo (Cronológico)</span>
          <span className="text-[10px] bg-muted/80 px-1.5 py-0.2 rounded-full font-mono">
            {sortedEntries.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('planejado')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            activeFilter === 'planejado'
              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 shadow-sm font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarCheck2 size={12} className={activeFilter === 'planejado' ? 'text-blue-600 dark:text-blue-400' : ''} />
          <span>Planejado</span>
          <span className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded-full font-mono">
            {plannedEntries.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('acontecimento')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
            activeFilter === 'acontecimento'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-sm font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles size={12} className={activeFilter === 'acontecimento' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
          <span>Acontecimentos</span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-mono">
            {happeningEntries.length}
          </span>
        </button>
      </div>

      {/* Empty State */}
      {displayedEntries.length === 0 ? (
        <div className="py-12 px-4 text-center bg-card/40 border border-dashed border-border rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-muted/70 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
            {activeFilter === 'planejado' ? (
              <CalendarCheck2 size={22} />
            ) : activeFilter === 'acontecimento' ? (
              <Sparkles size={22} />
            ) : (
              <Clock size={22} />
            )}
          </div>
          <h3 className="font-semibold text-foreground text-sm">
            {activeFilter === 'planejado'
              ? 'Nenhum compromisso ou atividade planejada para este dia'
              : activeFilter === 'acontecimento'
              ? 'Nenhum acontecimento registrado para este dia'
              : 'Nenhum registro para este dia'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1.5 leading-relaxed">
            {activeFilter === 'planejado'
              ? 'Compromissos da Google Agenda e atividades/notas agendadas no pipeline aparecerão aqui automaticamente.'
              : 'Grave um áudio ou digite acima para registrar o que aconteceu na sua rotina.'}
          </p>
        </div>
      ) : (
        /* Timeline List */
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
          {displayedEntries.map((entry) => {
            const isPlanned = isEntryPlanned(entry);
            const isVoice = entry.sourceType === 'voice';
            const isSync = entry.sourceType === 'crm_sync';
            const isEditing = editingId === entry.id;
            const displayTime = extractEntryDisplayTime(entry) || formatTime(entry.entryTime);

            // Detailed categorization for sync items
            const isGoogleCal = isSync && (entry.rawContent.includes('[Google Agenda') || (!entry.activityId && !entry.dealId));
            const isCrmActivity = isSync && (entry.rawContent.includes('[Atividade CRM') || Boolean(entry.activityId));
            const isLeadNote = isSync && (entry.rawContent.includes('[Nota do Lead') || (Boolean(entry.dealId) && !entry.activityId));

            // Extract pipeline stage if present
            const stageMatch = entry.rawContent.match(/\[(?:Atividade CRM|Nota do Lead)\s*•\s*([^\]]+)\]/);
            const stageName = stageMatch ? stageMatch[1].trim() : null;

            return (
              <div key={entry.id} className="relative group">
                {/* Timeline Rail Dot */}
                <div className={`absolute -left-6 top-3 w-5 h-5 rounded-full border-2 border-background bg-card flex items-center justify-center transition-colors shadow-sm ${
                  isPlanned 
                    ? 'text-blue-500 group-hover:border-blue-500' 
                    : 'text-emerald-500 group-hover:border-emerald-500'
                }`}>
                  {isPlanned ? (
                    isGoogleCal ? (
                      <Calendar size={10} className="text-blue-500" />
                    ) : isLeadNote ? (
                      <Building size={10} className="text-amber-500" />
                    ) : (
                      <CalendarCheck2 size={10} className="text-indigo-500" />
                    )
                  ) : isVoice ? (
                    <Mic size={10} className="text-rose-500" />
                  ) : (
                    <Sparkles size={10} className="text-emerald-500" />
                  )}
                </div>

                {/* Entry Card */}
                <div className={`bg-card border rounded-2xl p-4 shadow-sm transition-all hover:border-border/80 ${
                  isPlanned ? 'border-blue-200/40 dark:border-blue-900/30' : 'border-border'
                }`}>
                  {/* Card Header with Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Horário Cronológico */}
                      <span className="text-xs font-mono font-semibold text-muted-foreground flex items-center gap-1">
                        <Clock size={12} className="text-muted-foreground/70" />
                        {displayTime}
                      </span>

                      {/* Classificação Central: Planejado vs Acontecimento */}
                      {isPlanned ? (
                        <span className="text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CalendarCheck2 size={10} className="text-blue-500" />
                          Planejado
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Activity size={10} className="text-emerald-500" />
                          Acontecimento
                        </span>
                      )}

                      {/* Sub-Badges de Origem */}
                      {isGoogleCal && (
                        <span className="text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-blue-500/20">
                          <Calendar size={9} />
                          Google Agenda
                        </span>
                      )}

                      {isCrmActivity && (
                        <span className="text-[10px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-indigo-500/20">
                          <CheckSquare size={9} />
                          Atividade CRM
                        </span>
                      )}

                      {isLeadNote && (
                        <span className="text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-500/20">
                          <Building size={9} />
                          Nota do Lead
                        </span>
                      )}

                      {/* Badge da Etapa do Pipeline */}
                      {stageName && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getStageColor(stageName)}`}>
                          {stageName}
                        </span>
                      )}

                      {isVoice && (
                        <span className="text-[10px] font-medium bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded flex items-center gap-1 border border-rose-500/20">
                          <Mic size={9} />
                          Áudio
                        </span>
                      )}

                      {!isVoice && !isSync && (
                        <span className="text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-500/20">
                          <FileText size={9} />
                          Registro Rápido
                        </span>
                      )}

                      {/* Link para Lead no CRM se dealId existir */}
                      {entry.dealId && onOpenDeal && (
                        <button
                          type="button"
                          onClick={() => onOpenDeal(entry.dealId!)}
                          title="Abrir detalhes deste lead no CRM"
                          className="text-[10px] font-medium text-primary hover:underline inline-flex items-center gap-1 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/20 transition-colors"
                        >
                          <Building size={9} />
                          <span>Ver Lead</span>
                        </button>
                      )}

                      {entry.isLocalOnly && (
                        <span 
                          title="Registro salvo no seu navegador. Está seguro e acessível."
                          className="text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-500/20"
                        >
                          <CloudOff size={9} />
                          Salvo localmente
                        </span>
                      )}
                    </div>

                    {/* Ações: Editar e Excluir */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {!isEditing && onUpdateEntry && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(entry)}
                          title="Editar anotação"
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setEntryToDelete(entry)}
                        title="Excluir este registro"
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Raw Content or Edit Mode */}
                  {isEditing ? (
                    <div className="space-y-2 mt-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full text-sm p-2.5 rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={isSavingEdit}
                          className="px-2.5 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1"
                        >
                          <X size={12} />
                          <span>Cancelar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(entry.id)}
                          disabled={isSavingEdit || !editContent.trim()}
                          className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1 shadow-sm"
                        >
                          {isSavingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          <span>Salvar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {cleanEntryContent(entry.rawContent)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              &ldquo;{cleanEntryContent(entryToDelete.rawContent)}&rdquo;
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
    </div>
  );
}
