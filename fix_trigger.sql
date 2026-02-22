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
        
        -- Se mudou para "Reunião" (flexibilizado para englobar 'reunião de diagnóstico', 'Reunião', etc)
        IF (v_stage_name ILIKE '%reunião%' OR v_stage_name ILIKE '%reuniao%') THEN
            UPDATE public.deal_analytics
            SET contatos_ate_reuniao = total_contatos_realizados,
                dias_ate_reuniao = EXTRACT(DAY FROM (NOW() - created_at))::INTEGER
            WHERE deal_id = NEW.id;
        END IF;
    END IF;
    
    -- 2. Fechamento do Deal (WON / LOST)
    IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status IN ('won', 'lost')) THEN
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
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
