-- DYNAMIC CADENCE TEMPLATES
-- This migration creates the table for user-editable cadence rules and updates triggers to use them.

-- 1. Create the templates table
CREATE TABLE IF NOT EXISTS public.cadence_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag TEXT NOT NULL, -- LEAD, ENGAJADO, DIAGNOSTICO, FECHAMENTO
    step INTEGER NOT NULL, -- 1, 2, 3...
    type TEXT NOT NULL, -- message, email, call, task, etc
    title TEXT NOT NULL,
    description TEXT,
    script TEXT,
    days INTEGER NOT NULL DEFAULT 1, -- Days after previous step (or 0 for immediate)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tag, step)
);

-- Enable RLS
ALTER TABLE public.cadence_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view cadence templates" ON public.cadence_templates
    FOR SELECT USING (true);

CREATE POLICY "Admins can update cadence templates" ON public.cadence_templates
    FOR ALL USING (true) WITH CHECK (true); -- Simplified for now, adjust as needed

-- 2. Initial Data Load from current hardcoded values
INSERT INTO public.cadence_templates (tag, step, type, title, script, days, description) VALUES
-- LEAD (New)
('LEAD', 1, 'message', 'WhatsApp: Mensagem inicial', '[HOOK DIRETO - Sem "Olá, tudo bem?"]\n"Dra. [Nome], vi que a [Nome da Clínica] está sem presença digital estruturada. Não estou a enviar proposta. Só uma pergunta: quantas consultas deixou de marcar esta semana porque o paciente não a encontrou no Google antes de ligar para a concorrência?"\n\n[PAUSA - Aguardar resposta]\n\n"Trabalho exclusivamente com clínicas dentárias em Portugal. Ajudei a [Nome de Clínica Referência/Genérico] a aumentar o Payer Mix em 40% em 6 meses. Não vendo ''posts bonitos''. Vendo previsibilidade de faturamento."\n\n[CTA LEVE]\n"Valia a pena uma conversa de 15 minutos para eu mostrar onde está a fuga de dinheiro na sua captação? Sem compromisso. Se não fizer sentido, diz-me e não volto a incomodar."', 0, 'Objetivo: Abertura de 70%+ / Resposta de 30%+'),
('LEAD', 2, 'email', 'Email: Apresentação', 'Assunto: "A fuga de dinheiro que a Dra. [Nome] não está a ver"\n\nCorpo do Email:\nDra. [Nome],\nEnviei-lhe ontem uma mensagem no WhatsApp. Não respondeu. Normal. Gestores de clínicas recebem dezenas de "propostas de marketing" por semana.\n\nA diferença: eu não sou uma agência de "gestão de redes sociais".\n\nO que faço:\nAuditamos a jornada do paciente particular de alta valor desde o primeiro clique no Google até à confirmação da consulta. Depois implementamos os sistemas para que essa máquina funcione sem depender do "humor" da rececionista ou da "sorte" do boca-a-boca.\n\nResultado concreto:\nClínica similar à sua em [Cidade/Região Genérica] passou de 70% convenção/30% particular para 45% convenção/55% particular em 4 meses. O faturamento por consulta médio subiu de 42€ para 89€.\n\nPorque lhe escrevo:\nAnalisei a [Nome da Clínica] e identifiquei 3 pontos de fuga imediatos:\n- [Google Business Profile sem fotos da equipa]\n- [Website sem sistema de marcação online]\n- [Zero rastreio de origem das ligações]\n\nPróximo passo:\nPosso enviar-lhe uma mini-auditoria gratuita (vídeo de 5 minutos) mostrando exatamente onde está a perder dinheiro? Basta confirmar este email.', 1, 'Assunto: "A fuga de dinheiro que a Dra. [Nome] não está a ver"'),
('LEAD', 3, 'call', 'Ligação: Tentativa 1', '[ABERTURA - 0-10s]\n"Dra. [Nome]? É o Philipe Coelho. Enviei-lhe uma mensagem e um email sobre a captação de pacientes da [Nome da Clínica]. Tem 90 segundos? Se não for boa altura, marcamos para amanhã."\n\n[SE DIZER QUE NÃO TEM TEMPO]\n"Percebo. Só preciso de saber: está satisfeita com a percentagem de consultas particulares vs convencionadas neste momento?"\n\n[SE DEIXAR CONTINUAR]\n"Perfeito. Vou ser direto: não lhe vou vender nada nesta chamada. Só quero perceber se faz sentido eu mostrar-lhe onde está a perder pacientes particulares para a concorrência. São 15 minutos na sexta ou na próxima semana?"\n\n[OBJEÇÃO: "Já temos marketing"]\n"Excelente. Isso significa que já investe em crescer. A minha pergunta é diferente: consegue-me dizer, com números, quanto gastou em anúncios no último mês e quanto retornou em consultas particulares pagas?"\n\n[FECHO]\n"Vou enviar-lhe uma proposta de horário por email."', 2, 'Duração: Máx 3 minutos | Objetivo: Qualificar + Agendar'),
('LEAD', 4, 'analysis', 'Vídeo: Análise digital', '[0-30s] HOOK VISUAL: "Dra. [Nome], vou mostrar-lhe exatamente o que um paciente particular vê quando procura por ''dentista [cidade]'' no Google."\n\n[30s-2min] DIAGNÓSTICO VISUAL: Mostrar Google Business Profile, Website e Redes Sociais.\n\n[2-4min] OS 3 PROBLEMAS:\n1. Invisibilidade de Intenção (Busca)\n2. Fratura de Confiança (Avaliações)\n3. Ausência de Sistema (Marcação Online)\n\n[4-5min] PROVA DE CONCEITO: "Sabe quantos pacientes desistem de marcar se tiverem que ligar vs clicar? 60%. A 80€ médio por consulta, são 2.400€/mês a evaporar-se."\n\n[5-6min] CTA PARA REUNIÃO: "Quer que eu lhe mostre como funciona numa call de 20 minutos?"', 2, 'Formato: Vídeo Loom de 5-7 minutos (não PDF)'),
('LEAD', 5, 'email', 'Email: Insight estratégico', 'Dra. [Nome],\nNão é clickbait. É dado do Ordem dos Médicos Dentistas.\nO mercado está a dividir-se em dois:\n\nGrupo A: Grandes grupos com máquinas de captação digital, margens de 40%+.\nGrupo B: Clínicas independentes a competir por migalhas de convenção, margens de 8-12%.\n\nA diferença não é qualidade clínica. É arquitetura comercial.\n\nA sua clínica está a construir um ativo que vale alguma coisa para vender no futuro, ou está a criar um emprego para si mesma que paga mal e exige demais?\n\nSe a resposta incomodar, talvez seja altura de conversarmos.', 3, 'Assunto: "Porque é que 7% dos dentistas fugiram de Portugal em 2025"'),
('LEAD', 6, 'audit', 'Vídeo: Mini auditoria', 'DIAGNÓSTICO DIGITAL | [Nome da Clínica]\n\nSecção 1: Score de Maturidade Digital (0-100)\n- Presença de Busca\n- Conversão de Website\n- Gestão de Reputação\n- Sistemas de Retenção\n\nSecção 2: Os 3 Maiores Gargalos\nSecção 3: Impacto Financeiro Estimado\nSecção 4: Próximo Passo: "Reunião de Diagnóstico de 30 minutos. Zero proposta. Só estratégia."', 2, 'Formato: PDF de 1 página + Vídeo de 3 minutos'),
('LEAD', 7, 'call', 'Ligação: Tentativa 2', '[ABERTURA]\n"Dra. [Nome], Philipe Coelho de novo. Enviei-lhe ontem a auditoria da clínica. Viu o vídeo?"\n\n[SE NÃO VIU]\n"Normal, está ocupada. Só me diga: está satisfeita com o mix de faturamento atual ou quer saber onde está a fugir dinheiro?"\n\n[SE VIU]\n"O que é que mais a incomodou no diagnóstico?"\n\n[OBJEÇÃO: "Preciso de pensar"]\n"Percebo. Mas o dinheiro que está a perder continua a fugir enquanto pensa."\n\n[OBJEÇÃO: "É muito caro"]\n"Ainda não lhe apresentei preço. Mas já lhe mostrei que está a perder [X]€ por mês. É caro resolver, ou é caro continuar a perder?"', 2, 'Objetivo: Superar últimas objeções + Agendar RD'),
('LEAD', 8, 'email', 'Email: Convite fechamento', 'Dra. [Nome],\nReunião confirmada para [Dia] às [Hora].\n\nO que vai acontecer nestes 30 minutos:\n- Contexto (5 min)\n- Diagnóstico (15 min)\n- Estratégia (8 min)\n- Decisão (2 min)\n\nO que preciso de si:\n- Acesso ao Google Analytics (se tiver)\n- Honestidade sobre números\n- Decisão de sim ou não no final\n\nAté [Dia],', 3, 'Assunto: "Convite confirmado: Diagnóstico [Nome da Clínica]"'),

