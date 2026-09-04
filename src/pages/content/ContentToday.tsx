import { useContentDaily } from '@/hooks/content/useContentDaily';
import DailyHeader from '@/components/content/daily/DailyHeader';
import DailyQuickCapture from '@/components/content/daily/DailyQuickCapture';
import DailyTimeline from '@/components/content/daily/DailyTimeline';
import DailyPlannedSection from '@/components/content/daily/DailyPlannedSection';
import { Sparkles, Lightbulb, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ContentToday() {
  const {
    selectedDate,
    isToday,
    entries,
    crmActivities,
    isLoading,
    isSubmitting,
    addEntry,
    removeEntry,
    goToToday,
    goToPreviousDay,
    goToNextDay,
  } = useContentDaily();

  // Aggregate all AI signals captured for this day
  const dailySignals = entries
    .flatMap(e => e.aiSignals?.sinais_conteudo || [])
    .filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* 1. Header with date controls */}
      <DailyHeader
        selectedDate={selectedDate}
        isToday={isToday}
        onPreviousDay={goToPreviousDay}
        onNextDay={goToNextDay}
        onGoToToday={goToToday}
      />

      {/* 2. Responsive 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Main Column: Quick Capture & Timeline (8 cols on desktop) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quick Capture Form */}
          <DailyQuickCapture
            onAddEntry={addEntry}
            isSubmitting={isSubmitting}
          />

          {/* Timeline Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                {isToday ? 'Acontecimentos de Hoje' : 'Linha do Tempo'}
              </h3>
              <span className="text-xs text-muted-foreground">
                {entries.length} {entries.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            <DailyTimeline
              entries={entries}
              onDeleteEntry={removeEntry}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Right Column: CRM Planned & Sinais Desk (4 cols on desktop) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Planned in CRM */}
          <DailyPlannedSection
            activities={crmActivities}
            isToday={isToday}
          />

          {/* Sinais de Conteúdo do Dia */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Lightbulb size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Sinais Detectados</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {dailySignals.length === 0
                      ? 'Nenhum sinal extraído ainda'
                      : `${dailySignals.length} ${dailySignals.length === 1 ? 'tese identificada' : 'teses identificadas'}`}
                  </p>
                </div>
              </div>

              {dailySignals.length > 0 && (
                <Link
                  to="/content/opportunities"
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                  <span>Oportunidades</span>
                  <ArrowUpRight size={12} />
                </Link>
              )}
            </div>

            {dailySignals.length === 0 ? (
              <p className="text-xs text-muted-foreground italic leading-relaxed py-2">
                Conforme você registra reuniões, falas de clientes e percepções, a IA identifica crenças de mercado e sinais que alimentam suas Oportunidades de conteúdo.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {dailySignals.map((sinal, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-xs text-foreground leading-relaxed flex items-start gap-2"
                  >
                    <Sparkles size={13} className="text-amber-500 shrink-0 mt-0.5" />
                    <span>&ldquo;{sinal}&rdquo;</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
