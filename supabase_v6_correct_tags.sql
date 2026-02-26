-- MASTER CADENCE FIX (V6) - UNIFICAÇÃO E CORREÇÃO DE TAGS
-- Objetivo: Garantir que cada etapa use sua própria cadência e não misture "Lead" com "Engajado".

-- 1. LIMPEZA TOTAL DE VERSÕES ANTERIORES
DROP TRIGGER IF EXISTS tr_deal_cadence_init_v5 ON public.deals;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_v5 ON public.activities;

-- 2. FUNÇÃO DE INICIALIZAÇÃO (Ao mudar de etapa)
CREATE OR REPLACE FUNCTION public.fn_cadence_init_master_v6()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
    v_tag TEXT;
    v_template RECORD;
BEGIN
    -- Só dispara se a etapa mudou (ou se é novo)
    IF (TG_OP = 'UPDATE' AND OLD.stage_id = NEW.stage_id) THEN
        RETURN NEW;
    END IF;

    -- Obter Nome da Etapa
    SELECT UPPER(name) INTO v_stage_name FROM public.stages WHERE id = NEW.stage_id;
    v_stage_name := COALESCE(v_stage_name, '');

    -- Mapeamento de Tags (LEAD, ENGAJADO, DIAGNOSTICO, FECHAMENTO)
    IF (v_stage_name LIKE '%ENGAJADO%') THEN 
        v_tag := 'ENGAJADO';
    ELSIF (v_stage_name LIKE '%LEAD%') THEN 
        v_tag := 'LEAD';
    ELSIF (v_stage_name LIKE '%DIAGN%STICO%' OR v_stage_name LIKE '%REUNI%O%') THEN 
        v_tag := 'DIAGNOSTICO';
    ELSIF (v_stage_name LIKE '%FECHAMENTO%') THEN 
        v_tag := 'FECHAMENTO';
    ELSE 
        -- Se não for uma etapa de cadência, apenas limpamos as pendentes e saímos
        DELETE FROM public.activities WHERE deal_id = NEW.id AND is_automatic = true AND status = 'pending';
        RETURN NEW;
    END IF;

    -- LIMPEZA AGRESSIVA: Remove TODAS as atividades automáticas pendentes de QUALQUER etapa anterior
    DELETE FROM public.activities 
    WHERE deal_id = NEW.id 
      AND is_automatic = true 
      AND status = 'pending';

    -- Buscar Passo 1 da Cadência para a nova etapa
    SELECT * INTO v_template FROM public.cadence_templates WHERE tag = v_tag AND step = 1;

    IF FOUND THEN
        INSERT INTO public.activities (
            user_id, deal_id, type, title, notes, tooltip_script, 
            date, status, is_automatic, origin_stage, sequence_step
        )
        VALUES (
            NEW.user_id, 
            NEW.id, 
            v_template.type, 
            v_template.title, 
            v_template.description,
            v_template.script,
            NOW() + (v_template.days || ' hours')::interval, 
            'pending', 
            true, 
            v_tag, 
            1
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. MOTOR DE PROGRESSÃO (DINÂMICO - Sem tags fixas)
CREATE OR REPLACE FUNCTION public.fn_cadence_progress_master_v6()
RETURNS TRIGGER AS $$
DECLARE
    v_template RECORD;
    v_current_step INTEGER := 0;
    v_target_step INTEGER;
    v_tag TEXT;
BEGIN
    -- Dispara na conclusão da atividade automática
    IF (NEW.is_automatic = true AND (NEW.status = 'completed' OR NEW.completed = true) AND 
       (OLD.status IS DISTINCT FROM NEW.status OR OLD.completed IS DISTINCT FROM NEW.completed)) THEN
        
        -- Detecção do Passo
        v_current_step := COALESCE(NEW.sequence_step, 0);
        v_tag := COALESCE(NEW.origin_stage, 'LEAD');

        -- Se o passo for 0, tenta detectar pelo título (fallback)
        IF (v_current_step = 0) THEN
            IF (NEW.title ILIKE '%Mensagem inicial%') THEN v_current_step := 1; v_tag := 'LEAD';
            ELSIF (NEW.title ILIKE '%Resposta%Pergunta%') THEN v_current_step := 1; v_tag := 'ENGAJADO';
            ELSIF (NEW.title ILIKE '%Apontar%Problema%') THEN v_current_step := 2; v_tag := 'ENGAJADO';
            -- Adicione outros fallbacks se neessário
            END IF;
        END IF;

        IF (v_current_step > 0) THEN
            v_target_step := v_current_step + 1;

            -- Busca o Template do PRÓXIMO passo usando a MESMA tag da atividade concluída
            SELECT * INTO v_template FROM public.cadence_templates 
            WHERE tag = v_tag AND step = v_target_step;

            IF FOUND THEN
                -- Remove duplicidades pendentes da mesma cadência
                DELETE FROM public.activities 
                WHERE deal_id = NEW.deal_id 
                  AND is_automatic = true 
                  AND status = 'pending'
                  AND origin_stage = v_tag;

                INSERT INTO public.activities (
                    user_id, deal_id, type, title, notes, tooltip_script, 
                    date, status, is_automatic, origin_stage, sequence_step
                )
                VALUES (
                    NEW.user_id, 
                    NEW.deal_id, 
                    v_template.type, 
                    v_template.title, 
                    v_template.description,
                    v_template.script,
                    NOW() + (v_template.days || ' days')::interval, 
                    'pending', 
                    true, 
                    v_tag, 
                    v_target_step
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RE-ATIVAÇÃO DOS GATILHOS
CREATE TRIGGER tr_deal_cadence_init_v6
    AFTER INSERT OR UPDATE OF stage_id ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.fn_cadence_init_master_v6();

CREATE TRIGGER tr_activity_cadence_progress_v6
    AFTER UPDATE ON public.activities
    FOR EACH ROW 
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.completed IS DISTINCT FROM NEW.completed)
    EXECUTE FUNCTION public.fn_cadence_progress_master_v6();

-- 5. RESGATE / LIMPEZA MANUAL (Para o caso Margarida Cortez e outros)
-- Remove atividades de 'ENGAJADO' pendentes se o negócio estiver em outra etapa
DELETE FROM public.activities a
USING public.deals d, public.stages s
WHERE a.deal_id = d.id
  AND d.stage_id = s.id
  AND a.is_automatic = true
  AND a.status = 'pending'
  AND a.origin_stage = 'ENGAJADO'
  AND (UPPER(s.name) NOT LIKE '%ENGAJADO%');

-- Remove atividades de 'LEAD' pendentes se o negócio estiver em outra etapa
DELETE FROM public.activities a
USING public.deals d, public.stages s
WHERE a.deal_id = d.id
  AND d.stage_id = s.id
  AND a.is_automatic = true
  AND a.status = 'pending'
  AND a.origin_stage = 'LEAD'
  AND (UPPER(s.name) NOT LIKE '%LEAD%' OR UPPER(s.name) LIKE '%ENGAJADO%');
