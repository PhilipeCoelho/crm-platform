CREATE TABLE IF NOT EXISTS unsubscribed_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS para segurança
ALTER TABLE unsubscribed_emails ENABLE ROW LEVEL SECURITY;

-- Permitir qualquer pessoa (anon/user) ler para que o backend consiga consultar
CREATE POLICY "Permitir leitura anon unsubscribed_emails"
ON unsubscribed_emails FOR SELECT
TO anon, authenticated
USING (true);

-- Permitir o backend (através da API) inserir e-mails que descadastraram
CREATE POLICY "Permitir inserção anon unsubscribed_emails"
ON unsubscribed_emails FOR INSERT
TO anon, authenticated
WITH CHECK (true);
