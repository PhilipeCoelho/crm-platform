import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Sparkles, CheckCircle2, AlertTriangle, HelpCircle, Target, TrendingUp, Copy, Check, ShieldAlert, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface LeakagePoint {
  stage: string;
  severity: 'Crítico' | 'Alto' | 'Moderado' | string;
  title: string;
  description: string;
  evidence: string;
  financial_impact: string;
  action_to_seal: string;
}

export interface DiagnosticData {
  id?: string;
  contact_id?: string;
  deal_id?: string;
  overall_score?: number;
  presence_score?: number;
  content_score?: number;
  conversion_score?: number;
  local_discovery_score?: number;
  tracking_score?: number;
  acquisition_readiness_score?: number;
  primary_goal?: string;
  primary_challenge?: string;
  monthly_media_budget?: string;
  average_patient_value?: string;
  clinic_capacity?: string;
  number_of_rooms?: string;
  response_time?: string;
  leakage_points?: LeakagePoint[];
  top_opportunities?: any[];
  meeting_questions?: string[];
  strategy_hypothesis?: any;
  internal_report?: string;
  reviewed_by_vamuss?: boolean;
  reviewed_at?: string;
  created_at?: string;
}

interface DiagnosticDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostic: DiagnosticData | null;
  clinicName?: string;
  contactName?: string;
  onReviewedChange?: (isReviewed: boolean) => void;
  onDiagnosticUpdated?: (updated: DiagnosticData) => void;
}

