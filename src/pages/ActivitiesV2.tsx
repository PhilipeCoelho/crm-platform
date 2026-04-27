import { useState, useMemo, useCallback } from 'react';
import './activities-v2.css';
import { useCRM } from '@/contexts/CRMContext';
import { Activity, Deal, Stage } from '@/types/schema';
import { Currency } from '@/data/currencies';
import { filterRealActivities } from '@/utils/activityHelpers';
import { Icons } from '@/components/activities-v2/Icons';
import { differenceInDays, parseISO, isToday as isTodayFn } from 'date-fns';
import DetailPanelReal from '@/components/activities-v2/DetailPanelReal';
import CompleteActivityModal from '@/components/activities/CompleteActivityModal';
import NewActivityModal from '@/components/activities/NewActivityModal';

// --- Type config ---
type TabId = 'all' | 'call' | 'email' | 'message' | 'meeting' | 'task' | 'done';

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  call:      { label: 'Ligação',   icon: 'phone',    color: 'var(--vp-blue-500)', bg: 'var(--vp-blue-50)' },
  email:     { label: 'E-mail',    icon: 'mail',     color: 'var(--vp-purple)',   bg: 'var(--vp-purple-bg)' },
  message:   { label: 'Mensagem',  icon: 'whatsapp', color: 'var(--vp-success)',  bg: 'var(--vp-success-bg)' },
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

