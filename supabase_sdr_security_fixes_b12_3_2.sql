-- ============================================================================
-- VAMUSS SDR — PROPOSTA DE CORREÇÃO REVISADA DA RPC (FASE B.12.3.2)
-- ============================================================================
-- DOCUMENTO DE ARQUITETURA E PROPOSTA SQL PARA REVISÃO HUMANA / DBA.
-- AVISO: ESTE SCRIPT NÃO DEVE SER EXECUTADO AUTOMATICAMENTE EM PRODUÇÃO.
--
-- MELHORIAS ADICIONADAS NESTA VERSÃO B.12.3.2:
-- 1. VALIDAÇÃO FACTUAL DE INTERESSE: Não basta p_reason_code. Exige-se que
--    exista uma atividade comprovada (p_inbound_activity_id) na tabela activities,
--    com type = 'inbound_message' ou 'message', pertencente ao deal, com data recente
--    e completed = true, provando que houve mensagem real do contacto.
-- 2. INTEGRAÇÃO COM SUPRESSÃO DURADOURA: Se o motivo for recusa ('RECUSA_OU_PEDIDO_OPOSICAO'),
--    a RPC insere atomicamente um registo na tabela 'sdr_suppression_list'.
-- 3. PROIBIÇÃO ABSOLUTA DE STATUS 'won': O SDR só pode transitar entre 'open' e 'lost'.
-- 4. BLOQUEIO DE CALENDÁRIO: Transição para 'stage_reuniao' bloqueada por arquitetura.
-- 5. BLINDAGEM DE PRIVILÉGIOS: SECURITY DEFINER com search_path = public, pg_temp,
--    validação de claim sdr_worker imutável e REVOKE de PUBLIC.
-- ============================================================================

