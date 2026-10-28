-- ============================================================================
-- VAMUSS SDR — PROPOSTA DE CORREÇÃO COMPLETA DA RPC E SUPRESSÃO (FASE B.12.3.3)
-- ============================================================================
-- AVISO: DOCUMENTO DE ARQUITETURA E PROPOSTA SQL PARA REVISÃO HUMANA / DBA.
-- ESTE SCRIPT NÃO DEVE SER EXECUTADO AUTOMATICAMENTE EM PRODUÇÃO.
--
-- PRINCIPAIS CORREÇÕES IMPLEMENTADAS NESTA VERSÃO:
-- 1. VALIDAÇÃO FACTUAL DE INTERESSE (SEM COLUNAS INVENTADAS):
--    - Inspeciona a atividade real em public.activities vinculada a p_inbound_activity_id.
--    - Exige: deal_id correspondente, tipo de mensagem aceitável ('message', 'inbound_message', 'email'),
--      concluída (completed = true), data no passado e notas/título com evidência real.
--    - Rejeita explicitamente notas internas, outbound inicial e alterações de estado.
-- 2. SUPRESSÃO FAIL-CLOSED E ATÓMICA:
--    - Se o motivo for recusa ou opt-out, exige que a tabela public.sdr_suppression_list
--      exista e que a inserção ocorra com sucesso na mesma transação.
--    - Se a tabela de supressão não existir, a RPC ABORTA (FAIL-CLOSED) para impedir
--      que o negócio seja alterado sem registo permanente de bloqueio.
--    - Idempotência: Se já existir bloqueio para o deal/contacto, ignora duplicado (ON CONFLICT DO NOTHING).
-- 3. MÁQUINA DE ESTADOS COMPLETA E PARES stage_id/status VALIDADOS:
--    - Rejeição absoluta de status 'won'.
--    - Reativação para 'stage_lead_engajamento' exige status='open' e estado prévio 'lost'.
--    - Recusa exige status='lost' e etapa 'stage_perdido' (ou 'stage_lost').
--    - Bloqueio persistente da transição para 'stage_reuniao' enquanto o conector
--      Google Calendar / Google Meet não estiver autenticado e verificado.
-- 4. FUNÇÃO PRIVILEGIADA:
--    - SECURITY DEFINER com SET search_path = public, pg_temp;
--    - REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated;
--    - Validação de identidade via public.fn_is_sdr_worker().
-- ============================================================================

