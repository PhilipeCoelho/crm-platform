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
  ChevronUp
} from 'lucide-react';
import { Activity } from '@/types/schema';

interface DailyPlannedSectionProps {
  activities: Activity[];
  isToday: boolean;
}

export default function DailyPlannedSection({
  activities,
  isToday,
}: DailyPlannedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const completedCount = activities.filter(a => a.completed).length;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone size={13} className="text-amber-500" />;
      case 'meeting':
        return <Video size={13} className="text-blue-500" />;
      case 'email':
        return <Mail size={13} className="text-indigo-500" />;
      default:
        return <CheckSquare size={13} className="text-emerald-500" />;
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
      <div 
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(prev => !prev)}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <CalendarCheck2 size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {isToday ? 'Planejado no CRM' : 'Compromissos do Dia'}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {activities.length === 0
                ? 'Sem agendamentos'
                : `${completedCount} de ${activities.length} concluídos`}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Expandir ou recolher compromissos"
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          {activities.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-3">
              Nenhuma atividade ou reunião agendada no CRM para esta data.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {activities.map(activity => {
                const time = formatActivityTime(activity.dueDate);
                return (
                  <div
                    key={activity.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs transition-colors ${
                      activity.completed
                        ? 'bg-muted/30 border-border/40 opacity-70'
                        : 'bg-card border-border hover:border-border/80'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {activity.completed ? (
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      ) : (
                        <Circle size={14} className="text-muted-foreground/60" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        {getActivityIcon(activity.type)}
                        <span className="truncate">{activity.title}</span>
                      </div>
                      
                      {activity.notes && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {activity.notes}
                        </p>
                      )}
                    </div>

                    {time && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-muted/60 px-1.5 py-0.5 rounded">
                        {time}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
