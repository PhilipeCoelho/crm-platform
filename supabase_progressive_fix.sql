-- ADJUSTED PROGRESSIVE CADENCE MODEL (USING EXISTING ACTIVITIES)
-- Objective: Use the existing logic from backend_cadence_automation.sql but making it progressive.

-- 1. Ensure columns exist
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS sequence_step INT DEFAULT 1;

-- 2. Adjusted Function for INITIALIZATION (Only Step 1)
-- This replaces the original fn_automate_cadence or fn_init_cadence_on_stage_change
CREATE OR REPLACE FUNCTION public.fn_automate_cadence_progressive()
RETURNS TRIGGER AS $$
DECLARE
    new_stage_name TEXT;
BEGIN
    -- Only act if stage_id changed or brand new
    IF (TG_OP = 'UPDATE' AND OLD.stage_id = NEW.stage_id) THEN
        RETURN NEW;
    END IF;

    -- 1. Get Stage Name
    SELECT name INTO new_stage_name FROM public.stages WHERE id = NEW.stage_id;
    new_stage_name := UPPER(new_stage_name);

    -- 2. Cancel ANY pending automatic activity for this deal
    DELETE FROM public.activities 
    WHERE deal_id = NEW.id 
      AND is_automatic = true 
      AND status = 'pending';

    -- 3. Create ONLY THE FIRST step of your existing cadences
    
    -- --- LEAD CADENCE ---
    IF (new_stage_name LIKE '%LEAD%' AND new_stage_name NOT LIKE '%ENGAJADO%' AND new_stage_name NOT LIKE '%PROSPECT%') THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step)
        VALUES (NEW.user_id, NEW.id, 'message', 'Primeiro Contato (Automático)', NOW() + interval '1 hour', 'pending', true, 'LEAD', 1);
    
    -- --- ENGAJADO CADENCE ---
    ELSIF (new_stage_name LIKE '%ENGAJADO%') THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step)
        VALUES (NEW.user_id, NEW.id, 'message', 'Nutrição Engajado (Automático)', NOW() + interval '1 day', 'pending', true, 'ENGAJADO', 1);

    -- --- DIAGNOSTICO CADENCE ---
    ELSIF (new_stage_name LIKE '%DIAGN%STICO%') THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step)
        VALUES (NEW.user_id, NEW.id, 'meeting', 'Preparar RD (Automático)', NOW() + interval '4 hours', 'pending', true, 'DIAGNOSTICO', 1);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Adjusted Function for PROGRESSION (Next Steps)
CREATE OR REPLACE FUNCTION public.fn_progress_cadence_existing()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if an automatic activity is completed
    IF (NEW.is_automatic = true AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN
        
        -- --- LEAD PROGRESSION ---
        IF (NEW.origin_stage = 'LEAD') THEN
            IF (NEW.sequence_step = 1) THEN
                -- Create Step 2
                INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step)
                VALUES (NEW.user_id, NEW.deal_id, 'call', 'Follow-up 1 (Automático)', NOW() + interval '2 days', 'pending', true, 'LEAD', 2);
            ELSIF (NEW.sequence_step = 2) THEN
                -- Create Step 3
                INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step)
                VALUES (NEW.user_id, NEW.deal_id, 'message', 'Follow-up 2 (Mensagem)', NOW() + interval '3 days', 'pending', true, 'LEAD', 3);
            END IF;

        -- --- ENGAJADO PROGRESSION ---
        ELSIF (NEW.origin_stage = 'ENGAJADO') THEN
            IF (NEW.sequence_step = 1) THEN
                -- Create Step 2
                INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step)
                VALUES (NEW.user_id, NEW.deal_id, 'email', 'Envio de Case de Sucesso', NOW() + interval '3 days', 'pending', true, 'ENGAJADO', 2);
            END IF;

        -- --- DIAGNOSTICO PROGRESSION ---
        ELSIF (NEW.origin_stage = 'DIAGNOSTICO') THEN
            IF (NEW.sequence_step = 1) THEN
                -- Create Step 2
                INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step)
                VALUES (NEW.user_id, NEW.deal_id, 'message', 'Confirmação de Reunião', NOW() + interval '1 day', 'pending', true, 'DIAGNOSTICO', 2);
            END IF;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-apply Triggers
DROP TRIGGER IF EXISTS tr_deal_stage_cadence ON public.deals;
DROP TRIGGER IF EXISTS tr_deal_cadence_init ON public.deals;
CREATE TRIGGER tr_deal_cadence_init
    AFTER INSERT OR UPDATE OF stage_id ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.fn_automate_cadence_progressive();

DROP TRIGGER IF EXISTS tr_activity_cadence_progress ON public.activities;
CREATE TRIGGER tr_activity_cadence_progress
    AFTER UPDATE OF status ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.fn_progress_cadence_existing();
