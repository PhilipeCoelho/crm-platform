import type { 
  ContentIdea, 
  ContentOpportunity, 
  ContentReference, 
  ContentLearning,
  ContentActionType,
  ContentActionSourceType
} from './contentService';

// ==============================================================================
// CONFIGURABLE THRESHOLDS
// ==============================================================================
export const CONTENT_METRICS_WAIT_HOURS = 24;
export const REFERENCE_REVIEW_AGE_DAYS = 3;
export const PRODUCTION_STALE_DAYS = 5;
export const MAX_ACTIONS = 3;

export interface CandidateActionInput {
  ideas?: ContentIdea[];
  opportunities?: ContentOpportunity[];
  references?: ContentReference[];
  learnings?: ContentLearning[];
  analyzedIdeaIds?: Set<string>;
  existingActions?: Array<{ actionType: string; sourceId?: string | null; status?: string }>;
}

export interface CandidateAction {
  actionType: ContentActionType;
  title: string;
  description?: string;
  priority: number;
  score: number;
  sourceType: ContentActionSourceType;
  sourceId: string;
  reason: string;
}

/**
 * Pure evaluation function that ranks candidate actions deterministically.
 * Guarantees transparency, explainability, and limits results to MAX_ACTIONS (3).
 */
export function evaluateCandidateActions(input: CandidateActionInput): CandidateAction[] {
  const candidates: CandidateAction[] = [];
  const now = Date.now();

  const ideas = input.ideas || [];
  const opportunities = input.opportunities || [];
  const references = input.references || [];
  const learnings = input.learnings || [];
  const analyzedIdeaIds = input.analyzedIdeaIds || new Set<string>();

  const existingActiveKeys = new Set(
    (input.existingActions || [])
      .filter(a => a.status === 'suggested' || a.status === 'accepted')
      .map(a => `${a.actionType}:${a.sourceId}`)
  );

  const isAlreadyActive = (type: string, sourceId: string) => existingActiveKeys.has(`${type}:${sourceId}`);

  // 1. Alta Prioridade: Conteúdo publicado + métricas registradas + ainda não analisado
  for (const idea of ideas) {
    const isPublished = idea.executionStage === 'publicado' || Boolean(idea.publishedAt);
    const hasMetrics = idea.metrics && Object.keys(idea.metrics).length > 0 && (
      (idea.metrics.views && Number(idea.metrics.views) > 0) ||
      (idea.metrics.reach && Number(idea.metrics.reach) > 0) ||
      (idea.metrics.likes && Number(idea.metrics.likes) > 0) ||
      (idea.metrics.leads && Number(idea.metrics.leads) > 0)
    );

    if (isPublished && hasMetrics && !analyzedIdeaIds.has(idea.id)) {
      if (!isAlreadyActive('analisar_performance', idea.id)) {
        candidates.push({
          actionType: 'analisar_performance',
          title: `Analisar performance: "${idea.title}"`,
          description: 'Métricas coletadas disponíveis para análise de aprendizado.',
          priority: 1,
          score: 100,
          sourceType: 'content_idea',
          sourceId: idea.id,
          reason: 'Este conteúdo já possui métricas registradas e ainda não foi analisado. A análise pode gerar um aprendizado antes da próxima produção.',
        });
      }
    }
  }

  // 2. Alta Prioridade: Conteúdo publicado + sem métricas registradas + tempo suficiente passou
  for (const idea of ideas) {
    const isPublished = idea.executionStage === 'publicado' || Boolean(idea.publishedAt);
    const hasMetrics = idea.metrics && Object.keys(idea.metrics).length > 0 && (
      (idea.metrics.views && Number(idea.metrics.views) > 0) ||
      (idea.metrics.reach && Number(idea.metrics.reach) > 0) ||
      (idea.metrics.likes && Number(idea.metrics.likes) > 0)
    );

    if (isPublished && !hasMetrics && idea.publishedAt) {
      const publishedTime = new Date(idea.publishedAt).getTime();
      const hoursSincePublish = (now - publishedTime) / (1000 * 60 * 60);

      if (hoursSincePublish >= CONTENT_METRICS_WAIT_HOURS) {
        if (!isAlreadyActive('registrar_metricas', idea.id)) {
          candidates.push({
            actionType: 'registrar_metricas',
            title: `Registrar métricas: "${idea.title}"`,
            description: `Publicado há mais de ${Math.floor(hoursSincePublish)}h sem métricas.`,
            priority: 1,
            score: 90,
            sourceType: 'content_idea',
            sourceId: idea.id,
            reason: 'Conteúdo publicado há mais de 24h sem métricas registradas. Registrar os dados permite diagnosticar o que funcionou.',
          });
        }
      }
    }
  }

  // 3. Média-Alta Prioridade: Oportunidade aceita ainda não transformada em ideia
  for (const opp of opportunities) {
    if (opp.status === 'aceita' && !opp.connectedIdeaId) {
      if (!isAlreadyActive('usar_oportunidade', opp.id)) {
        const oppTitle = opp.title || (opp as any).suggestedTitle || 'Oportunidade de Conteúdo';
        candidates.push({
          actionType: 'usar_oportunidade',
          title: `Usar oportunidade: "${oppTitle}"`,
          description: opp.whyNow || (opp as any).strategicAngle || 'Oportunidade aceita pronta para produção.',
          priority: 2,
          score: 85,
          sourceType: 'content_opportunity',
          sourceId: opp.id,
          reason: 'Existe uma oportunidade aceita relacionada a uma dor ou momento comercial e ela ainda não foi transformada em roteiro ou ideia.',
        });
      }
    }
  }

  // 4. Estratégica: Aprendizado confirmado pronto para aplicação
  // Apenas status = 'confirmed'
  for (const learning of learnings) {
    if (learning.status === 'confirmed') {
      if (!isAlreadyActive('aplicar_aprendizado', learning.id)) {
        candidates.push({
          actionType: 'aplicar_aprendizado',
          title: `Aplicar aprendizado: "${learning.learning}"`,
          description: learning.application || 'Princípio confirmado baseado no seu histórico.',
          priority: 2,
          score: 80,
          sourceType: 'content_learning',
          sourceId: learning.id,
          reason: `Você confirmou que "${learning.learning}". Vale aplicar este princípio prático na criação do próximo conteúdo.`,
        });
      }
    }
  }

  // 5. Média Prioridade: Referência salva há algum tempo e ainda não analisada
  for (const ref of references) {
    if (ref.status === 'salva') {
      if (!isAlreadyActive('analisar_referencia', ref.id)) {
        const createdTime = new Date(ref.createdAt).getTime();
        const daysSinceCreated = (now - createdTime) / (1000 * 60 * 60 * 24);

        candidates.push({
          actionType: 'analisar_referencia',
          title: `Analisar referência: "${ref.title || ref.url}"`,
          description: ref.notes || 'Referência externa aguardando diagnóstico.',
          priority: 2,
          score: daysSinceCreated >= REFERENCE_REVIEW_AGE_DAYS ? 75 : 70,
          sourceType: 'content_reference',
          sourceId: ref.id,
          reason: 'Referência salva aguardando análise de princípios estruturais para alimentar futuros conteúdos sem cópia superficial.',
        });
      }
    }
  }

  // 6. Média Prioridade: Ideia em produção sem avanço
  for (const idea of ideas) {
    const inProduction = idea.executionStage === 'producao' || idea.executionStage === 'gravado';
    if (inProduction && idea.updatedAt) {
      const updatedTime = new Date(idea.updatedAt).getTime();
      const daysSinceUpdate = (now - updatedTime) / (1000 * 60 * 60 * 24);

      if (daysSinceUpdate >= PRODUCTION_STALE_DAYS) {
        if (!isAlreadyActive('continuar_producao', idea.id)) {
          candidates.push({
            actionType: 'continuar_producao',
            title: `Continuar produção: "${idea.title}"`,
            description: `Parado no estágio ${idea.executionStage} há ${Math.floor(daysSinceUpdate)} dias.`,
            priority: 3,
            score: 65,
            sourceType: 'content_idea',
            sourceId: idea.id,
            reason: 'Conteúdo em produção parado há mais de 5 dias. Vale concluir o roteiro ou avançar de etapa.',
          });
        }
      }
    }
  }

  // Ordenação determinística: maior score primeiro, menor prioridade como desempate
  candidates.sort((a, b) => b.score - a.score || a.priority - b.priority);

  // Retornar no máximo MAX_ACTIONS (3)
  return candidates.slice(0, MAX_ACTIONS);
}
