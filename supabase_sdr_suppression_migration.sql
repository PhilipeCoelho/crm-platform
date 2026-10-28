-- ==============================================================================
-- VAMUSS SDR — MIGRAÇÃO DA TABELA CENTRAL DE SUPRESSÃO E OPOSIÇÃO (FASE B.1)
-- ==============================================================================
-- Descrição: Tabela central de bloqueio pré-envio para conformidade legal (RGPD,
-- DL 7/2004) e política comercial da Vamuss. Garante que opt-outs, recusas e
-- canais restritos impedem qualquer disparo indevido de saída.
-- ==============================================================================

-- 1. Criar extensão para UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela sdr_suppression_list
CREATE TABLE IF NOT EXISTS public.sdr_suppression_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    
    -- Dados de contacto normalizados (opcionais para permitir bloqueio a nível de negócio)
    telefone_normalizado TEXT,
    email_normalizado TEXT,
    
    -- Motivo e origem estruturados
    motivo_bloqueio TEXT NOT NULL CHECK (motivo_bloqueio IN (
        'OPTOUT_EXPLICITO',       -- Pedido formal para parar / remover da lista (art. 13º DL 7/2004)
        'RECUSA_COMERCIAL',       -- Declaração expressa de falta de interesse
        'RESTRICAO_CANAL',       -- Proibição de WhatsApp / canal restrito a email institucional
        'DESQUALIFICACAO_PORTE',  -- Incompatibilidade estrutural (grande grupo / rede corporativa)
        'CONTINGENCIA_OPERACIONAL', -- Equipa completa / migração / obras
        'INTERVENCAO_MANUAL'      -- Bloqueio preventivo inserido por operador
    )),
    
    origem_bloqueio TEXT NOT NULL CHECK (origem_bloqueio IN (
        'HISTORICO_CRM',          -- Deteção em notas/atividades passadas do CRM
        'RESPOSTA_INBOUND',       -- Mensagem recebida durante cadência comercial
        'INTERVENCAO_MANUAL',     -- Ação de utilizador no CRM
        'AUDITORIA_SEGURANCA'     -- Classificação preventiva automatizada
    )),
    
    canal_bloqueado TEXT NOT NULL DEFAULT 'TODOS' CHECK (canal_bloqueado IN (
        'TODOS',                  -- Bloqueio total em qualquer canal
        'WHATSAPP',               -- Bloqueio específico para WhatsApp (ex: canal médico)
        'EMAIL',                  -- Bloqueio específico para email
        'TELEFONE'                -- Bloqueio específico para chamadas de voz
    )),
    
    evidencia TEXT NOT NULL,      -- Citação do texto / registo histórico comprovativo
    
    estado TEXT NOT NULL DEFAULT 'ativo' CHECK (estado IN (
        'ativo',                  -- Bloqueio em vigor (impede envios)
        'em_revisao',             -- Bloqueio sob auditoria humana
        'revogado'                -- Bloqueio levantado com fundamentação legal auditada
    )),
    
    revogado_em TIMESTAMPTZ,
    revogado_motivo TEXT,
    
    data_bloqueio TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices de alta performance para consulta pré-envio
CREATE INDEX IF NOT EXISTS idx_sdr_suppression_deal_id ON public.sdr_suppression_list(deal_id);
CREATE INDEX IF NOT EXISTS idx_sdr_suppression_phone ON public.sdr_suppression_list(telefone_normalizado) WHERE telefone_normalizado IS NOT NULL AND estado = 'ativo';
CREATE INDEX IF NOT EXISTS idx_sdr_suppression_email ON public.sdr_suppression_list(email_normalizado) WHERE email_normalizado IS NOT NULL AND estado = 'ativo';
CREATE INDEX IF NOT EXISTS idx_sdr_suppression_active ON public.sdr_suppression_list(estado, motivo_bloqueio);

-- 4. Restrições de unicidade idempotentes (evitar duplicados ativos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_sdr_suppression_phone_active 
    ON public.sdr_suppression_list(telefone_normalizado, canal_bloqueado) 
    WHERE telefone_normalizado IS NOT NULL AND estado = 'ativo';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sdr_suppression_email_active 
    ON public.sdr_suppression_list(email_normalizado, canal_bloqueado) 
    WHERE email_normalizado IS NOT NULL AND estado = 'ativo';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sdr_suppression_deal_reason_active 
    ON public.sdr_suppression_list(deal_id, motivo_bloqueio, canal_bloqueado) 
    WHERE deal_id IS NOT NULL AND estado = 'ativo';

-- 5. Função de atualização do timestamp updated_at
CREATE OR REPLACE FUNCTION public.handle_sdr_suppression_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sdr_suppression_updated_at ON public.sdr_suppression_list;
CREATE TRIGGER trg_sdr_suppression_updated_at
    BEFORE UPDATE ON public.sdr_suppression_list
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sdr_suppression_updated_at();

-- 6. Políticas de Segurança RLS (Row Level Security)
ALTER TABLE public.sdr_suppression_list ENABLE ROW LEVEL SECURITY;

-- Leitura permitida para utilizadores autenticados e service_role
CREATE POLICY "Permitir leitura de supressão para utilizadores autenticados" 
    ON public.sdr_suppression_list 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Modificação restrita (inserção e atualização apenas para backend / service_role / admins)
CREATE POLICY "Permitir inserção de supressão para service_role e autenticados" 
    ON public.sdr_suppression_list 
    FOR INSERT 
    TO authenticated, service_role 
    WITH CHECK (true);

CREATE POLICY "Permitir atualização de supressão apenas para service_role" 
    ON public.sdr_suppression_list 
    FOR UPDATE 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- Comentários de documentação
COMMENT ON TABLE public.sdr_suppression_list IS 'Lista central inviolável de supressão, oposição e restrição de canal do SDR Vamuss.';
COMMENT ON COLUMN public.sdr_suppression_list.motivo_bloqueio IS 'Motivo canónico legal e comercial para a exclusão de contacto.';
COMMENT ON COLUMN public.sdr_suppression_list.canal_bloqueado IS 'Canal afetado pelo bloqueio (TODOS, WHATSAPP, EMAIL, TELEFONE).';
