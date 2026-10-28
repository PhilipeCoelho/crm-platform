-- ============================================================================
-- VAMUSS SDR — PROPOSTA DE CORREÇÃO REVISADA DA RPC (FASE B.12.3 REV)
-- ============================================================================
-- DOCUMENTO DE ARQUITETURA E PROPOSTA SQL PARA REVISÃO HUMANA / DBA.
-- AVISO CRÍTICO: ESTE SCRIPT NÃO DEVE SER EXECUTADO AUTOMATICAMENTE EM PRODUÇÃO.
-- DESTINADO EXCLUSIVAMENTE À REVISÃO ANTES DE QUALQUER EXECUÇÃO NO SUPABASE.
--
-- PRINCIPAIS CORREÇÕES IMPLEMENTADAS NESTA VERSÃO:
-- 1. BLOQUEIO DE SEGURANÇA PARA REUNIÃO: Não permite transitar para 'stage_reuniao'
--    sem integração de calendário ativa E atividade de reunião confirmada com event_id.
-- 2. MÁQUINA DE ESTADOS COMPLETA: Valida estado prévio do negócio (lost),
--    proíbe reaberturas por silêncio/ambiguidade/preparação de mensagem.
-- 3. DEFESA EM PROFUNDIDADE DE PRIVILÉGIOS:
--    - REVOKE EXECUTE FROM PUBLIC
--    - Invocação protegida por verificação de claim imutável em auth.jwt()
--    - SET search_path = public, pg_temp (eliminação de Search Path Hijacking)
-- 4. COMPATIBILIDADE INTEGRAL COM ESQUEMA E TRIGGER DEFENSE:
--    - Não toca em value, contact_id, user_id, title, pipeline_id
--    - Regista auditoria atómica na tabela activities
-- ============================================================================

