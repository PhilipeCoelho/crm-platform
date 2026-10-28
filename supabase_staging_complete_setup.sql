-- ============================================================================
-- VAMUSS SDR — SCRIPT COMPLETO DE INICIALIZAÇÃO DE STAGING (FASE B.12.4.2)
-- ============================================================================
-- PROJETO DE STAGING: iqplpcwasjmqwfdvzvsc.supabase.co
-- AVISO: EXECUTAR ESTE SCRIPT EXCLUSIVAMENTE NO SQL EDITOR DO PROJETO DE STAGING!
-- ============================================================================

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela CONTACTS
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can crud own contacts" ON public.contacts;
CREATE POLICY "Users can crud own contacts" ON public.contacts FOR ALL USING (auth.uid() = user_id);

-- 3. Tabela DEALS (Com esquema factual e sem a coluna updated_at)
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    contact_id UUID REFERENCES public.contacts(id),
    title TEXT NOT NULL,
    value NUMERIC,
    priority TEXT,
    stage_id TEXT,
    pipeline_id TEXT DEFAULT 'sales',
    status TEXT DEFAULT 'active',
    position FLOAT8 DEFAULT 0,
    expected_date TIMESTAMP WITH TIME ZONE,
    won_at TIMESTAMP WITH TIME ZONE,
    lost_at TIMESTAMP WITH TIME ZONE,
    lost_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can crud own deals" ON public.deals;
CREATE POLICY "Users can crud own deals" ON public.deals FOR ALL USING (auth.uid() = user_id);

-- 4. Tabela ACTIVITIES
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    deal_id UUID REFERENCES public.deals(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INTEGER,
    completed BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can crud own activities" ON public.activities;
CREATE POLICY "Users can crud own activities" ON public.activities FOR ALL USING (auth.uid() = user_id);

-- 5. Tabela SDR_SUPPRESSION_LIST
CREATE TABLE IF NOT EXISTS public.sdr_suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    telefone_normalizado TEXT,
    email_normalizado TEXT,
    motivo_bloqueio TEXT NOT NULL CHECK (motivo_bloqueio IN (
        'OPTOUT_EXPLICITO',
        'RECUSA_COMERCIAL',
        'RESTRICAO_CANAL',
        'DESQUALIFICACAO_PORTE',
        'CONTINGENCIA_OPERACIONAL',
        'INTERVENCAO_MANUAL'
    )),
    origem_bloqueio TEXT NOT NULL CHECK (origem_bloqueio IN (
        'HISTORICO_CRM',
        'RESPOSTA_INBOUND',
        'INTERVENCAO_MANUAL',
        'AUDITORIA_SEGURANCA'
    )),
    canal_bloqueado TEXT NOT NULL DEFAULT 'TODOS' CHECK (canal_bloqueado IN (
        'TODOS',
        'WHATSAPP',
        'EMAIL',
        'TELEFONE'
    )),
    evidencia TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'ativo' CHECK (estado IN (
        'ativo',
        'em_revisao',
        'revogado'
    )),
    revogado_em TIMESTAMPTZ,
    revogado_motivo TEXT,
    data_bloqueio TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sdr_suppression_deal_id ON public.sdr_suppression_list(deal_id);
CREATE INDEX IF NOT EXISTS idx_sdr_suppression_phone ON public.sdr_suppression_list(telefone_normalizado) WHERE telefone_normalizado IS NOT NULL AND estado = 'ativo';
CREATE INDEX IF NOT EXISTS idx_sdr_suppression_email ON public.sdr_suppression_list(email_normalizado) WHERE email_normalizado IS NOT NULL AND estado = 'ativo';
ALTER TABLE public.sdr_suppression_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SDR_Worker_Select_Suppression" ON public.sdr_suppression_list;
CREATE POLICY "SDR_Worker_Select_Suppression" ON public.sdr_suppression_list FOR SELECT TO authenticated USING (true);

-- 6. Função de verificação de role do SDR Worker
CREATE OR REPLACE FUNCTION public.fn_is_sdr_worker()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.jwt() IS NOT NULL AND 
        (auth.jwt()->'app_metadata'->>'role') = 'sdr_worker'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 7. Políticas RLS para o SDR Worker em DEALS e ACTIVITIES
DROP POLICY IF EXISTS "SDR_Worker_Select_Deals" ON public.deals;
CREATE POLICY "SDR_Worker_Select_Deals"
ON public.deals FOR SELECT TO authenticated
USING (
    public.fn_is_sdr_worker() AND (
        status = 'lost' OR 
        stage_id IN ('stage_lead_engajamento', 'stage_reuniao')
    )
);

DROP POLICY IF EXISTS "SDR_Worker_Select_Activities" ON public.activities;
CREATE POLICY "SDR_Worker_Select_Activities"
ON public.activities FOR SELECT TO authenticated
USING (
    public.fn_is_sdr_worker() AND 
    EXISTS (
        SELECT 1 FROM public.deals d
        WHERE d.id = activities.deal_id
          AND (d.status = 'lost' OR d.stage_id IN ('stage_lead_engajamento', 'stage_reuniao'))
    )
);

-- 8. Trigger de Proteção de Colunas em DEALS
CREATE OR REPLACE FUNCTION public.fn_guard_sdr_deal_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF public.fn_is_sdr_worker() THEN
        IF (NEW.value IS DISTINCT FROM OLD.value) THEN
            RAISE EXCEPTION 'SDR_SECURITY_VIOLATION: Alteração da coluna "value" proibida para SDR Worker' USING ERRCODE = '42501';
        END IF;
        IF (NEW.contact_id IS DISTINCT FROM OLD.contact_id) THEN
            RAISE EXCEPTION 'SDR_SECURITY_VIOLATION: Alteração da coluna "contact_id" proibida para SDR Worker' USING ERRCODE = '42501';
        END IF;
        IF (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
            RAISE EXCEPTION 'SDR_SECURITY_VIOLATION: Alteração da coluna "user_id" proibida para SDR Worker' USING ERRCODE = '42501';
        END IF;
        IF (NEW.title IS DISTINCT FROM OLD.title) THEN
            RAISE EXCEPTION 'SDR_SECURITY_VIOLATION: Alteração da coluna "title" proibida para SDR Worker' USING ERRCODE = '42501';
        END IF;
        IF (NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id) THEN
            RAISE EXCEPTION 'SDR_SECURITY_VIOLATION: Alteração da coluna "pipeline_id" proibida para SDR Worker' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_sdr_deal_columns ON public.deals;
CREATE TRIGGER trg_guard_sdr_deal_columns
    BEFORE UPDATE ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_sdr_deal_columns();

-- 9. RPC CORRIGIDA (Sem updated_at, com validação factual de inbound e supressão atómica)
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
    -- 1. Autorização
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

    -- 3. Consulta de Negócio
    SELECT * INTO v_deal FROM public.deals WHERE id = p_deal_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Negócio não encontrado: %', p_deal_id USING ERRCODE = 'PGRST116';
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

REVOKE ALL ON FUNCTION public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sdr_transition_deal_stage(UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;