function fmtMoney(v: number, currency: Currency): string {
  const formatted = new Intl.NumberFormat(currency.locale, {
    style: 'currency', currency: currency.code,
    minimumFractionDigits: v % 1 === 0 ? 0 : 2,
    maximumFractionDigits: v % 1 === 0 ? 0 : 2,
    notation: v >= 100_000 ? 'compact' : 'standard',
  }).format(v);
  return formatted.replace(/\s+/g, '');
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


export default function ActivitiesV2({ currency }: { currency: Currency }) {
  const {
    deals, activities, contacts, pipelines, logs,
    updateActivity, openFocusDeal, isPrivacyMode, togglePrivacyMode
  } = useCRM();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('all');
  const [activityToComplete, setActivityToComplete] = useState<Activity | null>(null);
  const [dealIdForNewActivity, setDealIdForNewActivity] = useState<string | null>(null);

  // Mode States
  const [viewMode, setViewMode] = useState<'timeline' | 'focus' | 'engine'>('timeline');
  const [focusIndex, setFocusIndex] = useState(0);
  const [isTweaksOpen, setIsTweaksOpen] = useState(false);
  const [isBacklogExpanded, setIsBacklogExpanded] = useState(false);

  // --- Lookups ---
  const getDeal = useCallback((id?: string): Deal | undefined => deals.find(d => d.id === id), [deals]);
  const getContactName = useCallback((id?: string) => contacts.find(c => c.id === id)?.name || '', [contacts]);

  // --- All pipeline stages flat ---
  const allStages = useMemo(() => {
    const stages: Stage[] = [];
    Object.values(pipelines).forEach(p => stages.push(...(p.stages || [])));
    return stages;
  }, [pipelines]);
  const getStage = useCallback((stageId?: string) => allStages.find((s: any) => s.id === stageId), [allStages]);

  // --- Real activities ---
  const realActivities = useMemo(() => filterRealActivities(activities), [activities]);

  const openActivities = useMemo(() =>
    realActivities.filter(a => !a.completed && a.status !== 'canceled'),
  [realActivities]);

  const completedActivities = useMemo(() =>
    realActivities
      .filter(a => a.completed)
      .sort((a, b) => (b.completedAt || b.updatedAt || '').localeCompare(a.completedAt || a.updatedAt || '')),
  [realActivities]);

  // --- Sorting & Filtering ---
  const filtered = useMemo(() => {
    if (tab === 'done') return [];
    if (tab === 'all') return openActivities;
    return openActivities.filter(a => a.type === tab);
  }, [openActivities, tab]);

  const sortedForEngine = useMemo(() => {
    return [...openActivities].sort((a, b) => {
      const dueA = getDueDays(a.dueDate);
      const dueB = getDueDays(b.dueDate);
      if (dueA !== dueB) return dueA - dueB;
      const valA = getDeal(a.dealId)?.value || 0;
      const valB = getDeal(b.dealId)?.value || 0;
      return valB - valA;
    });
  }, [openActivities, getDeal]);

  // --- KPIs ---
  const overdueCount = useMemo(() => openActivities.filter(a => getDueDays(a.dueDate) < 0).length, [openActivities]);
  const todayCount = useMemo(() => openActivities.filter(a => a.dueDate && isTodayFn(parseISO(a.dueDate))).length, [openActivities]);
  const todayCompleted = useMemo(() =>
    completedActivities.filter(a => {
      const d = a.completedAt || a.updatedAt;
      return d && isTodayFn(parseISO(d));
    }).length,
  [completedActivities]);

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: openActivities.length, done: completedActivities.length };
    for (const t of Object.keys(TYPE_CONFIG)) c[t] = openActivities.filter(a => a.type === t).length;
    return c;
  }, [openActivities, completedActivities]);

  const selectedActivity = useMemo(() =>
    activities.find(a => a.id === selectedId) || null,
  [selectedId, activities]);

  // --- Actions ---
  const onCompleteClick = useCallback((activity: Activity) => {
    setActivityToComplete(activity);
  }, []);

  const onUndo = useCallback((id: string) => {
    updateActivity(id, { completed: false });
  }, [updateActivity]);

  const onSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const toggleFocusMode = useCallback(() => {
    setViewMode(prev => prev === 'focus' ? 'timeline' : 'focus');
    setFocusIndex(0);
  }, []);

  const toggleExecutionMode = useCallback(() => {
    setViewMode(prev => prev === 'engine' ? 'timeline' : 'engine');
    setFocusIndex(0);
  }, []);

  const nextFocus = useCallback(() => {
    const list = viewMode === 'engine' ? sortedForEngine : filtered;
    setFocusIndex(prev => Math.min(prev + 1, list.length - 1));
  }, [viewMode, sortedForEngine, filtered]);

  const prevFocus = useCallback(() => {
    setFocusIndex(prev => Math.max(prev - 1, 0));
  }, []);

  // --- Render Helpers ---
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
      >
        {isDone ? (
          <button className="av2-checkbox av2-checkbox--done"><Icons.check size={12} /></button>
        ) : (
          <button className="av2-checkbox" onClick={e => { e.stopPropagation(); onCompleteClick(a); }} />
        )}
        <div className="av2-type" style={{ background: tc.bg, color: tc.color }}><TypeIcon size={15} /></div>
        <div className="av2-card-body">
          <div className={`av2-card-title ${isDone ? 'av2-card-title--done' : ''}`}>{a.title}</div>
          <div className="av2-card-meta">
            {deal && <span className={`av2-card-deal ${blur}`}>{deal.title}</span>}
            {stage && <><span className="av2-card-dot">·</span><span className="av2-stage-dot" style={{ background: stage.color || 'var(--vp-blue-500)' }} /><span>{stage.title}</span></>}
            {contactName && <><span className="av2-card-dot">·</span><span className={blur}>{contactName}</span></>}
          </div>
        </div>
        {deal && <span className={`av2-card-value ${blur}`}>{fmtMoney(deal.value, currency)}</span>}
        <span className={`av2-due av2-due--${isDone ? 'done' : due <= -14 ? 'critical' : due < 0 ? 'overdue' : 'future'}`}>
          {isDone ? fmtCompletedTime(a.completedAt || a.updatedAt) : <><Icons.clock size={11} /> {fmtDue(due, a.dueDate)}</>}
        </span>
        {isDone && <button className="av2-btn av2-btn--outline" style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={e => { e.stopPropagation(); onUndo(a.id); }}><Icons.undo size={12} /> Reabrir</button>}
      </div>
    );
  };

  // --- ENGINE VIEW ---
  if (viewMode === 'engine') {
    const activeActivity = sortedForEngine[focusIndex];
    const nextActivities = sortedForEngine.slice(focusIndex + 1, focusIndex + 4);
    const activeDeal = activeActivity ? getDeal(activeActivity.dealId) : null;
    const overdueDays = activeActivity ? Math.abs(getDueDays(activeActivity.dueDate)) : 0;

    return (
      <div className={`av2 av2--engine ${isPrivacyMode ? 'av2--privacy' : ''}`}>
        <div className="av2-main">
          <div className="av2-engine-header">
            <div className="av2-engine-header-left">
              <div className="av2-engine-badge">MOTOR DE EXECUÇÃO</div>
              <h1 className="av2-engine-header-title">Sua Próxima Ação</h1>
            </div>
            <div className="av2-engine-header-right">
              {overdueCount > 5 && <div className="av2-engine-alert"><Icons.flame size={14} /> <strong>{overdueCount}</strong> críticas</div>}
              <button className="av2-engine-btn-exit" onClick={() => setViewMode('timeline')}><Icons.close size={14} /> Parar</button>
            </div>
          </div>
          <div className="av2-engine-content">
            {activeActivity ? (
              <div className="av2-engine-hero">
                <div className="av2-engine-hero-main">
                  <div className="av2-engine-hero-info">
                    <div className="av2-engine-hero-type" style={{ color: TYPE_CONFIG[activeActivity.type]?.color }}>
                      {(() => { const Icon = Icons[TYPE_CONFIG[activeActivity.type]?.icon || 'check']; return <Icon size={20} />; })()}
                      {TYPE_CONFIG[activeActivity.type]?.label}
                    </div>
                    <h2 className="av2-engine-hero-title">{activeActivity.title}</h2>
                    <div className="av2-engine-hero-context">
                      <span className={isPrivacyMode ? 'av2-blur' : ''} onClick={() => activeDeal && openFocusDeal(activeDeal.id)}>{activeDeal?.title}</span>
                      <span className="av2-engine-sep">·</span>
                      <span className={isPrivacyMode ? 'av2-blur' : ''}>{getContactName(activeActivity.contactId) || getContactName(activeDeal?.contactId)}</span>
                    </div>
                    <div className="av2-engine-hero-overdue"><Icons.clock size={14} /> {overdueDays > 0 ? `Atrasada há ${overdueDays} dias` : 'Vence hoje'}</div>
                  </div>
                  <div className="av2-engine-hero-actions">
                    <button className="av2-engine-btn-primary" onClick={() => onCompleteClick(activeActivity)}><Icons.check size={20} /> Concluir Atividade</button>
                    <div className="av2-engine-btn-group">
                      <button className="av2-engine-btn-secondary" onClick={nextFocus}>Adiar 1d</button>
                      <button className="av2-engine-btn-secondary" onClick={nextFocus}>Adiar 3d</button>
                      <button className="av2-engine-btn-secondary" onClick={() => activeDeal && openFocusDeal(activeDeal.id)}>Ver Negócio</button>
                    </div>
                  </div>
                </div>
                {(activeActivity.notes || activeActivity.tooltipScript) && (
                  <div className="av2-engine-hero-ai"><Icons.zap size={16} /><p>{activeActivity.notes || activeActivity.tooltipScript}</p></div>
                )}
              </div>
            ) : (
              <div className="av2-empty-state" style={{ padding: '80px 0', textAlign: 'center' }}>
                <Icons.target size={48} className="text-meta" />
                <h2>Tudo em dia!</h2>
                <button className="av2-btn av2-btn--primary" style={{ marginTop: 24 }} onClick={() => setViewMode('timeline')}>Voltar</button>
              </div>
            )}

            {activeActivity && nextActivities.length > 0 && (
              <div className="av2-engine-previews">
                <h3 className="av2-engine-section-title">A SEGUIR</h3>
                <div className="av2-engine-preview-list">
                  {nextActivities.map((na, idx) => (
                    <div key={na.id} className="av2-engine-preview-card" onClick={() => setFocusIndex(focusIndex + idx + 1)}>
                      <div className="av2-engine-preview-type" style={{ color: TYPE_CONFIG[na.type]?.color }}>
                        {(() => { const Icon = Icons[TYPE_CONFIG[na.type]?.icon || 'check']; return <Icon size={14} />; })()}
                      </div>
                      <div className="av2-engine-preview-body">
                        <div className="av2-engine-preview-title">{na.title}</div>
                        <div className="av2-engine-preview-sub">{getDeal(na.dealId)?.title}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="av2-engine-backlog">
              <button className="av2-engine-backlog-toggle" onClick={() => setIsBacklogExpanded(!isBacklogExpanded)}>
                {isBacklogExpanded ? 'Recolher Fila' : `Ver Fila (${sortedForEngine.length})`}
                <Icons.more size={16} />
              </button>
              {isBacklogExpanded && (
                <div className="av2-engine-backlog-list">
                  {sortedForEngine.map((a, idx) => (
                    <div key={a.id} className={`av2-engine-backlog-item ${idx === focusIndex ? 'active' : ''}`} onClick={() => setFocusIndex(idx)}>
                      <div className="av2-engine-backlog-idx">{idx + 1}</div>
                      <div className="av2-engine-backlog-content">
                        <div className="av2-engine-backlog-title">{a.title}</div>
                        <div className="av2-engine-backlog-deal">{getDeal(a.dealId)?.title}</div>
                      </div>
                      <div className="av2-engine-backlog-due">{getDueDays(a.dueDate)}d</div>
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

  // --- FOCUS VIEW ---
  if (viewMode === 'focus') {
    const activeActivity = filtered[focusIndex];
    const total = filtered.length;
    const activeDeal = activeActivity ? getDeal(activeActivity.dealId) : null;
    const activeDealHistory = activeDeal ? logs.filter((l: any) => l.dealId === activeDeal.id).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)) : [];
    const activePastActivities = activeDeal ? activities.filter((a: any) => a.dealId === activeDeal.id && a.completed && a.id !== activeActivity.id).sort((a: any, b: any) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt)).slice(0, 3) : [];

    return (
      <div className={`av2 av2--focus ${isPrivacyMode ? 'av2--privacy' : ''}`}>
        <div className="av2-main">
          <div className="av2-focus-header">
            <div className="av2-focus-header-left">
              <div className="av2-focus-title-group">
                <div className="av2-focus-icon-bg"><Icons.target size={20} className="text-white" /></div>
                <div><h1 className="av2-focus-title">Modo Foco</h1><p className="av2-focus-sub">Uma de cada vez</p></div>
              </div>
              <div className="av2-focus-progress">
                <div className="av2-focus-progress-text"><strong>{focusIndex + 1}</strong> / {total} restantes</div>
                <div className="av2-focus-progress-bar"><div className="av2-focus-progress-fill" style={{ width: `${((focusIndex + 1) / (total + todayCompleted)) * 100}%` }} /></div>
              </div>
            </div>
            <div className="av2-focus-header-actions">
              <div className="av2-focus-nav">
                <button className="av2-focus-btn-nav" onClick={prevFocus} disabled={focusIndex === 0}><Icons.chevronLeft size={16} /> Anterior</button>
                <button className="av2-focus-btn-nav" onClick={nextFocus} disabled={focusIndex === total - 1}>Próxima <Icons.chevronRight size={16} /></button>
              </div>
              <button className="av2-focus-btn-exit" onClick={toggleFocusMode}><Icons.close size={14} /> Sair</button>
            </div>
          </div>
          <div className="av2-focus-content">
            {activeActivity ? (
              <div className="av2-focus-central-card">
                <div className="av2-focus-card-body">
                  <div className="av2-focus-activity-type">
                    <div className="av2-focus-type-icon" style={{ background: TYPE_CONFIG[activeActivity.type]?.bg, color: TYPE_CONFIG[activeActivity.type]?.color }}><Icons.check size={20} /></div>
                    <div className="av2-focus-type-label">{TYPE_CONFIG[activeActivity.type]?.label}</div>
                  </div>
                  <h2 className="av2-focus-activity-title">{activeActivity.title}</h2>
                  <div className="av2-focus-context"><Icons.user size={16} /> <span className={isPrivacyMode ? 'av2-blur' : ''}>{activeDeal?.title}</span></div>
                  
                  {activePastActivities.length > 0 && (
                    <div className="av2-focus-history-mini">
                       {activePastActivities.map(pa => <div key={pa.id} className="av2-focus-history-dot" title={pa.title} />)}
                    </div>
                  )}

                  <div className="av2-focus-actions">
                    <button className="av2-focus-btn-primary" onClick={() => onCompleteClick(activeActivity)}><Icons.check size={18} /> Concluir & Próxima</button>
                    <button className="av2-focus-btn-ghost" onClick={nextFocus}><Icons.clock size={16} /> Adiar</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="av2-empty"><h2>Tudo limpo!</h2><button className="av2-btn av2-btn--primary" onClick={toggleFocusMode}>Voltar</button></div>
            )}
            {/* Unused but logic kept for structure */}
            <div style={{ display: 'none' }}>{activeDealHistory.length}</div>
          </div>
        </div>
        <div className="av2-focus-sidebar">
          <h3 className="av2-focus-sidebar-title">FILA</h3>
          <div className="av2-focus-queue">
            {filtered.map((a, i) => (
              <div key={a.id} className={`av2-focus-queue-item ${i === focusIndex ? 'av2-focus-queue-item--active' : ''}`} onClick={() => setFocusIndex(i)}>
                <div className="av2-focus-queue-body"><div className="av2-focus-queue-title">{getDeal(a.dealId)?.title}</div><div className="av2-focus-queue-sub">{a.title}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- TIMELINE VIEW (DEFAULT) ---
  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const b of BUCKETS) map.set(b.id, []);
    for (const a of filtered) map.get(bucketOf(getDueDays(a.dueDate)))?.push(a);
    return map;
  }, [filtered]);

  return (
    <div className={`av2 ${isPrivacyMode ? 'av2--privacy' : ''}`}>
      <div className="av2-main">
        <div className="av2-header">
          <div className="av2-header-row1">
            <div className="av2-header-left">
              <h1 className="av2-header-title">Atividades</h1>
              <div className="av2-kpi"><strong>{openActivities.length}</strong> abertas</div>
              {overdueCount > 0 && <div className="av2-kpi av2-kpi--warn"><strong>{overdueCount}</strong> atrasadas</div>}
              <div className="av2-kpi av2-kpi--blue"><strong>{todayCount}</strong> para hoje</div>
            </div>
            <div className="av2-header-actions">
              <button className="av2-btn av2-btn--primary" onClick={toggleExecutionMode}><Icons.zap size={14} /> Trabalhar Lista</button>
              <button className="av2-btn av2-btn--outline" onClick={() => setIsTweaksOpen(true)}><Icons.more size={14} /> Ajustes</button>
            </div>
          </div>
          <div className="av2-tabs">
            {(['all', 'call', 'email', 'message', 'meeting', 'task'] as TabId[]).map(t => (
              <button key={t} className={`av2-tab ${tab === t ? 'av2-tab--active' : ''}`} onClick={() => setTab(t)}>
                {TYPE_CONFIG[t]?.label || 'Todos'} <span className="av2-tab-count">{tabCounts[t]}</span>
              </button>
            ))}
            <span className="av2-tab-separator" />
            <button className={`av2-tab av2-tab--done ${tab === 'done' ? 'av2-tab--active' : ''}`} onClick={() => setTab('done')}>
              <Icons.check size={13} /> Concluídas <span className="av2-tab-count">{tabCounts.done}</span>
            </button>
          </div>
        </div>

        <div className="av2-scroll">
          {tab === 'done' ? (
            completedActivities.map(a => renderCard(a, true))
          ) : (
            <>
              {BUCKETS.map(b => {
                const items = grouped.get(b.id) || [];
                if (items.length === 0) return null;
                return (
                  <div key={b.id}>
                    <div className="av2-bucket"><span>{b.label}</span></div>
                    {items.map(a => renderCard(a))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {isTweaksOpen && (
        <div className="av2-tweaks-panel">
          <div className="av2-tweaks-header"><h3>Ajustes</h3><button onClick={() => setIsTweaksOpen(false)}><Icons.close size={14} /></button></div>
          <div className="av2-tweaks-section"><button onClick={toggleFocusMode}>Modo Foco</button></div>
          <div className="av2-tweaks-section"><button onClick={togglePrivacyMode}>{isPrivacyMode ? 'Desativar' : 'Ativar'} Privacidade</button></div>
        </div>
      )}

      {selectedId && !selectedActivity?.completed && <DetailPanelReal activity={selectedActivity!} currency={currency} onClose={() => setSelectedId(null)} onComplete={onCompleteClick} />}
      
      <CompleteActivityModal 
        isOpen={!!activityToComplete} 
        onClose={() => setActivityToComplete(null)} 
        activity={activityToComplete} 
        onCompleted={() => {
          if (activityToComplete?.dealId) setDealIdForNewActivity(activityToComplete.dealId);
          setActivityToComplete(null);
          setSelectedId(null);
          if (viewMode !== 'timeline') {
            const list = viewMode === 'engine' ? sortedForEngine : filtered;
            if (focusIndex >= list.length - 1) setFocusIndex(Math.max(0, list.length - 2));
          }
        }} 
      />

      <NewActivityModal isOpen={!!dealIdForNewActivity} onClose={() => setDealIdForNewActivity(null)} preselectedDealId={dealIdForNewActivity || undefined} />
    </div>
  );
}
