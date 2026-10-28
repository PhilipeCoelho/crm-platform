-- ============================================================================
-- VAMUSS SDR — CORREÇÕES DE SEGURANÇA SQL PÓS-HARDENING (FASE B.12.3)
-- ============================================================================
-- AVISO: PROPOSTA DE CORREÇÃO PARA REVISÃO DO DBA.
-- NÃO EXECUTAR AUTOMATICAMENTE.
--
-- PROBLEMAS ENDEREÇADOS:
-- 1. SEC-RPC-01: Injeção de 'SET search_path = public, pg_temp;' na RPC SECURITY DEFINER
-- 2. SEC-RPC-02: Revogação explícita de EXECUTE de PUBLIC (apenas authenticated)
-- 3. SEC-RPC-03: Validação de transição de estado legítima (State Machine: status anterior)
-- 4. SEC-RPC-04: Exigência de evidência comprovável de reunião para 'stage_reuniao'
-- 5. SEC-RLS-01: Salvaguarda contra colisão de ownership em políticas RLS permissivas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CORREÇÃO 1 & 2: RPC ATÓMICA REFORÇADA COM SEARCH_PATH, STATE MACHINE E PERMISSÕES
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_sdr_transition_deal_stage(
    p_deal_id UUID,
    p_new_stage TEXT,
    p_new_status TEXT,
    p_notes TEXT DEFAULT NULL,
    p_meeting_activity_id UUID DEFAULT NULL
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deal RECORD;
    v_updated RECORD;
    v_meeting RECORD;
BEGIN
    -- 1. Validação de Autorização do Chamador
    IF NOT public.fn_is_sdr_worker() THEN
        RAISE EXCEPTION 'Acesso não autorizado: Requer papel sdr_worker' USING ERRCODE = '42501';
    END IF;

    -- 2. Validação Estática de Entradas
    IF p_new_status NOT IN ('open', 'lost') THEN
        RAISE EXCEPTION 'Status inválido para transição SDR: %', p_new_status USING ERRCODE = '23514';
    END IF;

    IF p_new_stage NOT IN ('stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost') THEN
        RAISE EXCEPTION 'Etapa inválida para transição SDR: %', p_new_stage USING ERRCODE = '23514';
    END IF;

    -- 3. Consulta do Negócio e Verificação de Existência
    SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Negócio não encontrado: %', p_deal_id USING ERRCODE = 'PGRST116';
    END IF;

    -- 4. Validação da Máquina de Estados Comercial (Evitar transições ilícitas)
    -- Regra B.11.5: Não reabrir ou transitar para lead_engajamento se não for originário de negócio perdido
    IF p_new_stage = 'stage_lead_engajamento' THEN
        IF v_deal.status <> 'lost' AND v_deal.stage_id <> 'stage_lead_engajamento' THEN
            RAISE EXCEPTION 'Transição inválida: Reativação SDR só pode ocorrer a partir de negócios perdidos (status=lost)'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Regra B.11.4: Reunião exige evidência e atividade real associada
    IF p_new_stage = 'stage_reuniao' THEN
        IF p_meeting_activity_id IS NULL THEN
            RAISE EXCEPTION 'Transição inválida: Avanço para stage_reuniao exige identificador de atividade de reunião comprovada'
                USING ERRCODE = '23514';
        END IF;

        -- Validar se a atividade de reunião existe e pertence a este negócio
        SELECT * INTO v_meeting FROM public.activities 
        WHERE id = p_meeting_activity_id AND deal_id = p_deal_id AND type = 'meeting';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Transição inválida: Nenhuma atividade de tipo meeting válida encontrada para o ID fornecido'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 5. Atualização Estrita Apenas de stage_id, status e timestamps
    UPDATE public.deals
    SET stage_id = p_new_stage,
        status = p_new_status,
        updated_at = NOW()
    WHERE id = p_deal_id
    RETURNING * INTO v_updated;

    -- 6. Registo Automático da Atividade na Timeline
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
        COALESCE(p_notes, 'Transição realizada com validação de estado e regras comerciais B.11.5/B.12.3'),
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
$$;

-- Revogação de privilégios públicos na RPC (Defesa em Profundidade)
REVOKE ALL ON FUNCTION public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- ============================================================================
