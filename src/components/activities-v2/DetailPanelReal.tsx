import React, { useMemo } from 'react';
import { Activity } from '@/types/schema';
import { Currency } from '@/data/currencies';
import { useCRM } from '@/contexts/CRMContext';
import { Icons } from './Icons';
import { differenceInDays, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

function fmtMoney(v: number, currency: Currency): string {
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency', currency: currency.code,
    maximumFractionDigits: v >= 1000 ? 0 : 2,
    notation: v >= 100_000 ? 'compact' : 'standard',
  }).format(v);
}

interface Props {
  activity: Activity;
  currency: Currency;
  onClose: () => void;
  onComplete: (activity: Activity) => void;
}

const DetailPanelReal = React.memo(function DetailPanelReal({ activity, currency, onClose, onComplete }: Props) {
  const { deals, contacts, companies, pipelines, logs, activities, isPrivacyMode, openFocusDeal } = useCRM();
  const blur = isPrivacyMode ? 'av2-blur' : '';

  const tc = TYPE_CONFIG[activity.type] || TYPE_CONFIG.task;
  const TypeIcon = Icons[tc.icon] || Icons.check;

  const deal = useMemo(() => deals.find(d => d.id === activity.dealId), [deals, activity.dealId]);
  const contact = useMemo(() => contacts.find(c => c.id === (activity.contactId || deal?.contactId)), [contacts, activity.contactId, deal]);
  const company = useMemo(() => companies.find(c => c.id === (deal?.companyId || activity.companyId)), [companies, deal, activity.companyId]);

  // Pipeline stages for this deal
  const pipelineStages = useMemo(() => {
    if (!deal) return [];
    return pipelines[deal.pipelineId]?.stages || [];
  }, [deal, pipelines]);

  const currentStageIndex = useMemo(() => {
    if (!deal) return -1;
    return pipelineStages.findIndex(s => s.id === deal.stageId);
  }, [deal, pipelineStages]);

  const currentStage = currentStageIndex >= 0 ? pipelineStages[currentStageIndex] : null;
  const stagePct = currentStage?.probability || 0;

  // Due text
  const dueText = useMemo(() => {
    if (!activity.dueDate) return 'Sem prazo';
    const due = differenceInDays(parseISO(activity.dueDate), new Date());
    if (due === 0) {
      try { const d = parseISO(activity.dueDate); const h = d.getHours(); const m = d.getMinutes(); if (h > 0 || m > 0) return `hoje ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; } catch {}
      return 'hoje';
    }
    if (due < 0) return `${Math.abs(due)} dias atrasada`;
    if (due === 1) return 'amanhã';
    return `em ${due} dias`;
  }, [activity.dueDate]);

  // History from real logs for this deal
  const dealHistory = useMemo(() => {
    if (!deal) return [];
    const dealLogs = logs
      .filter(l => l.dealId === deal.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);
    return dealLogs;
  }, [deal, logs]);

  // Past activities on this deal (for richer history)
  const pastActivities = useMemo(() => {
    if (!deal) return [];
    return activities
      .filter(a => a.dealId === deal.id && a.completed && a.id !== activity.id)
      .sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt))
      .slice(0, 5);
  }, [deal, activities, activity.id]);

  // Suggestion from activity notes
  const suggestion = activity.notes || activity.tooltipScript;

  return (
    <div className="av2-detail">
      {/* Hero */}
      <div className="av2-detail-hero">
        <div className="av2-detail-type" style={{ background: tc.bg, color: tc.color }}>
          <TypeIcon size={12} />
          {tc.label}
        </div>
        <h2 className="av2-detail-title">{activity.title}</h2>
        <div className="av2-detail-due">
          <Icons.clock size={13} />
          <span>{dueText}</span>
        </div>
        <button className="av2-detail-close" onClick={onClose} aria-label="Fechar">
          <Icons.close size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="av2-detail-body">
        {/* Deal card */}
        {deal && (
          <div className="av2-deal-card">
            <div className="av2-deal-row">
              <button 
                className={`av2-deal-name ${blur} hover:text-[var(--vp-blue-600)] hover:underline cursor-pointer text-left focus:outline-none transition-colors`}
                onClick={() => openFocusDeal(deal.id)}
              >
                {deal.title}
              </button>
              <span className={`av2-deal-value ${blur}`}>{fmtMoney(deal.value, currency)}</span>
            </div>
            {contact && <div className={`av2-deal-contact ${blur}`}>{contact.name}</div>}
            {company && <div className={`av2-deal-contact ${blur}`} style={{ marginTop: 0 }}>{company.name}</div>}

            {pipelineStages.length > 0 && (
              <>
                <div className="av2-stage-bar">
                  {pipelineStages.map((s, i) => (
                    <div
                      key={s.id}
                      className={`av2-stage-seg ${i <= currentStageIndex ? 'av2-stage-seg--filled' : ''}`}
                    />
                  ))}
                </div>
                {currentStage && (
                  <div className="av2-stage-label">
                    <span className="av2-stage-name">
                      <span className="av2-stage-dot" style={{ background: currentStage.color || 'var(--vp-blue-500)' }} />
                      {currentStage.title}
                    </span>
                    <span className="av2-stage-pct">{stagePct}%</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Suggestion */}
        {suggestion && (
          <div className="av2-suggest">
            <div className="av2-suggest-head">✦ Sugestão</div>
            <div className="av2-suggest-text">{suggestion}</div>
          </div>
        )}

        {/* History — from real logs + past activities */}
        <div className="av2-history">
          <div className="av2-history-head">Histórico</div>

          {pastActivities.length === 0 && dealHistory.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--vp-text-soft)' }}>Nenhum histórico registrado.</p>
          )}

          {pastActivities.map(pa => {
            const ptc = TYPE_CONFIG[pa.type] || TYPE_CONFIG.task;
            const PIcon = Icons[ptc.icon] || Icons.check;
            return (
              <div key={pa.id} className="av2-history-item">
                <div className="av2-history-icon" style={{ background: ptc.bg, color: ptc.color }}>
                  <PIcon size={12} />
                </div>
                <div>
                  <div className="av2-history-text">{pa.title}{pa.result ? ` — ${pa.result}` : ''}</div>
                  <div className="av2-history-date">
                    {pa.completedAt ? format(parseISO(pa.completedAt), "dd MMM yyyy", { locale: ptBR }) : ''}
                  </div>
                </div>
              </div>
            );
          })}

          {dealHistory.slice(0, 3).map(log => (
            <div key={log.id} className="av2-history-item">
              <div className="av2-history-icon" style={{ background: 'var(--vp-ink-50)', color: 'var(--vp-ink-500)' }}>
                <Icons.clock size={12} />
              </div>
              <div>
                <div className="av2-history-text">{log.content}</div>
                <div className="av2-history-date">{format(parseISO(log.createdAt), "dd MMM yyyy", { locale: ptBR })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="av2-detail-footer">
        <button className="av2-btn av2-btn--success" onClick={() => onComplete(activity)}>
          <Icons.check size={14} />
          Concluir
        </button>
        <button className="av2-btn av2-btn--outline">Adiar</button>
      </div>
    </div>
  );
});

export default DetailPanelReal;
