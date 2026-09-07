import { useState } from 'react';
import { 
  CalendarCheck2, 
  CheckCircle2, 
  Circle, 
  Phone, 
  Video, 
  Mail, 
  CheckSquare, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  Plus, 
  RefreshCw, 
  ExternalLink, 
  MapPin, 
  Clock, 
  Building
} from 'lucide-react';
import { Activity, Deal, Contact, Pipeline, DealLog } from '@/types/schema';
import { GoogleCalendarEvent } from '@/services/googleCalendarService';

interface DailyPlannedSectionProps {
  plannedActivities: Activity[];
  completedActivities: Activity[];
  calendarEvents?: GoogleCalendarEvent[];
  deals?: Deal[];
  contacts?: Contact[];
  pipelines?: Record<string, Pipeline>;
  logs?: DealLog[];
  isToday: boolean;
  selectedDate?: string;
  isCalendarConnected?: boolean;
  isSyncingCalendar?: boolean;
  onOpenGoogleCalendarModal?: () => void;
  onSyncCalendar?: () => void;
  onOpenNewActivityModal?: () => void;
  onToggleActivity?: (activityId: string, currentCompleted: boolean) => void;
  onOpenDeal?: (dealId: string) => void;
}

export function getLeadStageInfo(deal?: Deal, pipelines?: Record<string, Pipeline>): { title: string; colorClass: string } | null {
  if (!deal) return null;

  let stageTitle = '';
  if (pipelines) {
    for (const p of Object.values(pipelines)) {
      const found = p.stages?.find(s => s.id === deal.stageId);
      if (found) {
        stageTitle = found.title;
        break;
      }
    }
  }

  if (!stageTitle) {
    stageTitle = deal.stageId || 'Lead';
  }

  const normalized = stageTitle.toLowerCase();
  
  if (normalized.includes('prospect')) {
    return {
      title: 'Prospect',
      colorClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
    };
  }
  if (normalized.includes('engaj') || normalized.includes('contact') || normalized.includes('contactado')) {
    return {
      title: stageTitle || 'Lead Engajado',
      colorClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    };
  }
  if (normalized.includes('reun') || normalized.includes('meet') || normalized.includes('call') || normalized.includes('apresent')) {
    return {
      title: stageTitle || 'Reunião',
      colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    };
  }
  if (normalized.includes('fech') || normalized.includes('propos') || normalized.includes('nego') || normalized.includes('close')) {
    return {
      title: stageTitle || 'Fechamento',
      colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    };
  }
  return {
    title: stageTitle || 'Lead',
    colorClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  };
}

