-- Adicionar coluna delivered_count na tabela de campanhas
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'delivered_count') THEN
        ALTER TABLE public.campaigns ADD COLUMN delivered_count INTEGER DEFAULT 0;
    END IF;
END $$;
