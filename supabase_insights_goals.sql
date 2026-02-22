-- FASE 3: METAS DE INSIGHTS
CREATE TABLE IF NOT EXISTS public.insights_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL, -- ex: 'reunioes', 'fechamentos', 'taxa_fechamento'
    target_value DOUBLE PRECISION NOT NULL,
    period_type TEXT CHECK (period_type IN ('monthly', 'quarterly')) DEFAULT 'monthly',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.insights_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own goals" ON public.insights_goals
    FOR ALL USING (auth.uid() = user_id);

-- Inserir metas padrão para o usuário atual (exemplo)
INSERT INTO public.insights_goals (user_id, metric_name, target_value)
SELECT id, 'reunioes', 10 FROM auth.users
UNION ALL
SELECT id, 'fechamentos', 5 FROM auth.users
UNION ALL
SELECT id, 'taxa_fechamento', 20 FROM auth.users
ON CONFLICT DO NOTHING;