-- ENGAJADO
('ENGAJADO', 1, 'message', 'Resposta + Pergunta Estratégica', 'Perfeito. Hoje vocês já investem em anúncios ou dependem mais de indicação?', 0, 'Responder o lead e fazer UMA pergunta estratégica.'),
('ENGAJADO', 2, 'message', 'Apontar o Problema', 'Normalmente clínicas que dependem só de indicação acabam tendo meses mais fracos. Isso acontece aí também?', 1, 'Mensagem curta ativando a dor principal.'),
('ENGAJADO', 3, 'message', 'Ampliar o Impacto', 'Quando a agenda oscila, isso impacta direto no faturamento e na previsibilidade. Já calcularam quanto deixam de faturar nos meses mais fracos?', 2, 'Mostrar a consequência do problema.'),
('ENGAJADO', 4, 'message', 'Mostrar Valor da Solução', 'Se vocês tivessem previsibilidade de 10 a 20 novos pacientes por mês, mudaria o cenário atual?', 2, 'Criar desejo pela solução.'),
('ENGAJADO', 5, 'message', 'Convite Direto', 'Posso te mostrar onde está o gargalo e como resolver em 20 minutos. Qual dia funciona melhor para você?', 2, 'Chamada objetiva para reunião.'),

-- DIAGNOSTICO
('DIAGNOSTICO', 1, 'message', 'RD – Confirmação oficial', 'Confirmado para dia [DATA] às [HORA].\nVou analisar sua presença online antes da nossa conversa.', 0, 'Confirmação imediata.'),
('DIAGNOSTICO', 2, 'task', 'RD – Preparar análise digital', 'Tarefa interna para preparar os pontos da clínica.', 0, 'Preparação (algumas horas depois)'),
('DIAGNOSTICO', 3, 'message', 'RD – Lembrete 24h', 'Amanhã às [HORA] analisamos sua clínica.\nJá levantei alguns pontos importantes.', 1, 'Lembrete de 24h.'),
('DIAGNOSTICO', 4, 'message', 'RD – Lembrete 1h', 'Nos vemos em 1 hora.\nSegue o link da reunião: [LINK]', 1, 'Lembrete de 1h (ajustado para dia seguinte se necessário)'),
('DIAGNOSTICO', 5, 'task', 'RD – Reunião realizada', 'Registro manual da reunião.', 0, 'Registro final'),

