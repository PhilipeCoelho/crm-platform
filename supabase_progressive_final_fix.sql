-- FINAL PROGRESSIVE CADENCE FIX (USING REAL REGISTERED CADENCES)
-- Objective: Use the exact titles and steps defined in src/services/cadence.ts in a progressive model.

-- 1. CLEANUP
DROP TRIGGER IF EXISTS tr_deal_stage_cadence ON public.deals;
DROP TRIGGER IF EXISTS tr_deal_cadence_init ON public.deals;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress ON public.activities;

-- 2. INITIALIZATION TRIGGER (Step 1 Only)
CREATE OR REPLACE FUNCTION public.fn_automate_cadence_progressive()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.stage_id = NEW.stage_id) THEN
        RETURN NEW;
    END IF;

    SELECT name INTO v_stage_name FROM public.stages WHERE id = NEW.stage_id;
    v_stage_name := UPPER(v_stage_name);

    DELETE FROM public.activities 
    WHERE deal_id = NEW.id 
      AND is_automatic = true 
      AND status = 'pending';

    -- LEAD (New) - CRIA APENAS O PRIMEIRO PASSO (D0)
    IF (v_stage_name LIKE '%LEAD%' AND v_stage_name NOT LIKE '%ENGAJADO%') THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
        VALUES (NEW.user_id, NEW.id, 'message', 'WhatsApp: Mensagem inicial', NOW() + interval '1 hour', 'pending', true, 'LEAD', 1, 'Primeiro contato para abertura de conversa.');
    
    -- LEAD ENGAJADO
    ELSIF (v_stage_name LIKE '%ENGAJADO%') THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
        VALUES (NEW.user_id, NEW.id, 'message', 'Resposta + Qualificação', NOW() + interval '1 hour', 'pending', true, 'ENGAJADO', 1, 'Entender o nível de maturidade do lead.');

    -- REUNIÃO DE DIAGNÓSTICO
    ELSIF (v_stage_name LIKE '%DIAGN%STICO%') THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
        VALUES (NEW.user_id, NEW.id, 'message', 'RD – Confirmação oficial', NOW() + interval '1 hour', 'pending', true, 'DIAGNOSTICO', 1, 'Confirmar presença e alinhar expectativas.');

    -- FECHAMENTO
    ELSIF (v_stage_name LIKE '%FECHAMENTO%') THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
        VALUES (NEW.user_id, NEW.id, 'message', 'FE – Resumo pós-reunião', NOW() + interval '1 hour', 'pending', true, 'FECHAMENTO', 1, 'Reforçar os pontos principais da proposta.');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. PROGRESSION TRIGGER (Next Steps)
