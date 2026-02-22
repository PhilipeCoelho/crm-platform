ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE public.deal_analytics ADD COLUMN IF NOT EXISTS motivo_perda TEXT;

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
                SET etapa_onde_perdeu = stage_atual,
                    motivo_perda = NEW.lost_reason
                WHERE deal_id = NEW.id;
            END IF;
        ELSIF (NEW.status = 'active' OR NEW.status = 'open') THEN
            -- 3. LOGICA DE REABERTURA: Volta para 'open' e limpa as datas de fechamento
            UPDATE public.deal_analytics
            SET status_final = 'open',
                closed_at = NULL,
                dias_totais_no_funil = 0,
                contatos_ate_fechamento = NULL,
                dias_ate_fechamento = NULL,
                etapa_onde_perdeu = NULL,
                motivo_perda = NULL,
                updated_at = NOW()
            WHERE deal_id = NEW.id;
        END IF;
    END IF;

    -- Se o motivo de perda mudar enquanto já estiver perdido
    IF (OLD.lost_reason IS DISTINCT FROM NEW.lost_reason) AND (NEW.status = 'lost') THEN
        UPDATE public.deal_analytics
        SET motivo_perda = NEW.lost_reason,
            updated_at = NOW()
        WHERE deal_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
