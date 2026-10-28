-- ============================================================================
-- VAMUSS SDR — CORREÇÃO DA RPC E ATIVAÇÃO DO WORKER NO STAGING (B.12.4.2)
-- ============================================================================
-- EXCLUSIVO DO STAGING: iqplpcwasjmqwfdvzvsc.supabase.co
-- NÃO EXECUTAR NA PRODUÇÃO!
-- ============================================================================

-- 1. CRIAR/ATUALIZAR UTILIZADOR SDR WORKER NO STAGING
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'sdr.worker.staging@vamuss.com') THEN
        UPDATE auth.users
        SET encrypted_password = crypt('Password_Staging_2026_Secure!', gen_salt('bf')),
            email_confirmed_at = NOW(),
            raw_app_meta_data = '{"role": "sdr_worker", "is_service": true}'::jsonb
        WHERE email = 'sdr.worker.staging@vamuss.com';
    ELSE
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            '43c189a7-43d3-4075-b69b-69e012348ef1',
            'authenticated',
            'authenticated',
            'sdr.worker.staging@vamuss.com',
            crypt('Password_Staging_2026_Secure!', gen_salt('bf')),
            NOW(),
            '{"role": "sdr_worker", "is_service": true}'::jsonb,
            '{}'::jsonb,
            NOW(),
            NOW()
        );
    END IF;
END $$;

