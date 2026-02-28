-- REGRAS DE NEGÓCIO DA ATIVIDADE - AJUSTE PARA FINAIS DE SEMANA
-- Objetivo: Evitar atividades agendadas em finais de semana, movendo-as
-- para a próxima segunda-feira, mantendo a mesma hora.

-- 1. Cria a Função de Validação e Ajuste de Fim de Semana
CREATE OR REPLACE FUNCTION public.fn_adjust_activity_date_for_weekends()
RETURNS TRIGGER AS $$
DECLARE
    v_dow INTEGER;
BEGIN
    IF NEW.date IS NOT NULL THEN
        -- Extrair o dia da semana: 0 = Domingo, 1-5 = Dias úteis, 6 = Sábado
        v_dow := EXTRACT(DOW FROM NEW.date);
        
        IF v_dow = 6 THEN
            -- Se for sábado, adiciona 2 dias para cair na segunda-feira
            NEW.date := NEW.date + INTERVAL '2 days';
        ELSIF v_dow = 0 THEN
            -- Se for domingo, adiciona 1 dia para cair na segunda-feira
            NEW.date := NEW.date + INTERVAL '1 day';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger na Inclusão (INSERT)
DROP TRIGGER IF EXISTS tr_activity_weekend_rule_insert ON public.activities;
CREATE TRIGGER tr_activity_weekend_rule_insert
    BEFORE INSERT ON public.activities
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_adjust_activity_date_for_weekends();

-- 3. Trigger na Alteração (UPDATE) de data
DROP TRIGGER IF EXISTS tr_activity_weekend_rule_update ON public.activities;
CREATE TRIGGER tr_activity_weekend_rule_update
    BEFORE UPDATE OF date ON public.activities
    FOR EACH ROW
    WHEN (NEW.date IS DISTINCT FROM OLD.date)
    EXECUTE FUNCTION public.fn_adjust_activity_date_for_weekends();

-- 4. Opcional (Efeito Retroativo): Atualizar datas já erradas
-- (Neste caso não aplicado automaticamente para não causar distúrbios, 
-- mas pode ser executado manualmente se o usuário quiser limpar sua base)
-- UPDATE public.activities 
-- SET date = date + INTERVAL '2 days' WHERE EXTRACT(DOW FROM date) = 6 AND status = 'pending';
-- UPDATE public.activities 
-- SET date = date + INTERVAL '1 day' WHERE EXTRACT(DOW FROM date) = 0 AND status = 'pending';
