-- ============================================================================
-- VAMUSS SDR + CLOSER — B.13.1: TABELA DE APRENDIZAGEM (sdr_outcomes)
-- ============================================================================
-- Regista todas as tentativas de reativação, estratégias utilizadas,
-- resultados reais e métricas de conversão para aprendizagem contínua.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sdr_outcomes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Contexto do negócio
    deal_id UUID REFERENCES public.deals(id) NOT NULL,
    contact_id UUID REFERENCES public.contacts(id),
    
    -- Estratégia e versão
    strategy TEXT NOT NULL,                          -- ex: REAPROXIMACAO_TRANSPARENTE
    strategy_version TEXT DEFAULT 'v1',              -- Versão para comparação A/B
    channel TEXT DEFAULT 'EMAIL',                    -- EMAIL | WHATSAPP
    message_approved TEXT,                           -- Texto da mensagem efetivamente aprovada
    
    -- Contexto comercial no momento da tentativa
    loss_classification TEXT,                        -- Classificação da perda no momento
    recoverability_score INTEGER DEFAULT 0,          -- Score 0-100 no momento
    diagnostic_confidence TEXT DEFAULT 'BAIXA',      -- ALTA | MEDIA | BAIXA
    
    -- Tentativa
    attempt_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Resultado real
    outcome TEXT DEFAULT 'PENDENTE',                 -- PENDENTE | SEM_RESPOSTA | SILENCIO | RESPOSTA_POSITIVA | RESPOSTA_NEGATIVA | RESPOSTA_AMBIGUA | OPTOUT | FALHA_ENTREGA
    response_classification TEXT,                    -- Classificação qualitativa da resposta
    delivery_status TEXT,                            -- dispatched | delivered | read | failed
    response_text TEXT,                              -- Texto da resposta real recebida
    objections_identified TEXT,                      -- Objeções identificadas na resposta
    next_action TEXT,                                -- Próxima ação tomada
    
    -- Resultados de conversão
    deal_reactivated BOOLEAN DEFAULT false,          -- Negócio efetivamente reativado (open)
    meeting_confirmed BOOLEAN DEFAULT false,         -- Reunião 20min confirmada
    proposal_presented BOOLEAN DEFAULT false,        -- Proposta apresentada
    sale_won BOOLEAN DEFAULT false,                  -- Venda ganha
    final_reason TEXT,                               -- Motivo final do resultado
    
    -- Metadados
    result_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_sdr_outcomes_deal_id ON public.sdr_outcomes(deal_id);
CREATE INDEX IF NOT EXISTS idx_sdr_outcomes_strategy ON public.sdr_outcomes(strategy);
CREATE INDEX IF NOT EXISTS idx_sdr_outcomes_outcome ON public.sdr_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_sdr_outcomes_attempt_date ON public.sdr_outcomes(attempt_date DESC);
CREATE INDEX IF NOT EXISTS idx_sdr_outcomes_channel ON public.sdr_outcomes(channel);

-- RLS básico
ALTER TABLE public.sdr_outcomes ENABLE ROW LEVEL SECURITY;

-- Política permissiva para service_role (backend)
CREATE POLICY "sdr_outcomes_service_all" ON public.sdr_outcomes
    FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.sdr_outcomes IS 'B.13.1: Registo de tentativas de reativação SDR para aprendizagem contínua. Cada linha = 1 tentativa com estratégia, versão, resultado e métricas de conversão.';
