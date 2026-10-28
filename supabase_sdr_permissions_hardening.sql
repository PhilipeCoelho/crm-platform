-- ============================================================================
-- VAMUSS SDR — PROPOSTA DE HARDENING DE PERMISSÕES SUPABASE (FASE B.12.2)
-- ============================================================================
-- DOCUMENTO DE ARQUITETURA DE SEGURANÇA E PROPOSTA SQL PARA REVISÃO DO DBA.
-- AVISO: ESTE SCRIPT NÃO DEVE SER EXECUTADO AUTOMATICAMENTE EM PRODUÇÃO.
-- DESTINADO EXCLUSIVAMENTE À REVISÃO E HOMOLOGAÇÃO MANUAL PELO ADMINISTRADOR DO SUPABASE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. IDENTIDADE DE SERVIÇO DEDICADA DO SDR WORKER
-- ----------------------------------------------------------------------------
-- Em vez de reutilizar a chave anónima do frontend ou a superuser service_role,
-- o SDR Worker autentica-se com um utilizador de sistema dedicado em auth.users
-- ou recebe um JWT assinado pelo backend com app_metadata contendo:
--   "app_metadata": { "role": "sdr_worker", "is_service": true }
--
-- Função auxiliar para identificar se o chamador atual é o SDR Worker:
CREATE OR REPLACE FUNCTION public.fn_is_sdr_worker()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.jwt() IS NOT NULL AND 
        (auth.jwt()->'app_metadata'->>'role') = 'sdr_worker'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2. POLÍTICAS RLS ESTREITAS PARA A TABELA DEALS
-- ----------------------------------------------------------------------------

-- A. Leitura Restrita ao Escopo de Recuperação
-- O SDR Worker só pode ler negócios perdidos ('lost') ou negócios já em recuperação ('stage_lead_engajamento')
DROP POLICY IF EXISTS "SDR_Worker_Select_Deals" ON public.deals;
CREATE POLICY "SDR_Worker_Select_Deals"
ON public.deals
FOR SELECT
TO authenticated
USING (
    public.fn_is_sdr_worker() AND (
        status = 'lost' OR 
        stage_id IN ('stage_lead_engajamento', 'stage_reuniao')
    )
);

-- B. Atualização Restrita de Linhas
DROP POLICY IF EXISTS "SDR_Worker_Update_Deals" ON public.deals;
CREATE POLICY "SDR_Worker_Update_Deals"
ON public.deals
FOR UPDATE
TO authenticated
USING (
    public.fn_is_sdr_worker() AND (
        status = 'lost' OR 
        stage_id IN ('stage_lead_engajamento', 'stage_reuniao')
    )
)
WITH CHECK (
    public.fn_is_sdr_worker() AND 
    status IN ('open', 'lost') AND 
    stage_id IN ('stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost')
);

-- C. Bloqueio Absoluto de INSERT e DELETE em Deals para o SDR Worker
-- Não criar políticas de INSERT ou DELETE para o papel do worker.
-- Como o RLS está ativo em 'deals', a ausência de política resulta em bloqueio padrão (DENY ALL).

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS RLS ESTREITAS PARA A TABELA ACTIVITIES
-- ----------------------------------------------------------------------------

-- A. Leitura Restrita a Atividades de Negócios Elegíveis
DROP POLICY IF EXISTS "SDR_Worker_Select_Activities" ON public.activities;
CREATE POLICY "SDR_Worker_Select_Activities"
ON public.activities
FOR SELECT
TO authenticated
USING (
    public.fn_is_sdr_worker() AND 
    EXISTS (
        SELECT 1 FROM public.deals d
        WHERE d.id = activities.deal_id
          AND (d.status = 'lost' OR d.stage_id IN ('stage_lead_engajamento', 'stage_reuniao'))
    )
);

-- B. Inserção Restrita a Tipos Permitidos e Negócios Elegíveis
DROP POLICY IF EXISTS "SDR_Worker_Insert_Activities" ON public.activities;
CREATE POLICY "SDR_Worker_Insert_Activities"
ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (
    public.fn_is_sdr_worker() AND 
    type IN ('note', 'status_change', 'meeting') AND
    EXISTS (
        SELECT 1 FROM public.deals d
        WHERE d.id = activities.deal_id
          AND (d.status = 'lost' OR d.stage_id IN ('stage_lead_engajamento', 'stage_reuniao'))
    )
);

-- C. Bloqueio Absoluto de UPDATE e DELETE em Activities para o SDR Worker
-- Nenhuma política concedida -> Deny incondicional.

