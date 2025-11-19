-- Adicionando a coluna 'is_fixed' à tabela 'despesas' se ela não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'despesas' AND column_name = 'is_fixed') THEN
        ALTER TABLE public.despesas ADD COLUMN is_fixed boolean DEFAULT false NULL;
    END IF;
END
$$;

-- Habilitando RLS para 'despesas' (se já não estiver habilitado)
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- Criando políticas de RLS para 'despesas'
-- Removido IF NOT EXISTS, pois não é uma sintaxe válida para CREATE POLICY
CREATE POLICY "Users can view their own expenses" ON public.despesas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own expenses" ON public.despesas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own expenses" ON public.despesas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expenses" ON public.despesas FOR DELETE USING (auth.uid() = user_id);


-- Criando a tabela 'despesas_parcelas' se ela não existir
CREATE TABLE IF NOT EXISTS public.despesas_parcelas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    despesa_id uuid NOT NULL,
    numero_parcela integer NOT NULL,
    valor_parcela numeric NOT NULL,
    vencimento date NOT NULL,
    data_pagamento date NULL,
    pago boolean DEFAULT false NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Adicionando chave primária para 'despesas_parcelas' se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'despesas_parcelas_pkey') THEN
        ALTER TABLE public.despesas_parcelas ADD CONSTRAINT despesas_parcelas_pkey PRIMARY KEY (id);
    END IF;
END
$$;

-- Adicionando chave estrangeira para 'despesas_parcelas' se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'despesas_parcelas_despesa_id_fkey') THEN
        ALTER TABLE public.despesas_parcelas ADD CONSTRAINT despesas_parcelas_despesa_id_fkey FOREIGN KEY (despesa_id) REFERENCES public.despesas(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- Habilitando RLS para 'despesas_parcelas' (se já não estiver habilitado)
ALTER TABLE public.despesas_parcelas ENABLE ROW LEVEL SECURITY;

-- Criando políticas de RLS para 'despesas_parcelas'
-- Removido IF NOT EXISTS, pois não é uma sintaxe válida para CREATE POLICY
CREATE POLICY "Users can view their expense installments" ON public.despesas_parcelas FOR SELECT USING (EXISTS (SELECT 1 FROM public.despesas WHERE despesas.id = despesa_id AND despesas.user_id = auth.uid()));
CREATE POLICY "Users can insert their expense installments" ON public.despesas_parcelas FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.despesas WHERE despesas.id = despesa_id AND despesas.user_id = auth.uid()));
CREATE POLICY "Users can update their expense installments" ON public.despesas_parcelas FOR UPDATE USING (EXISTS (SELECT 1 FROM public.despesas WHERE despesas.id = despesa_id AND despesas.user_id = auth.uid()));
CREATE POLICY "Users can delete their expense installments" ON public.despesas_parcelas FOR DELETE USING (EXISTS (SELECT 1 FROM public.despesas WHERE despesas.id = despesa_id AND despesas.user_id = auth.uid()));