export default function DailyPlannedSection({
  plannedActivities = [],
  completedActivities = [],
  calendarEvents = [],
  deals = [],
  contacts = [],
  pipelines = {},
  logs = [],
  isToday,
  selectedDate,
  isCalendarConnected = false,
  isSyncingCalendar = false,
  onOpenGoogleCalendarModal,
  onSyncCalendar,
  onOpenNewActivityModal,
  onToggleActivity,
  onOpenDeal,
}: DailyPlannedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isDateMatch = (dateStr?: string, targetDate?: string) => {
    if (!dateStr || !targetDate) return false;
    return dateStr.startsWith(targetDate) || dateStr.slice(0, 10) === targetDate;
  };

  const todayLogs = (logs || []).filter(l => 
    l.logType !== 'system' && Boolean(l.content?.trim()) && isDateMatch(l.createdAt, selectedDate)
  );

  const totalItems = calendarEvents.length + plannedActivities.length + todayLogs.length + completedActivities.length;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone size={13} className="text-amber-500 shrink-0" />;
      case 'meeting':
        return <Video size={13} className="text-blue-500 shrink-0" />;
      case 'email':
        return <Mail size={13} className="text-indigo-500 shrink-0" />;
      default:
        return <CheckSquare size={13} className="text-emerald-500 shrink-0" />;
    }
  };

  const formatActivityTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div 
          className="flex items-center gap-2 cursor-pointer select-none flex-1 min-w-0"
          onClick={() => setIsExpanded(prev => !prev)}
        >
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <CalendarCheck2 size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {isToday ? 'Planejamento de Hoje' : 'Compromissos do Dia'}
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {totalItems === 0
                ? 'Sem agendamentos'
                : `${plannedActivities.length} atividades • ${todayLogs.length} notas • ${completedActivities.length} concluídas${calendarEvents.length > 0 ? ` • ${calendarEvents.length} agenda` : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Sincronizar Agenda */}
          {isCalendarConnected && onSyncCalendar && (
            <button
              type="button"
              onClick={onSyncCalendar}
              disabled={isSyncingCalendar}
              title="Sincronizar agenda agora"
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
            >
              <RefreshCw size={14} className={isSyncingCalendar ? 'animate-spin text-primary' : ''} />
            </button>
          )}

          {/* Conectar / Configurar Google Calendar */}
          {onOpenGoogleCalendarModal && (
            <button
              type="button"
              onClick={onOpenGoogleCalendarModal}
              title={isCalendarConnected ? 'Google Agenda conectada (clique para gerenciar)' : 'Conectar Google Agenda'}
              className={`px-2 py-1 text-[11px] font-medium rounded-lg border transition-all flex items-center gap-1 ${
                isCalendarConnected 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                  : 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10'
              }`}
            >
              <Calendar size={12} />
              <span className="hidden sm:inline">Google Agenda</span>
            </button>
          )}

          {/* Botão Nova Atividade */}
          {onOpenNewActivityModal && (
            <button
              type="button"
              onClick={onOpenNewActivityModal}
              title="Adicionar nova atividade no CRM"
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
            >
              <Plus size={15} />
            </button>
          )}

          {/* Toggle Expand */}
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Expandir ou recolher compromissos"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          {totalItems === 0 ? (
            /* Estado limpo quando não há nada no dia (conforme regra do Phil) */
            <div className="text-center py-3 px-2 space-y-2">
              <p className="text-xs text-muted-foreground italic">
                Nenhum compromisso ou atividade agendada para {isToday ? 'hoje' : 'esta data'}.
              </p>
              
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                {onOpenNewActivityModal && (
                  <button
                    type="button"
                    onClick={onOpenNewActivityModal}
                    className="px-2.5 py-1 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>+ Atividade no CRM</span>
                  </button>
                )}

                {onOpenGoogleCalendarModal && !isCalendarConnected && (
                  <button
                    type="button"
                    onClick={onOpenGoogleCalendarModal}
                    className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-all inline-flex items-center gap-1 active:scale-95"
                  >
                    <Calendar size={12} />
                    <span>Conectar Google Agenda</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
              {/* 1. GOOGLE CALENDAR EVENTS */}
              {calendarEvents.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider px-1">
                    <Calendar size={12} />
                    <span>Google Agenda ({calendarEvents.length})</span>
                  </div>

                  <div className="space-y-2">
                    {calendarEvents.map(event => (
                      <div
                        key={event.id}
                        className="p-2.5 rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 text-xs space-y-1.5 transition-all hover:border-blue-300 dark:hover:border-blue-800"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-1.5 flex-1 min-w-0">
                            <div className="mt-0.5 w-4 h-4 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                              <Calendar size={11} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-foreground truncate block">
                                {event.title}
                              </span>
                              {event.description && (
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {event.description}
                                </p>
                              )}
                              {event.location && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                                  <MapPin size={10} className="shrink-0 text-blue-500" />
                                  <span>{event.location}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">
                              {event.isAllDay ? 'Dia todo' : (event.startTime ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ''}` : '')}
                            </span>
                            {event.calendarName && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                {event.calendarName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-blue-200/40 dark:border-blue-900/30">
                          {event.url ? (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5"
                            >
                              <span>Abrir link</span>
                              <ExternalLink size={9} />
                            </a>
                          ) : <span />}

                          <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 flex items-center gap-1 font-medium">
                            <CheckCircle2 size={11} className="text-blue-500" />
                            <span>No Daily</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. ATIVIDADES PLANEJADAS NO CRM (PENDENTES DO DIA) */}
              {plannedActivities.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80 uppercase tracking-wider px-1">
                    <CheckSquare size={12} className="text-primary" />
                    <span>Planejadas para o dia ({plannedActivities.length})</span>
                  </div>

                  <div className="space-y-2">
                    {plannedActivities.map(activity => {
                      const deal = deals.find(d => d.id === activity.dealId);
                      const contact = contacts.find(c => c.id === activity.contactId);
                      const stageInfo = getLeadStageInfo(deal, pipelines);
                      const time = formatActivityTime(activity.dueDate);

                      return (
                        <div
                          key={activity.id}
                          className="p-2.5 rounded-xl border border-border bg-card hover:border-border/80 transition-all text-xs space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            {/* Checkbox para Concluir */}
                            <button
                              type="button"
                              onClick={() => onToggleActivity && onToggleActivity(activity.id, false)}
                              title="Marcar como concluída"
                              className="mt-0.5 text-muted-foreground/60 hover:text-emerald-500 transition-colors shrink-0"
                            >
                              <Circle size={15} />
                            </button>

                            <div className="flex-1 min-w-0">
                              {/* Título da Atividade */}
                              <div className="flex items-center gap-1.5 font-medium text-foreground">
                                {getActivityIcon(activity.type)}
                                <span className="truncate">{activity.title}</span>
                              </div>

                              {/* Informações do Lead & Etapa do Pipeline */}
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {deal && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenDeal && onOpenDeal(deal.id)}
                                    title="Ver detalhes do lead no CRM"
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground/90 hover:text-primary hover:underline"
                                  >
                                    <Building size={11} className="text-muted-foreground shrink-0" />
                                    <span className="truncate max-w-[140px]">{deal.title}</span>
                                  </button>
                                )}

                                {!deal && contact && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Building size={11} className="shrink-0" />
                                    <span className="truncate max-w-[140px]">{contact.name}</span>
                                  </span>
                                )}

                                {/* Badge da Etapa do Pipeline (Prospect, Lead, Lead Engajado, Reunião, Fechamento) */}
                                {stageInfo && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${stageInfo.colorClass}`}>
                                    {stageInfo.title}
                                  </span>
                                )}
                              </div>

                              {activity.notes && (
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">
                                  {activity.notes}
                                </p>
                              )}
                            </div>

                            {/* Horário */}
                            {time && (
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-muted/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Clock size={10} />
                                {time}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2.5 NOTAS E COMENTÁRIOS DO PIPELINE */}
              {todayLogs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider px-1">
                    <Building size={12} />
                    <span>Notas do Pipeline ({todayLogs.length})</span>
                  </div>

                  <div className="space-y-2">
                    {todayLogs.map(log => {
                      const deal = deals.find(d => d.id === log.dealId);
                      const stageInfo = getLeadStageInfo(deal, pipelines);
                      const time = formatActivityTime(log.createdAt);

                      return (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/20 text-xs space-y-1.5 transition-all hover:border-amber-300 dark:hover:border-amber-800"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-1.5 flex-1 min-w-0">
                              <Building size={12} className="mt-0.5 text-amber-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                {deal && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenDeal && onOpenDeal(deal.id)}
                                    title="Ver detalhes do lead no CRM"
                                    className="font-semibold text-foreground hover:text-primary hover:underline truncate block"
                                  >
                                    {deal.title}
                                  </button>
                                )}
                                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                                  {log.content}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {time && (
                                <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Clock size={10} />
                                  {time}
                                </span>
                              )}
                              {stageInfo && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${stageInfo.colorClass}`}>
                                  {stageInfo.title}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-amber-200/40 dark:border-amber-900/30">
                            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 flex items-center gap-1 font-medium">
                              <CheckCircle2 size={11} className="text-amber-500" />
                              <span>No Daily</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. ATIVIDADES CONCLUÍDAS HOJE */}
              {completedActivities.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-1">
                    <CheckCircle2 size={12} />
                    <span>Concluídas no dia ({completedActivities.length})</span>
                  </div>

                  <div className="space-y-1.5">
                    {completedActivities.map(activity => {
                      const deal = deals.find(d => d.id === activity.dealId);
                      const contact = contacts.find(c => c.id === activity.contactId);
                      const stageInfo = getLeadStageInfo(deal, pipelines);
                      const time = formatActivityTime(activity.completedAt || activity.dueDate);

                      return (
                        <div
                          key={activity.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-xl border border-border/40 bg-muted/30 text-xs transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Checkbox para Desmarcar */}
                            <button
                              type="button"
                              onClick={() => onToggleActivity && onToggleActivity(activity.id, true)}
                              title="Desmarcar como concluída"
                              className="text-emerald-500 hover:text-muted-foreground transition-colors shrink-0"
                            >
                              <CheckCircle2 size={15} />
                            </button>

                            <div className="min-w-0 flex-1">
                              <span className="line-through text-muted-foreground font-medium truncate block">
                                {activity.title}
                              </span>
                              
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {deal ? (
                                  <span className="text-[10px] text-muted-foreground/80 truncate max-w-[120px]">
                                    {deal.title}
                                  </span>
                                ) : contact ? (
                                  <span className="text-[10px] text-muted-foreground/80 truncate max-w-[120px]">
                                    {contact.name}
                                  </span>
                                ) : null}
                                {stageInfo && (
                                  <span className={`px-1 py-0.2 rounded text-[9px] font-semibold border ${stageInfo.colorClass}`}>
                                    {stageInfo.title}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {time && (
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                                {time}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