CREATE OR REPLACE FUNCTION public.fn_progress_cadence_progressive()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.is_automatic = true AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN
        
        -- Se o lead respondeu, não gerar próximas atividades da cadência
        IF (NEW.houve_resposta = true) THEN
            RETURN NEW;
        END IF;

        -- --- LEAD PROGRESSION ---
        IF (NEW.origin_stage = 'LEAD') THEN
            CASE NEW.sequence_step
                WHEN 1 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'email', 'Email: Apresentação', NOW() + interval '1 day', 'pending', true, 'LEAD', 2, 'Apresentação formal da solução.');
                WHEN 2 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'call', 'Ligação: Tentativa 1', NOW() + interval '2 days', 'pending', true, 'LEAD', 3, 'Primeiro contato por voz para qualificação.');
                WHEN 3 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'analysis', 'Vídeo: Análise digital', NOW() + interval '2 days', 'pending', true, 'LEAD', 4, 'Entrega de valor através de diagnóstico visual.');
                WHEN 4 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'email', 'Email: Insight estratégico', NOW() + interval '3 days', 'pending', true, 'LEAD', 5, 'Conteúdo educativo para quebra de objeções.');
                WHEN 5 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'audit', 'Vídeo: Mini auditoria', NOW() + interval '2 days', 'pending', true, 'LEAD', 6, 'Aprofundamento técnico e prova de conceito.');
                WHEN 6 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'call', 'Ligação: Tentativa 2', NOW() + interval '2 days', 'pending', true, 'LEAD', 7, 'Follow-up focado em agendamento.');
                WHEN 7 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'email', 'Email: Convite fechamento', NOW() + interval '3 days', 'pending', true, 'LEAD', 8, 'Última tentativa de agendamento na cadência LEAD.');
                ELSE NULL;
            END CASE;

        -- --- ENGAJADO PROGRESSION ---
        ELSIF (NEW.origin_stage = 'ENGAJADO') THEN
            CASE NEW.sequence_step
                WHEN 1 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'message', 'Apontar o Problema', NOW() + interval '1 day', 'pending', true, 'ENGAJADO', 2, 'Fazer o lead reconhecer o problema.');
                WHEN 2 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'message', 'Ampliar o Impacto', NOW() + interval '2 days', 'pending', true, 'ENGAJADO', 3, 'Gerar desconforto e senso de urgência real.');
                WHEN 3 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'message', 'Mostrar Valor', NOW() + interval '2 days', 'pending', true, 'ENGAJADO', 4, 'Fazer o lead visualizar o ganho.');
                WHEN 4 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'message', 'Convite para Reunião', NOW() + interval '2 days', 'pending', true, 'ENGAJADO', 5, 'Agendar reunião.');
                WHEN 5 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'message', 'Reativação de Lead Parado', NOW() + interval '3 days', 'pending', true, 'ENGAJADO', 6, 'Recuperar contato de leads que pararam de responder.');
                ELSE NULL;
            END CASE;

        -- --- DIAGNOSTICO PROGRESSION ---
        ELSIF (NEW.origin_stage = 'DIAGNOSTICO') THEN
            CASE NEW.sequence_step
                WHEN 1 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'task', 'RD – Preparar análise digital', NOW() + interval '4 hours', 'pending', true, 'DIAGNOSTICO', 2, 'Tarefa interna de preparação.');
                WHEN 2 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'message', 'RD – Lembrete 24h', NOW() + interval '1 day', 'pending', true, 'DIAGNOSTICO', 3, 'Lembrete estratégico para a reunião.');
                WHEN 3 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'message', 'RD – Lembrete 1h', NOW() + interval '1 day', 'pending', true, 'DIAGNOSTICO', 4, 'Última chamada para a reunião.');
                WHEN 4 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'task', 'RD – Reunião realizada', NOW() + interval '1 hour', 'pending', true, 'DIAGNOSTICO', 5, 'Registro da conclusão da reunião.');
                ELSE NULL;
            END CASE;

        -- --- FECHAMENTO PROGRESSION ---
        ELSIF (NEW.origin_stage = 'FECHAMENTO') THEN
            CASE NEW.sequence_step
                WHEN 1 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'message', 'FE – Follow-up 1', NOW() + interval '2 days', 'pending', true, 'FECHAMENTO', 2, 'Primeiro follow-up após envio da proposta.');
                WHEN 2 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'message', 'FE – Follow-up 2', NOW() + interval '2 days', 'pending', true, 'FECHAMENTO', 3, 'Segundo follow-up reforcando escassez/oportunidade.');
                WHEN 3 THEN INSERT INTO public.activities (user_id, deal_id, type, title, date, status, is_automatic, origin_stage, sequence_step, notes)
                            VALUES (NEW.user_id, NEW.deal_id, 'message', 'FE – Última chamada', NOW() + interval '3 days', 'pending', true, 'FECHAMENTO', 4, 'Tentativa final de fechamento antes do arquivamento.');
                ELSE NULL;
            END CASE;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RE-APPLY TRIGGERS
CREATE TRIGGER tr_deal_cadence_init
    AFTER INSERT OR UPDATE OF stage_id ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.fn_automate_cadence_progressive();

CREATE TRIGGER tr_activity_cadence_progress
    AFTER UPDATE OF status ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.fn_progress_cadence_progressive();
