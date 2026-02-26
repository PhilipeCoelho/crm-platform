-- IMPLEMENTAÇÃO DO STATUS "DESQUALIFICADO" NO NEGÓCIO (CRM)

-- 1. ADICIONAR COLUNAS À TABELA DEALS
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS disqualified_reason TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMP WITH TIME ZONE;

-- 2. ATUALIZAR STATUS NO ANALYTICS (CHECK CONSTRAINT)
-- Nota: Supabase às vezes não nomeia a constraint de forma previsível se foi criada via SQL direto.
-- Vamos tentar remover e adicionar novamente se soubermos o nome, ou usar uma abordagem segura.
DO $$ 
BEGIN 
    -- Tentar encontrar a constraint de check no status_final
    -- Se não conseguirmos o nome exato, vamos apenas garantir que o trigger suporte o novo valor.
    -- A tabela deal_analytics já tem um CHECK constraint: status_final TEXT CHECK (status_final IN ('open', 'won', 'lost')) DEFAULT 'open'
    
    -- Remover a constraint antiga (assumindo nome padrão ou listando)
    ALTER TABLE public.deal_analytics DROP CONSTRAINT IF EXISTS deal_analytics_status_final_check;
    
    -- Adicionar a nova constraint
    ALTER TABLE public.deal_analytics ADD CONSTRAINT deal_analytics_status_final_check 
        CHECK (status_final IN ('open', 'won', 'lost', 'desqualificado'));
END $$;

-- 3. ATUALIZAR TRIGGER DE ANALYTICS (fn_on_deal_updated_analytics)
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
        
        -- Se mudou para "Reunião"
        IF (v_stage_name ILIKE '%reunião%' OR v_stage_name ILIKE '%reuniao%') THEN
            UPDATE public.deal_analytics
            SET contatos_ate_reuniao = total_contatos_realizados,
                dias_ate_reuniao = EXTRACT(DAY FROM (NOW() - created_at))::INTEGER
            WHERE deal_id = NEW.id;
        END IF;
    END IF;
    
    -- 2. Fechamento ou Reabertura do Deal (WON / LOST / DESQUALIFICADO / OPEN)
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        IF (NEW.status IN ('won', 'lost', 'desqualificado')) THEN
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
            -- DESQUALIFICADO: Não participamos de métricas de conversão, então apenas o status_final e closed_at são suficientes.
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

-- 4. AUTOMATIZAÇÃO: CANCELAR ATIVIDADES AO DESQUALIFICAR
CREATE OR REPLACE FUNCTION public.fn_on_deal_disqualified_cleanup()
RETURNS TRIGGER AS $$
BEGIN
    -- Se mudou para desqualificado
    IF (NEW.status = 'desqualificado' AND OLD.status IS DISTINCT FROM 'desqualificado') THEN
        -- 1. Cancelar todas as atividades pendentes
        UPDATE public.activities
        SET status = 'canceled'
        WHERE deal_id = NEW.id AND status = 'pending';
        
        -- Nota: O trigger de cadência (fn_cadence_init_unified) já lida com stage_id, 
        -- mas para garantir que nenhuma nova atividade automática seja gerada, 
        -- não precisamos fazer nada pois o trigger de cadência só age se stage_id mudar.
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_deal_disqualified_cleanup ON public.deals;
CREATE TRIGGER tr_on_deal_disqualified_cleanup
    BEFORE UPDATE ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.fn_on_deal_disqualified_cleanup();
