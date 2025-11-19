-- Remove as chaves estrangeiras que dependem da tabela 'categorias'
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_categoria_id_fkey;
ALTER TABLE public.receitas DROP CONSTRAINT IF EXISTS receitas_tipo_receita_id_fkey;
ALTER TABLE public.categorias DROP CONSTRAINT IF EXISTS categorias_parent_id_fkey;

-- Exclui a tabela 'categorias'
DROP TABLE IF EXISTS public.categorias;

-- Recria a tabela 'categorias'
CREATE TABLE public.categorias (
  id text NOT NULL,
  nome text NOT NULL,
  icone text NOT NULL,
  cor text NOT NULL,
  forma_pagamento text NULL,
  user_id uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  parent_id text NULL,
  CONSTRAINT categorias_pkey PRIMARY KEY (id)
);

-- Re-adiciona as chaves estrangeiras
ALTER TABLE public.despesas ADD CONSTRAINT despesas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;
ALTER TABLE public.receitas ADD CONSTRAINT receitas_tipo_receita_id_fkey FOREIGN KEY (tipo_receita_id) REFERENCES public.categorias(id) ON DELETE SET NULL;
ALTER TABLE public.categorias ADD CONSTRAINT categorias_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categorias(id) ON DELETE CASCADE;

-- Habilita Row Level Security (RLS) para a tabela 'categorias'
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- Cria políticas de RLS para 'categorias'
DROP POLICY IF EXISTS "Enable read access for all users" ON public.categorias;
CREATE POLICY "Enable read access for all users" ON public.categorias FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.categorias;
CREATE POLICY "Enable insert for authenticated users only" ON public.categorias FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Enable update for users who own the category" ON public.categorias;
CREATE POLICY "Enable update for users who own the category" ON public.categorias FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Enable delete for users who own the category" ON public.categorias;
CREATE POLICY "Enable delete for users who own the category" ON public.categorias FOR DELETE USING (auth.uid() = user_id);

-- Adiciona uma política para permitir que usuários vejam categorias padrão (user_id é null)
DROP POLICY IF EXISTS "Allow authenticated users to view default categories" ON public.categorias;
CREATE POLICY "Allow authenticated users to view default categories" ON public.categorias FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

-- Adiciona uma política para impedir que usuários autenticados atualizem/deletem categorias padrão
DROP POLICY IF EXISTS "Prevent authenticated users from updating default categories" ON public.categorias;
CREATE POLICY "Prevent authenticated users from updating default categories" ON public.categorias FOR UPDATE USING (user_id IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Prevent authenticated users from deleting default categories" ON public.categorias;
CREATE POLICY "Prevent authenticated users from deleting default categories" ON public.categorias FOR DELETE USING (user_id IS NOT NULL AND auth.uid() = user_id);