export default function DiagnosticDossierModal({
  isOpen,
  onClose,
  diagnostic,
  clinicName,
  contactName,
  onReviewedChange,
  onDiagnosticUpdated
}: DiagnosticDossierModalProps) {
  const [currentDiag, setCurrentDiag] = useState<DiagnosticData | null>(diagnostic);
  const [activeTab, setActiveTab] = useState<'leakage' | 'script' | 'opportunities' | 'math' | 'dossier'>('leakage');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reviewed, setReviewed] = useState(diagnostic?.reviewed_by_vamuss || false);
  const [copiedQuestionIdx, setCopiedQuestionIdx] = useState<number | null>(null);

  useEffect(() => {
    setCurrentDiag(diagnostic);
    setReviewed(diagnostic?.reviewed_by_vamuss || false);
  }, [diagnostic]);

  if (!currentDiag) return null;

  const handleToggleReview = async () => {
    setIsReviewing(true);
    try {
      const newStatus = !reviewed;
      const now = new Date().toISOString();
      if (currentDiag.id) {
        await supabase
          .from('diagnostics')
          .update({
            reviewed_by_vamuss: newStatus,
            reviewed_at: newStatus ? now : null
          })
          .eq('id', currentDiag.id);
      }
      setReviewed(newStatus);
      if (onReviewedChange) onReviewedChange(newStatus);
    } catch (err) {
      console.warn('Erro ao atualizar status de revisão:', err);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleAnalyzeWithClaude = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/diagnostics/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentDiag.id,
          dealId: currentDiag.deal_id,
          contactId: currentDiag.contact_id,
          clinicName: clinicName || contactName,
          contactName: contactName,
          primaryGoal: currentDiag.primary_goal,
          primaryChallenge: currentDiag.primary_challenge,
          monthlyMediaBudget: currentDiag.monthly_media_budget,
          averagePatientValue: currentDiag.average_patient_value,
          clinicCapacity: currentDiag.clinic_capacity,
          numberOfRooms: currentDiag.number_of_rooms,
          responseTime: currentDiag.response_time,
          rawAnswers: currentDiag.internal_report
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.diagnostic) {
          setCurrentDiag(json.diagnostic);
          if (onDiagnosticUpdated) onDiagnosticUpdated(json.diagnostic);
        }
      }
    } catch (err) {
      console.warn('Erro ao reanalisar com Claude:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyQuestion = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestionIdx(idx);
    setTimeout(() => setCopiedQuestionIdx(null), 2000);
  };

  const score = currentDiag.overall_score || 68;
  const opps = currentDiag.top_opportunities || [];
  const questions = currentDiag.meeting_questions || [];
  const hypothesis = currentDiag.strategy_hypothesis || {};
  const leakagePoints: LeakagePoint[] = currentDiag.leakage_points || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl" title="Diagnóstico Estratégico & Pontos de Fuga">
      <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-1">
        
        {/* Topo do Dossiê */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold uppercase tracking-wider border border-emerald-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                Análise Claude 3.5 Sonnet
              </span>
              {reviewed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-xs font-semibold border border-blue-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Revisado pela Vamuss__
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-semibold border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3" /> Pendente de Revisão
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              {clinicName || contactName || 'Clínica em Diagnóstico'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Responsável: {contactName || 'Doutor(a)'} · Mapeamento de Fuga de Pacientes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right mr-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vamuss Readiness</div>
              <div className="text-3xl font-extrabold text-foreground">{score}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
            </div>

            <button
              onClick={handleAnalyzeWithClaude}
              disabled={isAnalyzing}
              className="px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-primary text-primary-foreground hover:opacity-90 shadow-sm disabled:opacity-50"
              title="Executar análise profunda com Claude sobre as respostas fornecidas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Analisando...' : 'Reanalisar com Claude'}</span>
            </button>

            <button
              onClick={handleToggleReview}
              disabled={isReviewing}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                reviewed 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' 
                  : 'bg-foreground text-background hover:opacity-90'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{reviewed ? 'Revisado ✓' : 'Marcar como Revisado'}</span>
            </button>
          </div>
        </div>

        {/* Navegação por Abas */}
        <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('leakage')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'leakage' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>🚨 Pontos de Fuga ({leakagePoints.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'script' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Roteiro de Reunião ({questions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'opportunities' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>5 Alavancas ({opps.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('math')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'math' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Matemática Declarada</span>
          </button>
          <button
            onClick={() => setActiveTab('dossier')}
            className={`px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'dossier' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <span>Dossiê Completo</span>
          </button>
        </div>

        {/* ABA 0: PONTOS DE FUGA DE LEADS E PACIENTES (DESTAQUE CLAUDE) */}
        {activeTab === 'leakage' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs leading-relaxed space-y-1">
              <div className="flex items-center gap-2 text-rose-700 font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>Mapeamento Cirúrgico de Fuga de Pacientes no Funil Comercial</span>
              </div>
              <p className="text-muted-foreground">
                Com base estritamente nos dados fornecidos pelo lead, o Claude identificou os gargalos operacionais onde a clínica perde pacientes para concorrentes antes mesmo de fechar o tratamento.
              </p>
            </div>

            {leakagePoints.length === 0 ? (
              <div className="p-8 text-center bg-muted/20 border border-dashed border-border rounded-xl space-y-3">
                <p className="text-xs text-muted-foreground">Nenhum ponto de fuga mapeado ainda para este registo.</p>
                <button
                  onClick={handleAnalyzeWithClaude}
                  disabled={isAnalyzing}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg cursor-pointer hover:opacity-90 inline-flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gerar Diagnóstico com Claude Agora</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {leakagePoints.map((lp, idx) => {
                  let severityBadge = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
                  if (lp.severity === 'Alto') severityBadge = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
                  if (lp.severity === 'Moderado') severityBadge = 'bg-blue-500/10 text-blue-600 border-blue-500/20';

                  return (
                    <div key={idx} className="p-4 rounded-xl bg-card border border-border space-y-3 hover:border-foreground/20 transition-all shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold inline-flex items-center justify-center text-xs">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-foreground text-sm">
                            {lp.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {lp.stage}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityBadge}`}>
                            {lp.severity}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs leading-relaxed">
                        <div>
                          <span className="font-bold text-foreground block mb-0.5">🚨 Onde o Paciente Escapa:</span>
                          <p className="text-muted-foreground">{lp.description}</p>
                        </div>

                        {lp.evidence && (
                          <div className="p-2.5 rounded-lg bg-muted/40 border border-border/80">
                            <span className="font-bold text-foreground text-[11px] block mb-0.5">📌 Evidência nos Dados Declarados:</span>
                            <p className="text-muted-foreground italic">{lp.evidence}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10">
                            <span className="font-bold text-rose-600 text-[11px] block mb-0.5">💸 Impacto Financeiro / Perda Estimada:</span>
                            <p className="text-muted-foreground text-[11px]">{lp.financial_impact}</p>
                          </div>

                          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                            <span className="font-bold text-emerald-600 text-[11px] block mb-0.5">🛡️ Como Estancar a Fuga:</span>
                            <p className="text-muted-foreground text-[11px]">{lp.action_to_seal}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 1: ROTEIRO DE REUNIÃO INTELIGENTE */}
        {activeTab === 'script' && (
          <div className="space-y-6">
            {/* Hipótese Inicial da Estratégia Comercial */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Hipótese Inicial de Estratégia (Para a Reunião)</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Canais Recomendados:</span>
                  <div className="font-semibold text-foreground">{hypothesis.acquisitionChannels || 'Google Search Local + Meta Ads'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Gargalo Principal Observado:</span>
                  <div className="font-semibold text-rose-600">{hypothesis.mainBottleneck || 'Conversão no Website / Ponto de Contacto'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Maturidade de Rastreamento:</span>
                  <div className="font-semibold text-foreground">{hypothesis.trackingMaturity || 'Baixa (Sem Pixel Detectado)'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Diretriz de Conteúdo:</span>
                  <div className="font-semibold text-foreground">{hypothesis.contentDirection || 'Ganchos de Intenção e Casos Reais'}</div>
                </div>
              </div>
              {hypothesis.nextMeetingInvestigation && (
                <div className="pt-2 border-t border-border/60 text-xs">
                  <span className="text-muted-foreground font-semibold">Investigação Principal na Reunião:</span>
                  <p className="text-foreground mt-0.5">{hypothesis.nextMeetingInvestigation}</p>
                </div>
              )}
            </div>

            {/* Perguntas Inteligentes */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Perguntas Estratégicas Personalizadas para o Closer conduzir a chamada:
              </h4>
              <div className="space-y-2.5">
                {questions.map((q: string, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-card border border-border flex items-start justify-between gap-3 text-xs leading-relaxed group hover:border-foreground/30 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold inline-flex items-center justify-center shrink-0 text-[11px]">
                        {idx + 1}
                      </span>
                      <p className="text-foreground font-medium">{q}</p>
                    </div>
                    <button
                      onClick={() => copyQuestion(q, idx)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors shrink-0 cursor-pointer"
                      title="Copiar pergunta"
                    >
                      {copiedQuestionIdx === idx ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: AS PRINCIPAIS ALAVANCAS DE OPORTUNIDADE */}
        {activeTab === 'opportunities' && (
          <div className="space-y-3">
            {opps.map((opp: any, idx: number) => {
              let badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
              if (opp.priority === 'Alta') badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
              else if (opp.priority === 'Baixa') badgeColor = 'bg-zinc-100 text-zinc-800 border-zinc-200';

              return (
                <div key={idx} className="p-4 rounded-xl bg-card border border-border space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center text-xs">
                        {idx + 1}
                      </span>
                      [{opp.category}] {opp.title}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${badgeColor}`}>
                      {opp.priority}
                    </span>
                  </div>
                  <div className="space-y-1 text-muted-foreground pl-7 leading-relaxed">
                    <p><strong className="text-foreground">Evidência Observada:</strong> {opp.evidence}</p>
                    <p><strong className="text-foreground">Impacto Potencial:</strong> {opp.impact}</p>
                    <p><strong className="text-emerald-600">Hipótese Estratégica:</strong> {opp.hypothesis}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ABA 3: MATEMÁTICA & DADOS DECLARADOS */}
        {activeTab === 'math' && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px] mb-1">Prioridade / Meta Declarada</span>
                <span className="font-bold text-foreground text-sm">{currentDiag.primary_goal || 'Não informado'}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px] mb-1">Principal Desafio Atual</span>
                <span className="font-bold text-foreground text-sm">{currentDiag.primary_challenge || 'Não informado'}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px] mb-1">Orçamento de Mídia Mensal</span>
                <span className="font-bold text-foreground text-sm">{currentDiag.monthly_media_budget || 'Não informado'}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px] mb-1">Ticket Médio por Paciente</span>
                <span className="font-bold text-foreground text-sm">{currentDiag.average_patient_value || 'Não informado'}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px] mb-1">Capacidade Operacional</span>
                <span className="font-bold text-foreground text-sm">{currentDiag.clinic_capacity || 'Não informada'} ({currentDiag.number_of_rooms || '2'} gabinetes)</span>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[11px] mb-1">Tempo Médio de Resposta</span>
                <span className="font-bold text-foreground text-sm">{currentDiag.response_time || 'Não informado'}</span>
              </div>
            </div>

            {/* Premissas do Funil de Referência */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-2">
              <h4 className="font-bold text-foreground text-xs uppercase tracking-wider">Simulação do Funil Operacional (Benchmark Portugal)</h4>
              <p className="text-muted-foreground leading-relaxed">
                Premissas de simulação adotadas para o mercado português de clínicas particulares:
                <br />
                • Contactos Efetivos: <strong>50%</strong> dos leads
                <br />
                • Agendamentos: <strong>60%</strong> dos contactos
                <br />
                • Comparecimento à Consulta: <strong>70%</strong> dos agendamentos
                <br />
                • Fecho de Novos Pacientes: <strong>70%</strong> das consultas realizadas
              </p>
            </div>
          </div>
        )}

        {/* ABA 4: DOSSIÊ COMPLETO EM MARKDOWN */}
        {activeTab === 'dossier' && (
          <div className="p-5 rounded-xl bg-muted/30 border border-border text-xs leading-relaxed font-mono whitespace-pre-wrap text-foreground max-h-[60vh] overflow-y-auto">
            {currentDiag.internal_report || 'Dossiê em formato textual não disponível.'}
          </div>
        )}

      </div>
    </Modal>
  );
}
