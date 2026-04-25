import React from 'react';
import { ActivityV2, TYPES, STAGES, HISTORY_MOCK, fmtMoney, fmtDue } from '@/data/activitiesV2Data';
import { Icons } from './Icons';

interface Props {
  activity: ActivityV2;
  privacy: boolean;
  onClose: () => void;
  onComplete: (id: number) => void;
}

const DetailPanel = React.memo(function DetailPanel({ activity, privacy, onClose, onComplete }: Props) {
  const t = TYPES[activity.type];
  const stageIndex = STAGES.findIndex(s => s.id === activity.stage);
  const stage = STAGES[stageIndex] || STAGES[0];
  const TypeIcon = Icons[t.icon];
  const blur = privacy ? 'av2-blur' : '';

  return (
    <div className="av2-detail">
      {/* Hero */}
      <div className="av2-detail-hero">
        <div className="av2-detail-type" style={{ background: t.bg, color: t.color }}>
          <TypeIcon size={12} />
          {t.label}
        </div>
        <h2 className="av2-detail-title">{activity.title}</h2>
        <div className="av2-detail-due">
          <Icons.clock size={13} />
          <span>{fmtDue(activity.due, activity.time)}</span>
          {activity.attempt > 0 && (
            <span style={{ marginLeft: 8, opacity: 0.6 }}>· tentativa {activity.attempt + 1}</span>
          )}
        </div>
        <button className="av2-detail-close" onClick={onClose} aria-label="Fechar">
          <Icons.close size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="av2-detail-body">
        {/* Deal card */}
        <div className="av2-deal-card">
          <div className="av2-deal-row">
            <span className={`av2-deal-name ${blur}`}>{activity.deal}</span>
            <span className={`av2-deal-value ${blur}`}>{fmtMoney(activity.value)}</span>
          </div>
          <div className={`av2-deal-contact ${blur}`}>{activity.contact}</div>

          <div className="av2-stage-bar">
            {STAGES.map((s, i) => (
              <div
                key={s.id}
                className={`av2-stage-seg ${i <= stageIndex ? 'av2-stage-seg--filled' : ''}`}
              />
            ))}
          </div>
          <div className="av2-stage-label">
            <span className="av2-stage-name">
              <span className="av2-stage-dot" style={{ background: stage.color }} />
              {stage.label}
            </span>
            <span className="av2-stage-pct">{stage.pct}%</span>
          </div>
        </div>

        {/* Suggestion */}
        {activity.suggestion && (
          <div className="av2-suggest">
            <div className="av2-suggest-head">✦ Sugestão</div>
            <div className="av2-suggest-text">{activity.suggestion}</div>
          </div>
        )}

        {/* History */}
        <div className="av2-history">
          <div className="av2-history-head">Histórico</div>
          {HISTORY_MOCK.map((h, i) => {
            const HIcon = Icons[TYPES[h.type].icon];
            return (
              <div key={i} className="av2-history-item">
                <div className="av2-history-icon" style={{ background: TYPES[h.type].bg, color: TYPES[h.type].color }}>
                  <HIcon size={12} />
                </div>
                <div>
                  <div className="av2-history-text">{h.text}</div>
                  <div className="av2-history-date">{h.date}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="av2-detail-footer">
        <button className="av2-btn av2-btn--success" onClick={() => onComplete(activity.id)}>
          <Icons.check size={14} />
          Concluir
        </button>
        <button className="av2-btn av2-btn--outline">Adiar</button>
      </div>
    </div>
  );
});

export default DetailPanel;
