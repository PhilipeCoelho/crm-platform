-- ANTIGRAVITY – FASE 1: BASE DE DADOS CONSOLIDADA PARA INSIGHTS (TEMPO REAL)

-- 1. NOVA TABELA PRINCIPAL: deal_analytics
CREATE TABLE IF NOT EXISTS public.deal_analytics (
    deal_id UUID PRIMARY KEY REFERENCES public.deals(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    status_final TEXT CHECK (status_final IN ('open', 'won', 'lost')) DEFAULT 'open',
    
    -- ESTÁGIO
    stage_atual TEXT,
    etapa_onde_perdeu TEXT,
    
    -- CICLO
    dias_totais_no_funil INTEGER DEFAULT 0,
    dias_ate_reuniao INTEGER,
    dias_ate_fechamento INTEGER,
    
    -- ATIVIDADES (VOLUME)
    total_atividades INTEGER DEFAULT 0,
    total_mensagens INTEGER DEFAULT 0,
    total_emails INTEGER DEFAULT 0,
    total_ligacoes INTEGER DEFAULT 0,
    total_analises INTEGER DEFAULT 0,
    total_auditorias INTEGER DEFAULT 0,
    
    -- CONTATOS
    total_contatos_realizados INTEGER DEFAULT 0,
    contatos_ate_reuniao INTEGER,
    contatos_ate_fechamento INTEGER,
    
    -- RESPOSTAS
    total_respostas INTEGER DEFAULT 0,
    respondeu_primeiro_contato BOOLEAN DEFAULT FALSE,
    
    -- TEMPO ENTRE CONTATOS
    ultimo_contato_em TIMESTAMP WITH TIME ZONE,
    tempo_medio_entre_contatos DOUBLE PRECISION,
    
    -- CANAL
    canal_mais_usado TEXT,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para deal_analytics
ALTER TABLE public.deal_analytics ENABLE ROW LEVEL SECURITY;

-- Política de RLS: Usuário pode ver apenas os dados dos seus próprios deals
DROP POLICY IF EXISTS "Users can view own deal analytics" ON public.deal_analytics;
CREATE POLICY "Users can view own deal analytics" ON public.deal_analytics
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_analytics.deal_id AND d.user_id = auth.uid())
    );

-- 1.1 Adicionar coluna houve_resposta em activities se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='houve_resposta') THEN
        ALTER TABLE public.activities ADD COLUMN houve_resposta BOOLEAN DEFAULT FALSE;
    END IF;
END $$;


