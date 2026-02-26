-- SUPABASE PROGRESSIVE CADENCE AUTOMATION
-- Objective: Implement a progressive activity cadence where only the next activity is created upon completion of the current one.

-- 1. Create Cadence Definition Tables
CREATE TABLE IF NOT EXISTS public.cadence_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL, -- e.g. 'LEAD', 'ENGAJADO', 'DIAGNOSTICO'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cadence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cadence_id UUID REFERENCES public.cadence_definitions(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    type TEXT NOT NULL, -- 'message', 'call', 'email', 'meeting'
    title TEXT NOT NULL,
    interval_days INT DEFAULT 0,
    interval_hours INT DEFAULT 0,
    tooltip_script TEXT,
    UNIQUE(cadence_id, step_order)
);

-- 2. Enhance Activities table
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS sequence_step INT DEFAULT 1;

-- Ensure origin_stage and is_automatic exist (from previous migrations)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='origin_stage') THEN
        ALTER TABLE public.activities ADD COLUMN origin_stage TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='is_automatic') THEN
        ALTER TABLE public.activities ADD COLUMN is_automatic BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='tooltip_script') THEN
        ALTER TABLE public.activities ADD COLUMN tooltip_script TEXT;
    END IF;
END $$;

-- 3. Functions for Logic

-- A) Function to cancel current cadence (delete pending automatic activities)
CREATE OR REPLACE FUNCTION public.fn_cancel_deal_cadence(target_deal_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.activities 
    WHERE deal_id = target_deal_id 
      AND is_automatic = true 
      AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B) Function to initialize cadence on stage change
CREATE OR REPLACE FUNCTION public.fn_init_cadence_on_stage_change()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
    v_cadence_id UUID;
BEGIN
    -- Only act if stage_id changed or brand new deal
    IF (TG_OP = 'UPDATE' AND OLD.stage_id = NEW.stage_id) THEN
        RETURN NEW;
    END IF;

    -- 1. Cancel current cadence
    PERFORM public.fn_cancel_deal_cadence(NEW.id);

    -- 2. Get Stage Name and normalize
    SELECT UPPER(name) INTO v_stage_name FROM public.stages WHERE id = NEW.stage_id;

    -- 3. Match stage name to cadence definition
    -- Simple mapping: if stage contains 'LEAD' but not 'ENGAJADO', then 'LEAD' cadence
    IF (v_stage_name LIKE '%LEAD%' AND v_stage_name NOT LIKE '%ENGAJADO%' AND v_stage_name NOT LIKE '%PROSPECT%') THEN
        SELECT id INTO v_cadence_id FROM public.cadence_definitions WHERE name = 'LEAD';
    ELSIF (v_stage_name LIKE '%ENGAJADO%') THEN
        SELECT id INTO v_cadence_id FROM public.cadence_definitions WHERE name = 'ENGAJADO';
    ELSIF (v_stage_name LIKE '%DIAGN%STICO%') THEN
        SELECT id INTO v_cadence_id FROM public.cadence_definitions WHERE name = 'DIAGNOSTICO';
    ELSIF (v_stage_name LIKE '%PROSPECT%') THEN
        SELECT id INTO v_cadence_id FROM public.cadence_definitions WHERE name = 'PROSPECT';
    END IF;

    -- 4. Create first step if cadence found
    IF (v_cadence_id IS NOT NULL) THEN
        INSERT INTO public.activities (
            user_id, deal_id, type, title, date, status, 
            is_automatic, origin_stage, sequence_step, tooltip_script
        )
        SELECT 
            NEW.user_id, NEW.id, s.type, s.title, 
            NOW() + (s.interval_days || ' days')::interval + (s.interval_hours || ' hours')::interval,
            'pending', true, (SELECT name FROM public.cadence_definitions WHERE id = v_cadence_id), 1, s.tooltip_script
        FROM public.cadence_steps s
        WHERE s.cadence_id = v_cadence_id AND s.step_order = 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C) Function to progress cadence on completion
CREATE OR REPLACE FUNCTION public.fn_progress_cadence_on_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_cadence_id UUID;
    v_next_step_order INT;
