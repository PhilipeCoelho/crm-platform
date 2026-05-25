import { useState, useMemo, useCallback, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Currency } from '@/data/currencies';
import { filterRealActivities } from '@/utils/activityHelpers';
import { Icons } from '@/components/activities-v2/Icons';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { isMobileNumber, isLandline, getWhatsAppUrl, getCleanedPhoneLink } from '@/utils/phoneHelpers';
import CompleteActivityModal from '@/components/activities/CompleteActivityModal';
import { Activity } from '@/types/schema';
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription';
import { VoiceMicButton } from '@/components/shared/VoiceMicButton';

const TYPE_THEME: Record<string, { label: string; icon: string; bg: string; color: string }> = {
  call:      { label: 'Ligar',     icon: 'phone',    bg: 'rgba(59, 130, 246, 0.08)',  color: '#2563eb' },
  email:     { label: 'E-mail',    icon: 'mail',     bg: 'rgba(139, 92, 246, 0.08)', color: '#7c3aed' },
  message:   { label: 'WhatsApp',  icon: 'whatsapp', bg: 'rgba(34, 197, 94, 0.08)',   color: '#16a34a' },
  meeting:   { label: 'Reunião',   icon: 'video',    bg: 'rgba(245, 158, 11, 0.08)',  color: '#d97706' },
  task:      { label: 'Tarefa',    icon: 'check',    bg: 'rgba(107, 114, 128, 0.08)', color: '#4b5563' },
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

export default function MobileActivities({ currency }: { currency: Currency }) {
  const {
    deals, activities, contacts, pipelines,
    addActivity, completeActivityWithLog
  } = useCRM();

  const [filterType, setFilterType] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'overdue' | 'today' | 'future'>('all');
  
  // States para ações inline
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [expandedNextStepId, setExpandedNextStepId] = useState<string | null>(null);
  
  const [execNotes, setExecNotes] = useState<Record<string, string>>({});
  const [activityToComplete, setActivityToComplete] = useState<Activity | null>(null);

  // States para detecção e confirmação do WhatsApp
  const [pendingWhatsAppActivity, setPendingWhatsAppActivity] = useState<Activity | null>(null);
  const [hasLeftApp, setHasLeftApp] = useState(false);
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const [pastedMessage, setPastedMessage] = useState('');

  const getDeal = useCallback((id?: string) => deals.find(d => d.id === id), [deals]);
  const getContact = useCallback((id?: string) => contacts.find(c => c.id === id), [contacts]);
  const getStage = useCallback((dealId?: string) => {
    const deal = getDeal(dealId);
    if (!deal) return null;
    const pipe = pipelines[deal.pipelineId];
    return pipe?.stages?.find(s => s.id === deal.stageId);
  }, [getDeal, pipelines]);

  // Monitorar retorno ao app após clique no WhatsApp
  useEffect(() => {
    if (!pendingWhatsAppActivity) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setHasLeftApp(true);
      } else if (document.visibilityState === 'visible' && hasLeftApp) {
        setShowWhatsAppPrompt(true);
      }
    };

    const handleBlur = () => {
      setHasLeftApp(true);
    };

    const handleFocus = () => {
      if (hasLeftApp) {
        setShowWhatsAppPrompt(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [pendingWhatsAppActivity, hasLeftApp]);

  const handleWhatsAppClick = useCallback((a: Activity) => {
    setPendingWhatsAppActivity(a);
    setHasLeftApp(false);
    setShowWhatsAppPrompt(false);
    setPastedMessage('');

    // Fallback: se os eventos blur/visibilitychange não dispararem ou demorarem em alguns browsers
    setTimeout(() => {
      setHasLeftApp(true);
    }, 1500);

    // Expandir notas automaticamente
    setTimeout(() => {
      setExpandedNotesId(a.id);
    }, 1000);
  }, []);

  // --- Ordenação Inteligente ---
  const mobileActivities = useMemo(() => {
    return filterRealActivities(activities)
      .filter(a => !a.completed && a.status !== 'canceled')
      // Apenas atividades vinculadas a negócios em aberto
      .filter(a => {
        const deal = getDeal(a.dealId);
        return deal && deal.status === 'open';
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
        
        // 1. Primeiro ordena pela data
        if (dueA !== dueB) return dueA - dueB;

        // 2. Se a data for igual, ordena pelo telefone (Telemóvel > Fixo > Nenhum)
        const cA = getContact(a.contactId || getDeal(a.dealId)?.contactId);
        const cB = getContact(b.contactId || getDeal(b.dealId)?.contactId);
        
        const scorePhone = (c?: any) => {
            if (!c || !c.phone) return 0; // Nenhum
            if (isMobileNumber(c.phone)) return 2; // Telemóvel
            if (isLandline(c.phone)) return 1; // Fixo
            return 1; // Desconhecido, trata como fixo
        };
        
        const scoreA = scorePhone(cA);
        const scoreB = scorePhone(cB);
        
        if (scoreA !== scoreB) return scoreB - scoreA;

        // 3. Desempate final pelo valor do negócio
        const valA = getDeal(a.dealId)?.value || 0;
        const valB = getDeal(b.dealId)?.value || 0;
        return valB - valA;
      });
  }, [activities, getDeal, getContact, filterType, periodFilter]);

  // Voice Notes Hook
  const { isRecording, toggleRecording } = useVoiceTranscription({
    lang: 'pt-PT',
    onResult: (text, isFinal) => {
      if (isFinal && expandedNotesId) {
        setExecNotes(prev => ({
          ...prev,
          [expandedNotesId]: (prev[expandedNotesId] || '') + (prev[expandedNotesId] ? ' ' : '') + text
        }));
      }
    }
  });

  const handleNextStep = async (a: Activity, nextTaskType: string) => {
    const nextTypeLabel = TYPE_THEME[nextTaskType]?.label || 'Nova Atividade';
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);

    await addActivity({
      dealId: a.dealId!,
      type: nextTaskType as any,
      title: `${nextTypeLabel} (Follow-up)`,
      status: 'pending',
      completed: false,
      dueDate: nextDueDate.toISOString()
    });
    setExpandedNextStepId(null);
  };

  return (
    <div style={{
      padding: '0px 0px 80px 0px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      height: '100%',
      overflowY: 'auto',
      background: 'var(--vp-surface-muted)'
    }}>
      
      {/* HEADER DE FILTROS SUPER COMPACTO */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '12px 16px',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--vp-border)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--vp-text)',
            backgroundColor: 'var(--vp-surface)',
            border: '1px solid var(--vp-border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            outline: 'none',
            WebkitAppearance: 'none',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '16px',
            paddingRight: '36px',
          }}
        >
          <option value="all">Todas Atividades</option>
          <option value="call">📞 Ligar</option>
          <option value="message">💬 WhatsApp</option>
          <option value="email">✉️ E-mail</option>
          <option value="meeting">👥 Reunião</option>
        </select>
        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as any)}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--vp-text)',
            backgroundColor: 'var(--vp-surface)',
            border: '1px solid var(--vp-border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            outline: 'none',
            WebkitAppearance: 'none',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '16px',
            paddingRight: '36px',
          }}
        >
          <option value="all">Qualquer Data</option>
          <option value="today">📅 Hoje</option>
          <option value="overdue">⚠️ Atrasadas</option>
        </select>
      </div>

      <div style={{ padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mobileActivities.map(a => {
          const deal = getDeal(a.dealId)!;
          const stage = getStage(a.dealId);
          const contact = getContact(a.contactId || deal.contactId);
          const due = getDueDays(a.dueDate);
          
          const typeTheme = TYPE_THEME[a.type] || TYPE_THEME.task;
          const ActionIcon = Icons[typeTheme.icon];
          const hasPhone = !!contact?.phone;
          const isMobile = hasPhone && isMobileNumber(contact.phone);
          const isOverdue = due < 0;

          return (
            <div key={a.id} style={{
              background: 'var(--vp-surface)',
              borderRadius: 20,
              border: `1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.25)' : 'var(--vp-border)'}`,
              overflow: 'hidden',
              boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.01)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              paddingTop: 14
            }}>
              {/* TOPO DO CARD */}
              <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                
                {/* Meta Topo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: typeTheme.bg,
                    padding: '4px 10px',
                    borderRadius: 10,
                    border: `1px solid ${typeTheme.bg.replace('0.08', '0.15')}`
                  }}>
                    <div style={{ color: typeTheme.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ActionIcon size={12} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: typeTheme.color }}>{typeTheme.label}</span>
                  </div>
                  
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 10,
                    background: isOverdue ? '#fef2f2' : 'var(--vp-surface-muted)',
                    border: isOverdue ? '1px solid #fecaca' : '1px solid var(--vp-border)',
                    color: isOverdue ? '#ef4444' : 'var(--vp-text-soft)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}>
                    {due === 0 ? '📅 Hoje' : due < 0 ? `⚠️ ${Math.abs(due)}d atraso` : `⌛ ${due}d`}
                  </span>
                </div>

                {/* Info Principal */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--vp-text)', lineHeight: 1.25, letterSpacing: '-0.3px' }}>
                    {deal.title}
                  </h3>
                  
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                    <span style={{
                      background: 'var(--vp-surface-muted)',
                      color: 'var(--vp-text-soft)',
                      border: '1px solid var(--vp-border)',
                      padding: '3px 8px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700
                    }}>
                      {stage?.title || 'Sem etapa'}
                    </span>
                    
                    <span style={{
                      color: '#d97706',
                      background: 'rgba(217, 119, 6, 0.06)',
                      border: '1px solid rgba(217, 119, 6, 0.15)',
                      padding: '3px 8px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 800
                    }}>
                      {fmtMoney(deal.value, currency)}
                    </span>
                    
                    {contact && (
                      <span style={{
                        background: 'var(--vp-surface-muted)',
                        color: 'var(--vp-text-soft)',
                        border: '1px solid var(--vp-border)',
                        padding: '3px 8px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <Icons.user size={10} style={{ opacity: 0.7 }} />
                        {contact.name}
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* AÇÕES PRIMÁRIAS (Asymmetric visual hierarchy) */}
              <div style={{ padding: '0 14px 4px 14px', display: 'flex', gap: 8 }}>
                {hasPhone ? (
                  <>
                    <a
                      href={isMobile ? getWhatsAppUrl(contact.phone!) : getCleanedPhoneLink(contact.phone!)}
                      target={isMobile ? "_blank" : "_self"}
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (isMobile) {
                          handleWhatsAppClick(a);
                        }
                      }}
                      style={{
                        flex: 1.6, // Outreach action is primary & wider
                        background: isMobile 
                          ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' 
                          : 'linear-gradient(135deg, var(--ax-blue) 0%, #1d4ed8 100%)',
                        color: 'white',
                        padding: '12px 16px',
                        borderRadius: 12,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 800,
                        fontSize: 14,
                        textDecoration: 'none',
                        boxShadow: isMobile 
                          ? '0 4px 10px rgba(37, 211, 102, 0.18)' 
                          : '0 4px 10px rgba(37, 99, 235, 0.18)',
                        transition: 'all 0.2s ease',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {isMobile ? <Icons.whatsapp size={18} /> : <Icons.phone size={18} />}
                      <span>{isMobile ? 'WhatsApp' : 'Ligar'}</span>
                    </a>
                    
                    <button
                      onClick={() => setActivityToComplete(a)}
                      style={{
                        flex: 1, // Concluir is secondary & neutral
                        background: 'var(--vp-surface)',
                        color: 'var(--vp-text-soft)',
                        border: '1px solid var(--vp-border)',
                        padding: '12px 16px',
                        borderRadius: 12,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Icons.check size={18} />
                      <span>Concluir</span>
                    </button>
                  </>
                ) : (
                  // Se não tem telefone, Concluir vira botão primário em destaque
                  <button
                    onClick={() => setActivityToComplete(a)}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, var(--ax-blue) 0%, #1d4ed8 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '12px 16px',
                      borderRadius: 12,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: '0 4px 10px rgba(37, 99, 235, 0.18)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Icons.check size={18} />
                    <span>Concluir Atividade</span>
                  </button>
                )}
              </div>

              {/* AÇÕES SECUNDÁRIAS (Quick Actions Segmented Control) */}
              <div style={{
                display: 'flex',
                borderTop: '1px solid var(--vp-border)',
                background: 'var(--vp-surface-muted)',
                padding: '4px',
                gap: 4
              }}>
                <button
                  onClick={() => setExpandedNotesId(expandedNotesId === a.id ? null : a.id)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 8,
                    background: expandedNotesId === a.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    border: 'none',
                    color: expandedNotesId === a.id ? 'var(--ax-blue)' : 'var(--vp-text-soft)',
                    fontWeight: 700,
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease',
                    cursor: 'pointer'
                  }}
                >
                  <Icons.fileText size={16} />
                  <span>Notas</span>
                </button>
                <button
                  onClick={() => setExpandedContactId(expandedContactId === a.id ? null : a.id)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 8,
                    background: expandedContactId === a.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    border: 'none',
                    color: expandedContactId === a.id ? 'var(--ax-blue)' : 'var(--vp-text-soft)',
                    fontWeight: 700,
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease',
                    cursor: 'pointer'
                  }}
                >
                  <Icons.user size={16} />
                  <span>Contato</span>
                </button>
                <button
                  onClick={() => setExpandedNextStepId(expandedNextStepId === a.id ? null : a.id)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 8,
                    background: expandedNextStepId === a.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    border: 'none',
                    color: expandedNextStepId === a.id ? 'var(--ax-blue)' : 'var(--vp-text-soft)',
                    fontWeight: 700,
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease',
                    cursor: 'pointer'
                  }}
                >
                  <Icons.zap size={16} />
                  <span>Próximo</span>
                </button>
              </div>

              {/* EXPANSÕES (Apenas 1 visível por vez no card) */}
              
              {/* Notas Inline */}
              {expandedNotesId === a.id && (
                <div style={{ padding: 16, background: 'var(--vp-surface-muted)', borderTop: '1px solid var(--vp-border)' }}>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      placeholder="Registrar notas desta interação..."
                      value={execNotes[a.id] || ''}
                      onChange={(e) => setExecNotes(p => ({...p, [a.id]: e.target.value}))}
                      style={{ width: '100%', minHeight: 80, padding: '12px 40px 12px 12px', borderRadius: 12, border: '1px solid var(--vp-border)', fontSize: 14, outline: 'none', resize: 'vertical' }}
                    />
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      <VoiceMicButton isRecording={isRecording} onToggle={toggleRecording} size="sm" variant="minimal" />
                    </div>
                  </div>
                </div>
              )}

              {/* Contato Expandido */}
              {expandedContactId === a.id && contact && (
                <div style={{ padding: 16, background: 'var(--vp-surface-muted)', borderTop: '1px solid var(--vp-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--vp-text-muted)', marginBottom: 2 }}>Telefone</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{contact.phone || 'Não informado'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--vp-text-muted)', marginBottom: 2 }}>E-mail</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{contact.email || 'Não informado'}</div>
                  </div>
                </div>
              )}

              {/* Próximo Passo Expandido */}
              {expandedNextStepId === a.id && (
                <div style={{ padding: 16, background: 'var(--vp-surface-muted)', borderTop: '1px solid var(--vp-border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--vp-text-muted)', marginBottom: 8 }}>Agendar Para Amanhã</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {['call', 'message', 'meeting', 'task'].map(t => (
                      <button
                        key={t}
                        onClick={() => handleNextStep(a, t)}
                        style={{ padding: '10px', background: 'var(--vp-surface)', border: '1px solid var(--vp-border)', borderRadius: 10, fontSize: 12, fontWeight: 700, color: 'var(--vp-text)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', cursor: 'pointer' }}
                      >
                        {(() => {
                          const Ico = Icons[TYPE_THEME[t].icon];
                          return <Ico size={14} />;
                        })()}
                        {TYPE_THEME[t].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          );
        })}
        
        {mobileActivities.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--vp-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Icons.target size={48} style={{ opacity: 0.2 }} />
            <h3 style={{ margin: 0 }}>Fila Limpa</h3>
            <p style={{ margin: 0, fontSize: 14 }}>Não há atividades pendentes para os filtros selecionados.</p>
          </div>
        )}
      </div>

      {/* WHATSAPP CONFIRMATION POPUP MODAL (Bottom Sheet Premium Style) */}
      {showWhatsAppPrompt && pendingWhatsAppActivity && (() => {
        const deal = getDeal(pendingWhatsAppActivity.dealId);
        const contact = getContact(pendingWhatsAppActivity.contactId || deal?.contactId);
        
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            animation: 'fadeIn 0.25s ease-out'
          }}>
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>
            
            <div style={{
              width: '100%',
              maxWidth: 500,
              background: 'var(--vp-surface)',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: '24px 20px 40px 20px',
              borderTop: '1px solid var(--vp-border)',
              boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1), 0 -8px 10px -6px rgba(0,0,0,0.1)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}>
              {/* Drag indicator bar */}
              <div style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'var(--vp-border)',
                alignSelf: 'center'
              }} />

              {/* Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icons.whatsapp size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--vp-text)' }}>
                    Mensagem Enviada?
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--vp-text-soft)', fontWeight: 600 }}>
                    Confirmação de Ação WhatsApp
                  </p>
                </div>
              </div>

              {/* Description */}
              <div style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: 'var(--vp-text)',
                background: 'var(--vp-surface-muted)',
                padding: 16,
                borderRadius: 16,
                border: '1px solid var(--vp-border)',
                fontWeight: 500
              }}>
                Você acabou de abrir o WhatsApp para falar com <strong style={{ color: 'var(--vp-text)', fontWeight: 700 }}>{contact?.name || 'este contato'}</strong>.
                <br /><br />
                Conseguiu enviar a mensagem com sucesso?
              </div>

              {/* Optional Textarea to paste message */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--vp-text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mensagem Enviada (Opcional)
                </label>
                <textarea
                  placeholder="Cole aqui o texto da mensagem para guardar no histórico..."
                  value={pastedMessage}
                  onChange={(e) => setPastedMessage(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 70,
                    maxHeight: 120,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid var(--vp-border)',
                    fontSize: 13,
                    outline: 'none',
                    resize: 'vertical',
                    backgroundColor: 'var(--vp-surface)',
                    color: 'var(--vp-text)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={async () => {
                    const activity = pendingWhatsAppActivity;
                    const messageContent = pastedMessage.trim();

                    // Reset do prompt imediatamente para fechar modal e evitar cliques duplicados
                    setShowWhatsAppPrompt(false);
                    setPendingWhatsAppActivity(null);
                    setPastedMessage('');

                    // 1. Concluir a atividade atual com as notas da interação e mensagem enviada (funciona para qualquer tipo de atividade)
                    let notes = execNotes[activity.id] || "";
                    if (messageContent) {
                      notes = notes 
                        ? `${notes}\n\n[Mensagem Enviada]:\n"${messageContent}"`
                        : `Mensagem enviada via WhatsApp:\n\n"${messageContent}"`;
                    } else {
                      notes = notes || "Mensagem enviada via WhatsApp.";
                    }
                    await completeActivityWithLog(activity.id, notes, true);

                    // 2. Criar nova atividade para amanhã (+1 dia) para verificar se respondeu
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    await addActivity({
                      dealId: activity.dealId,
                      type: 'message',
                      title: 'Verificar se respondeu ao WhatsApp',
                      status: 'pending',
                      completed: false,
                      dueDate: tomorrow.toISOString(),
                      originStage: activity.originStage
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 16,
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 211, 102, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s'
                  }}
                >
                  <Icons.check size={18} /> Sim, enviei a mensagem
                </button>

                <button
                  onClick={() => {
                    setShowWhatsAppPrompt(false);
                    setPendingWhatsAppActivity(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'transparent',
                    color: 'var(--vp-text-soft)',
                    border: '1px solid var(--vp-border)',
                    borderRadius: 16,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s'
                  }}
                >
                  Não enviei / Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <CompleteActivityModal 
        isOpen={!!activityToComplete} 
        onClose={() => setActivityToComplete(null)} 
        activity={activityToComplete} 
        initialNotes={activityToComplete ? execNotes[activityToComplete.id] || '' : ''}
        onCompleted={async () => {
          setActivityToComplete(null);
        }} 
      />
    </div>
  );
}