-- 2. CRIAÇÃO AUTOMÁTICA DO REGISTRO (TRIGGER)
CREATE OR REPLACE FUNCTION public.fn_on_deal_created_analytics()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
BEGIN
    -- Obter o nome da etapa inicial
    SELECT name INTO v_stage_name FROM public.stages WHERE id = NEW.stage_id;
    
    INSERT INTO public.deal_analytics (
        deal_id, 
        created_at, 
        status_final, 
        stage_atual,
        updated_at
    )
    VALUES (
        NEW.id, 
        NEW.created_at, 
        'open', 
        COALESCE(v_stage_name, NEW.stage_id),
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_deal_created_analytics ON public.deals;
CREATE TRIGGER tr_on_deal_created_analytics
AFTER INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.fn_on_deal_created_analytics();


-- 3 & 4. ATUALIZAÇÃO AO CONCLUIR ATIVIDADE E MARCAÇÃO DE RESPOSTA (TRIGGER)
CREATE OR REPLACE FUNCTION public.fn_on_activity_completed_analytics()
RETURNS TRIGGER AS $$
DECLARE
    v_deal_id UUID;
    v_total_atividades INTEGER;
    v_total_mensagens INTEGER;
    v_total_emails INTEGER;
    v_total_ligacoes INTEGER;
    v_total_analises INTEGER;
    v_total_auditorias INTEGER;
    v_total_contatos INTEGER;
    v_total_respostas INTEGER;
    v_canal_mais_usado TEXT;
    
    v_tempo_medio DOUBLE PRECISION;
    v_ultimo_contato TIMESTAMP WITH TIME ZONE;
    v_respondeu_primeiro BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_deal_id := OLD.deal_id;
    ELSE
        v_deal_id := NEW.deal_id;
    END IF;

    -- 1. FAZER RECONTAGEM TOTAL DOS VOLUMES
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE type = 'message'),
        COUNT(*) FILTER (WHERE type = 'email'),
        COUNT(*) FILTER (WHERE type = 'call'),
        COUNT(*) FILTER (WHERE type = 'analysis'),
        COUNT(*) FILTER (WHERE type = 'audit'),
        COUNT(*) FILTER (WHERE type IN ('message', 'email', 'call')),
        COUNT(*) FILTER (WHERE houve_resposta = TRUE)
    INTO
        v_total_atividades,
        v_total_mensagens,
        v_total_emails,
        v_total_ligacoes,
        v_total_analises,
        v_total_auditorias,
        v_total_contatos,
        v_total_respostas
    FROM public.activities
    WHERE deal_id = v_deal_id AND completed = TRUE;

    -- Atualizar canal_mais_usado
    SELECT type INTO v_canal_mais_usado
    FROM (
        SELECT 'message' as type, v_total_mensagens as count
        UNION ALL SELECT 'email', v_total_emails
        UNION ALL SELECT 'call', v_total_ligacoes
    ) s
    WHERE count > 0
    ORDER BY count DESC, type ASC
    LIMIT 1;

    -- Buscar valores de tempo 
    SELECT tempo_medio_entre_contatos, ultimo_contato_em, respondeu_primeiro_contato
    INTO v_tempo_medio, v_ultimo_contato, v_respondeu_primeiro
    FROM public.deal_analytics
    WHERE deal_id = v_deal_id;

    -- 2. CALCULAR MÉDIAS (Sempre que uma atividade recém-finalizada entrar)
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF NEW.completed = TRUE AND (TG_OP = 'INSERT' OR OLD.completed = FALSE) THEN
            IF NEW.type IN ('message', 'email', 'call') AND v_ultimo_contato IS NOT NULL THEN
                v_tempo_medio := ((COALESCE(v_tempo_medio, 0) * (v_total_contatos - 1)) + 
                                 EXTRACT(EPOCH FROM (NOW() - v_ultimo_contato))/86400) / v_total_contatos;
            END IF;

            IF NEW.type IN ('message', 'email', 'call') THEN
                v_ultimo_contato := NOW();
            END IF;

            IF NEW.houve_resposta = TRUE AND (
                (NEW.type IN ('message', 'email', 'call') AND v_total_contatos = 1) OR
                (NOT NEW.type IN ('message', 'email', 'call') AND v_total_contatos = 0 AND NOT v_respondeu_primeiro)
            ) THEN
                v_respondeu_primeiro := TRUE;
            END IF;
        END IF;
    END IF;

    -- 3. APPLY TO deal_analytics
    UPDATE public.deal_analytics
    SET 
        total_atividades = v_total_atividades,
        total_mensagens = v_total_mensagens,
        total_emails = v_total_emails,
        total_ligacoes = v_total_ligacoes,
        total_analises = v_total_analises,
        total_auditorias = v_total_auditorias,
        total_contatos_realizados = v_total_contatos,
        total_respostas = v_total_respostas,
        canal_mais_usado = v_canal_mais_usado,
        tempo_medio_entre_contatos = v_tempo_medio,
        ultimo_contato_em = v_ultimo_contato,
        respondeu_primeiro_contato = v_respondeu_primeiro,
        updated_at = NOW()
    WHERE deal_id = v_deal_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_activity_completed_analytics ON public.activities;
CREATE TRIGGER tr_on_activity_completed_analytics
AFTER INSERT OR UPDATE OR DELETE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.fn_on_activity_completed_analytics();


-- 5, 6 & 7. AVANÇO DE ETAPA, FECHAMENTO E MUDANÇA DE ESTÁGIO (TRIGGER)
CREATE OR REPLACE FUNCTION public.fn_on_deal_updated_analytics()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
    v_days_in_funnel INTEGER;