BEGIN
    -- Only act if it's an automatic activity marked as completed
    IF (NEW.is_automatic = true AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN
        
        -- Find the cadence definition
        SELECT id INTO v_cadence_id FROM public.cadence_definitions WHERE name = NEW.origin_stage;
        
        IF (v_cadence_id IS NOT NULL) THEN
            v_next_step_order := NEW.sequence_step + 1;
            
            -- Create next step if exists
            INSERT INTO public.activities (
                user_id, deal_id, type, title, date, status, 
                is_automatic, origin_stage, sequence_step, tooltip_script
            )
            SELECT 
                NEW.user_id, NEW.deal_id, s.type, s.title, 
                NOW() + (s.interval_days || ' days')::interval + (s.interval_hours || ' hours')::interval,
                'pending', true, NEW.origin_stage, v_next_step_order, s.tooltip_script
            FROM public.cadence_steps s
            WHERE s.cadence_id = v_cadence_id AND s.step_order = v_next_step_order;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Triggers

-- Trigger on Deals
DROP TRIGGER IF EXISTS tr_deal_cadence_init ON public.deals;
CREATE TRIGGER tr_deal_cadence_init
    AFTER INSERT OR UPDATE OF stage_id ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.fn_init_cadence_on_stage_change();

-- Trigger on Activities
DROP TRIGGER IF EXISTS tr_activity_cadence_progress ON public.activities;
CREATE TRIGGER tr_activity_cadence_progress
    AFTER UPDATE OF status ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.fn_progress_cadence_on_completion();

-- 5. Default Data Seeds

-- Insert default cadences
INSERT INTO public.cadence_definitions (name, description)
VALUES 
    ('LEAD', 'Cadência inicial para novos leads'),
    ('ENGAJADO', 'Fluxo de nutrição para leads que já responderam'),
    ('DIAGNOSTICO', 'Preparação e follow-up de diagnóstico'),
    ('PROSPECT', 'Cadência de prospecção fria')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Steps for LEAD
WITH cand_id AS (SELECT id FROM public.cadence_definitions WHERE name = 'LEAD')
INSERT INTO public.cadence_steps (cadence_id, step_order, type, title, interval_days, interval_hours)
SELECT id, 1, 'message', 'Primeiro Contato (Automático)', 0, 1 FROM cand_id
UNION ALL
SELECT id, 2, 'call', 'Follow-up 1 (Automático)', 2, 0 FROM cand_id
UNION ALL
SELECT id, 3, 'message', 'Follow-up 2 (Mensagem)', 3, 0 FROM cand_id
ON CONFLICT (cadence_id, step_order) DO UPDATE SET 
    type = EXCLUDED.type, 
    title = EXCLUDED.title, 
    interval_days = EXCLUDED.interval_days, 
    interval_hours = EXCLUDED.interval_hours;

-- Steps for ENGAJADO
WITH cand_id AS (SELECT id FROM public.cadence_definitions WHERE name = 'ENGAJADO')
INSERT INTO public.cadence_steps (cadence_id, step_order, type, title, interval_days, interval_hours)
SELECT id, 1, 'message', 'Nutrição Lead Engajado (Automático)', 1, 0 FROM cand_id
UNION ALL
SELECT id, 2, 'email', 'Envio de Case de Sucesso', 3, 0 FROM cand_id
ON CONFLICT (cadence_id, step_order) DO UPDATE SET 
    type = EXCLUDED.type, 
    title = EXCLUDED.title, 
    interval_days = EXCLUDED.interval_days, 
    interval_hours = EXCLUDED.interval_hours;

-- Steps for DIAGNOSTICO
WITH cand_id AS (SELECT id FROM public.cadence_definitions WHERE name = 'DIAGNOSTICO')
INSERT INTO public.cadence_steps (cadence_id, step_order, type, title, interval_days, interval_hours)
SELECT id, 1, 'meeting', 'Preparar RD / Diagnóstico', 0, 4 FROM cand_id
UNION ALL
SELECT id, 2, 'message', 'Confirmação de Reunião', 1, 0 FROM cand_id
ON CONFLICT (cadence_id, step_order) DO UPDATE SET 
    type = EXCLUDED.type, 
    title = EXCLUDED.title, 
    interval_days = EXCLUDED.interval_days, 
    interval_hours = EXCLUDED.interval_hours;
