-- 1. RESTAURA A PRIVACIDADE TOTAL
-- (Impede que você veja negócios de outros usuários/testes antigos)
DROP POLICY IF EXISTS "Users can view own deal analytics" ON public.deal_analytics;
CREATE POLICY "Users can view own deal analytics" ON public.deal_analytics
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_analytics.deal_id AND d.user_id = auth.uid())
    );

-- 2. LIMPA O CACHE DE NEGÓCIOS DELETADOS OU ÓRFÃOS
DELETE FROM public.deal_analytics
WHERE deal_id NOT IN (SELECT id FROM public.deals);

-- 3. FORÇA A INCLUSÃO DE QUALQUER NEGÓCIO QUE TENHA FICADO DE FORA
INSERT INTO public.deal_analytics (deal_id, created_at, status_final, stage_atual, updated_at)
SELECT 
    d.id, 
    d.created_at, 
    CASE WHEN d.status IN ('won', 'lost') THEN d.status ELSE 'open' END, 
    COALESCE(s.name, d.stage_id), 
    NOW()
FROM public.deals d
LEFT JOIN public.stages s ON d.stage_id = s.id
ON CONFLICT (deal_id) DO UPDATE SET
    status_final = EXCLUDED.status_final,
    stage_atual = EXCLUDED.stage_atual;

-- 4. RECALCULA ABSOLUTAMENTE TODAS AS ATIVIDADES POR NEGÓCIO
UPDATE public.deal_analytics da
SET 
    total_atividades = sub.total,
    total_mensagens = sub.msgs,
    total_emails = sub.emails,
    total_ligacoes = sub.calls,
    total_analises = sub.analises,
    total_auditorias = sub.auditorias,
    total_contatos_realizados = sub.contatos,
    total_respostas = sub.respostas
FROM (
    SELECT 
        d.id as deal_id,
        COUNT(a.id) as total,
        COUNT(a.id) FILTER (WHERE a.type = 'message') as msgs,
        COUNT(a.id) FILTER (WHERE a.type = 'email') as emails,
        COUNT(a.id) FILTER (WHERE a.type = 'call') as calls,
        COUNT(a.id) FILTER (WHERE a.type = 'analysis') as analises,
        COUNT(a.id) FILTER (WHERE a.type = 'audit') as auditorias,
        COUNT(a.id) FILTER (WHERE a.type IN ('message', 'email', 'call')) as contatos,
        COUNT(a.id) FILTER (WHERE a.houve_resposta = TRUE) as respostas
    FROM public.deals d
    LEFT JOIN public.activities a ON a.deal_id = d.id AND a.completed = TRUE
    GROUP BY d.id
) AS sub
WHERE da.deal_id = sub.deal_id;