BEGIN
    -- 1. Mudança de Estágio / Etapa
    IF (OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
        SELECT name INTO v_stage_name FROM public.stages WHERE id = NEW.stage_id;
        
        UPDATE public.deal_analytics
        SET stage_atual = COALESCE(v_stage_name, NEW.stage_id),
            updated_at = NOW()
        WHERE deal_id = NEW.id;
        
        -- Se mudou para "Reunião" (flexível para 'reunião de diagnostico', etc)
        IF (v_stage_name ILIKE '%reunião%' OR v_stage_name ILIKE '%reuniao%') THEN
            UPDATE public.deal_analytics
            SET contatos_ate_reuniao = total_contatos_realizados,
                dias_ate_reuniao = EXTRACT(DAY FROM (NOW() - created_at))::INTEGER
            WHERE deal_id = NEW.id;
        END IF;
    END IF;
    
    -- 2. Fechamento ou Reabertura do Deal (WON / LOST / ACTIVE)
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        IF (NEW.status IN ('won', 'lost')) THEN
            -- Calcular dias totais no funil até agora
            SELECT EXTRACT(DAY FROM (NOW() - created_at))::INTEGER INTO v_days_in_funnel 
            FROM public.deal_analytics WHERE deal_id = NEW.id;
            
            UPDATE public.deal_analytics
            SET status_final = NEW.status,
                closed_at = NOW(),
                dias_totais_no_funil = v_days_in_funnel,
                updated_at = NOW()
            WHERE deal_id = NEW.id;
            
            IF (NEW.status = 'won') THEN
                UPDATE public.deal_analytics
                SET contatos_ate_fechamento = total_contatos_realizados,
                    dias_ate_fechamento = v_days_in_funnel
                WHERE deal_id = NEW.id;
            ELSIF (NEW.status = 'lost') THEN
                UPDATE public.deal_analytics
                SET etapa_onde_perdeu = stage_atual
                WHERE deal_id = NEW.id;
            END IF;
        ELSIF (NEW.status = 'active' OR NEW.status = 'open') THEN
            -- 3. Reabertura do Deal
            UPDATE public.deal_analytics
            SET status_final = 'open',
                closed_at = NULL,
                dias_totais_no_funil = 0,
                contatos_ate_fechamento = NULL,
                dias_ate_fechamento = NULL,
                etapa_onde_perdeu = NULL,
                updated_at = NOW()
            WHERE deal_id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_deal_updated_analytics ON public.deals;
CREATE TRIGGER tr_on_deal_updated_analytics
AFTER UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.fn_on_deal_updated_analytics();

-- 8. POPULAÇÃO INICIAL (Opcional, mas recomendado para consistência inicial)
-- Esta parte garante que os negócios existentes tenham um registro básico em analytics.
INSERT INTO public.deal_analytics (deal_id, created_at, status_final, stage_atual, updated_at)
SELECT d.id, d.created_at, 
       CASE WHEN d.status = 'active' THEN 'open' ELSE d.status END, 
       s.name, 
       NOW()
FROM public.deals d
LEFT JOIN public.stages s ON d.stage_id = s.id
ON CONFLICT (deal_id) DO NOTHING;

-- ANTIGRAVITY – FASE 4: SISTEMA GLOBAL DE GUIAS RÁPIDOS (ESCALÁVEL)

CREATE TABLE IF NOT EXISTS public.help_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_name TEXT NOT NULL UNIQUE, -- ex: 'insights_funil', 'insights_perdas'
    title TEXT NOT NULL,
    short_explanation TEXT NOT NULL,
    interpretation_tip TEXT NOT NULL,
    action_tip TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserção de conteúdo inicial para Insights
INSERT INTO public.help_content (module_name, title, short_explanation, interpretation_tip, action_tip)
VALUES 
('insights_resumo', 'Resumo Executivo', 'Visão geral do volume e conversão de negócios criados no período.', 'Compare o total de negócios com os ganhos para entender a eficiência imediata.', 'Foque em aumentar o volume de entrada se a conversão estiver alta.'),
('insights_funil', 'Análise de Funil', 'O funil mostra como os negócios avançam entre as etapas de venda.', 'Observe onde ocorre a maior queda percentual (%) entre as fases.', 'A etapa com menor conversão indica o principal gargalo operacional.'),
('insights_execucao', 'Métricas de Execução', 'Produtividade da equipe em termos de atividades e contatos realizados.', 'Compare o total de mensagens vs e-mails para descobrir o canal preferido.', 'Padronize a cadência se houver muita variação entre os tipos de contato.'),
('insights_intensidade', 'Intensidade de Contatos', 'Mede a persistência e o esforço de contato com cada lead.', 'Negócios encerrados antes de 5 contatos indicam baixa insistência comercial.', 'Aumente o número mínimo de tentativas antes de considerar um lead perdido.'),
('insights_tempo', 'Velocidade e Ciclo', 'Analisa a velocidade de avanço e o tempo total de fechamento.', 'Um aumento no tempo médio indica que os leads estão esfriando no funil.', 'Reduza o intervalo entre os contatos para manter o lead engajado.'),
('insights_canais', 'Performance por Canal', 'Compara o desempenho e conversão de cada canal de aquisição.', 'O canal com maior taxa de fechamento deve receber prioridade de investimento.', 'Redistribua o esforço da equipe para o canal que gera mais vendas reais.'),
('insights_perdas', 'Análise de Perdas', 'Identifica onde e por que os negócios estão sendo perdidos.', 'Se mais de 40% das perdas ocorrem na mesma etapa, há um problema estrutural.', 'Revise a sua abordagem e os critérios de qualificação nesta fase crítica.')
ON CONFLICT (module_name) DO UPDATE SET
    title = EXCLUDED.title,
    short_explanation = EXCLUDED.short_explanation,
    interpretation_tip = EXCLUDED.interpretation_tip,
    action_tip = EXCLUDED.action_tip,
    updated_at = NOW();