-- 2. RECRIAR A RPC DE TRANSIÇÃO (COM SQLSTATE PADRÃO P0002)
CREATE OR REPLACE FUNCTION public.fn_sdr_transition_deal_stage(
    p_deal_id UUID,
    p_new_stage TEXT,
    p_new_status TEXT,
    p_reason_code TEXT,
    p_notes TEXT DEFAULT NULL,
    p_inbound_activity_id UUID DEFAULT NULL,
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
    v_inbound RECORD;
    v_meeting RECORD;
    v_calendar_integration_active BOOLEAN := false;
BEGIN
    -- 1. Autorização estrita
    IF NOT public.fn_is_sdr_worker() THEN
        RAISE EXCEPTION 'Acesso não autorizado: Requer identidade e papel sdr_worker' USING ERRCODE = '42501';
    END IF;

    -- 2. Status e Etapas (SDR nunca marca won)
    IF p_new_status NOT IN ('open', 'lost') THEN
        RAISE EXCEPTION 'Status inválido para SDR: %. Apenas "open" ou "lost" são permitidos', p_new_status USING ERRCODE = '23514';
    END IF;

    IF p_new_stage NOT IN ('stage_lead_engajamento', 'stage_reuniao', 'stage_perdido', 'stage_lost') THEN
        RAISE EXCEPTION 'Etapa inválida para transição SDR: %', p_new_stage USING ERRCODE = '23514';
    END IF;

    IF p_new_stage = 'stage_lead_engajamento' AND p_new_status <> 'open' THEN
        RAISE EXCEPTION 'Inconsistência de máquina de estados: stage_lead_engajamento exige status="open"' USING ERRCODE = '23514';
    END IF;

    IF p_new_stage = 'stage_reuniao' AND p_new_status <> 'open' THEN
        RAISE EXCEPTION 'Inconsistência de máquina de estados: stage_reuniao exige status="open"' USING ERRCODE = '23514';
    END IF;

    IF p_new_stage IN ('stage_perdido', 'stage_lost') AND p_new_status <> 'lost' THEN
        RAISE EXCEPTION 'Inconsistência de máquina de estados: etapa de perda exige status="lost"' USING ERRCODE = '23514';
    END IF;

    -- 3. Consulta de Negócio (SQLSTATE standard P0002 para NO_DATA_FOUND)
    SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Negócio não encontrado: %', p_deal_id USING ERRCODE = 'P0002';
    END IF;

    -- 4. Validação de Máquina de Estados
    IF p_reason_code IN (
        'SILENCIO_SEM_RESPOSTA',
        'RESPOSTA_AMBIGUA',
        'MENSAGEM_APENAS_PREPARADA',
        'AGUARDANDO_RESPOSTA_CADENCIA',
        'RESPOSTA_AUTOMATICA'
    ) THEN
        IF p_new_status = 'open' OR p_new_stage IN ('stage_lead_engajamento', 'stage_reuniao') THEN
            RAISE EXCEPTION 'Transição comercial proibida: Motivo comercial "%" não demonstra interesse comprovado.', p_reason_code USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Reativação para Lead de Engajamento
    IF p_new_stage = 'stage_lead_engajamento' THEN
        IF v_deal.status <> 'lost' AND v_deal.stage_id <> 'stage_lead_engajamento' THEN
            RAISE EXCEPTION 'Transição inválida: Reativação SDR só pode ocorrer a partir de negócios com status="lost"' USING ERRCODE = '23514';
        END IF;

        IF p_reason_code <> 'RESPOSTA_COM_INTERESSE_COMPROVADO' THEN
            RAISE EXCEPTION 'Reativação exige motivo formal "RESPOSTA_COM_INTERESSE_COMPROVADO"' USING ERRCODE = '23514';
        END IF;

        IF p_inbound_activity_id IS NULL THEN
            RAISE EXCEPTION 'Reativação proibida: Ausência de p_inbound_activity_id comprovando mensagem real recebida' USING ERRCODE = '23514';
        END IF;

        SELECT * INTO v_inbound FROM public.activities
        WHERE id = p_inbound_activity_id AND deal_id = p_deal_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Atividade inbound % não encontrada para o negócio %', p_inbound_activity_id, p_deal_id USING ERRCODE = '23514';
        END IF;

        IF v_inbound.completed IS NOT TRUE THEN
            RAISE EXCEPTION 'Atividade inbound % não concluída/confirmada', p_inbound_activity_id USING ERRCODE = '23514';
        END IF;

        IF v_inbound.type = 'status_change' THEN
            RAISE EXCEPTION 'Atividade % é do tipo status_change; não constitui mensagem inbound', p_inbound_activity_id USING ERRCODE = '23514';
        END IF;

        IF v_inbound.title ILIKE '%enviar%' OR v_inbound.title ILIKE '%apresentação%' OR v_inbound.title ILIKE '%mensagem inicial%' THEN
            RAISE EXCEPTION 'Atividade % representa disparo outbound, não mensagem recebida', p_inbound_activity_id USING ERRCODE = '23514';
        END IF;

        IF v_inbound.notes IS NULL OR LENGTH(TRIM(v_inbound.notes)) < 3 THEN
            RAISE EXCEPTION 'Atividade inbound % sem conteúdo/evidência de resposta registada em notes', p_inbound_activity_id USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Reunião
    IF p_new_stage = 'stage_reuniao' THEN
        IF NOT v_calendar_integration_active THEN
            RAISE EXCEPTION 'Transição para stage_reuniao bloqueada: Ausência de integração operacional ativa com calendário' USING ERRCODE = '23514';
        END IF;

        IF p_meeting_activity_id IS NULL THEN
            RAISE EXCEPTION 'Transição para stage_reuniao exige identificador p_meeting_activity_id' USING ERRCODE = '23514';
        END IF;

        SELECT * INTO v_meeting FROM public.activities
        WHERE id = p_meeting_activity_id AND deal_id = p_deal_id AND type = 'meeting';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Nenhuma atividade de reunião ("meeting") encontrada para o negócio %', p_deal_id USING ERRCODE = '23514';
        END IF;

        IF v_meeting.completed IS NOT TRUE THEN
            RAISE EXCEPTION 'A atividade de reunião ainda não se encontra confirmada no calendário' USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Recusa e Supressão FAIL-CLOSED
    IF p_reason_code IN ('RECUSA_OU_PEDIDO_OPOSICAO', 'OPTOUT_EXPLICITO', 'RECUSA_COMERCIAL') THEN
        IF p_new_status <> 'lost' THEN
            RAISE EXCEPTION 'Transição de recusa exige status="lost"' USING ERRCODE = '23514';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sdr_suppression_list') THEN
            RAISE EXCEPTION 'SUPPRESSION_FAIL_CLOSED: Tabela public.sdr_suppression_list indisponível. Transação abortada' USING ERRCODE = '42P01';
        END IF;

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

    -- 5. Atualização Segura em Deals (Sem updated_at)
    UPDATE public.deals
    SET stage_id = p_new_stage,
        status = p_new_status,
        lost_at = CASE WHEN p_new_status = 'lost' THEN NOW() ELSE lost_at END
    WHERE id = p_deal_id
    RETURNING * INTO v_updated;

    -- 6. Inserção de Atividade na Timeline
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
        COALESCE(p_notes, 'Transição executada com validação estrita B.12.4.2'),
        NOW(),
        true
    );

    RETURN jsonb_build_object(
        'success', true,
        'deal_id', v_updated.id,
        'stage_id', v_updated.stage_id,
        'status', v_updated.status,
        'reason_code', p_reason_code
    );
END;
$$;