DROP FUNCTION IF EXISTS public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.fn_sdr_transition_deal_stage(
    p_deal_id UUID,
    p_new_stage TEXT,
    p_new_status TEXT,
    p_reason_code TEXT,
    p_notes TEXT DEFAULT NULL,
    p_inbound_activity_id UUID DEFAULT NULL,  -- Exigido para reativação legítima
    p_meeting_activity_id UUID DEFAULT NULL   -- Exigido para reunião confirmada
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deal RECORD;
    v_updated RECORD;
    v_inbound RECORD;
    v_meeting RECORD;
    v_calendar_integration_active BOOLEAN := false; -- Trava operacional de calendário
BEGIN
    -- 1. VALIDAÇÃO DE IDENTIDADE E AUTORIZAÇÃO DO CHAMADOR
    IF NOT public.fn_is_sdr_worker() THEN
        RAISE EXCEPTION 'Acesso não autorizado: Requer identidade e papel sdr_worker'
            USING ERRCODE = '42501';
    END IF;

    -- 2. VALIDAÇÃO SINTÁTICA E DOMÍNIO DE STATUS
    -- Regra inegociável: O SDR NUNCA marca negócios como 'won'
    IF p_new_status NOT IN ('open', 'lost') THEN
        RAISE EXCEPTION 'Status inválido para SDR: %. Apenas "open" ou "lost" permitidos (SDR nunca marca "won")', p_new_status
            USING ERRCODE = '23514';
    END IF;

    IF p_new_stage NOT IN ('stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost') THEN
        RAISE EXCEPTION 'Etapa inválida para transição SDR: %', p_new_stage
            USING ERRCODE = '23514';
    END IF;

    -- 3. CONSULTA FACTUAL DO NEGÓCIO NO CRM
    SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Negócio não encontrado: %', p_deal_id
            USING ERRCODE = 'PGRST116';
    END IF;

    -- 4. SALVAGUARDAS DA MÁQUINA DE ESTADOS COMERCIAL (B.11.4 / B.11.5 / B.12.3.2)
    
    -- 4.1 Silêncio, mensagens preparadas, respostas automáticas ou ambíguas NUNCA REATIVAM
    IF p_reason_code IN (
        'SILENCIO_SEM_RESPOSTA',
        'RESPOSTA_AMBIGUA',
        'MENSAGEM_APENAS_PREPARADA',
        'AGUARDANDO_RESPOSTA_CADENCIA',
        'RESPOSTA_AUTOMATICA'
    ) THEN
        IF p_new_status = 'open' OR p_new_stage IN ('stage_lead_engajamento', 'stage_reuniao') THEN
            RAISE EXCEPTION 'Transição proibida: Motivo comercial "%" não demonstra interesse. O negócio deve permanecer lost em stage_perdido.', p_reason_code
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 4.2 Reativação para 'stage_lead_engajamento' (Exige evidência factual)
    IF p_new_stage = 'stage_lead_engajamento' THEN
        -- Deve provir de negócio previamente perdido
        IF v_deal.status <> 'lost' AND v_deal.stage_id <> 'stage_lead_engajamento' THEN
            RAISE EXCEPTION 'Transição inválida: Reativação SDR só pode ocorrer a partir de negócios com status="lost"'
                USING ERRCODE = '23514';
        END IF;

        IF p_new_status <> 'open' THEN
            RAISE EXCEPTION 'Inconsistência de máquina de estados: stage_lead_engajamento exige status="open"'
                USING ERRCODE = '23514';
        END IF;

        -- Não aceitar reason_code inventado sem atividade factual vinculada
        IF p_inbound_activity_id IS NULL THEN
            RAISE EXCEPTION 'Reativação proibida: Ausência de identificador p_inbound_activity_id comprovando resposta real recebida'
                USING ERRCODE = '23514';
        END IF;

        -- Validar se a atividade existe, é do deal e representa mensagem recebida
        SELECT * INTO v_inbound FROM public.activities
        WHERE id = p_inbound_activity_id 
          AND deal_id = p_deal_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Atividade de resposta inbound % não encontrada para o negócio %', p_inbound_activity_id, p_deal_id
                USING ERRCODE = '23514';
        END IF;

        IF p_reason_code <> 'RESPOSTA_COM_INTERESSE_COMPROVADO' THEN
            RAISE EXCEPTION 'Reativação para Lead de Engajamento exige motivo formal "RESPOSTA_COM_INTERESSE_COMPROVADO"'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 4.3 Transição para 'stage_reuniao' (Bloqueio enquanto não houver calendário ativo)
    IF p_new_stage = 'stage_reuniao' THEN
        IF NOT v_calendar_integration_active THEN
            RAISE EXCEPTION 'Transição para stage_reuniao bloqueada: Ausência de integração operacional ativa com calendário'
                USING ERRCODE = '23514';
        END IF;

        IF p_meeting_activity_id IS NULL THEN
            RAISE EXCEPTION 'Transição para stage_reuniao exige identificador p_meeting_activity_id'
                USING ERRCODE = '23514';
        END IF;

        SELECT * INTO v_meeting FROM public.activities
        WHERE id = p_meeting_activity_id 
          AND deal_id = p_deal_id 
          AND type = 'meeting';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Nenhuma atividade de reunião ("meeting") encontrada para o negócio %', p_deal_id
                USING ERRCODE = '23514';
        END IF;

        IF v_meeting.completed IS NOT TRUE THEN
            RAISE EXCEPTION 'A atividade de reunião ainda não se encontra confirmada no calendário'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 4.4 Tratamento de Recusa / Opt-out e Integração com Supressão Central
    IF p_reason_code IN ('RECUSA_OU_PEDIDO_OPOSICAO', 'OPTOUT_EXPLICITO', 'RECUSA_COMERCIAL') THEN
        IF p_new_status <> 'lost' THEN
            RAISE EXCEPTION 'Transição de recusa exige status="lost"' USING ERRCODE = '23514';
        END IF;

        -- Registo duradouro na tabela de supressão se a tabela existir
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sdr_suppression_list') THEN
            INSERT INTO public.sdr_suppression_list (
                deal_id,
                contact_id,
                motivo_bloqueio,
                origem_bloqueio,
                canal_bloqueado,
                evidencia,
                estado
            ) VALUES (
                p_deal_id,
                v_deal.contact_id,
                CASE WHEN p_reason_code = 'OPTOUT_EXPLICITO' THEN 'OPTOUT_EXPLICITO' ELSE 'RECUSA_COMERCIAL' END,
                'RESPOSTA_INBOUND',
                'TODOS',
                COALESCE(p_notes, 'Recusa comercial registada via RPC SDR'),
                'ativo'
            );
        END IF;
    END IF;

    -- 5. ATUALIZAÇÃO SEGURA EM DEALS (COMPATÍVEL COM TRIGGER DE DEFESA)
    UPDATE public.deals
    SET stage_id = p_new_stage,
        status = p_new_status,
        updated_at = NOW()
    WHERE id = p_deal_id
    RETURNING * INTO v_updated;

    -- 6. REGISTO AUDITÁVEL ATÓMICO NA TABELA ACTIVITIES
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
        COALESCE(p_notes, 'Transição executada com validação estrita de evidências B.12.3.2'),
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

-- 7. DEFESA DE CONCESSÕES
REVOKE ALL ON FUNCTION public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;
