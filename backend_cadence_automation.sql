-- BACKEND CADENCE AUTOMATION
-- Objective: Move cadence logic from frontend (store.ts) to database triggers for reliability.

CREATE OR REPLACE FUNCTION public.fn_automate_cadence()
RETURNS TRIGGER AS $$
DECLARE
    new_stage_name TEXT;
    template_record RECORD;
BEGIN
    -- Only act if stage_id changed
    IF (TG_OP = 'UPDATE' AND OLD.stage_id = NEW.stage_id) THEN
        RETURN NEW;
    END IF;

    -- Get Stage Name
    SELECT name INTO new_stage_name FROM public.stages WHERE id = NEW.stage_id;
    new_stage_name := UPPER(new_stage_name);

    -- 1. Cancel pending automatic activities for this deal
    DELETE FROM public.activities 
    WHERE deal_id = NEW.id 
      AND is_automatic = true 
      AND status = 'pending';

    -- 2. Trigger sequences based on stage name
    -- Lead Stage
    IF (new_stage_name LIKE '%LEAD%' AND new_stage_name NOT LIKE '%ENGAJADO%' AND new_stage_name NOT LIKE '%PROSPECT%') THEN
        -- Insert Sequence (Simplified example, real templates would be in a table)
        INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage)
        VALUES 
            (NEW.user_id, NEW.id, 'message', 'Primeiro Contato (Automático)', NOW() + interval '1 hour', 'pending', true, 'LEAD'),
            (NEW.user_id, NEW.id, 'call', 'Follow-up 1 (Automático)', NOW() + interval '2 days', 'pending', true, 'LEAD');
    
    -- Engaged Lead
    ELSIF (new_stage_name LIKE '%ENGAJADO%') THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage)
        VALUES 
            (NEW.user_id, NEW.id, 'message', 'Nutrição Engajado (Automático)', NOW() + interval '1 day', 'pending', true, 'ENGAJADO');

    -- RD / Diagnosis
    ELSIF (new_stage_name LIKE '%DIAGN%STICO%') THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage)
        VALUES 
            (NEW.user_id, NEW.id, 'meeting', 'Preparar RD (Automático)', NOW() + interval '4 hours', 'pending', true, 'DIAGNOSTICO');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS tr_deal_stage_cadence ON public.deals;
CREATE TRIGGER tr_deal_stage_cadence
    AFTER INSERT OR UPDATE OF stage_id ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.fn_automate_cadence();
