-- ==============================================================================
-- LIMPEZA E PROTEÇÃO ANTI-DUPLICAÇÃO DE ATIVIDADES PENDENTES NO CRM
-- ==============================================================================

-- 1. Excluir atividades pendentes duplicadas existentes (mantendo apenas a mais recente por deal)
DELETE FROM public.activities
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY deal_id, 
                                CASE 
                                    WHEN LOWER(TRIM(title)) LIKE 'follow up%' OR LOWER(TRIM(title)) LIKE 'follow-up%' OR type = 'task' 
                                    THEN 'follow_up_task' 
                                    ELSE LOWER(TRIM(title)) 
                                END
                   ORDER BY COALESCE(date, created_at) DESC, created_at DESC
               ) as rnum
        FROM public.activities
        WHERE status = 'pending' AND completed = false AND deal_id IS NOT NULL
    ) sub
    WHERE sub.rnum > 1
);

-- 2. Trigger de proteção: garante que um novo agendamento substitua automaticamente qualquer pendente antigo do mesmo tipo no deal
CREATE OR REPLACE FUNCTION public.fn_prevent_duplicate_pending_activities()
RETURNS TRIGGER AS $$
DECLARE
    v_is_followup BOOLEAN;
BEGIN
    -- Apenas atua se a nova atividade for pendente/não-concluída e tiver deal_id
    IF (NEW.status = 'pending' AND (NEW.completed IS NULL OR NEW.completed = false) AND NEW.deal_id IS NOT NULL) THEN
        v_is_followup := (LOWER(TRIM(NEW.title)) LIKE 'follow up%' OR LOWER(TRIM(NEW.title)) LIKE 'follow-up%' OR NEW.type = 'task');

        -- Exclui atividades pendentes anteriores do mesmo deal com o mesmo título ou do tipo follow-up
        DELETE FROM public.activities
        WHERE deal_id = NEW.deal_id
          AND id != NEW.id
          AND status = 'pending'
          AND completed = false
          AND (
              LOWER(TRIM(title)) = LOWER(TRIM(NEW.title))
              OR (v_is_followup AND (LOWER(TRIM(title)) LIKE 'follow up%' OR LOWER(TRIM(title)) LIKE 'follow-up%' OR type = 'task'))
          );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_prevent_duplicate_pending_activities ON public.activities;
CREATE TRIGGER tr_prevent_duplicate_pending_activities
BEFORE INSERT ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_duplicate_pending_activities();
