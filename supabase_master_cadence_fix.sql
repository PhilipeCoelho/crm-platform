-- MASTER CADENCE FIX & CONSOLIDATION
-- Objetivo: Resolver o sumiço das atividades e garantir que a progressão funcione sempre.
-- Este script limpa gatilhos antigos e consolida a lógica progressiva dinâmica.

-- 1. LIMPEZA TOTAL DE TRIGGER ANTIGOS
DROP TRIGGER IF EXISTS tr_deal_stage_cadence ON public.deals;
DROP TRIGGER IF EXISTS tr_deal_cadence_init ON public.deals;
DROP TRIGGER IF EXISTS tr_activity_cadence_progress ON public.activities;
DROP TRIGGER IF EXISTS tr_activity_cadence_step ON public.activities;

-- 2. GARANTIR COLUNAS NA TABELA ACTIVITIES
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS origin_stage TEXT;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS sequence_step INTEGER DEFAULT 1;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS is_automatic BOOLEAN DEFAULT false;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS tooltip_script TEXT;

-- 3. LOGICA DE INICIALIZAÇÃO (Ao mudar de etapa)
CREATE OR REPLACE FUNCTION public.fn_cadence_init_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
    v_tag TEXT;
    v_template RECORD;
BEGIN
    -- Ignorar se não mudou a etapa
    IF (TG_OP = 'UPDATE' AND OLD.stage_id = NEW.stage_id) THEN
        RETURN NEW;
    END IF;

    -- Obter Nome da Etapa Normalizado
    SELECT UPPER(name) INTO v_stage_name FROM public.stages WHERE id = NEW.stage_id;
    v_stage_name := COALESCE(v_stage_name, '');

    -- Limpar atividades automáticas pendentes desta negociação para evitar duplicidade ou lixo de etapas anteriores
    DELETE FROM public.activities 
    WHERE deal_id = NEW.id 
      AND is_automatic = true 
      AND (status = 'pending' OR status IS NULL);

    -- Mapeamento Robusto de Tags
    IF (v_stage_name LIKE '%LEAD%' AND v_stage_name NOT LIKE '%ENGAJADO%') THEN v_tag := 'LEAD';
    ELSIF (v_stage_name LIKE '%ENGAJADO%') THEN v_tag := 'ENGAJADO';
    ELSIF (v_stage_name LIKE '%DIAGN%STICO%') THEN v_tag := 'DIAGNOSTICO';
    ELSIF (v_stage_name LIKE '%FECHAMENTO%') THEN v_tag := 'FECHAMENTO';
    ELSE 
        -- Se for uma etapa manual/aleatória, não cria cadência mas já limpamos a anterior
        RETURN NEW;
    END IF;

    -- Buscar Passo 1 do Template
    SELECT * INTO v_template FROM public.cadence_templates WHERE tag = v_tag AND step = 1;

    IF FOUND THEN
        INSERT INTO public.activities (
            user_id, deal_id, type, title, notes, tooltip_script, 
            date, status, is_automatic, origin_stage, sequence_step
        )
        VALUES (
            NEW.user_id, 
            NEW.id, 
            v_template.type, 
            v_template.title, 
            v_template.description,
            v_template.script,
            NOW() + (v_template.days || ' hours')::interval, -- Passo 1 costuma ser imediato ou em poucas horas
            'pending', 
            true, 
            v_tag, 
            1
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. LOGICA DE PROGRESSÃO (Ao concluir atividade)
CREATE OR REPLACE FUNCTION public.fn_cadence_progress_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_template RECORD;
    v_target_tag TEXT;
    v_target_step INTEGER;
BEGIN
    -- Só dispara se a atividade for automática e foi marcada como concluída AGORA
    IF (NEW.is_automatic = true AND (NEW.status = 'completed' OR NEW.completed = true) AND 
       (OLD.status IS DISTINCT FROM NEW.status OR OLD.completed IS DISTINCT FROM NEW.completed)) THEN
        
        -- Fallbacks caso os dados estejam incompletos na atividade concluída
        v_target_tag := COALESCE(NEW.origin_stage, 'LEAD');
        v_target_step := COALESCE(NEW.sequence_step, 1) + 1;

        -- Buscar o próximo passo nos templates
        SELECT * INTO v_template 
        FROM public.cadence_templates 
        WHERE tag = v_target_tag AND step = v_target_step;

        IF FOUND THEN
            INSERT INTO public.activities (
                user_id, deal_id, type, title, notes, tooltip_script, 
                date, status, is_automatic, origin_stage, sequence_step
            )
            VALUES (
                NEW.user_id, 
                NEW.deal_id, 
                v_template.type, 
                v_template.title, 
                v_template.description,
                v_template.script,
                NOW() + (v_template.days || ' days')::interval, 
                'pending', 
                true, 
                v_target_tag, 
                v_target_step
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RE-APLICAÇÃO DOS GATILHOS
CREATE TRIGGER tr_deal_cadence_init_v2
    AFTER INSERT OR UPDATE OF stage_id ON public.deals
    FOR EACH ROW EXECUTE FUNCTION public.fn_cadence_init_v2();

-- Disparar na mudança de status OU no booleano completed para máxima compatibilidade
CREATE TRIGGER tr_activity_cadence_progress_v2
    AFTER UPDATE ON public.activities
    FOR EACH ROW 
    WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.completed IS DISTINCT FROM NEW.completed)
    EXECUTE FUNCTION public.fn_cadence_progress_v2();

-- 6. GARANTIR DADOS DOS TEMPLATES (Corrigindo possíveis gaps)
INSERT INTO public.cadence_templates (tag, step, type, title, script, days, description) VALUES
('ENGAJADO', 1, 'message', 'Resposta + Pergunta Estratégica', 'Perfeito. Hoje vocês já investem em anúncios ou dependem mais de indicação?', 0, 'Responder o lead e fazer UMA pergunta estratégica.'),
('ENGAJADO', 2, 'message', 'Apontar o Problema', 'Normalmente clínicas que dependem só de indicação acabam tendo meses mais fracos. Isso acontece aí também?', 1, 'Mensagem curta ativando a dor principal.'),
('ENGAJADO', 3, 'message', 'Ampliar o Impacto', 'Quando a agenda oscila, isso impacta direto no faturamento e na previsibilidade. Já calcularam quanto deixam de faturar nos meses mais fracos?', 2, 'Mostrar a consequência do problema.'),
('ENGAJADO', 4, 'message', 'Mostrar Valor da Solução', 'Se vocês tivessem previsibilidade de 10 a 20 novos pacientes por mês, mudaria o cenário atual?', 2, 'Criar desejo pela solução.'),
('ENGAJADO', 5, 'message', 'Convite Direto', 'Posso te mostrar onde está o gargalo e como resolver em 20 minutos. Qual dia funciona melhor para você?', 2, 'Chamada objetiva para reunião.')
ON CONFLICT (tag, step) DO UPDATE SET 
    title = EXCLUDED.title,
    script = EXCLUDED.script,
    description = EXCLUDED.description,
    days = EXCLUDED.days;
