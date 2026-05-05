import React, { useMemo } from 'react';
import { Activity } from '@/types/schema';
import { Currency } from '@/data/currencies';
import { useCRM } from '@/contexts/CRMContext';
import { Icons } from './Icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  call:      { label: 'Ligar',   icon: 'phone',    color: 'var(--ax-blue)',   bg: 'var(--ax-blue-bg)' },
  email:     { label: 'E-mail',  icon: 'mail',     color: '#7c5cff',          bg: '#efebff' },
  message:   { label: 'Mensagem', icon: 'whatsapp', color: 'var(--ax-success)', bg: '#defaee' },
  meeting:   { label: 'Reunião', icon: 'video',    color: '#d23a82',          bg: '#fde7f1' },
  task:      { label: 'Tarefa',  icon: 'check',    color: 'var(--ax-neutral)', bg: 'var(--ax-neutral-bg)' },
};

function fmtMoney(v: number, currency: Currency): string {
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency', currency: currency.code,
    minimumFractionDigits: 0,
  }).format(v).replace(/\s+/g, '');
}

interface Props {
  activity: Activity;
  currency: Currency;
  onClose: () => void;
  onComplete: (activity: Activity) => void;
  className?: string;
}

const DetailPanelReal = React.memo(function DetailPanelReal({ activity, currency, onClose, onComplete, className }: Props) {
  const { deals, contacts, pipelines, activities, isPrivacyMode, openFocusDeal } = useCRM();
  const blur = isPrivacyMode ? 'ax-blur' : '';

  const deal = useMemo(() => deals.find(d => d.id === activity.dealId), [deals, activity.dealId]);
  const contact = useMemo(() => contacts.find(c => c.id === (activity.contactId || deal?.contactId)), [contacts, activity.contactId, deal]);
  const pipelineStages = useMemo(() => deal ? (pipelines[deal.pipelineId]?.stages || []) : [], [deal, pipelines]);
  const currentStage = useMemo(() => deal ? pipelineStages.find(s => s.id === deal.stageId) : null, [deal, pipelineStages]);

  const suggestion = activity.notes || activity.tooltipScript;

  return (
    <aside className={`ax-sidebar ${className || ''}`}>
      {/* HEADER */}
      <div style={{ padding: '24px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="ax-label" style={{ margin: 0 }}>Guia de Execução</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vp-text-soft)' }}>
          <Icons.close size={20} />
        </button>
      </div>

      {/* STEP 6: PRATIC SUGGESTION (PINK BOX) */}
      {suggestion && (
        <div className="ax-sidebar-suggestion">
          <div className="ax-sidebar-suggestion-lbl">
            <Icons.zap size={10} />
            O que falar agora
          </div>
          <div className="ax-sidebar-suggestion-txt">"{suggestion}"</div>
        </div>
      )}

      {/* STEP 6: DIRECT CONTEXT */}
      <div className="ax-sidebar-ctx">
        <span className="ax-label">Contexto do Negócio</span>
        
        <div className="ax-sidebar-ctx-row">
          <span className="ax-sidebar-ctx-lbl">Negócio</span>
          <span className={`ax-sidebar-ctx-val ax-exec-deal ${blur}`} onClick={() => deal && openFocusDeal(deal.id)}>
            {deal?.title || '—'}
          </span>
        </div>

        <div className="ax-sidebar-ctx-row">
          <span className="ax-sidebar-ctx-lbl">Contato</span>
          <span className={`ax-sidebar-ctx-val ${blur}`}>{contact?.name || '—'}</span>
        </div>

        <div className="ax-sidebar-ctx-row">
          <span className="ax-sidebar-ctx-lbl">Estágio</span>
          <span className="ax-sidebar-ctx-val" style={{ color: currentStage?.color }}>
            {currentStage?.title || '—'}
          </span>
        </div>

        <div className="ax-sidebar-ctx-row">
          <span className="ax-sidebar-ctx-lbl">Valor</span>
          <span className={`ax-sidebar-ctx-val ${blur}`}>{deal ? fmtMoney(deal.value, currency) : '—'}</span>
        </div>

        {/* FULL HISTORY */}
        <span className="ax-label" style={{ marginTop: 16 }}>Histórico de Interações</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {activities
            .filter(a => a.dealId === deal?.id && a.completed)
            .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
            .slice(0, 5) // Last 5 activities
            .map(pa => {
              const ptc = TYPE_CONFIG[pa.type] || TYPE_CONFIG.task;
              const PIcon = Icons[ptc.icon] || Icons.check;
              const interactionText = pa.notes || pa.result || pa.description;

              return (
                <div key={pa.id} style={{ display: 'flex', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--vp-bg)' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: ptc.bg, color: ptc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PIcon size={12} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{pa.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--vp-text-soft)' }}>
                      {pa.completedAt ? format(parseISO(pa.completedAt), "dd MMM HH:mm", { locale: ptBR }) : ''}
                    </div>
                    {interactionText && (
                      <div style={{ 
                        fontSize: 11, 
                        color: 'var(--vp-text-muted)', 
                        marginTop: 4, 
                        padding: '6px 8px', 
                        background: 'var(--vp-bg)', 
                        borderRadius: 4,
                        borderLeft: `2px solid ${ptc.color}`
                      }}>
                        {interactionText}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          
          {activities.filter(a => a.dealId === deal?.id && a.completed).length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--vp-text-soft)', padding: '12px 0', textAlign: 'center', background: 'var(--vp-bg)', borderRadius: 6 }}>
              Nenhuma interação anterior.
            </div>
          )}
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid var(--vp-border)', display: 'flex', gap: 10 }}>
        <button 
          className="ax-btn ax-btn-primary" 
          style={{ flex: 1, height: 48, justifyContent: 'center' }}
          onClick={() => onComplete(activity)}
        >
          <Icons.check size={18} /> Concluir
        </button>
      </div>
    </aside>
  );
});

export default DetailPanelReal;