-- FECHAMENTO
('FECHAMENTO', 1, 'message', 'FE – Resumo pós-reunião', 'Conforme alinhamos, hoje vocês perdem previsibilidade\npor falta de aquisição estruturada.\nO plano seria iniciar com [PLATAFORMA] focando em [SERVIÇO].', 0, 'Resumo pós-reunião.'),
('FECHAMENTO', 2, 'message', 'FE – Follow-up 1', 'Conseguiu avaliar a proposta?\nFaz sentido avançarmos ainda esta semana?', 2, 'Follow-up 2 dias depois.'),
('FECHAMENTO', 3, 'message', 'FE – Follow-up 2', 'Enquanto isso não estiver ativo,\nvocês continuam dependentes de indicação.\nQuer que iniciemos este mês?', 2, 'Follow-up 4 dias depois acumulados (2+2)'),
('FECHAMENTO', 4, 'message', 'FE – Última chamada', 'Se não for prioridade agora,\nposso retomar mais à frente.', 3, 'Última tentativa.')
ON CONFLICT (tag, step) DO UPDATE SET
    script = EXCLUDED.script,
    days = EXCLUDED.days,
    title = EXCLUDED.title,
    description = EXCLUDED.description;

-- 3. UPDATED TRIGGERS TO BE DYNAMIC