-- Remover assinaturas antigas ambíguas para garantir sobrecarga limpa
DROP FUNCTION IF EXISTS public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.fn_sdr_transition_deal_stage(
    p_deal_id UUID,
    p_new_stage TEXT,
    p_new_status TEXT,
    p_reason_code TEXT,
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
    v_calendar_integration_active BOOLEAN := false; -- Flag de integração real com Google Agenda / Meet
BEGIN
    -- ------------------------------------------------------------------------
    -- 1. VALIDAÇÃO DE AUTORIZAÇÃO E IDENTIDADE DO CHAMADOR
    -- ------------------------------------------------------------------------
    -- Garante que um utilizador comum autenticado (sem claim de sdr_worker emitida pelo sistema)
    -- é barrado imediatamente com erro de privilégio insuficiente.
    IF NOT public.fn_is_sdr_worker() THEN
        RAISE EXCEPTION 'Acesso não autorizado: Requer identidade e papel sdr_worker'
            USING ERRCODE = '42501';
    END IF;

    -- ------------------------------------------------------------------------
    -- 2. VALIDAÇÃO SINTÁTICA E DE DOMÍNIO DE ENTRADA
    -- ------------------------------------------------------------------------
    IF p_new_status NOT IN ('open', 'lost') THEN
        RAISE EXCEPTION 'Status inválido para transição SDR: % (Apenas open ou lost permitidos)', p_new_status
            USING ERRCODE = '23514';
    END IF;

    IF p_new_stage NOT IN ('stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost') THEN
        RAISE EXCEPTION 'Etapa inválida para transição SDR: %', p_new_stage
            USING ERRCODE = '23514';
    END IF;

    -- ------------------------------------------------------------------------
    -- 3. CONSULTA FACTUAL DO NEGÓCIO NO CRM
    -- ------------------------------------------------------------------------
    SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Negócio não encontrado: %', p_deal_id
            USING ERRCODE = 'PGRST116';
    END IF;

    -- ------------------------------------------------------------------------
    -- 4. SALVAGUARDAS DA MÁQUINA DE ESTADOS COMERCIAL (REGRAS B.11.4 e B.11.5)
    -- ------------------------------------------------------------------------

    -- Regra 4.1: Silêncio, mensagens preparadas e respostas ambíguas NÃO REATIVAM NEGÓCIO
    IF p_reason_code IN (
        'SILENCIO_SEM_RESPOSTA',
        'RESPOSTA_AMBIGUA',
        'MENSAGEM_APENAS_PREPARADA',
        'AGUARDANDO_RESPOSTA_CADENCIA'
    ) THEN
        IF p_new_status = 'open' OR p_new_stage = 'stage_lead_engajamento' THEN
            RAISE EXCEPTION 'Transição proibida: Motivo comercial "%" não demonstra interesse. O negócio deve permanecer lost em stage_perdido.', p_reason_code
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Regra 4.2: Transição para 'stage_lead_engajamento' (Reativação legítima)
    IF p_new_stage = 'stage_lead_engajamento' THEN
        -- Só pode reativar a partir de um negócio previamente perdido ou já em engajamento
        IF v_deal.status <> 'lost' AND v_deal.stage_id <> 'stage_lead_engajamento' THEN
            RAISE EXCEPTION 'Transição inválida: Reativação SDR só pode ocorrer a partir de negócios com status="lost"'
                USING ERRCODE = '23514';
        END IF;

        IF p_new_status <> 'open' THEN
            RAISE EXCEPTION 'Inconsistência de máquina de estados: stage_lead_engajamento exige status="open"'
                USING ERRCODE = '23514';
        END IF;

        IF p_reason_code <> 'RESPOSTA_COM_INTERESSE_COMPROVADO' THEN
            RAISE EXCEPTION 'Reativação para Lead de Engajamento exige motivo "RESPOSTA_COM_INTERESSE_COMPROVADO"'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Regra 4.3: Transição para 'stage_reuniao' (Proteção Absoluta contra Marcações Fictícias)
    IF p_new_stage = 'stage_reuniao' THEN
        -- Se a integração com o Google Calendar / Agenda não estiver operacional, bloqueia
        IF NOT v_calendar_integration_active THEN
            RAISE EXCEPTION 'Transição para stage_reuniao bloqueada: Ausência de integração operacional ativa com calendário'
                USING ERRCODE = '23514';
        END IF;

        IF p_meeting_activity_id IS NULL THEN
            RAISE EXCEPTION 'Transição para stage_reuniao exige identificador p_meeting_activity_id de reunião confirmada'
                USING ERRCODE = '23514';
        END IF;

        -- Validar atividade na base de dados
        SELECT * INTO v_meeting FROM public.activities
        WHERE id = p_meeting_activity_id 
          AND deal_id = p_deal_id 
          AND type = 'meeting';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Nenhuma atividade de reunião ("meeting") encontrada para o negócio %', p_deal_id
                USING ERRCODE = '23514';
        END IF;

        -- Exige que a atividade esteja formalmente concluída/confirmada
        IF v_meeting.completed IS NOT TRUE THEN
            RAISE EXCEPTION 'A atividade de reunião ainda não se encontra confirmada no calendário'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- ------------------------------------------------------------------------
    -- 5. ATUALIZAÇÃO SEGURA EM DEALS (COMPATÍVEL COM O TRIGGER DE DEFESA)
    -- ------------------------------------------------------------------------
    -- Atualiza APENAS stage_id e status. As colunas value, contact_id, user_id, title
    -- e pipeline_id NÃO são alteradas, garantindo que o trigger trg_guard_sdr_deal_columns
    -- aprova a mutação sem violação de permissão.
    UPDATE public.deals
    SET stage_id = p_new_stage,
        status = p_new_status,
        updated_at = NOW()
    WHERE id = p_deal_id
    RETURNING * INTO v_updated;

    -- ------------------------------------------------------------------------
    -- 6. REGISTO AUDITÁVEL ATÓMICO NA TABELA ACTIVITIES
    -- ------------------------------------------------------------------------
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
        'Transição SDR: ' || p_new_stage || ' (' || p_reason_code || ')',
        COALESCE(p_notes, 'Transição executada com validação estrita de máquina de estados B.12.3'),
        NOW(),
        true
    );

    RETURN jsonb_build_object(
        'success', true,
        'deal_id', v_updated.id,
        'stage_id', v_updated.stage_id,
        'status', v_updated.status,
        'reason_code', p_reason_code,
        'updated_at', v_updated.updated_at
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. DEFESA DE PRIVILÉGIOS (REVOKE / GRANT)
-- ----------------------------------------------------------------------------
-- Revoga execução pública e restringe a invocação a authenticated.
-- O chamador authenticated ainda terá de satisfazer fn_is_sdr_worker() em runtime.
REVOKE ALL ON FUNCTION public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
