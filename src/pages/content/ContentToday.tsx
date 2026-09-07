import { useState, useEffect } from 'react';
import { useContentDaily } from '@/hooks/content/useContentDaily';
import { useCRM } from '@/contexts/CRMContext';
import DailyHeader from '@/components/content/daily/DailyHeader';
import DailyQuickCapture from '@/components/content/daily/DailyQuickCapture';
import DailyTimeline from '@/components/content/daily/DailyTimeline';
import DailyPlannedSection from '@/components/content/daily/DailyPlannedSection';
import GoogleCalendarModal from '@/components/content/daily/GoogleCalendarModal';
import NewActivityModal from '@/components/activities-v2/NewActivityModal';

export default function ContentToday() {
  const {
    selectedDate,
    isToday,
    entries,
    crmActivities,
    calendarEvents,
    isCalendarConnected,
    isSyncingCalendar,
    isLoading,
    isSubmitting,
    addEntry,
    removeEntry,
    updateEntryText,
    ingestPlannedItems,
    syncCalendar,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    refresh,
  } = useContentDaily();

  const {
    activities: allStoreActivities = [],
    deals = [],
    contacts = [],
    pipelines = {},
    logs = [],
    updateActivity,
    openFocusDeal,
  } = useCRM();

  const [isGoogleCalendarModalOpen, setIsGoogleCalendarModalOpen] = useState(false);
  const [isNewActivityModalOpen, setIsNewActivityModalOpen] = useState(false);
  const [prefilledCaptureText, setPrefilledCaptureText] = useState<string>('');

  // Auto-ingest planned items (Google Agenda + CRM Activities + Pipeline Notes/Comments) into Daily
  useEffect(() => {
    if (!isLoading) {
      ingestPlannedItems({
        targetDate: selectedDate,
        calendarEvents,
        activities: allStoreActivities,
        logs,
        deals,
        contacts,
        pipelines,
      });
    }
  }, [selectedDate, calendarEvents, allStoreActivities, logs, deals, contacts, pipelines, isLoading, ingestPlannedItems]);

  // Helper date matcher (YYYY-MM-DD)
  const isDateMatch = (dateStr?: string, targetDate?: string) => {
    if (!dateStr || !targetDate) return false;
    return dateStr.startsWith(targetDate) || dateStr.slice(0, 10) === targetDate;
  };

  // Merge CRM store activities with fallback from useContentDaily
  const sourceActivities = allStoreActivities.length > 0 ? allStoreActivities : crmActivities;

  // 1. Planned for selectedDate (due on this day and pending)
  const plannedActivities = sourceActivities.filter(a =>
    !a.completed && a.status !== 'completed' && a.status !== 'canceled' && isDateMatch(a.dueDate, selectedDate)
  );

  // 2. Completed on selectedDate
  const completedActivities = sourceActivities.filter(a =>
    (a.completed || a.status === 'completed') && (
      isDateMatch(a.completedAt, selectedDate) ||
      (!a.completedAt && isDateMatch(a.dueDate, selectedDate))
    )
  );

  const handleToggleActivity = async (activityId: string, currentCompleted: boolean) => {
    if (updateActivity) {
      const nextCompleted = !currentCompleted;
      await updateActivity(activityId, {
        completed: nextCompleted,
        status: nextCompleted ? 'completed' : 'pending',
        completedAt: nextCompleted ? new Date().toISOString() : undefined,
      });
    }
  };

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

      {/* 2. Responsive 2-Column Grid: Inputs & Cronologia (Left) + Planejado CRM/Agenda (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Quick Capture & Timeline */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Capture Form (Text & Voice) */}
          <DailyQuickCapture
            onAddEntry={addEntry}
            isSubmitting={isSubmitting}
            prefilledText={prefilledCaptureText}
            onClearPrefill={() => setPrefilledCaptureText('')}
          />

          {/* Timeline Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-tight">
                  {isToday ? 'Daily de Hoje' : 'Linha do Tempo'}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Planejamento e acontecimentos em ordem cronológica
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {entries.length} {entries.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            <DailyTimeline
              entries={entries}
              onDeleteEntry={removeEntry}
              onUpdateEntry={updateEntryText}
              isLoading={isLoading}
              onOpenDeal={dealId => openFocusDeal && openFocusDeal(dealId)}
            />
          </div>
        </div>

        {/* Right Column: CRM Planned & Google Calendar */}
        <div className="lg:col-span-5 space-y-6">
          <DailyPlannedSection
            plannedActivities={plannedActivities}
            completedActivities={completedActivities}
            calendarEvents={calendarEvents}
            deals={deals}
            contacts={contacts}
            pipelines={pipelines}
            logs={logs}
            isToday={isToday}
            selectedDate={selectedDate}
            isCalendarConnected={isCalendarConnected}
            isSyncingCalendar={isSyncingCalendar}
            onOpenGoogleCalendarModal={() => setIsGoogleCalendarModalOpen(true)}
            onSyncCalendar={syncCalendar}
            onOpenNewActivityModal={() => setIsNewActivityModalOpen(true)}
            onToggleActivity={handleToggleActivity}
            onOpenDeal={dealId => openFocusDeal && openFocusDeal(dealId)}
          />
        </div>
      </div>

      {/* Modal para conectar Google Agenda via iCal */}
      <GoogleCalendarModal
        isOpen={isGoogleCalendarModalOpen}
        onClose={() => setIsGoogleCalendarModalOpen(false)}
        onConnected={() => {
          syncCalendar();
          refresh();
        }}
      />

      {/* Modal para criar nova atividade rápida no CRM */}
      <NewActivityModal
        isOpen={isNewActivityModalOpen}
        onClose={() => {
          setIsNewActivityModalOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
