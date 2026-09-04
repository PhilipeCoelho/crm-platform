import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DailyHeaderProps {
  selectedDate: string;
  isToday: boolean;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onGoToToday: () => void;
}

export default function DailyHeader({
  selectedDate,
  isToday,
  onPreviousDay,
  onNextDay,
  onGoToToday,
}: DailyHeaderProps) {
  // Format date in Portuguese
  const formatDateTitle = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
      const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
      const formattedDate = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      
      return {
        weekday: capitalizedWeekday,
        fullDate: formattedDate,
      };
    } catch {
      return { weekday: 'Data', fullDate: dateStr };
    }
  };

  const { weekday, fullDate } = formatDateTitle(selectedDate);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-foreground">{weekday}</h2>
          {isToday && (
            <span className="text-[11px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              Hoje
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <CalendarIcon size={13} className="text-muted-foreground/70" />
          {fullDate}
        </p>
      </div>

      <div className="flex items-center gap-1.5 self-start sm:self-auto">
        {!isToday && (
          <button
            onClick={onGoToToday}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/60 text-foreground transition-colors"
          >
            Ir para hoje
          </button>
        )}
        <div className="flex items-center border border-border rounded-lg bg-card overflow-hidden">
          <button
            onClick={onPreviousDay}
            title="Dia anterior"
            className="p-1.5 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors border-r border-border"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={onNextDay}
            title="Próximo dia"
            className="p-1.5 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