-- ----------------------------------------------------------------------------
-- 4. GUARDIAO DE COLUNAS EM DEALS (COLUMN-LEVEL DEFENSE TRIGGER)
-- ----------------------------------------------------------------------------
-- Como o RLS opera a nível de linha, este trigger garante que, se o SDR Worker
-- tentar alterar colunas financeiras ou de titularidade, a transação aborta imediatamente.
CREATE OR REPLACE FUNCTION public.fn_guard_sdr_deal_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF public.fn_is_sdr_worker() THEN
        -- Verificar campos estritamente protegidos
        IF (NEW.value IS DISTINCT FROM OLD.value) THEN
            RAISE EXCEPTION 'SDR_SECURITY_VIOLATION: Alteração da coluna "value" proibida para SDR Worker'
                USING ERRCODE = '42501';
        END IF;

        IF (NEW.contact_id IS DISTINCT FROM OLD.contact_id) THEN
            RAISE EXCEPTION 'SDR_SECURITY_VIOLATION: Alteração da coluna "contact_id" proibida para SDR Worker'
                USING ERRCODE = '42501';
        END IF;

        IF (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
            RAISE EXCEPTION 'SDR_SECURITY_VIOLATION: Alteração da coluna "user_id" (proprietário) proibida para SDR Worker'
                USING ERRCODE = '42501';
        END IF;

        IF (NEW.title IS DISTINCT FROM OLD.title) THEN
            RAISE EXCEPTION 'SDR_SECURITY_VIOLATION: Alteração da coluna "title" proibida para SDR Worker'
                USING ERRCODE = '42501';
        END IF;

        IF (NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id) THEN
            RAISE EXCEPTION 'SDR_SECURITY_VIOLATION: Alteração da coluna "pipeline_id" proibida para SDR Worker'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_sdr_deal_columns ON public.deals;
CREATE TRIGGER trg_guard_sdr_deal_columns
    BEFORE UPDATE ON public.deals
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_guard_sdr_deal_columns();

-- ----------------------------------------------------------------------------
-- 5. FUNÇÃO RPC CONTROLADA PARA TRANSIÇÃO DE ETAPA (OPÇÃO RECOMENDADA)
-- ----------------------------------------------------------------------------
-- Permite ao backend executar transições de forma atómica e estrita,
-- encapsulando as regras comerciais diretamente no PostgreSQL.
CREATE OR REPLACE FUNCTION public.fn_sdr_transition_deal_stage(
    p_deal_id UUID,
    p_new_stage TEXT,
    p_new_status TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_deal RECORD;
    v_updated RECORD;
BEGIN
    -- 1. Validação de Autorização do Chamador
    IF NOT public.fn_is_sdr_worker() THEN
        RAISE EXCEPTION 'Acesso não autorizado: Requer papel sdr_worker' USING ERRCODE = '42501';
    END IF;

    -- 2. Validação de Estágio e Status Permitidos
    IF p_new_status NOT IN ('open', 'lost') THEN
        RAISE EXCEPTION 'Status inválido para transição SDR: %', p_new_status USING ERRCODE = '23514';
    END IF;

    IF p_new_stage NOT IN ('stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost') THEN
        RAISE EXCEPTION 'Etapa inválida para transição SDR: %', p_new_stage USING ERRCODE = '23514';
    END IF;

    -- 3. Consulta do Negócio
    SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Negócio não encontrado: %', p_deal_id USING ERRCODE = 'PGRST116';
    END IF;

    -- 4. Atualização Estrita Apenas de stage_id, status e timestamps
    UPDATE public.deals
    SET stage_id = p_new_stage,
        status = p_new_status,
        updated_at = NOW()
    WHERE id = p_deal_id
    RETURNING * INTO v_updated;

    -- 5. Registo Automático da Atividade na Timeline
    INSERT INTO public.activities (
        user_id,
        deal_id,
        type,
        title,
        notes,
        date,
        completed
    ) VALUES (
        v_deal.user_id,
        p_deal_id,
        'status_change',
        'Transição SDR: ' || p_new_stage,
        COALESCE(p_notes, 'Transição realizada pelo motor SDR com regras de segurança validadas'),
        NOW(),
        true
    );

    RETURN jsonb_build_object(
        'success', true,
        'deal_id', v_updated.id,
        'stage_id', v_updated.stage_id,
        'status', v_updated.status,
        'updated_at', v_updated.updated_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
