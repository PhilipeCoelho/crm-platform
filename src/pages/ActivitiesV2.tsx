import { useState, useMemo, useCallback, useEffect } from 'react';
import './activities-v2.css';
import { useCRM } from '@/contexts/CRMContext';
import { Activity, Deal } from '@/types/schema';
import { Currency } from '@/data/currencies';
import { filterRealActivities } from '@/utils/activityHelpers';
import { Icons } from '@/components/activities-v2/Icons';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import DetailPanelReal from '@/components/activities-v2/DetailPanelReal';
import CompleteActivityModal from '@/components/activities/CompleteActivityModal';
import NewActivityModal from '@/components/activities/NewActivityModal';

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  call:      { label: 'Ligar',   icon: 'phone',    color: 'var(--ax-blue)',   bg: 'var(--ax-blue-bg)' },
  email:     { label: 'E-mail',  icon: 'mail',     color: '#7c5cff',          bg: '#efebff' },
  message:   { label: 'Mensagem', icon: 'whatsapp', color: 'var(--ax-success)', bg: '#defaee' },
  meeting:   { label: 'Reunião', icon: 'video',    color: '#d23a82',          bg: '#fde7f1' },
  task:      { label: 'Tarefa',  icon: 'check',    color: 'var(--ax-neutral)', bg: 'var(--ax-neutral-bg)' },
};

function getDueDays(dueDate?: string): number {
  if (!dueDate) return 999;
  return differenceInDays(startOfDay(parseISO(dueDate)), startOfDay(new Date()));
}

function fmtMoney(v: number, currency: Currency): string {
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency', currency: currency.code,
    minimumFractionDigits: 0,
    notation: v >= 100_000 ? 'compact' : 'standard',
  }).format(v).replace(/\s+/g, '');
}