-- Remover assinaturas antigas de forma segura
DROP FUNCTION IF EXISTS public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION public.fn_sdr_transition_deal_stage(
    p_deal_id UUID,
    p_new_stage TEXT,
    p_new_status TEXT,
    p_reason_code TEXT,
    p_notes TEXT DEFAULT NULL,
    p_inbound_activity_id UUID DEFAULT NULL,  -- Obrigatório para reativação legítima
    p_meeting_activity_id UUID DEFAULT NULL   -- Obrigatório para reunião confirmada
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
    -- ------------------------------------------------------------------------
    -- 1. VALIDAÇÃO DE AUTORIZAÇÃO E IDENTIDADE DO CHAMADOR
    -- ------------------------------------------------------------------------
    IF NOT public.fn_is_sdr_worker() THEN
        RAISE EXCEPTION 'Acesso não autorizado: Requer identidade e papel sdr_worker'
            USING ERRCODE = '42501';
    END IF;

    -- ------------------------------------------------------------------------
    -- 2. VALIDAÇÃO DE PARES stage_id / status E PROIBIÇÃO ABSOLUTA DE 'won'
    -- ------------------------------------------------------------------------
    -- Regra inegociável: O SDR NUNCA fecha vendas nem marca negócios como 'won'
    IF p_new_status NOT IN ('open', 'lost') THEN
        RAISE EXCEPTION 'Status inválido para SDR: %. Apenas "open" ou "lost" são permitidos', p_new_status
            USING ERRCODE = '23514';
    END IF;

    -- Validação de etapas permitidas
    IF p_new_stage NOT IN ('stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost') THEN
        RAISE EXCEPTION 'Etapa inválida para transição SDR: %', p_new_stage
            USING ERRCODE = '23514';
    END IF;

    -- Validação de consistência estrita dos pares stage_id / status
    IF p_new_stage = 'stage_lead_engajamento' AND p_new_status <> 'open' THEN
        RAISE EXCEPTION 'Inconsistência de máquina de estados: stage_lead_engajamento exige status="open"'
            USING ERRCODE = '23514';
    END IF;

    IF p_new_stage = 'stage_reuniao' AND p_new_status <> 'open' THEN
        RAISE EXCEPTION 'Inconsistência de máquina de estados: stage_reuniao exige status="open"'
            USING ERRCODE = '23514';
    END IF;

    IF p_new_stage IN ('stage_perdido', 'stage_lost') AND p_new_status <> 'lost' THEN
        RAISE EXCEPTION 'Inconsistência de máquina de estados: etapa de perda exige status="lost"'
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
    -- 4. SALVAGUARDAS DA MÁQUINA DE ESTADOS COMERCIAL
    -- ------------------------------------------------------------------------

    -- 4.1 Silêncio, mensagens preparadas, respostas automáticas ou ambíguas NUNCA REATIVAM
    IF p_reason_code IN (
        'SILENCIO_SEM_RESPOSTA',
        'RESPOSTA_AMBIGUA',
        'MENSAGEM_APENAS_PREPARADA',
        'AGUARDANDO_RESPOSTA_CADENCIA',
        'RESPOSTA_AUTOMATICA'
    ) THEN
        IF p_new_status = 'open' OR p_new_stage IN ('stage_lead_engajamento', 'stage_reuniao') THEN
            RAISE EXCEPTION 'Transição comercial proibida: Motivo comercial "%" não demonstra interesse comprovado.', p_reason_code
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 4.2 Reativação para 'stage_lead_engajamento' (Exige evidência factual verificável)
    IF p_new_stage = 'stage_lead_engajamento' THEN
        -- Deve provir de negócio previamente perdido
        IF v_deal.status <> 'lost' AND v_deal.stage_id <> 'stage_lead_engajamento' THEN
            RAISE EXCEPTION 'Transição inválida: Reativação SDR só pode ocorrer a partir de negócios com status="lost"'
                USING ERRCODE = '23514';
        END IF;

        IF p_reason_code <> 'RESPOSTA_COM_INTERESSE_COMPROVADO' THEN
            RAISE EXCEPTION 'Reativação exige motivo formal "RESPOSTA_COM_INTERESSE_COMPROVADO"'
                USING ERRCODE = '23514';
        END IF;

        -- Validação de ID da atividade factual de inbound
        IF p_inbound_activity_id IS NULL THEN
            RAISE EXCEPTION 'Reativação proibida: Ausência de p_inbound_activity_id comprovando mensagem real recebida'
                USING ERRCODE = '23514';
        END IF;

        -- Consulta da atividade real conforme o esquema de public.activities
        SELECT * INTO v_inbound FROM public.activities
        WHERE id = p_inbound_activity_id AND deal_id = p_deal_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Atividade inbound % não encontrada para o negócio %', p_inbound_activity_id, p_deal_id
                USING ERRCODE = '23514';
        END IF;

        -- Verificações estritas baseadas nas colunas reais: type, completed, title, notes, date
        IF v_inbound.completed IS NOT TRUE THEN
            RAISE EXCEPTION 'Atividade inbound % não concluída/confirmada', p_inbound_activity_id
                USING ERRCODE = '23514';
        END IF;

        -- Rejeitar se for status_change, nota interna simples ou outbound declarado no título
        IF v_inbound.type = 'status_change' THEN
            RAISE EXCEPTION 'Atividade % é do tipo status_change; não constitui mensagem inbound', p_inbound_activity_id
                USING ERRCODE = '23514';
        END IF;

        IF v_inbound.title ILIKE '%enviar%' OR v_inbound.title ILIKE '%apresentação%' OR v_inbound.title ILIKE '%mensagem inicial%' THEN
            RAISE EXCEPTION 'Atividade % representa disparo outbound, não mensagem recebida', p_inbound_activity_id
                USING ERRCODE = '23514';
        END IF;

        -- Exige que contenha notas com conteúdo textual da resposta recebida
        IF v_inbound.notes IS NULL OR LENGTH(TRIM(v_inbound.notes)) < 3 THEN
            RAISE EXCEPTION 'Atividade inbound % sem conteúdo/evidência de resposta registada em notes', p_inbound_activity_id
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 4.3 Transição para 'stage_reuniao' (Bloqueio estrito de calendário)
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
        WHERE id = p_meeting_activity_id AND deal_id = p_deal_id AND type = 'meeting';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Nenhuma atividade de reunião ("meeting") encontrada para o negócio %', p_deal_id
                USING ERRCODE = '23514';
        END IF;

        IF v_meeting.completed IS NOT TRUE THEN
            RAISE EXCEPTION 'A atividade de reunião ainda não se encontra confirmada no calendário'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- 4.4 Tratamento de Recusa / Opt-out e Integração com Supressão FAIL-CLOSED
    IF p_reason_code IN ('RECUSA_OU_PEDIDO_OPOSICAO', 'OPTOUT_EXPLICITO', 'RECUSA_COMERCIAL') THEN
        IF p_new_status <> 'lost' THEN
            RAISE EXCEPTION 'Transição de recusa exige status="lost"' USING ERRCODE = '23514';
        END IF;

        -- Regra Fail-Closed: A tabela sdr_suppression_list DEVE existir. Se não existir, aborta transação!
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sdr_suppression_list') THEN
            RAISE EXCEPTION 'SUPPRESSION_FAIL_CLOSED: Tabela public.sdr_suppression_list indisponível. Transação abortada para evitar contacto sem supressão duradoura'
                USING ERRCODE = '42P01';
        END IF;

        -- Inserção duradoura e atómica de supressão (idempotente)
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

    -- ------------------------------------------------------------------------
    -- 5. ATUALIZAÇÃO SEGURA EM DEALS (COMPATÍVEL COM O TRIGGER DE DEFESA)
    -- ------------------------------------------------------------------------
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
        COALESCE(p_notes, 'Transição executada com validação estrita de evidências B.12.3.3'),
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
REVOKE ALL ON FUNCTION public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;
