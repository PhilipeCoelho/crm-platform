import { useState, useMemo, useCallback } from 'react';
import './activities-v2.css';
import { useCRM } from '@/contexts/CRMContext';
import { Activity, Deal, Stage } from '@/types/schema';
import { filterRealActivities } from '@/utils/activityHelpers';
import { Icons } from '@/components/activities-v2/Icons';
import { differenceInDays, parseISO, isToday as isTodayFn } from 'date-fns';
import DetailPanelReal from '@/components/activities-v2/DetailPanelReal';

// --- Type config ---
type TabId = 'all' | 'call' | 'email' | 'message' | 'meeting' | 'task' | 'done';

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  call:      { label: 'Ligação',   icon: 'phone',    color: 'var(--vp-blue-500)', bg: 'var(--vp-blue-50)' },
  email:     { label: 'E-mail',    icon: 'mail',     color: 'var(--vp-purple)',   bg: 'var(--vp-purple-bg)' },
  message:   { label: 'WhatsApp',  icon: 'whatsapp', color: 'var(--vp-success)',  bg: 'var(--vp-success-bg)' },
  instagram: { label: 'Instagram', icon: 'whatsapp', color: 'var(--vp-pink)',     bg: 'var(--vp-pink-bg)' },
  meeting:   { label: 'Reunião',   icon: 'video',    color: 'var(--vp-pink)',     bg: 'var(--vp-pink-bg)' },
  task:      { label: 'Tarefa',    icon: 'check',    color: 'var(--vp-ink-600)',  bg: 'var(--vp-ink-50)' },
  analysis:  { label: 'Análise',   icon: 'search',   color: 'var(--vp-purple)',   bg: 'var(--vp-purple-bg)' },
  audit:     { label: 'Auditoria', icon: 'video',    color: 'var(--vp-blue-600)', bg: 'var(--vp-blue-50)' },
};

const BUCKETS = [
  { id: 'critical', label: 'Críticas',    sub: 'mais de 14 dias atrasadas', tone: 'critical' },
  { id: 'overdue',  label: 'Atrasadas',   sub: 'precisam de atenção',       tone: 'warn' },
  { id: 'today',    label: 'Hoje',        sub: '',                          tone: 'today' },
  { id: 'week',     label: 'Esta semana', sub: '',                          tone: 'normal' },
  { id: 'later',    label: 'Mais tarde',  sub: '',                          tone: 'soft' },
] as const;

function getDueDays(dueDate?: string): number {
  if (!dueDate) return 999;
  return differenceInDays(parseISO(dueDate), new Date());
}

function bucketOf(due: number) {
  if (due <= -14) return 'critical';
  if (due < 0)    return 'overdue';
  if (due === 0)  return 'today';
  if (due <= 7)   return 'week';
  return 'later';
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${v}`;
}

function fmtDue(due: number, dueDate?: string): string {
  if (due === 0) {
    if (dueDate) {
      try { const d = parseISO(dueDate); const h = d.getHours(); const m = d.getMinutes(); if (h > 0 || m > 0) return `hoje · ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; } catch {}
    }
    return 'hoje';
  }
  if (due < 0)  return `${Math.abs(due)} dias atrás`;
  if (due === 1) return 'amanhã';
  return `em ${due} dias`;
}

function fmtCompletedTime(dateStr?: string): string {
  if (!dateStr) return '';
  const ts = parseISO(dateStr).getTime();
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 60)    return 'agora mesmo';
  if (diff < 3600)  return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const GOAL = 12;

