-- Adicionar a coluna updated_at à tabela despesas, se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='despesas' AND column_name='updated_at') THEN
        ALTER TABLE public.despesas
        ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL;
    END IF;
END
$$;

-- Adicionar a coluna updated_at à tabela despesas_parcelas, se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='despesas_parcelas' AND column_name='updated_at') THEN
        ALTER TABLE public.despesas_parcelas
        ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL;
    END IF;
END
$$;