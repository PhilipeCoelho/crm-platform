import React from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  X, 
  RotateCw, 
  TrendingUp, 
  Layers, 
  Lightbulb, 
  BookMarked, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';
import type { ContentAction, ContentActionType } from '@/services/contentService';
import { useContentActions } from '@/hooks/content/useContentActions';

interface NextBestActionSectionProps {
  onExecuteAction?: (action: ContentAction) => void;
}

export const NextBestActionSection: React.FC<NextBestActionSectionProps> = ({
  onExecuteAction,
}) => {
  const {
    actions,
    primaryAction,
    secondaryActions,
    isLoading,
    isGenerating,
    generate,
    dismiss,
  } = useContentActions();

  const getActionBadge = (type: ContentActionType) => {
    switch (type) {
      case 'analisar_performance':
        return { label: 'Analisar Desempenho', icon: TrendingUp, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
      case 'registrar_metricas':
        return { label: 'Registrar Métricas', icon: Clock, color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
      case 'usar_oportunidade':
        return { label: 'Usar Oportunidade', icon: Sparkles, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
      case 'aplicar_aprendizado':
        return { label: 'Aplicar Aprendizado', icon: ShieldCheck, color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
      case 'analisar_referencia':
        return { label: 'Analisar Referência', icon: BookMarked, color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' };
      case 'continuar_producao':
        return { label: 'Continuar Produção', icon: Layers, color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
      default:
        return { label: 'Criar Ideia', icon: Lightbulb, color: 'bg-muted text-muted-foreground border-border' };
    }
  };

  const handleExecute = (action: ContentAction) => {
    if (onExecuteAction) {
      onExecuteAction(action);
    }
  };

  const handleDismiss = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await dismiss(id);
  };

  if (isLoading) {
    return (
      <div className="p-6 rounded-2xl bg-card border border-border animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-40" />
        <div className="h-16 bg-muted/60 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header da Seção */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Próximo Movimento
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            A ação de maior alavancagem com base em todos os sinais acumulados.
          </p>
        </div>

        <button
          type="button"
          onClick={() => generate()}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all disabled:opacity-50 shadow-sm"
          title="Recalcular próximo movimento com base nos dados mais recentes"
        >
          <RotateCw size={12} className={isGenerating ? 'animate-spin' : ''} />
          <span>{isGenerating ? 'Avaliando sinais...' : 'Recalcular'}</span>
        </button>
      </div>

      {/* Estado: Sem Ações (Você está em dia) */}
      {actions.length === 0 ? (
        <div className="p-6 rounded-2xl bg-card/40 border border-dashed border-border text-center space-y-2">
          <CheckCircle2 size={24} className="text-emerald-500 mx-auto" />
          <h3 className="font-bold text-sm text-foreground">Você está em dia.</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Não há nenhum movimento prioritário no momento. Continue sua rotina normalmente ou capture novos sinais no Daily.
          </p>
          <button
            type="button"
            onClick={() => generate()}
            disabled={isGenerating}
            className="mt-2 text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            <span>Verificar novos sinais</span>
            <ArrowRight size={11} />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* AÇÃO PRIMÁRIA (DESTAQUE MÁXIMO) */}
          {primaryAction && (() => {
            const badge = getActionBadge(primaryAction.actionType);
            const Icon = badge.icon;

            return (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 border-2 border-primary/40 shadow-md space-y-4 relative overflow-hidden group">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${badge.color}`}>
                        <Icon size={12} />
                        {badge.label}
                      </span>
                      <span className="text-[10px] font-semibold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
                        Prioridade Recomendada
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-foreground leading-snug">
                      {primaryAction.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDismiss(e, primaryAction.id)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/60 transition-colors self-start sm:self-auto"
                    title="Dispensar recomendação"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Box "POR QUE AGORA?" */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 text-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                    ⚡ Por Que Agora?
                  </span>
                  <p className="text-foreground/90 leading-relaxed">
                    {primaryAction.reason}
                  </p>
                </div>

                {/* Botão de Ação Primária */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground italic">
                    A IA sugere. O Phil decide.
                  </span>

                  <button
                    type="button"
                    onClick={() => handleExecute(primaryAction)}
                    className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md active:scale-95"
                  >
                    <span>Fazer agora</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* AÇÕES SECUNDÁRIAS (ATÉ 2) */}
          {secondaryActions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {secondaryActions.map(action => {
                const badge = getActionBadge(action.actionType);
                const Icon = badge.icon;

                return (
                  <div
                    key={action.id}
                    className="p-4 rounded-xl bg-card border border-border hover:border-border/80 transition-all flex flex-col justify-between space-y-3 shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${badge.color}`}>
                          <Icon size={11} />
                          {badge.label}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleDismiss(e, action.id)}
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/60 transition-colors"
                          title="Dispensar"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      <h4 className="font-bold text-xs text-foreground leading-snug line-clamp-2">
                        {action.title}
                      </h4>

                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {action.reason}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/50 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleExecute(action)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors flex items-center gap-1"
                      >
                        <span>Fazer</span>
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