export default function ActivitiesV2() {
  const {
    deals, activities, contacts, pipelines,
    updateActivity, openFocusDeal, isPrivacyMode
  } = useCRM();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('all');

  // --- All pipeline stages flat ---
  const allStages = useMemo(() => {
    const stages: Stage[] = [];
    Object.values(pipelines).forEach(p => stages.push(...(p.stages || [])));
    return stages;
  }, [pipelines]);

  // --- Real activities (no notes/system events) ---
  const realActivities = useMemo(() => filterRealActivities(activities), [activities]);

  // --- Open (active) activities ---
  const openActivities = useMemo(() =>
    realActivities.filter(a => !a.completed && a.status !== 'canceled'),
  [realActivities]);

  // --- Completed activities ---
  const completedActivities = useMemo(() =>
    realActivities
      .filter(a => a.completed)
      .sort((a, b) => (b.completedAt || b.updatedAt || '').localeCompare(a.completedAt || a.updatedAt || '')),
  [realActivities]);

  // --- Filtered by tab ---
  const filtered = useMemo(() => {
    if (tab === 'done') return [];
    if (tab === 'all') return openActivities;
    return openActivities.filter(a => a.type === tab);
  }, [openActivities, tab]);

  // --- Grouped by bucket ---
  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const b of BUCKETS) map.set(b.id, []);
    for (const a of filtered) {
      const due = getDueDays(a.dueDate);
      const bk = bucketOf(due);
      map.get(bk)?.push(a);
    }
    // Sort each bucket by due date
    for (const [, items] of map) {
      items.sort((a, b) => getDueDays(a.dueDate) - getDueDays(b.dueDate));
    }
    return map;
  }, [filtered]);

  // --- KPIs ---
  const overdueCount = useMemo(() => openActivities.filter(a => getDueDays(a.dueDate) < 0).length, [openActivities]);
  const todayCount = useMemo(() => openActivities.filter(a => {
    if (!a.dueDate) return false;
    return isTodayFn(parseISO(a.dueDate));
  }).length, [openActivities]);

  const todayCompleted = useMemo(() =>
    completedActivities.filter(a => {
      const d = a.completedAt || a.updatedAt;
      return d && isTodayFn(parseISO(d));
    }).length,
  [completedActivities]);

  const goalMet = todayCompleted >= GOAL;

  // Tab counts
  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: openActivities.length, done: completedActivities.length };
    for (const t of Object.keys(TYPE_CONFIG)) c[t] = openActivities.filter(a => a.type === t).length;
    return c;
  }, [openActivities, completedActivities]);

  // --- Lookups ---
  const getDeal = useCallback((id?: string): Deal | undefined => deals.find(d => d.id === id), [deals]);
  const getContactName = useCallback((id?: string) => contacts.find(c => c.id === id)?.name || '', [contacts]);
  const getStage = useCallback((stageId?: string) => allStages.find(s => s.id === stageId), [allStages]);

  const selectedActivity = useMemo(() =>
    activities.find(a => a.id === selectedId) || null,
  [selectedId, activities]);

  // --- Actions ---
  const onComplete = useCallback((id: string) => {
    updateActivity(id, { completed: true });
    if (selectedId === id) setSelectedId(null);
  }, [selectedId, updateActivity]);

  const onUndo = useCallback((id: string) => {
    updateActivity(id, { completed: false });
  }, [updateActivity]);

  const onSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  // --- Bucket icon ---
  const bucketIcon = (tone: string) => {
    switch (tone) {
      case 'critical': return <Icons.flame size={13} />;
      case 'warn': return <Icons.clock size={13} />;
      case 'today': return <Icons.target size={13} />;
      default: return <Icons.calendar size={13} />;
    }
  };

  // --- Card renderer ---
  const renderCard = (a: Activity, isDone = false) => {
    const tc = TYPE_CONFIG[a.type] || TYPE_CONFIG.task;
    const deal = getDeal(a.dealId);
    const stage = deal ? getStage(deal.stageId) : undefined;
    const contactName = getContactName(a.contactId) || getContactName(deal?.contactId);
    const TypeIcon = Icons[tc.icon] || Icons.check;
    const isSelected = selectedId === a.id && !isDone;
    const blur = isPrivacyMode ? 'av2-blur' : '';
    const due = getDueDays(a.dueDate);

    return (
      <div
        key={a.id}
        className={`av2-card ${isSelected ? 'av2-card--selected' : ''} ${isDone ? 'av2-card--completed' : ''}`}
        onClick={() => isDone ? (a.dealId && openFocusDeal(a.dealId)) : onSelect(a.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && !isDone && onSelect(a.id)}
      >
        {isDone ? (
          <button className="av2-checkbox av2-checkbox--done" aria-label="Concluída">
            <Icons.check size={12} />
          </button>
        ) : (
          <button
            className="av2-checkbox"
            onClick={e => { e.stopPropagation(); onComplete(a.id); }}
            aria-label="Concluir atividade"
          />
        )}

        <div className="av2-type" style={{ background: tc.bg, color: tc.color }}>
          <TypeIcon size={15} />
        </div>

        <div className="av2-card-body">
          <div className={`av2-card-title ${isDone ? 'av2-card-title--done' : ''}`}>{a.title}</div>
          <div className="av2-card-meta">
            {deal && <span className={`av2-card-deal ${blur}`}>{deal.title}</span>}
            {stage && (
              <>
                <span className="av2-card-dot">·</span>
                <span className="av2-stage-dot" style={{ background: stage.color || 'var(--vp-blue-500)' }} />
                <span>{stage.title}</span>
              </>
            )}
            {contactName && (
              <>
                <span className="av2-card-dot">·</span>
                <span className={blur}>{contactName}</span>
              </>
            )}
          </div>
        </div>

        {deal && <span className={`av2-card-value ${blur}`}>{fmtMoney(deal.value)}</span>}

        {isDone ? (
          <span className="av2-due av2-due--done">{fmtCompletedTime(a.completedAt || a.updatedAt)}</span>
        ) : (
          <span className={`av2-due av2-due--${due <= -14 ? 'critical' : due < 0 ? 'overdue' : due === 0 ? 'today' : 'future'}`}>
            <Icons.clock size={11} />
            {fmtDue(due, a.dueDate)}
          </span>
        )}

        {isDone && (
          <button
            className="av2-btn av2-btn--outline"
            style={{ padding: '4px 10px', fontSize: 11.5 }}
            onClick={e => { e.stopPropagation(); onUndo(a.id); }}
          >
            <Icons.undo size={12} />
            Reabrir
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`av2 ${isPrivacyMode ? 'av2--privacy' : ''}`}>
      <div className="av2-main">
        {/* Header */}
        <div className="av2-header">
          <div className="av2-header-row1">
            <div className="av2-header-left">
              <h1 className="av2-header-title">Atividades</h1>
              <div className="av2-kpi"><strong>{openActivities.length}</strong> abertas</div>
              {overdueCount > 0 && (
                <div className="av2-kpi av2-kpi--warn">
                  <span className="av2-kpi-dot" style={{ background: 'var(--vp-warn)' }} />
                  <strong>{overdueCount}</strong> atrasadas
                </div>
              )}
              <div className="av2-kpi av2-kpi--blue">
                <span className="av2-kpi-dot" style={{ background: 'var(--vp-blue-500)' }} />
                <strong>{todayCount}</strong> para hoje
              </div>
            </div>
            <div className="av2-header-actions">
              <button className="av2-btn av2-btn--outline"><Icons.plus size={14} /> Nova atividade</button>
              <button className="av2-btn av2-btn--primary"><Icons.target size={14} /> Modo Foco</button>
            </div>
          </div>

          <div className="av2-tabs">
            {(['all', 'call', 'email', 'message', 'meeting', 'task'] as TabId[]).map(t => (
              <button key={t} className={`av2-tab ${tab === t ? 'av2-tab--active' : ''}`} onClick={() => setTab(t)}>
                {t === 'all' ? 'Todos' : TYPE_CONFIG[t]?.label || t}
                <span className="av2-tab-count">{tabCounts[t] || 0}</span>
              </button>
            ))}
            <span className="av2-tab-separator" />
            <button className={`av2-tab av2-tab--done ${tab === 'done' ? 'av2-tab--active' : ''}`} onClick={() => setTab('done')}>
              <Icons.check size={13} /> Concluídas
              <span className="av2-tab-count">{tabCounts.done}</span>
            </button>
          </div>
        </div>

        {/* Scroll */}
        <div className="av2-scroll">
          {tab === 'done' ? (
            completedActivities.length === 0 ? (
              <div className="av2-empty">
                <div className="av2-empty-circle"><Icons.check size={24} /></div>
                <div className="av2-empty-title">Nenhuma atividade concluída ainda</div>
                <div className="av2-empty-sub">Quando você concluir uma atividade, ela aparece aqui.</div>
              </div>
            ) : (
              <>
                <div className="av2-bucket">
                  <span className="av2-bucket-pill av2-bucket-pill--success">
                    <Icons.check size={13} /> Concluídas <span className="av2-bucket-count">{completedActivities.length}</span>
                  </span>
                  <span className="av2-bucket-line" />
                </div>
                {completedActivities.slice(0, 50).map(a => renderCard(a, true))}
              </>
            )
          ) : (
            <>
              {/* Goal */}
              <div className={`av2-goal ${goalMet ? 'av2-goal--done' : ''}`}>
                <span className="av2-goal-icon">{goalMet ? <Icons.check size={14} /> : <Icons.target size={14} />}</span>
                <span className="av2-goal-label">Meta do dia</span>
                <span className="av2-goal-text">{goalMet ? '🎉 Meta batida!' : `${todayCompleted}/${GOAL} · faltam ${GOAL - todayCompleted}`}</span>
                <div className="av2-goal-bar">
                  <div className="av2-goal-fill" style={{ width: `${Math.min(100, (todayCompleted / GOAL) * 100)}%` }} />
                </div>
              </div>

              {BUCKETS.map(b => {
                const items = grouped.get(b.id) || [];
                if (items.length === 0) return null;
                return (
                  <div key={b.id}>
                    <div className="av2-bucket">
                      <span className={`av2-bucket-pill av2-bucket-pill--${b.tone}`}>
                        {bucketIcon(b.tone)} {b.label} <span className="av2-bucket-count">{items.length}</span>
                      </span>
                      {b.sub && <span className="av2-bucket-sub">{b.sub}</span>}
                      <span className="av2-bucket-line" />
                    </div>
                    {items.map(a => renderCard(a))}
                  </div>
                );
              })}

              {completedActivities.length > 0 && (
                <button className="av2-done-link" onClick={() => setTab('done')}>
                  <Icons.check size={14} /> {todayCompleted} concluídas hoje · ver
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedActivity && !selectedActivity.completed && (
        <DetailPanelReal
          activity={selectedActivity}
          onClose={() => setSelectedId(null)}
          onComplete={onComplete}
        />
      )}
    </div>
  );
}
