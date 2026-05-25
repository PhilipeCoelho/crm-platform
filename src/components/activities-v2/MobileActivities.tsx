import { useState, useMemo, useCallback, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Currency } from '@/data/currencies';
import { filterRealActivities } from '@/utils/activityHelpers';
import { Icons } from '@/components/activities-v2/Icons';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { isMobileNumber, getWhatsAppUrl, getCleanedPhoneLink } from '@/utils/phoneHelpers';
import CompleteActivityModal from '@/components/activities/CompleteActivityModal';
import { Activity } from '@/types/schema';
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription';
import { VoiceMicButton } from '@/components/shared/VoiceMicButton';

const TYPE_THEME: Record<string, { label: string; icon: string; gradient: string; glow: string }> = {
  call:    { label: 'Ligar',    icon: 'phone',    gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', glow: 'rgba(59,130,246,0.25)' },
  email:   { label: 'E-mail',   icon: 'mail',     gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', glow: 'rgba(139,92,246,0.25)' },
  message: { label: 'WhatsApp', icon: 'whatsapp', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)', glow: 'rgba(34,197,94,0.25)' },
  meeting: { label: 'Reunião',  icon: 'video',    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', glow: 'rgba(245,158,11,0.25)' },
  task:    { label: 'Tarefa',   icon: 'check',    gradient: 'linear-gradient(135deg, #64748b, #475569)', glow: 'rgba(100,116,139,0.25)' },
};

function getDueDays(dueDate?: string): number {
  if (!dueDate) return 999;
  return differenceInDays(startOfDay(parseISO(dueDate)), startOfDay(new Date()));
}

export default function MobileActivities({ currency }: { currency: Currency }) {
  void currency;
  const {
    deals, activities, contacts, pipelines,
    addActivity, completeActivityWithLog
  } = useCRM();

  const [filterType, setFilterType] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'overdue' | 'today' | 'future'>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [execNotes, setExecNotes] = useState<Record<string, string>>({});
  const [activityToComplete, setActivityToComplete] = useState<Activity | null>(null);

  // WhatsApp states
  const [pendingWhatsAppActivity, setPendingWhatsAppActivity] = useState<Activity | null>(null);
  const [hasLeftApp, setHasLeftApp] = useState(false);
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const [pastedMessage, setPastedMessage] = useState('');

  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);

  const getDeal = useCallback((id?: string) => deals.find(d => d.id === id), [deals]);
  const getContact = useCallback((id?: string) => contacts.find(c => c.id === id), [contacts]);
  const getStage = useCallback((dealId?: string) => {
    const deal = getDeal(dealId);
    if (!deal) return null;
    const pipe = pipelines[deal.pipelineId];
    return pipe?.stages?.find(s => s.id === deal.stageId);
  }, [getDeal, pipelines]);

  // WhatsApp return detection
  useEffect(() => {
    if (!pendingWhatsAppActivity) return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') setHasLeftApp(true);
      else if (document.visibilityState === 'visible' && hasLeftApp) setShowWhatsAppPrompt(true);
    };
    const onBlur = () => setHasLeftApp(true);
    const onFocus = () => { if (hasLeftApp) setShowWhatsAppPrompt(true); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [pendingWhatsAppActivity, hasLeftApp]);

  const handleWhatsAppClick = useCallback((a: Activity) => {
    setPendingWhatsAppActivity(a);
    setHasLeftApp(false);
    setShowWhatsAppPrompt(false);
    setPastedMessage('');
    setTimeout(() => setHasLeftApp(true), 1500);
  }, []);

  // Sorting
  const mobileActivities = useMemo(() => {
    return filterRealActivities(activities)
      .filter(a => !a.completed && a.status !== 'canceled')
      .filter(a => { const d = getDeal(a.dealId); return d && d.status === 'open'; })
      .filter(a => filterType === 'all' || a.type === filterType)
      .filter(a => {
        if (periodFilter === 'all') return true;
        const dd = getDueDays(a.dueDate);
        if (periodFilter === 'overdue') return dd < 0;
        if (periodFilter === 'today') return dd === 0;
        if (periodFilter === 'future') return dd > 0 && dd !== 999;
        return true;
      })
      .sort((a, b) => {
        const dA = getDueDays(a.dueDate), dB = getDueDays(b.dueDate);
        if (dA !== dB) return dA - dB;
        const cA = getContact(a.contactId || getDeal(a.dealId)?.contactId);
        const cB = getContact(b.contactId || getDeal(b.dealId)?.contactId);
        const sp = (c?: any) => !c?.phone ? 0 : isMobileNumber(c.phone) ? 2 : 1;
        if (sp(cA) !== sp(cB)) return sp(cB) - sp(cA);
        return (getDeal(b.dealId)?.value || 0) - (getDeal(a.dealId)?.value || 0);
      });
  }, [activities, getDeal, getContact, filterType, periodFilter]);

  useEffect(() => { setCurrentIndex(0); setShowNotes(false); }, [filterType, periodFilter]);
  useEffect(() => {
    if (currentIndex >= mobileActivities.length && mobileActivities.length > 0)
      setCurrentIndex(mobileActivities.length - 1);
  }, [mobileActivities.length, currentIndex]);

  useEffect(() => {
    if (periodFilter === 'today' && mobileActivities.length === 0) {
      setPeriodFilter('all');
    }
  }, [mobileActivities.length, periodFilter]);

  const current = mobileActivities[currentIndex] || null;

  const { isRecording, toggleRecording } = useVoiceTranscription({
    lang: 'pt-PT',
    onResult: (text, isFinal) => {
      if (isFinal && current) {
        setExecNotes(prev => ({
          ...prev,
          [current.id]: (prev[current.id] || '') + (prev[current.id] ? ' ' : '') + text
        }));
      }
    }
  });

  const navigate = useCallback((dir: 'left' | 'right') => {
    const next = dir === 'left' ? currentIndex + 1 : currentIndex - 1;
    if (next < 0 || next >= mobileActivities.length) return;
    setSlideDir(dir);
    setShowNotes(false);
    setTimeout(() => { setCurrentIndex(next); setSlideDir(null); }, 150);
  }, [currentIndex, mobileActivities.length]);

  // =============== EMPTY STATE ===============
  if (mobileActivities.length === 0) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
        background: 'linear-gradient(180deg, var(--vp-surface) 0%, var(--vp-surface-muted) 100%)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,163,74,0.06))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icons.check size={32} style={{ color: '#22c55e' }} />
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--vp-text)' }}>Tudo feito!</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--vp-text-soft)', textAlign: 'center', lineHeight: 1.5 }}>
          Nenhuma atividade pendente.
        </p>
      </div>
    );
  }

  const a = current!;
  const deal = getDeal(a.dealId)!;
  const stage = getStage(a.dealId);
  const contact = getContact(a.contactId || deal.contactId);
  const due = getDueDays(a.dueDate);
  const theme = TYPE_THEME[a.type] || TYPE_THEME.task;
  const ActionIcon = Icons[theme.icon];
  const hasPhone = !!contact?.phone;
  const isMobile = hasPhone && isMobileNumber(contact.phone);
  const isOverdue = due < 0;
  const total = mobileActivities.length;
  const pct = Math.round(((currentIndex + 1) / total) * 100);

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, var(--vp-surface) 0%, var(--vp-surface-muted) 100%)',
      overflow: 'hidden', position: 'relative',
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes slideL { from { opacity:0; transform:translateX(60px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideR { from { opacity:0; transform:translateX(-60px) } to { opacity:1; transform:translateX(0) } }

      `}</style>

      {/* ===== TOP BAR ===== */}
      <div style={{
        padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: theme.gradient,
            boxShadow: `0 4px 12px ${theme.glow}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
          }}>
            <ActionIcon size={16} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--vp-text)', lineHeight: 1.1 }}>
              {theme.label}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--vp-text-muted)', marginTop: 1 }}>
              {currentIndex + 1} de {total}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => navigate('right')} disabled={currentIndex === 0}
            style={{ width: 34, height: 34, borderRadius: 10, background: currentIndex === 0 ? 'transparent' : 'var(--vp-surface)', border: currentIndex === 0 ? 'none' : '1px solid var(--vp-border)', color: currentIndex === 0 ? 'var(--vp-border)' : 'var(--vp-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentIndex === 0 ? 'default' : 'pointer' }}>
            <Icons.chevronLeft size={16} />
          </button>
          <button onClick={() => navigate('left')} disabled={currentIndex >= total - 1}
            style={{ width: 34, height: 34, borderRadius: 10, background: currentIndex >= total - 1 ? 'transparent' : 'var(--vp-surface)', border: currentIndex >= total - 1 ? 'none' : '1px solid var(--vp-border)', color: currentIndex >= total - 1 ? 'var(--vp-border)' : 'var(--vp-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentIndex >= total - 1 ? 'default' : 'pointer' }}>
            <Icons.chevronRight size={16} />
          </button>
          <button onClick={() => setShowFilters(!showFilters)}
            style={{ width: 34, height: 34, borderRadius: 10, background: showFilters ? 'rgba(37,99,235,0.08)' : 'var(--vp-surface)', border: showFilters ? '1px solid rgba(37,99,235,0.2)' : '1px solid var(--vp-border)', color: showFilters ? 'var(--ax-blue)' : 'var(--vp-text-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icons.filter size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--vp-border)', margin: '0 16px', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: theme.gradient, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{ padding: '10px 16px', display: 'flex', gap: 8, flexShrink: 0, animation: 'fadeIn 0.15s' }}>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'var(--vp-text)', backgroundColor: 'var(--vp-surface)', border: '1px solid var(--vp-border)', outline: 'none' }}>
            <option value="all">Todas</option>
            <option value="call">📞 Ligar</option>
            <option value="message">💬 WhatsApp</option>
            <option value="email">✉️ E-mail</option>
            <option value="meeting">👥 Reunião</option>
          </select>
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value as any)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'var(--vp-text)', backgroundColor: 'var(--vp-surface)', border: '1px solid var(--vp-border)', outline: 'none' }}>
            <option value="all">Qualquer Data</option>
            <option value="today">📅 Hoje</option>
            <option value="overdue">⚠️ Atrasadas</option>
          </select>
        </div>
      )}

      {/* ===== MAIN CARD ===== */}
      <div key={a.id} style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '16px 16px 0 16px', overflow: 'auto',
        animation: slideDir === 'left' ? 'slideL 0.2s ease-out' : slideDir === 'right' ? 'slideR 0.2s ease-out' : 'none',
      }}>
        {/* Main Card */}
        <div style={{
          background: 'var(--vp-surface)', borderRadius: 24,
          border: '1px solid var(--vp-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)',
          padding: '20px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Due Info (Right aligned, minimal plain text) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: isOverdue ? '#dc2626' : 'var(--vp-text-muted)',
            }}>
              {due === 0 ? 'Hoje' : due < 0 ? `${Math.abs(due)}d atraso` : `Em ${due}d`}
            </div>
          </div>

          {/* Deal Title */}
          <div>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(
                deal.title
                  .replace(/^(neg[oó]cio\b\s*[:\-|\s]*)/gi, '')
                  .replace(/\bneg[oó]cio\b/gi, '')
                  .trim()
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <h1 style={{
                margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--vp-text)',
                lineHeight: 1.2, letterSpacing: '-0.5px', cursor: 'pointer',
              }}>
                {deal.title}
              </h1>
            </a>
            {a.title && a.title !== deal.title && (
              <p style={{ margin: '6px 0 0 0', fontSize: 14, fontWeight: 600, color: 'var(--vp-text-soft)', lineHeight: 1.3 }}>
                {a.title}
              </p>
            )}
          </div>

          {/* Stage pill */}
          <div style={{
            alignSelf: 'flex-start',
            fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '5px 12px', borderRadius: 8,
            background: 'var(--vp-surface-muted)', color: 'var(--vp-text-soft)',
            border: '1px solid var(--vp-border)',
          }}>
            {stage?.title || 'Sem etapa'}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--vp-border)' }} />

          {/* Contact Info — always visible */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: 'var(--vp-surface-muted)', border: '1px solid var(--vp-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--vp-text-soft)', flexShrink: 0,
              }}>
                <Icons.user size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--vp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {contact?.name || 'Sem contato'}
                </div>
                {contact?.phone ? (
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--vp-text-muted)',
                      textDecoration: 'none',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    {contact.phone}
                  </a>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--vp-text-muted)' }}>
                    Sem telefone
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notes section */}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowNotes(!showNotes)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 16,
              background: showNotes ? 'var(--vp-surface)' : 'transparent',
              border: showNotes ? '1px solid var(--vp-border)' : '1px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: showNotes ? 'var(--vp-text)' : 'var(--vp-text-soft)' }}>
              <Icons.fileText size={16} />
              {execNotes[a.id] ? '✏️ Notas adicionadas' : 'Adicionar notas'}
            </span>
            <Icons.chevronRight size={14} style={{
              color: 'var(--vp-text-muted)',
              transform: showNotes ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
            }} />
          </button>

          {showNotes && (
            <div style={{
              padding: '12px 16px', marginTop: 4,
              background: 'var(--vp-surface)', borderRadius: 16,
              border: '1px solid var(--vp-border)',
              animation: 'fadeIn 0.15s',
            }}>
              <div style={{ position: 'relative' }}>
                <textarea
                  placeholder="O que aconteceu nesta interação?"
                  value={execNotes[a.id] || ''}
                  onChange={e => setExecNotes(p => ({ ...p, [a.id]: e.target.value }))}
                  style={{
                    width: '100%', minHeight: 72, padding: '12px 44px 12px 12px',
                    borderRadius: 12, border: '1px solid var(--vp-border)',
                    fontSize: 14, outline: 'none', resize: 'vertical',
                    backgroundColor: 'var(--vp-surface-muted)',
                  }}
                />
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                  <VoiceMicButton isRecording={isRecording} onToggle={toggleRecording} size="sm" variant="minimal" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 12 }} />
      </div>

      {/* ===== BOTTOM ACTION BAR ===== */}
      <div style={{
        flexShrink: 0, padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--vp-border)',
        display: 'flex', gap: 10,
      }}>
        <button
          onClick={() => setActivityToComplete(a)}
          style={{
            flex: 1,
            background: hasPhone ? 'var(--vp-surface)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            color: hasPhone ? 'var(--vp-text)' : 'white',
            border: hasPhone ? '1.5px solid var(--vp-border)' : 'none',
            padding: '15px 10px', borderRadius: 16,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: hasPhone ? 'none' : '0 6px 20px rgba(59,130,246,0.2)',
          }}
        >
          <Icons.check size={16} />
          Concluir atividade
        </button>
        {hasPhone && (
          <a
            href={isMobile ? getWhatsAppUrl(contact.phone!) : getCleanedPhoneLink(contact.phone!)}
            target={isMobile ? "_blank" : "_self"}
            rel="noopener noreferrer"
            onClick={() => { if (isMobile) handleWhatsAppClick(a); }}
            style={{
              flex: 1,
              background: isMobile
                ? 'linear-gradient(135deg, #25D366, #128C7E)'
                : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: 'white', padding: '15px', borderRadius: 16,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
              fontWeight: 800, fontSize: 16, textDecoration: 'none',
              boxShadow: isMobile ? '0 6px 20px rgba(37,211,102,0.2)' : '0 6px 20px rgba(59,130,246,0.2)',
              border: 'none',
            }}
          >
            {isMobile ? <Icons.whatsapp size={20} /> : <Icons.phone size={20} />}
            {isMobile ? 'WhatsApp' : 'Ligar'}
          </a>
        )}
      </div>

      {/* ===== WHATSAPP BOTTOM SHEET ===== */}
      {showWhatsAppPrompt && pendingWhatsAppActivity && (() => {
        const waDeal = getDeal(pendingWhatsAppActivity.dealId);
        const waContact = getContact(pendingWhatsAppActivity.contactId || waDeal?.contactId);
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'fadeIn 0.25s',
          }}>
            <div style={{
              width: '100%', maxWidth: 500, background: 'var(--vp-surface)',
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              padding: '24px 20px 40px', borderTop: '1px solid var(--vp-border)',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.1)',
              animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--vp-border)', alignSelf: 'center' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(34,197,94,0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.whatsapp size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--vp-text)' }}>Mensagem Enviada?</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--vp-text-soft)', fontWeight: 600 }}>{waContact?.name || 'Contato'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--vp-text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mensagem Enviada (Opcional)
                </label>
                <textarea
                  placeholder="Cole aqui o texto da mensagem..."
                  value={pastedMessage} onChange={e => setPastedMessage(e.target.value)}
                  style={{ width: '100%', minHeight: 70, maxHeight: 120, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--vp-border)', fontSize: 13, outline: 'none', resize: 'vertical', backgroundColor: 'var(--vp-surface-muted)', color: 'var(--vp-text)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={async () => {
                    const act = pendingWhatsAppActivity;
                    const msg = pastedMessage.trim();
                    setShowWhatsAppPrompt(false);
                    setPendingWhatsAppActivity(null);
                    setPastedMessage('');

                    let notes = execNotes[act.id] || "";
                    if (msg) { notes = notes ? `${notes}\n\n[Mensagem Enviada]:\n"${msg}"` : `Mensagem enviada via WhatsApp:\n\n"${msg}"`; }
                    else { notes = notes || "Mensagem enviada via WhatsApp."; }

                    if (act.type === 'message') {
                      await completeActivityWithLog(act.id, notes, true);
                    } else {
                      await addActivity({ dealId: act.dealId, type: 'message', title: 'Mensagem enviada via WhatsApp', status: 'completed', completed: true, dueDate: new Date().toISOString(), notes });
                    }

                    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
                    await addActivity({ dealId: act.dealId, type: 'message', title: 'Verificar se respondeu ao WhatsApp', status: 'pending', completed: false, dueDate: tmr.toISOString(), originStage: act.originStage });
                  }}
                  style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #25D366, #128C7E)', color: 'white', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,211,102,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Icons.check size={18} /> Sim, enviei
                </button>
                <button
                  onClick={() => { setShowWhatsAppPrompt(false); setPendingWhatsAppActivity(null); }}
                  style={{ width: '100%', padding: '16px', background: 'transparent', color: 'var(--vp-text-soft)', border: '1px solid var(--vp-border)', borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  Não enviei / Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <CompleteActivityModal
        isOpen={!!activityToComplete} onClose={() => setActivityToComplete(null)}
        activity={activityToComplete}
        initialNotes={activityToComplete ? execNotes[activityToComplete.id] || '' : ''}
        onCompleted={async () => setActivityToComplete(null)}
      />
    </div>
  );
}
