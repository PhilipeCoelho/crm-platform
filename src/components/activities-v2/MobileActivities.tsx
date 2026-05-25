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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // States para ações inline
  const [showNotes, setShowNotes] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const [execNotes, setExecNotes] = useState<Record<string, string>>({});
  const [activityToComplete, setActivityToComplete] = useState<Activity | null>(null);

  // States para detecção e confirmação do WhatsApp
  const [pendingWhatsAppActivity, setPendingWhatsAppActivity] = useState<Activity | null>(null);
  const [hasLeftApp, setHasLeftApp] = useState(false);
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const [pastedMessage, setPastedMessage] = useState('');

  // Slide animation direction
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);

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

    const handleBlur = () => { setHasLeftApp(true); };
    const handleFocus = () => { if (hasLeftApp) setShowWhatsAppPrompt(true); };

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
    setTimeout(() => setHasLeftApp(true), 1500);
  }, []);

  // --- Ordenação Inteligente ---
  const mobileActivities = useMemo(() => {
    return filterRealActivities(activities)
      .filter(a => !a.completed && a.status !== 'canceled')
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
        if (dueA !== dueB) return dueA - dueB;

        const cA = getContact(a.contactId || getDeal(a.dealId)?.contactId);
        const cB = getContact(b.contactId || getDeal(b.dealId)?.contactId);
        const scorePhone = (c?: any) => {
          if (!c || !c.phone) return 0;
          if (isMobileNumber(c.phone)) return 2;
          if (isLandline(c.phone)) return 1;
          return 1;
        };
        const scoreA = scorePhone(cA);
        const scoreB = scorePhone(cB);
        if (scoreA !== scoreB) return scoreB - scoreA;

        const valA = getDeal(a.dealId)?.value || 0;
        const valB = getDeal(b.dealId)?.value || 0;
        return valB - valA;
      });
  }, [activities, getDeal, getContact, filterType, periodFilter]);

  // Reset index when filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setShowNotes(false);
    setShowContact(false);
  }, [filterType, periodFilter]);

  // Clamp index
  useEffect(() => {
    if (currentIndex >= mobileActivities.length && mobileActivities.length > 0) {
      setCurrentIndex(mobileActivities.length - 1);
    }
  }, [mobileActivities.length, currentIndex]);

  // Voice Notes Hook
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

  const current = mobileActivities[currentIndex] || null;

  const goNext = useCallback(() => {
    if (currentIndex < mobileActivities.length - 1) {
      setSlideDir('left');
      setShowNotes(false);
      setShowContact(false);
      setTimeout(() => {
        setCurrentIndex(i => i + 1);
        setSlideDir(null);
      }, 150);
    }
  }, [currentIndex, mobileActivities.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSlideDir('right');
      setShowNotes(false);
      setShowContact(false);
      setTimeout(() => {
        setCurrentIndex(i => i - 1);
        setSlideDir(null);
      }, 150);
    }
  }, [currentIndex]);

  // ==================== RENDER ====================

  // Empty state
  if (mobileActivities.length === 0) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 32,
        background: 'var(--vp-surface-muted)',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'rgba(34, 197, 94, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icons.check size={36} style={{ color: '#22c55e' }} />
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--vp-text)', textAlign: 'center' }}>
          Fila Limpa!
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--vp-text-soft)', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
          Não há atividades pendentes para os filtros selecionados.
        </p>
      </div>
    );
  }

  const a = current!;
  const deal = getDeal(a.dealId)!;
  const stage = getStage(a.dealId);
  const contact = getContact(a.contactId || deal.contactId);
  const due = getDueDays(a.dueDate);
  const typeTheme = TYPE_THEME[a.type] || TYPE_THEME.task;
  const ActionIcon = Icons[typeTheme.icon];
  const hasPhone = !!contact?.phone;
  const isMobile = hasPhone && isMobileNumber(contact.phone);
  const isOverdue = due < 0;
  const total = mobileActivities.length;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--vp-surface-muted)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      {/* ===== TOP BAR ===== */}
      <div style={{
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--vp-border)',
        flexShrink: 0,
      }}>
        {/* Counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 15, fontWeight: 900, color: 'var(--vp-text)',
            letterSpacing: '-0.3px'
          }}>
            {currentIndex + 1}
            <span style={{ color: 'var(--vp-text-muted)', fontWeight: 600 }}> / {total}</span>
          </span>
          {/* Mini progress bar */}
          <div style={{
            width: 60, height: 4, borderRadius: 2,
            background: 'var(--vp-border)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${((currentIndex + 1) / total) * 100}%`,
              background: 'var(--ax-blue)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Navigation arrows + Filter toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: currentIndex === 0 ? 'transparent' : 'var(--vp-surface)',
              border: currentIndex === 0 ? 'none' : '1px solid var(--vp-border)',
              color: currentIndex === 0 ? 'var(--vp-border)' : 'var(--vp-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: currentIndex === 0 ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Icons.chevronLeft size={18} />
          </button>
          <button
            onClick={goNext}
            disabled={currentIndex >= total - 1}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: currentIndex >= total - 1 ? 'transparent' : 'var(--vp-surface)',
              border: currentIndex >= total - 1 ? 'none' : '1px solid var(--vp-border)',
              color: currentIndex >= total - 1 ? 'var(--vp-border)' : 'var(--vp-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: currentIndex >= total - 1 ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Icons.chevronRight size={18} />
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--vp-border)', margin: '0 4px' }} />
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: showFilters ? 'rgba(37, 99, 235, 0.08)' : 'var(--vp-surface)',
              border: showFilters ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid var(--vp-border)',
              color: showFilters ? 'var(--ax-blue)' : 'var(--vp-text-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <Icons.filter size={16} />
          </button>
        </div>
      </div>

      {/* ===== FILTERS (Collapsible) ===== */}
      {showFilters && (
        <div style={{
          padding: '10px 20px',
          display: 'flex', gap: 8,
          background: 'rgba(255,255,255,0.95)',
          borderBottom: '1px solid var(--vp-border)',
          flexShrink: 0,
          animation: 'fadeIn 0.15s ease-out',
        }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 10,
              fontSize: 13, fontWeight: 700,
              color: 'var(--vp-text)', backgroundColor: 'var(--vp-surface)',
              border: '1px solid var(--vp-border)', outline: 'none',
            }}
          >
            <option value="all">Todas</option>
            <option value="call">📞 Ligar</option>
            <option value="message">💬 WhatsApp</option>
            <option value="email">✉️ E-mail</option>
            <option value="meeting">👥 Reunião</option>
          </select>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 10,
              fontSize: 13, fontWeight: 700,
              color: 'var(--vp-text)', backgroundColor: 'var(--vp-surface)',
              border: '1px solid var(--vp-border)', outline: 'none',
            }}
          >
            <option value="all">Qualquer Data</option>
            <option value="today">📅 Hoje</option>
            <option value="overdue">⚠️ Atrasadas</option>
          </select>
        </div>
      )}

      {/* ===== MAIN CARD (Full Screen Focus) ===== */}
      <div
        key={a.id}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 20px 0 20px',
          overflow: 'auto',
          animation: slideDir === 'left' ? 'slideInLeft 0.2s ease-out' : slideDir === 'right' ? 'slideInRight 0.2s ease-out' : 'none',
        }}
      >
        {/* Type & Due Badge Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: typeTheme.bg, padding: '6px 14px', borderRadius: 12,
            border: `1px solid ${typeTheme.bg.replace('0.08', '0.18')}`,
          }}>
            <div style={{ color: typeTheme.color, display: 'flex' }}>
              <ActionIcon size={14} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: typeTheme.color }}>
              {typeTheme.label}
            </span>
          </div>

          <div style={{
            padding: '6px 14px', borderRadius: 12,
            background: isOverdue ? '#fef2f2' : 'var(--vp-surface)',
            border: isOverdue ? '1px solid #fecaca' : '1px solid var(--vp-border)',
            color: isOverdue ? '#ef4444' : 'var(--vp-text-soft)',
            fontSize: 13, fontWeight: 800,
          }}>
            {due === 0 ? '📅 Hoje' : due < 0 ? `⚠️ ${Math.abs(due)}d atraso` : `⌛ ${due}d`}
          </div>
        </div>

        {/* Deal Title */}
        <h1 style={{
          margin: '0 0 8px 0', fontSize: 24, fontWeight: 800,
          color: 'var(--vp-text)', lineHeight: 1.2, letterSpacing: '-0.5px'
        }}>
          {deal.title}
        </h1>

        {/* Activity Title (if differs from deal) */}
        {a.title && a.title !== deal.title && (
          <p style={{
            margin: '0 0 12px 0', fontSize: 14, fontWeight: 600,
            color: 'var(--vp-text-soft)', lineHeight: 1.4,
          }}>
            {a.title}
          </p>
        )}

        {/* Tags */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <span style={{
            background: 'var(--vp-surface)', border: '1px solid var(--vp-border)',
            padding: '5px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
            color: 'var(--vp-text-soft)',
          }}>
            {stage?.title || 'Sem etapa'}
          </span>
          <span style={{
            background: 'rgba(217, 119, 6, 0.06)', border: '1px solid rgba(217, 119, 6, 0.15)',
            padding: '5px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800,
            color: '#d97706',
          }}>
            {fmtMoney(deal.value, currency)}
          </span>
          {contact && (
            <span style={{
              background: 'var(--vp-surface)', border: '1px solid var(--vp-border)',
              padding: '5px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              color: 'var(--vp-text-soft)', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Icons.user size={11} style={{ opacity: 0.6 }} />
              {contact.name}
            </span>
          )}
        </div>

        {/* ===== EXPANDABLE SECTIONS ===== */}

        {/* Contact Info (toggle) */}
        <button
          onClick={() => { setShowContact(!showContact); setShowNotes(false); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '12px 16px', marginBottom: 8,
            background: showContact ? 'rgba(37, 99, 235, 0.04)' : 'var(--vp-surface)',
            border: showContact ? '1px solid rgba(37, 99, 235, 0.15)' : '1px solid var(--vp-border)',
            borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: showContact ? 'var(--ax-blue)' : 'var(--vp-text-soft)' }}>
            <Icons.user size={15} /> Dados do Contato
          </span>
          <Icons.chevronRight size={14} style={{
            color: 'var(--vp-text-muted)',
            transform: showContact ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
          }} />
        </button>
        {showContact && contact && (
          <div style={{
            padding: '12px 16px', marginBottom: 8,
            background: 'var(--vp-surface)', borderRadius: 14,
            border: '1px solid var(--vp-border)',
            display: 'flex', flexDirection: 'column', gap: 10,
            animation: 'fadeIn 0.15s ease-out',
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--vp-text-muted)', marginBottom: 2 }}>Telefone</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--vp-text)' }}>{contact.phone || 'Não informado'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--vp-text-muted)', marginBottom: 2 }}>E-mail</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--vp-text)' }}>{contact.email || 'Não informado'}</div>
            </div>
          </div>
        )}

        {/* Notes (toggle) */}
        <button
          onClick={() => { setShowNotes(!showNotes); setShowContact(false); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '12px 16px', marginBottom: 8,
            background: showNotes ? 'rgba(37, 99, 235, 0.04)' : 'var(--vp-surface)',
            border: showNotes ? '1px solid rgba(37, 99, 235, 0.15)' : '1px solid var(--vp-border)',
            borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: showNotes ? 'var(--ax-blue)' : 'var(--vp-text-soft)' }}>
            <Icons.fileText size={15} /> Notas da Execução
          </span>
          <Icons.chevronRight size={14} style={{
            color: 'var(--vp-text-muted)',
            transform: showNotes ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
          }} />
        </button>
        {showNotes && (
          <div style={{
            padding: '12px 16px', marginBottom: 8,
            background: 'var(--vp-surface)', borderRadius: 14,
            border: '1px solid var(--vp-border)',
            animation: 'fadeIn 0.15s ease-out',
          }}>
            <div style={{ position: 'relative' }}>
              <textarea
                placeholder="Registrar notas desta interação..."
                value={execNotes[a.id] || ''}
                onChange={(e) => setExecNotes(p => ({...p, [a.id]: e.target.value}))}
                style={{
                  width: '100%', minHeight: 80, padding: '12px 44px 12px 12px',
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

        {/* Spacer to push actions to bottom */}
        <div style={{ flex: 1, minHeight: 16 }} />
      </div>

      {/* ===== BOTTOM ACTION BAR (Fixed) ===== */}
      <div style={{
        flexShrink: 0,
        padding: '16px 20px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--vp-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {/* Primary Action Row */}
        <div style={{ display: 'flex', gap: 10 }}>
          {hasPhone ? (
            <a
              href={isMobile ? getWhatsAppUrl(contact.phone!) : getCleanedPhoneLink(contact.phone!)}
              target={isMobile ? "_blank" : "_self"}
              rel="noopener noreferrer"
              onClick={() => { if (isMobile) handleWhatsAppClick(a); }}
              style={{
                flex: 1,
                background: isMobile
                  ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                padding: '16px',
                borderRadius: 16,
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
                fontWeight: 800, fontSize: 16, textDecoration: 'none',
                boxShadow: isMobile
                  ? '0 6px 16px rgba(37, 211, 102, 0.2)'
                  : '0 6px 16px rgba(37, 99, 235, 0.2)',
                transition: 'all 0.2s', border: 'none',
              }}
            >
              {isMobile ? <Icons.whatsapp size={20} /> : <Icons.phone size={20} />}
              {isMobile ? 'WhatsApp' : 'Ligar'}
            </a>
          ) : null}

          <button
            onClick={() => setActivityToComplete(a)}
            style={{
              flex: hasPhone ? 0.6 : 1,
              background: hasPhone ? 'var(--vp-surface)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: hasPhone ? 'var(--vp-text)' : 'white',
              border: hasPhone ? '1px solid var(--vp-border)' : 'none',
              padding: '16px',
              borderRadius: 16,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
              fontWeight: 700, fontSize: hasPhone ? 14 : 16,
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: hasPhone ? 'none' : '0 6px 16px rgba(37, 99, 235, 0.2)',
            }}
          >
            <Icons.check size={18} />
            Concluir
          </button>
        </div>
      </div>

      {/* ===== WHATSAPP CONFIRMATION BOTTOM SHEET ===== */}
      {showWhatsAppPrompt && pendingWhatsAppActivity && (() => {
        const waDeal = getDeal(pendingWhatsAppActivity.dealId);
        const waContact = getContact(pendingWhatsAppActivity.contactId || waDeal?.contactId);

        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'fadeIn 0.25s ease-out',
          }}>
            <div style={{
              width: '100%', maxWidth: 500,
              background: 'var(--vp-surface)',
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              padding: '24px 20px 40px 20px',
              borderTop: '1px solid var(--vp-border)',
              boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.1)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              {/* Drag indicator */}
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--vp-border)', alignSelf: 'center' }} />

              {/* Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icons.whatsapp size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--vp-text)' }}>
                    Mensagem Enviada?
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--vp-text-soft)', fontWeight: 600 }}>
                    {waContact?.name || 'Contato'}
                  </p>
                </div>
              </div>

              {/* Paste field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--vp-text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mensagem Enviada (Opcional)
                </label>
                <textarea
                  placeholder="Cole aqui o texto da mensagem para guardar no histórico..."
                  value={pastedMessage}
                  onChange={(e) => setPastedMessage(e.target.value)}
                  style={{
                    width: '100%', minHeight: 70, maxHeight: 120,
                    padding: '10px 12px', borderRadius: 12,
                    border: '1px solid var(--vp-border)', fontSize: 13,
                    outline: 'none', resize: 'vertical',
                    backgroundColor: 'var(--vp-surface-muted)',
                    color: 'var(--vp-text)',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={async () => {
                    const activity = pendingWhatsAppActivity;
                    const messageContent = pastedMessage.trim();

                    setShowWhatsAppPrompt(false);
                    setPendingWhatsAppActivity(null);
                    setPastedMessage('');

                    let notes = execNotes[activity.id] || "";
                    if (messageContent) {
                      notes = notes
                        ? `${notes}\n\n[Mensagem Enviada]:\n"${messageContent}"`
                        : `Mensagem enviada via WhatsApp:\n\n"${messageContent}"`;
                    } else {
                      notes = notes || "Mensagem enviada via WhatsApp.";
                    }

                    if (activity.type === 'message') {
                      await completeActivityWithLog(activity.id, notes, true);
                    } else {
                      const now = new Date();
                      await addActivity({
                        dealId: activity.dealId,
                        type: 'message',
                        title: 'Mensagem enviada via WhatsApp',
                        status: 'completed',
                        completed: true,
                        dueDate: now.toISOString(),
                        notes: notes,
                      });
                    }

                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    await addActivity({
                      dealId: activity.dealId,
                      type: 'message',
                      title: 'Verificar se respondeu ao WhatsApp',
                      status: 'pending',
                      completed: false,
                      dueDate: tomorrow.toISOString(),
                      originStage: activity.originStage,
                    });
                  }}
                  style={{
                    width: '100%', padding: '16px',
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    color: 'white', border: 'none', borderRadius: 16,
                    fontSize: 15, fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 211, 102, 0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
                    width: '100%', padding: '16px',
                    background: 'transparent',
                    color: 'var(--vp-text-soft)',
                    border: '1px solid var(--vp-border)', borderRadius: 16,
                    fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