-- A. Initialization Logic
CREATE OR REPLACE FUNCTION public.fn_automate_cadence_progressive()
RETURNS TRIGGER AS $$
DECLARE
    v_stage_name TEXT;
    v_tag TEXT;
    v_template RECORD;
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.stage_id = NEW.stage_id) THEN
        RETURN NEW;
    END IF;

    SELECT name INTO v_stage_name FROM public.stages WHERE id = NEW.stage_id;
    v_stage_name := UPPER(v_stage_name);

    -- Clean pending automatic activities for this deal
    DELETE FROM public.activities 
    WHERE deal_id = NEW.id 
      AND is_automatic = true 
      AND status = 'pending';

    -- Map Stage Name to Tag
    IF (v_stage_name LIKE '%LEAD%' AND v_stage_name NOT LIKE '%ENGAJADO%') THEN v_tag := 'LEAD';
    ELSIF (v_stage_name LIKE '%ENGAJADO%') THEN v_tag := 'ENGAJADO';
    ELSIF (v_stage_name LIKE '%DIAGN%STICO%') THEN v_tag := 'DIAGNOSTICO';
    ELSIF (v_stage_name LIKE '%FECHAMENTO%') THEN v_tag := 'FECHAMENTO';
    ELSE RETURN NEW;
    END IF;

    -- Get Step 1 Template
    SELECT * INTO v_template FROM public.cadence_templates WHERE tag = v_tag AND step = 1;

    IF FOUND THEN
        INSERT INTO public.activities (user_id, deal_id, type, title, notes, tooltip_script, date, status, is_automatic, origin_stage, sequence_step)
        VALUES (
            NEW.user_id, 
            NEW.id, 
            v_template.type, 
            v_template.title, 
            v_template.description,
            v_template.script,
            NOW() + (v_template.days || ' hours')::interval, -- Use hours for step 1 to avoid day overlap
            'pending', 
            true, 
            v_tag, 
            1
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Progression Logic
CREATE OR REPLACE FUNCTION public.fn_progress_cadence_progressive()
RETURNS TRIGGER AS $$
DECLARE
    v_template RECORD;
BEGIN
    -- Only trigger when an automatic activity is completed
    IF (NEW.is_automatic = true AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN
        
        -- Get Next Step Template
        SELECT * INTO v_template 
        FROM public.cadence_templates 
        WHERE tag = NEW.origin_stage AND step = NEW.sequence_step + 1;

        IF FOUND THEN
            INSERT INTO public.activities (user_id, deal_id, type, title, notes, tooltip_script, date, status, is_automatic, origin_stage, sequence_step)
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
                NEW.origin_stage, 
                v_template.step
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Global Propagator (Update pending activities when template changes)
CREATE OR REPLACE FUNCTION public.fn_propagate_cadence_template_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all pending automatic activities that match this template
    UPDATE public.activities
    SET title = NEW.title,
        notes = NEW.description,
        tooltip_script = NEW.script,
        type = NEW.type,
        -- If days changed, we might want to reschedule, but that's complex as we don't know the "reference date" easily.
        -- For now, let's at least update the content.
        updated_at = NOW()
    WHERE is_automatic = true 
      AND status = 'pending'
      AND origin_stage = NEW.tag
      AND sequence_step = NEW.step;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_propagate_cadence_changes ON public.cadence_templates;
CREATE TRIGGER tr_propagate_cadence_changes
    AFTER UPDATE ON public.cadence_templates
    FOR EACH ROW EXECUTE FUNCTION public.fn_propagate_cadence_template_changes();
