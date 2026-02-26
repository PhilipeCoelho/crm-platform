-- SUPREME EMERGENCY FIX & ULTIMATE ENGINE RECOVERY
-- Este script força a criação das atividades faltantes e remove travas excessivas do motor.

-- 1. DESATIVAÇÃO DE GATILHOS ANTIGOS (Limpeza profunda)
DROP TRIGGER IF EXISTS tr_deal_cadence_init_master ON public.deals;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_master ON public.activities;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_v4 ON public.activities;

-- 2. MOTOR UNIVERSAL (Mais inteligente e menos restritivo)
CREATE OR REPLACE FUNCTION public.fn_cadence_progress_ultimate()
RETURNS TRIGGER AS $$
DECLARE
    v_template RECORD;
    v_current_step INTEGER := 0;
    v_target_step INTEGER;
    v_tag TEXT;
BEGIN
    -- Dispara quando QUALQUER atividade do funil é concluída (mesmo que não seja marcada como automática)
    IF (NEW.status = 'completed' OR NEW.completed = true) AND 
       (OLD.status IS DISTINCT FROM NEW.status OR OLD.completed IS DISTINCT FROM NEW.completed) THEN
        
        -- A. Tenta identificar o passo pelo Título (Fallback para atividades sem metadados)
        IF (NEW.title ILIKE '%Resposta%Pergunta%') THEN v_current_step := 1;
        ELSIF (NEW.title ILIKE '%Apontar%Problema%') THEN v_current_step := 2;
        ELSIF (NEW.title ILIKE '%Ampliar%Impacto%') THEN v_current_step := 3;
        ELSIF (NEW.title ILIKE '%Valor%Solu%') THEN v_current_step := 4;
        ELSIF (NEW.title ILIKE '%Convite%Direto%') THEN v_current_step := 5;
        -- Se não for nenhum desses, tenta usar o campo sequence_step se existir
        ELSE v_current_step := COALESCE(NEW.sequence_step, 0);
        END IF;

        -- B. Se identificamos um passo válido, vamos para o próximo
        IF (v_current_step > 0) THEN
            v_target_step := v_current_step + 1;
            v_tag := COALESCE(NEW.origin_stage, 'ENGAJADO'); -- Assume Engajado por padrão se for uma das frases acima

            -- C. Busca o Template
            SELECT * INTO v_template FROM public.cadence_templates 
            WHERE tag = v_tag AND step = v_target_step;

            IF FOUND THEN
                -- D. Segurança anti-duplicidade (Limpa outras automáticas pendentes antes)
                DELETE FROM public.activities 
                WHERE deal_id = NEW.deal_id 
                  AND is_automatic = true 
                  AND status = 'pending';

                -- E. Cria a próxima atividade
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

-- 3. RE-ATIVAÇÃO DO MOTOR
CREATE TRIGGER tr_activity_cadence_progress_ultimate
    AFTER UPDATE ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.fn_cadence_progress_ultimate();

-- 4. CURA MANUAL DO NEGÓCIO "SUPREME" (E outros travados)
-- Este bloco vai criar o Passo 3 para quem terminou o Passo 2 e ficou no vácuo
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT d.id, d.user_id 
        FROM public.deals d
        WHERE d.status = 'open'
          -- Procura negócios que concluíram "Apontar o Problema" mas não tem nada pendente
          AND EXISTS (SELECT 1 FROM public.activities a WHERE a.deal_id = d.id AND a.title ILIKE '%Apontar%Problema%' AND (a.status = 'completed' OR a.completed = true))
          AND NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.deal_id = d.id AND a.status = 'pending')
    LOOP
        -- Cria "Ampliar o Impacto" (Passo 3)
        INSERT INTO public.activities (
            user_id, deal_id, type, title, notes, tooltip_script, 
            date, status, is_automatic, origin_stage, sequence_step
        )
        SELECT 
            r.user_id, r.id, type, title, description, script, 
            NOW() + (days || ' days')::interval, 'pending', true, 'ENGAJADO', 3
        FROM public.cadence_templates 
        WHERE tag = 'ENGAJADO' AND step = 3
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
