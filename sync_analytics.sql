UPDATE public.deal_analytics da
SET 
    total_atividades = COALESCE((SELECT COUNT(*) FROM public.activities a WHERE a.deal_id = da.deal_id AND a.completed = TRUE), 0),
    total_mensagens = COALESCE((SELECT COUNT(*) FROM public.activities a WHERE a.deal_id = da.deal_id AND a.type = 'message' AND a.completed = TRUE), 0),
    total_emails = COALESCE((SELECT COUNT(*) FROM public.activities a WHERE a.deal_id = da.deal_id AND a.type = 'email' AND a.completed = TRUE), 0),
    total_ligacoes = COALESCE((SELECT COUNT(*) FROM public.activities a WHERE a.deal_id = da.deal_id AND a.type = 'call' AND a.completed = TRUE), 0),
    total_analises = COALESCE((SELECT COUNT(*) FROM public.activities a WHERE a.deal_id = da.deal_id AND a.type = 'analysis' AND a.completed = TRUE), 0),
    total_auditorias = COALESCE((SELECT COUNT(*) FROM public.activities a WHERE a.deal_id = da.deal_id AND a.type = 'audit' AND a.completed = TRUE), 0),
    total_contatos_realizados = COALESCE((SELECT COUNT(*) FROM public.activities a WHERE a.deal_id = da.deal_id AND a.type IN ('message','email','call') AND a.completed = TRUE), 0),
    total_respostas = COALESCE((SELECT COUNT(*) FROM public.activities a WHERE a.deal_id = da.deal_id AND a.houve_resposta = TRUE AND a.completed = TRUE), 0)
;

UPDATE public.deal_analytics da
SET canal_mais_usado = (
    SELECT s.type
    FROM (
        SELECT 'message' as type, da.total_mensagens as count
        UNION ALL SELECT 'email', da.total_emails
        UNION ALL SELECT 'call', da.total_ligacoes
    ) s
    WHERE s.count > 0
    ORDER BY s.count DESC, s.type ASC
    LIMIT 1
);
