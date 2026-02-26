-- MASTER CADENCE FIX & CONSOLIDATION (V5)
-- Objetivo: Resolver o sumiço das atividades e garantir que a progressão funcione sempre.
-- Este script normaliza as tags e permite que a cadência funcione mesmo em etapas com nomes variados.

-- 1. LIMPEZA TOTAL DE GATILHOS ANTIGOS
DROP TRIGGER IF EXISTS tr_deal_cadence_init ON public.deals;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress ON public.activities;
DROP TRIGGER IF EXISTS tr_deal_cadence_init_v2 ON public.deals;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_v2 ON public.activities;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_v3 ON public.activities;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_v4 ON public.activities;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_ultimate ON public.activities;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_final ON public.activities;

-- 2. FUNÇÃO DE INICIALIZAÇÃO (Ao entrar em uma etapa nova)
CREATE OR REPLACE FUNCTION public.fn_cadence_init_master_v5()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
    v_tag TEXT;
    v_template RECORD;
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.stage_id = NEW.stage_id) THEN RETURN NEW; END IF;

    SELECT UPPER(name) INTO v_stage_name FROM public.stages WHERE id = NEW.stage_id;
    v_stage_name := COALESCE(v_stage_name, '');

    -- Limpa automáticas pendentes para não duplicar
    DELETE FROM public.activities WHERE deal_id = NEW.id AND is_automatic = true AND status = 'pending';

    -- Mapeamento Robusto
    IF (v_stage_name LIKE '%LEAD%' AND v_stage_name NOT LIKE '%ENGAJADO%') THEN v_tag := 'LEAD';
    ELSIF (v_stage_name LIKE '%ENGAJADO%') THEN v_tag := 'ENGAJADO';
    ELSIF (v_stage_name LIKE '%DIAGN%STICO%') THEN v_tag := 'DIAGNOSTICO';
    ELSIF (v_stage_name LIKE '%FECHAMENTO%') THEN v_tag := 'FECHAMENTO';
    ELSE RETURN NEW; END IF;

    -- Cria o Passo 1
    SELECT * INTO v_template FROM public.cadence_templates WHERE tag = v_tag AND step = 1;
    IF FOUND THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, notes, tooltip_script, date, status, is_automatic, origin_stage, sequence_step)
        VALUES (NEW.user_id, NEW.id, v_template.type, v_template.title, v_template.description, v_template.script, NOW() + (v_template.days || ' hours')::interval, 'pending', true, v_tag, 1);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. MOTOR DE PROGRESSÃO (Detecção por Título e Normalização)
CREATE OR REPLACE FUNCTION public.fn_cadence_progress_master_v5()
RETURNS TRIGGER AS $$
DECLARE
    v_template RECORD;
    v_current_step INTEGER := 0;
    v_target_step INTEGER;
    v_clean_tag TEXT;
BEGIN
    -- Só dispara na conclusão da atividade
    IF (NEW.status = 'completed' OR NEW.completed = true) AND 
       (OLD.status IS DISTINCT FROM NEW.status OR OLD.completed IS DISTINCT FROM NEW.completed) THEN
        
        -- Identifica o Passo atual pelo Título
        IF (NEW.title ILIKE '%Resposta%Pergunta%') THEN v_current_step := 1;
        ELSIF (NEW.title ILIKE '%Apontar%Problema%') THEN v_current_step := 2;
        ELSIF (NEW.title ILIKE '%Ampliar%Impacto%') THEN v_current_step := 3;
        ELSIF (NEW.title ILIKE '%Valor%Solu%') THEN v_current_step := 4;
        ELSIF (NEW.title ILIKE '%Convite%Direto%') THEN v_current_step := 5;
        ELSE v_current_step := COALESCE(NEW.sequence_step, 0);
        END IF;

        IF (v_current_step > 0) THEN
            v_target_step := v_current_step + 1;
            v_clean_tag := 'ENGAJADO'; -- Focado na etapa de Engajamento que é a mais crítica

            -- Busca o Template do PRÓXIMO passo
            SELECT * INTO v_template FROM public.cadence_templates 
            WHERE tag = v_clean_tag AND step = v_target_step;

            IF FOUND THEN
                -- Segurança anti-duplicidade
                DELETE FROM public.activities WHERE deal_id = NEW.deal_id AND is_automatic = true AND status = 'pending';

                INSERT INTO public.activities (
                    user_id, deal_id, type, title, notes, tooltip_script, 
                    date, status, is_automatic, origin_stage, sequence_step
                )
                VALUES (
                    NEW.user_id, NEW.deal_id, v_template.type, v_template.title, 
                    v_template.description, v_template.script,
                    NOW() + (v_template.days || ' days')::interval, 
                    'pending', true, v_clean_tag, v_target_step
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ATIVAÇÃO DOS GATILHOS
CREATE TRIGGER tr_deal_cadence_init_v5
    AFTER INSERT OR UPDATE OF stage_id ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.fn_cadence_init_master_v5();

CREATE TRIGGER tr_activity_cadence_progress_v5
    AFTER UPDATE ON public.activities
    FOR EACH ROW 
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.completed IS DISTINCT FROM NEW.completed)
    EXECUTE FUNCTION public.fn_cadence_progress_master_v5();
