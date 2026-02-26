-- UNIFIED CADENCE ENGINE V1.0
-- Objective: Consolidate all cadence logic into a single robust system.
-- Deletes all old triggers and conflicting logic.

-- 1. CLEANUP OLD TRIGGERS
-- Deals triggers
DROP TRIGGER IF EXISTS tr_deal_stage_cadence ON public.deals;
DROP TRIGGER IF EXISTS tr_deal_cadence_init ON public.deals;
DROP TRIGGER IF EXISTS tr_deal_cadence_init_v2 ON public.deals;
DROP TRIGGER IF EXISTS tr_deal_cadence_init_master ON public.deals;

-- Activities triggers
DROP TRIGGER IF EXISTS tr_activity_cadence_progress ON public.activities;
DROP TRIGGER IF EXISTS tr_activity_cadence_step ON public.activities;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_v2 ON public.activities;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_v4 ON public.activities;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress_ultimate ON public.activities;

-- 2. ENSURE SCHEMA
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS origin_stage TEXT;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS sequence_step INTEGER DEFAULT 1;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS is_automatic BOOLEAN DEFAULT false;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS tooltip_script TEXT;

-- 3. UNIFIED INITIALIZATION FUNCTION
CREATE OR REPLACE FUNCTION public.fn_cadence_init_unified()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
    v_tag TEXT;
    v_template RECORD;
BEGIN
    -- Only act if stage changed
    IF (TG_OP = 'UPDATE' AND OLD.stage_id = NEW.stage_id) THEN
        RETURN NEW;
    END IF;

    -- 1. Identify Stage
    SELECT UPPER(name) INTO v_stage_name FROM public.stages WHERE id = NEW.stage_id;
    v_stage_name := COALESCE(v_stage_name, '');

    -- 2. EXTERMINATE OLD PENDING TASKS
    -- This is what the user specifically asked for: clear anything unfinished from the previous stage.
    DELETE FROM public.activities 
    WHERE deal_id = NEW.id 
      AND is_automatic = true 
      AND (status NOT IN ('completed', 'won', 'lost') OR status IS NULL);

    -- 3. Map Tag
    IF (v_stage_name LIKE '%LEAD%' AND v_stage_name NOT LIKE '%ENGAJADO%') THEN v_tag := 'LEAD';
    ELSIF (v_stage_name LIKE '%ENGAJADO%') THEN v_tag := 'ENGAJADO';
    ELSIF (v_stage_name LIKE '%DIAGN%STICO%') THEN v_tag := 'DIAGNOSTICO';
    ELSIF (v_stage_name LIKE '%FECHAMENTO%') THEN v_tag := 'FECHAMENTO';
    ELSIF (v_stage_name LIKE '%PROSPECT%') THEN v_tag := 'LEAD'; -- Prospect users Lead cadence
    ELSE 
        RETURN NEW; -- No cadence for other stages
    END IF;

    -- 4. Create Step 1
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
            NOW() + (v_template.days || ' days')::interval, 
            'pending', 
            true, 
            v_tag, 
            1
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. UNIFIED PROGRESSION FUNCTION
CREATE OR REPLACE FUNCTION public.fn_cadence_progress_unified()
RETURNS TRIGGER AS $$
DECLARE
    v_template RECORD;
    v_target_tag TEXT;
    v_target_step INTEGER;
BEGIN
    -- Only progress if activity is automatic and was JUST completed
    IF (NEW.is_automatic = true AND (NEW.status = 'completed' OR NEW.completed = true) AND 
       (OLD.status IS DISTINCT FROM NEW.status OR OLD.completed IS DISTINCT FROM NEW.completed)) THEN
        
        v_target_tag := COALESCE(NEW.origin_stage, 'LEAD');
        v_target_step := COALESCE(NEW.sequence_step, 1) + 1;

        SELECT * INTO v_template 
        FROM public.cadence_templates 
        WHERE tag = v_target_tag AND step = v_target_step;

        IF FOUND THEN
            -- Delete any other pending automatic tasks to avoid dual-threading
            DELETE FROM public.activities 
            WHERE deal_id = NEW.deal_id 
              AND is_automatic = true 
              AND id != NEW.id -- Don't delete self (though already completed)
              AND (status NOT IN ('completed', 'won', 'lost') OR status IS NULL);

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
                v_target_tag, 
                v_target_step
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. APPLY TRIGGERS
CREATE TRIGGER tr_deal_cadence_init_unified
    AFTER INSERT OR UPDATE OF stage_id ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.fn_cadence_init_unified();

CREATE TRIGGER tr_activity_cadence_progress_unified
    AFTER UPDATE ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.fn_cadence_progress_unified();
