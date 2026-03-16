-- MÓDULO DE TEMPLATES DE EMAIL - ADIÇÃO DE CAMPOS E MODELOS PADRÃO

-- 1. Adicionar colunas 'subject' e 'category' na tabela email_templates (caso não existam)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_templates' AND column_name = 'subject') THEN
        ALTER TABLE public.email_templates ADD COLUMN subject TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_templates' AND column_name = 'category') THEN
        ALTER TABLE public.email_templates ADD COLUMN category TEXT;
    END IF;
END $$;
