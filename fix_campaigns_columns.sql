-- Adiciona as novas colunas necessárias, ignorando as que já existem
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS from_name TEXT,
ADD COLUMN IF NOT EXISTS from_email TEXT,
ADD COLUMN IF NOT EXISTS reply_to TEXT,
ADD COLUMN IF NOT EXISTS template_id UUID,
ADD COLUMN IF NOT EXISTS list_id TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS opened_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicked_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Algumas restrições importantes caso a tabela antiga tivesse status num formato curto
-- Garante que o PostgREST atualiza a estrutura pro frontend
NOTIFY pgrst, 'reload schema';
