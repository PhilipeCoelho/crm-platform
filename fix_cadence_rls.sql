-- SECURITY FIX: Enable RLS and add basic policies for cadence tables
-- Resolves the linter error "RLS Disabled in Public" (0013_rls_disabled_in_public)
-- for public.cadence_definitions and public.cadence_steps.

-- 1. Enable RLS on cadence_definitions
ALTER TABLE public.cadence_definitions ENABLE ROW LEVEL SECURITY;

-- Add policy to allow authenticated users full access
-- Since cadences appear to be shared configuration across the app
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.cadence_definitions;
CREATE POLICY "Enable full access for authenticated users" ON public.cadence_definitions 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 2. Enable RLS on cadence_steps
ALTER TABLE public.cadence_steps ENABLE ROW LEVEL SECURITY;

-- Add policy to allow authenticated users full access
DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.cadence_steps;
CREATE POLICY "Enable full access for authenticated users" ON public.cadence_steps 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- NOTE: Execute this script in the Supabase SQL Editor.