export default function ActivitiesV2({ currency }: { currency: Currency }) {
  const {
    deals, activities, contacts, pipelines, logs,
    updateActivity, openFocusDeal, isPrivacyMode,
    completeActivityWithLog, addActivity, updateDeal,
    deleteActivity
  } = useCRM();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityToComplete, setActivityToComplete] = useState<Activity | null>(null);
  const [dealIdForNewActivity, setDealIdForNewActivity] = useState<string | null>(null);
  const [isBacklogExpanded, setIsBacklogExpanded] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'overdue' | 'today' | 'future'>('all');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [execNotes, setExecNotes] = useState('');
  const [nextTaskType, setNextTaskType] = useState<string | null>(null);

  // --- Lookups ---
  const getDeal = useCallback((id?: string) => deals.find(d => d.id === id), [deals]);
  const getContact = useCallback((id?: string) => contacts.find(c => c.id === id), [contacts]);
  const getStage = useCallback((deal?: Deal) => {
    if (!deal) return null;
    const pipe = pipelines[deal.pipelineId];
    return pipe?.stages?.find(s => s.id === deal.stageId);
  }, [pipelines]);

  // --- Logic: Radical Priority Sorting + Filters ---
  const openActivities = useMemo(() => {
    return filterRealActivities(activities)
      .filter(a => !a.completed && a.status !== 'canceled')
      .filter(a => {
        const deal = getDeal(a.dealId);
        return !deal || deal.status === 'open';
      })
      .filter(a => filterType === 'all' || a.type === filterType)
      .filter(a => {
        if (periodFilter === 'all') return true;
        const dueDays = getDueDays(a.dueDate);
        if (periodFilter === 'overdue') return dueDays < 0;
        if (periodFilter === 'today') return dueDays === 0;
        if (periodFilter === 'future') return dueDays > 0 && dueDays !== 999;
        return true;
      })
      .sort((a, b) => {
        const dueA = getDueDays(a.dueDate);
        const dueB = getDueDays(b.dueDate);
        if (dueA !== dueB) return dueA - dueB;
        const valA = getDeal(a.dealId)?.value || 0;
        const valB = getDeal(b.dealId)?.value || 0;
        return valB - valA;
      });
  }, [activities, getDeal, filterType, periodFilter]);

  const currentHero = openActivities[0];
  const queue = openActivities.slice(1, 10); // Show up to 10 in queue
  const backlog = openActivities.slice(10);

  // Clear notes when switching
  useEffect(() => {
    setExecNotes('');
  }, [selectedId]);

  const selectedActivity = useMemo(() => 
    activities.find(a => a.id === selectedId) || null,
  [selectedId, activities]);

  // --- Actions ---
  const handleExecute = (a: Activity) => {
    if (execNotes) {
      updateActivity(a.id, { notes: execNotes });
    }
    setActivityToComplete(a);
  };

  const directComplete = async (a: Activity) => {
    if (!nextTaskType) return;
    
    // 1. Complete with notes
    await completeActivityWithLog(a.id, execNotes || "Concluído via Modo Foco", false);
    
    // 2. Create Next Task
    const nextTypeLabel = TYPE_CONFIG[nextTaskType]?.label || 'Nova Atividade';
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1); // Default to tomorrow

    await addActivity({
      dealId: a.dealId!,
      type: nextTaskType as any,
      title: `${nextTypeLabel} (Follow-up)`,
      status: 'pending',
      completed: false,
      dueDate: nextDueDate.toISOString()
    });

    // 3. Move flow
    moveToNext(true);
  };

  const handlePostpone = (a: Activity) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    updateActivity(a.id, { 
      dueDate: d.toISOString(),
      notes: execNotes ? (a.notes ? a.notes + '\n' + execNotes : execNotes) : a.notes
    });
    moveToNext();
  };
  const handleSkip = () => {
    const idx = openActivities.findIndex(a => a.id === selectedId);
    if (idx !== -1 && idx < openActivities.length - 1) {
      setSelectedId(openActivities[idx + 1].id);
    }
  };

  const moveToNext = (exitFocusIfEmpty = false) => {
    setExecNotes('');
    setNextTaskType(null);
    if (openActivities.length > 1) {
      setSelectedId(openActivities[1].id);
    } else {
      setSelectedId(null);
      if (exitFocusIfEmpty) setIsFocusMode(false);
    }
  };

  const handleMarkAsLost = async (a: Activity) => {
    if (!execNotes) return;
    if (!a.dealId) return;

    const confirmLost = window.confirm("Tem certeza que deseja marcar este negócio como PERDIDO?");
    if (!confirmLost) return;

    // 1. Complete activity with the execution note
    await completeActivityWithLog(a.id, execNotes, false);

    // 2. Mark deal as lost
    await updateDeal(a.dealId, { status: 'lost' });

    // 2.5 Delete other pending activities for this deal
    const otherPending = activities.filter(act => 
      act.dealId === a.dealId && 
      act.id !== a.id && 
      !act.completed
    );
    for (const p of otherPending) {
      await deleteActivity(p.id);
    }

    // 3. Move flow
    moveToNext(true);
  };

  const renderQueueItem = (a: Activity, idx: number) => {
    const deal = getDeal(a.dealId);
    const due = getDueDays(a.dueDate);
    const blur = isPrivacyMode ? 'ax-blur' : '';
    
    return (
      <div 
        key={a.id} 
        className={`ax-queue-item ${selectedId === a.id ? 'ax-queue-item--selected' : ''}`}
        onClick={() => setSelectedId(a.id)}
      >
        <span className="ax-queue-idx">{idx + 2}</span>
        <span className="ax-queue-title">{a.title}</span>
        <span className={`ax-queue-deal ${blur}`}>{deal?.title}</span>
        <span className={`ax-queue-value ${blur}`}>{deal ? fmtMoney(deal.value, currency) : ''}</span>
        <span className={`ax-queue-time ax-card-time--${due <= -14 ? 'critical' : due < 0 ? 'warn' : 'normal'}`}>
          {due === 0 ? 'Hoje' : due < 0 ? `${Math.abs(due)}d atraso` : `${due}d`}
        </span>
      </div>
    );
  };


  return (
    <div className={`av2 ax-flow-enter ${isFocusMode ? 'av2--focus-mode' : ''}`}>
      <div className="av2-main">
        {/* FILTERS & HEADER */}
        {!isFocusMode && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    border: '1px solid var(--vp-border)',
                    background: 'var(--vp-surface)',
                    color: filterType === 'all' ? 'var(--vp-text-muted)' : 'var(--ax-blue)',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="all">Todas Atividades</option>
                  <option value="call">Ligar</option>
                  <option value="email">E-mail</option>
                  <option value="message">Mensagem</option>
                  <option value="meeting">Reunião</option>
                  <option value="task">Tarefa</option>
                </select>
              </div>

              {/* PERÍODO FILTROS */}
              <div style={{ display: 'flex', gap: 8, paddingLeft: 16, borderLeft: '1px solid var(--vp-border)' }}>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value as any)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    border: '1px solid var(--vp-border)',
                    background: 'var(--vp-surface)',
                    color: periodFilter === 'all' ? 'var(--vp-text-muted)' : 'var(--ax-blue)',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="all">Qualquer Data</option>
                  <option value="today">Hoje</option>
                  <option value="overdue">Atrasadas</option>
                  <option value="future">Futuras</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, borderLeft: '1px solid var(--vp-border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--vp-text-soft)' }}>
                  {openActivities.length} tarefas
                </span>
              </div>
            </div>
            <button 
              className="ax-btn ax-btn-primary" 
              onClick={() => setIsFocusMode(true)}
              style={{ background: 'var(--vp-text)', color: 'white' }}
            >
              <Icons.zap size={14} /> Modo Foco
            </button>
          </div>
        )}

        {isFocusMode && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Modo Foco</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--vp-text-soft)' }}>{openActivities.length} restantes</div>
              <button 
                className="ax-btn ax-btn-secondary" 
                onClick={() => setIsFocusMode(false)}
              >
                <Icons.close size={14} /> Sair do Foco
              </button>
            </div>
          </div>
        )}

        {/* STEP 1 & 2: EXECUTION BLOCK */}
        {currentHero ? (
          <section>
            {!isFocusMode && <span className="ax-label">Executar Agora</span>}
            <div 
              className={`ax-exec-block ax-exec-block--${getDueDays(currentHero.dueDate) < 0 ? 'warn' : 'normal'}`}
            >
              <div className="ax-focus-header" onClick={() => setSelectedId(currentHero.id)} style={{ cursor: 'pointer' }}>
                <div className="ax-exec-type" style={isFocusMode ? { fontSize: 13, padding: '6px 12px' } : {}}>
                  {(() => { const tc = TYPE_CONFIG[currentHero.type] || TYPE_CONFIG.task; return tc.label; })()}
                </div>
                
                <div className="ax-exec-main">
                  <h1 className={`ax-exec-title ${isFocusMode ? 'ax-focus-title' : ''}`}>{currentHero.title}</h1>
                  <div className="ax-exec-meta" style={isFocusMode ? { fontSize: 16, marginTop: 8 } : {}}>
                    <span className={`ax-exec-deal ${isPrivacyMode ? 'ax-blur' : ''}`} onClick={() => openFocusDeal(currentHero.dealId!)}>
                      {getDeal(currentHero.dealId)?.title}
                    </span>
                    <span style={{ opacity: 0.3 }}>·</span>
                    <span>{getStage(getDeal(currentHero.dealId))?.title}</span>
                    <span style={{ opacity: 0.3 }}>·</span>
                    <span className={isPrivacyMode ? 'ax-blur' : ''} style={{ fontWeight: 700 }}>
                      {fmtMoney(getDeal(currentHero.dealId)?.value || 0, currency)}
                    </span>
                  </div>

                  {!isFocusMode && (() => {
                    const pastCompleted = activities
                      .filter(a => a.dealId === currentHero.dealId && a.completed)
                      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
                    
                    const last = pastCompleted[0];
                    if (!last) return null;

                    // Get actual comment from log
                    const lastLog = logs.find(l => l.activityId === last.id);
                    const comment = lastLog?.content || last.notes || last.result;

                    if (!comment || comment.includes("concluída sem observações")) return null;

                    return (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11, maxWidth: '600px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--vp-text-soft)', textTransform: 'uppercase', fontSize: 9, display: 'block', marginBottom: 2 }}>Última Interação</span>
                        <span style={{ color: '#475569' }}>"{comment}"</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="ax-exec-indicators">
                  <div className="ax-indicator">
                    <span className={`ax-indicator-val ${getDueDays(currentHero.dueDate) < 0 ? 'text-[var(--ax-red)]' : ''}`} style={isFocusMode ? { fontSize: 16 } : {}}>
                      {getDueDays(currentHero.dueDate) < 0 ? `${Math.abs(getDueDays(currentHero.dueDate))}d` : 'No prazo'}
                    </span>
                    <span className="ax-indicator-lbl">Atraso</span>
                  </div>
                </div>

                {!isFocusMode && (
                  <div className="ax-exec-actions">
                    <button 
                      className="ax-btn ax-btn-primary" 
                      onClick={() => handleExecute(currentHero)}
                    >
                      <Icons.phone size={16} /> {TYPE_CONFIG[currentHero.type]?.label || 'Executar'}
                    </button>
                    <button className="ax-btn ax-btn-secondary" onClick={() => handlePostpone(currentHero)}>
                      +1 Dia
                    </button>
                    <button className="ax-btn ax-btn-ghost" onClick={handleSkip}>
                      Pular
                    </button>
                  </div>
                )}
              </div>

              {/* FOCUS MODE EXTRA INFO & NOTES */}
              {isFocusMode && (
                <div className="ax-focus-grid">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <span className="ax-label">Informações de Contato</span>
                    {(() => {
                      const dealId = currentHero.dealId;
                      const c = getContact(currentHero.contactId || getDeal(dealId)?.contactId);
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {/* CONTACT INFO */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ax-blue-bg)', color: 'var(--ax-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icons.phone size={16} /></div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--vp-text-soft)', textTransform: 'uppercase' }}>Telefone</div>
                                <div className={isPrivacyMode ? 'ax-blur' : ''} style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.phone || 'Não informado'}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#efebff', color: '#7c5cff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icons.mail size={16} /></div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--vp-text-soft)', textTransform: 'uppercase' }}>E-mail</div>
                                <div className={isPrivacyMode ? 'ax-blur' : ''} style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c?.email || ''}>{c?.email || 'Não informado'}</div>
                              </div>
                            </div>
                          </div>

                          {/* LAST INTERACTION QUICK VIEW */}
                          {(() => {
                            const pastCompleted = activities
                              .filter(a => a.dealId === dealId && a.completed)
                              .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
                            
                            const last = pastCompleted[0];
                            if (!last) return null;

                            const lastLog = logs.find(l => l.activityId === last.id);
                            const comment = lastLog?.content || last.notes || last.result;

                            if (!comment || comment.includes("concluída sem observações")) return null;

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <span className="ax-label" style={{ margin: 0, fontSize: 10 }}>Última Interação</span>
                                <div style={{ 
                                  padding: '10px 12px', 
                                  background: '#f8fafc', 
                                  border: '1px solid #e2e8f0', 
                                  borderRadius: 10,
                                  fontSize: 12,
                                  color: '#475569',
                                  lineHeight: '1.5',
                                  position: 'relative'
                                }}>
                                   <div style={{ fontWeight: 700, fontSize: 10, color: 'var(--vp-text-soft)', marginBottom: 4, textTransform: 'uppercase' }}>
                                     {last.title}
                                   </div>
                                   <div style={{ whiteSpace: 'pre-wrap' }}>
                                     "{comment}"
                                   </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    <div style={{ marginTop: 12 }}>
                      <span className="ax-label">Próximo Passo Automatizado</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                        {['call', 'email', 'message', 'task'].map(t => (
                          <button 
                            key={t}
                            onClick={() => setNextTaskType(nextTaskType === t ? null : t)}
                            style={{
                              padding: '8px',
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 700,
                              border: '1px solid var(--vp-border)',
                              background: nextTaskType === t ? 'var(--ax-blue)' : 'var(--vp-surface)',
                              color: nextTaskType === t ? 'white' : 'var(--vp-text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            {(() => { const Icon = Icons[TYPE_CONFIG[t]?.icon || 'check']; return <Icon size={12} />; })()}
                            {TYPE_CONFIG[t]?.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="ax-notes-container">
                    <span className="ax-label">Notas da Execução</span>
                    <textarea 
                      placeholder="O que aconteceu nesta interação? (Ex: Não atendeu, agendamos reunião...)"
                      value={execNotes}
                      onChange={e => setExecNotes(e.target.value)}
                      className="ax-notes-textarea"
                    />
                    <div className="ax-focus-actions" style={{ gap: '10px' }}>
                      <button 
                        className="ax-btn ax-btn-primary" 
                        style={{ 
                          flex: '2', 
                          height: 52, 
                          fontSize: 14,
                          opacity: nextTaskType ? 1 : 0.6,
                          cursor: nextTaskType ? 'pointer' : 'not-allowed'
                        }}
                        disabled={!nextTaskType}
                        onClick={() => directComplete(currentHero)}
                      >
                        <Icons.check size={18} /> Concluir
                      </button>
                      <button 
                        className="ax-btn ax-btn-secondary" 
                        style={{ flex: '1', height: 52, fontSize: 14, whiteSpace: 'nowrap' }}
                        onClick={() => handlePostpone(currentHero)}
                      >
                        Adiar +1d
                      </button>
                      <button 
                        className="ax-btn" 
                        style={{ 
                          flex: '1', 
                          height: 52, 
                          fontSize: 14,
                          background: execNotes ? '#fef2f2' : '#f8fafc',
                          color: execNotes ? '#dc2626' : '#94a3b8',
                          cursor: execNotes ? 'pointer' : 'not-allowed',
                          opacity: execNotes ? 1 : 0.7,
                          border: execNotes ? '1px solid #fee2e2' : '1px solid #e2e8f0',
                          fontWeight: 700
                        }}
                        disabled={!execNotes}
                        onClick={() => handleMarkAsLost(currentHero)}
                        title={!execNotes ? "Adicione uma nota para poder dar como perdido" : ""}
                      >
                        <Icons.close size={18} /> Perdido
                      </button>
                      <button 
                        className="ax-btn ax-btn-ghost" 
                        style={{ flex: '0.7', height: 52, fontSize: 14 }}
                        onClick={handleSkip}
                      >
                        Pular
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Icons.target size={64} style={{ opacity: 0.2, marginBottom: 16 }} />
            <h2 style={{ margin: 0 }}>Parabéns! Fila limpa.</h2>
            {isFocusMode && <button className="ax-btn ax-btn-secondary" style={{ marginTop: 24, marginInline: 'auto' }} onClick={() => setIsFocusMode(false)}>Voltar para lista</button>}
          </div>
        )}

        {/* STEP 5: FILA NUMERADA */}
        {!isFocusMode && queue.length > 0 && (
          <section>
            <span className="ax-label">Sequência de Execução</span>
            <div className="ax-numbered-queue">
              {queue.map((a, i) => renderQueueItem(a, i))}
            </div>
          </section>
        )}

        {/* STEP 5: BACKLOG */}
        {!isFocusMode && backlog.length > 0 && (
          <section style={{ borderTop: '1px dashed var(--vp-border)', paddingTop: 20 }}>
            {isBacklogExpanded ? (
              <div className="ax-numbered-queue">
                {backlog.map((a, i) => renderQueueItem(a, i + queue.length))}
              </div>
            ) : (
              <button className="ax-backlog-toggle" onClick={() => setIsBacklogExpanded(true)}>
                Ver Backlog Restante ({backlog.length})
              </button>
            )}
          </section>
        )}
      </div>

      {/* STEP 6: SIDEBAR FUNCIONAL */}
      {selectedActivity && (
        <>
          <div className="ax-sidebar-backdrop" onClick={() => setSelectedId(null)} />
          <DetailPanelReal 
            activity={selectedActivity} 
            currency={currency} 
            onClose={() => setSelectedId(null)} 
            onComplete={handleExecute} 
            className="ax-sidebar--open"
          />
        </>
      )}

      <CompleteActivityModal 
        isOpen={!!activityToComplete} 
        onClose={() => setActivityToComplete(null)} 
        activity={activityToComplete} 
        initialNotes={execNotes}
        onCompleted={async () => {
          if (nextTaskType && activityToComplete?.dealId) {
            const nextTypeLabel = TYPE_CONFIG[nextTaskType]?.label || 'Nova Atividade';
            const nextDueDate = new Date();
            nextDueDate.setDate(nextDueDate.getDate() + 1); // Default to tomorrow

            await addActivity({
              dealId: activityToComplete.dealId,
              type: nextTaskType as any,
              title: `${nextTypeLabel} (Follow-up)`,
              status: 'pending',
              completed: false,
              dueDate: nextDueDate.toISOString()
            });
          }

          if (activityToComplete?.dealId) setDealIdForNewActivity(null); // We handle it here or in modal
          setActivityToComplete(null);
          setExecNotes('');
          setNextTaskType(null);
          setSelectedId(null); 
        }} 
      />

      <NewActivityModal 
        isOpen={!!dealIdForNewActivity} 
        onClose={() => setDealIdForNewActivity(null)} 
        preselectedDealId={dealIdForNewActivity || undefined} 
      />
    </div>
  );
}
