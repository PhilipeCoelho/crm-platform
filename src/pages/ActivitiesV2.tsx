import { useState, useMemo, useCallback, useEffect } from 'react';
import './activities-v2.css';
import { useCRM } from '@/contexts/CRMContext';
import { Activity, Deal } from '@/types/schema';
import { Currency } from '@/data/currencies';
import { filterRealActivities } from '@/utils/activityHelpers';
import { Icons } from '@/components/activities-v2/Icons';
import { differenceInDays, parseISO } from 'date-fns';
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
  return differenceInDays(parseISO(dueDate), new Date());
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
    deals, activities, contacts, pipelines,
    updateActivity, openFocusDeal, isPrivacyMode,
    completeActivityWithLog, addActivity, updateDeal
  } = useCRM();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityToComplete, setActivityToComplete] = useState<Activity | null>(null);
  const [dealIdForNewActivity, setDealIdForNewActivity] = useState<string | null>(null);
  const [isBacklogExpanded, setIsBacklogExpanded] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
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
      .filter(a => filterType === 'all' || a.type === filterType)
      .sort((a, b) => {
        const dueA = getDueDays(a.dueDate);
        const dueB = getDueDays(b.dueDate);
        if (dueA !== dueB) return dueA - dueB;
        const valA = getDeal(a.dealId)?.value || 0;
        const valB = getDeal(b.dealId)?.value || 0;
        return valB - valA;
      });
  }, [activities, getDeal, filterType]);

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

    // 3. Reset and move flow
    setExecNotes('');
    setNextTaskType(null);
    setSelectedId(null);
  };

  const handlePostpone = (a: Activity) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    updateActivity(a.id, { 
      dueDate: d.toISOString(),
      notes: execNotes ? (a.notes ? a.notes + '\n' + execNotes : execNotes) : a.notes
    });
    setExecNotes('');
    if (openActivities.length > 1) {
      setSelectedId(openActivities[1].id);
    } else {
      setSelectedId(null);
    }
  };
  const handleSkip = () => {
    const idx = openActivities.findIndex(a => a.id === selectedId);
    if (idx !== -1 && idx < openActivities.length - 1) {
      setSelectedId(openActivities[idx + 1].id);
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

    // 3. Reset and move flow
    setExecNotes('');
    setNextTaskType(null);
    setSelectedId(null);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'call', 'email', 'message', 'meeting', 'task'].map(t => (
                <button 
                  key={t}
                  onClick={() => setFilterType(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    border: '1px solid var(--vp-border)',
                    background: filterType === t ? 'var(--ax-blue)' : 'var(--vp-surface)',
                    color: filterType === t ? 'white' : 'var(--vp-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {t === 'all' ? 'Tudo' : TYPE_CONFIG[t]?.label || t}
                </button>
              ))}
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
                      const c = getContact(currentHero.contactId || getDeal(currentHero.dealId)?.contactId);
                      return (
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
