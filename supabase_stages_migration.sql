CREATE TABLE IF NOT EXISTS public.stages (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    pipeline_id TEXT DEFAULT 'sales',
    order_index INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own stages" ON public.stages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stages" ON public.stages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stages" ON public.stages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stages" ON public.stages
    FOR DELETE USING (auth.uid() = user_id);

-- SEED DATA INSTRUCTION:
-- To keep your existing deals visible on the board, you MUST insert the default stages with their specific IDs.
-- Replace 'YOUR_USER_ID_HERE' with your UUID (found in Supabase Auth > Users column).
/*
INSERT INTO public.stages (id, name, pipeline_id, order_index, user_id) VALUES
('new', 'Lead Novo', 'sales', 0, 'YOUR_USER_ID_HERE'),
('contacted', 'Contactado', 'sales', 1, 'YOUR_USER_ID_HERE'),
('proposal', 'Proposta Enviada', 'sales', 2, 'YOUR_USER_ID_HERE'),
('negotiation', 'Negociação', 'sales', 3, 'YOUR_USER_ID_HERE');
*/
