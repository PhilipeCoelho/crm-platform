-- Função para incrementar métricas da campanha (seguro contra concorrência)
-- SECURITY DEFINER permite que a função execute como o criador (dono), ignorando RLS
CREATE OR REPLACE FUNCTION increment_campaign_metric(target_campaign_id UUID, metric_column TEXT)
RETURNS VOID AS $$
BEGIN
    IF metric_column = 'opened_count' THEN
        UPDATE public.campaigns SET opened_count = COALESCE(opened_count, 0) + 1 WHERE id = target_campaign_id;
    ELSIF metric_column = 'clicked_count' THEN
        UPDATE public.campaigns SET clicked_count = COALESCE(clicked_count, 0) + 1 WHERE id = target_campaign_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir acesso ao anon para RFC
GRANT EXECUTE ON FUNCTION increment_campaign_metric(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION increment_campaign_metric(UUID, TEXT) TO authenticated;

-- RLS para email_logs (permitir update anônimo apenas para tracking)
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous tracking update" ON public.email_logs;

-- Esta política é um pouco aberta, mas necessária para o tracking funcionar sem service role key
-- No futuro, o ideal é usar a service role key no backend para evitar abrir o RLS
CREATE POLICY "Allow anonymous tracking update" 
ON public.email_logs FOR UPDATE 
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous matching recipients update" ON public.campaign_recipients;
CREATE POLICY "Allow anonymous matching recipients update"
ON public.campaign_recipients FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
