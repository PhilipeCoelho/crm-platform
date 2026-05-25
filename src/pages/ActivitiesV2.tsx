import { useIsMobile } from '@/hooks/useMediaQuery';
import MobileActivities from '@/components/activities-v2/MobileActivities';
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
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription';
import { VoiceMicButton } from '@/components/shared/VoiceMicButton';

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

function getCleanedWhatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('351')) {
    return `https://wa.me/${digits}`;
  }
  return `https://wa.me/351${digits}`;
}

function getCleanedPhoneLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('351')) return `tel:+${digits}`;
  if (digits.length === 9) return `tel:+351${digits}`;
  return `tel:${digits}`;
}

function DesktopActivitiesV2({ currency }: { currency: Currency }) {

  const {
    deals, activities, contacts, pipelines,
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
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  const {
    isRecording,
    toggleRecording,
    interimTranscript
  } = useVoiceTranscription({
    lang: 'pt-PT',
    onResult: (text, isFinal) => {
      if (isFinal) {
        setExecNotes(prev => prev + (prev ? ' ' : '') + text);
      }
    }
  });

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
      .filter(a => !skippedIds.has(a.id))
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
  }, [activities, getDeal, filterType, periodFilter, skippedIds]);

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
    if (currentHero) {
      setSkippedIds(prev => new Set(prev).add(currentHero.id));
      setExecNotes('');
      setNextTaskType(null);
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

        {isFocusMode && (() => {
          const totalCount = openActivities.length + skippedIds.size;
          const completedCount = skippedIds.size;
          const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, background: 'var(--ax-blue-bg)', color: 'var(--ax-blue)', padding: '5px 12px', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icons.zap size={11} /> Modo Foco
                  </span>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 850, color: 'var(--vp-text)', letterSpacing: '-0.02em' }}>Fila de Atividades</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--vp-text-soft)', background: 'var(--vp-surface)', border: '1px solid var(--vp-border)', padding: '6px 14px', borderRadius: '20px' }}>
                    {openActivities.length} restantes
                  </div>
                  <button 
                    className="ax-btn ax-btn-secondary" 
                    onClick={() => setIsFocusMode(false)}
                    style={{ borderRadius: '20px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, height: 36 }}
                  >
                    <Icons.close size={14} /> Sair do Foco
                  </button>
                </div>
              </div>
              
              {/* Premium Progress Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--vp-border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--ax-blue)', borderRadius: 3, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--vp-text-soft)', width: 36, textAlign: 'right' }}>{pct}%</span>
              </div>
            </div>
          );
        })()}

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
                  <h1 className={`ax-exec-title ${isFocusMode ? 'ax-focus-title' : ''}`}>
                    {isFocusMode ? (
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(
                          currentHero.title
                            .replace(/^(Ligar para|ligar para|Ligar a|ligar a|Ligar|ligar|Mensagem para|mensagem para|E-mail para|e-mail para)\s+/i, '')
                            .trim()
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Pesquisar no Google"
                        className="ax-focus-title-link"
                      >
                        {currentHero.title}
                      </a>
                    ) : (
                      currentHero.title
                    )}
                  </h1>
                  <div className="ax-exec-meta" style={isFocusMode ? { fontSize: 13, marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } : {}}>
                    {isFocusMode ? (
                      <>
                        <span className={`ax-exec-deal ${isPrivacyMode ? 'ax-blur' : ''}`} onClick={(e) => { e.stopPropagation(); openFocusDeal(currentHero.dealId!); }} style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                          {getDeal(currentHero.dealId)?.title}
                        </span>
                        <span style={{ background: 'var(--ax-blue-bg)', color: 'var(--ax-blue)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                          {getStage(getDeal(currentHero.dealId))?.title}
                        </span>
                        <span className={isPrivacyMode ? 'ax-blur' : ''} style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '6px', fontWeight: 800 }}>
                          {fmtMoney(getDeal(currentHero.dealId)?.value || 0, currency)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={`ax-exec-deal ${isPrivacyMode ? 'ax-blur' : ''}`} onClick={(e) => { e.stopPropagation(); openFocusDeal(currentHero.dealId!); }}>
                          {getDeal(currentHero.dealId)?.title}
                        </span>
                        <span style={{ opacity: 0.3 }}>·</span>
                        <span>{getStage(getDeal(currentHero.dealId))?.title}</span>
                        <span style={{ opacity: 0.3 }}>·</span>
                        <span className={isPrivacyMode ? 'ax-blur' : ''} style={{ fontWeight: 700 }}>
                          {fmtMoney(getDeal(currentHero.dealId)?.value || 0, currency)}
                        </span>
                        {(() => {
                          const c = getContact(currentHero.contactId || getDeal(currentHero.dealId)?.contactId);
                          if (!c) return null;
                          return (
                            <>
                              <span style={{ opacity: 0.3 }}>·</span>
                              <a
                                href={c.phone ? getCleanedPhoneLink(c.phone) : '#'}
                                className={`hover:text-primary transition-colors ${isPrivacyMode ? 'ax-blur' : ''} ${c.phone ? 'underline decoration-dotted' : ''}`}
                                style={{ color: 'var(--vp-text-soft)', fontWeight: 600 }}
                                title={c.phone ? `Ligar para ${c.phone}` : ''}
                                onClick={(e) => {
                                  if (!c.phone) e.preventDefault();
                                  else e.stopPropagation();
                                }}
                              >
                                {c.name}
                              </a>
                              {c.phone && (
                                <span style={{ display: 'inline-flex', marginLeft: 8, verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                                  <a
                                    href={getCleanedWhatsAppLink(c.phone)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                                    title="WhatsApp"
                                  >
                                    <Icons.whatsapp size={8} />
                                    WhatsApp
                                  </a>
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
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
                      <Icons.check size={16} /> Concluir
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
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="ax-focus-grid">
                    {/* Left Column: Lead Info & Automations */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      <div>
                        <span className="ax-label" style={{ marginBottom: 12, display: 'block' }}>Informações de Contato</span>
                        {(() => {
                          const dealId = currentHero.dealId;
                          const c = getContact(currentHero.contactId || getDeal(dealId)?.contactId);
                          
                          return (
                            <div style={{ background: 'var(--vp-surface-muted, #f8fafc)', border: '1px solid var(--vp-border)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--vp-text-soft)', textTransform: 'uppercase', marginBottom: 2 }}>Telefone</div>
                                  {c?.phone ? (
                                    <a
                                      href={getCleanedPhoneLink(c.phone)}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        if (c?.phone) {
                                          window.location.href = getCleanedPhoneLink(c.phone);
                                        }
                                      }}
                                      className={`hover:text-primary transition-colors ${isPrivacyMode ? 'ax-blur' : ''}`}
                                      style={{ fontSize: 16, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: 'fit-content', textDecoration: 'underline', textDecorationStyle: 'dotted', cursor: 'pointer' }}
                                      title={`Ligar para ${c.phone}`}
                                    >
                                      {c.phone}
                                    </a>
                                  ) : (
                                    <div className={isPrivacyMode ? 'ax-blur' : ''} style={{ fontSize: 15, fontWeight: 700, color: 'var(--vp-text-muted)' }}>Não informado</div>
                                  )}
                                </div>
                                {c?.phone && (
                                  <div style={{ display: 'flex', flexShrink: 0 }}>
                                    <a
                                      href={getCleanedWhatsAppLink(c.phone)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 px-3.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[11px] font-extrabold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                                      title="Enviar WhatsApp"
                                    >
                                      <Icons.whatsapp size={11} />
                                      WhatsApp
                                    </a>
                                  </div>
                                )}
                              </div>
                              
                              <div style={{ minWidth: 0, flex: 1, borderTop: '1px solid var(--vp-border)', paddingTop: 14 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--vp-text-soft)', textTransform: 'uppercase', marginBottom: 2 }}>E-mail</div>
                                <div className={isPrivacyMode ? 'ax-blur' : ''} style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--vp-text)' }} title={c?.email || ''}>{c?.email || 'Não informado'}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                    </div>

                    {/* Right Column: Notes & Recording */}
                    <div className="ax-notes-container">
                      <span className="ax-label">Notas da Execução</span>
                      <div className="relative group" style={{ position: 'relative' }}>
                        <textarea 
                          placeholder="O que aconteceu nesta interação? (Ex: Não atendeu, agendamos reunião...)"
                          value={execNotes}
                          onChange={e => setExecNotes(e.target.value)}
                          className="ax-notes-textarea pr-12"
                          style={{
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                            fontSize: '14px'
                          }}
                        />
                        
                        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5 }}>
                          <VoiceMicButton 
                            isRecording={isRecording}
                            onToggle={toggleRecording}
                            size="sm"
                            variant="minimal"
                          />
                        </div>

                        {isRecording && interimTranscript && (
                          <div style={{
                            position: 'absolute',
                            bottom: 12,
                            left: 12,
                            right: 12,
                            padding: '8px 12px',
                            background: 'rgba(59, 130, 246, 0.05)',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(59, 130, 246, 0.1)',
                            borderRadius: 12,
                            fontSize: 12,
                            color: 'var(--ax-blue)',
                            zIndex: 10,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                          }} className="animate-pulse">
                            {interimTranscript}
                          </div>
                        )}
                      </div>

                      {/* Inline Next Automated Step Row */}
                      <div style={{ marginTop: 12 }}>
                        <span className="ax-label" style={{ marginBottom: 6, display: 'block', fontSize: 10, fontWeight: 800 }}>Próximo Passo Automatizado</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['call', 'email', 'message', 'task'].map(t => {
                            const active = nextTaskType === t;
                            const ptc = TYPE_CONFIG[t] || TYPE_CONFIG.task;
                            const Icon = Icons[ptc.icon || 'check'];
                            
                            return (
                              <button 
                                key={t}
                                onClick={() => setNextTaskType(nextTaskType === t ? null : t)}
                                style={{
                                  flex: 1,
                                  height: 32,
                                  borderRadius: 8,
                                  fontSize: 10.5,
                                  fontWeight: 750,
                                  border: active ? '1px solid var(--ax-blue)' : '1px solid var(--vp-border)',
                                  background: active ? 'var(--ax-blue-bg)' : 'var(--vp-surface)',
                                  color: active ? 'var(--ax-blue)' : 'var(--vp-text-muted)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 4,
                                  boxShadow: active ? '0 2px 6px rgba(59, 130, 246, 0.06)' : 'none',
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                              >
                                <Icon size={12} style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ptc.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Unified Execution Actions Row directly under Next Steps */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--vp-border)' }}>
                        <button 
                          className="ax-btn ax-btn-primary" 
                          style={{ 
                            flex: 1.5,
                            height: 34, 
                            borderRadius: 8,
                            padding: '0 16px', 
                            fontSize: 12,
                            fontWeight: 800,
                            background: nextTaskType ? '#16a34a' : '#16a34a',
                            color: 'white',
                            opacity: nextTaskType ? 1 : 0.5,
                            cursor: nextTaskType ? 'pointer' : 'not-allowed',
                            boxShadow: nextTaskType ? '0 3px 8px rgba(22, 163, 74, 0.15)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                          disabled={!nextTaskType}
                          onClick={() => directComplete(currentHero)}
                        >
                          <Icons.check size={14} /> Concluir Atividade
                        </button>
                        <button 
                          className="ax-btn ax-btn-ghost" 
                          onClick={handleSkip} 
                          style={{ height: 34, borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 700 }}
                        >
                          Pular Atividade
                        </button>
                        <button 
                          className="ax-btn" 
                          style={{ 
                            height: 34, 
                            borderRadius: 8,
                            padding: '0 12px', 
                            fontSize: 12,
                            background: execNotes ? '#fef2f2' : '#f8fafc',
                            color: execNotes ? '#dc2626' : '#94a3b8',
                            cursor: execNotes ? 'pointer' : 'not-allowed',
                            opacity: execNotes ? 1 : 0.7,
                            border: execNotes ? '1px solid #fee2e2' : '1px solid #e2e8f0',
                            fontWeight: 750,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4
                          }}
                          disabled={!execNotes}
                          onClick={() => handleMarkAsLost(currentHero)}
                          title={!execNotes ? "Adicione uma nota para poder dar como perdido" : ""}
                        >
                          <Icons.close size={14} /> Dar como Perdido
                        </button>
                      </div>
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

export default function ActivitiesV2({ currency }: { currency: Currency }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <MobileActivities currency={currency} />;
  }
  return <DesktopActivitiesV2 currency={currency} />;
}
