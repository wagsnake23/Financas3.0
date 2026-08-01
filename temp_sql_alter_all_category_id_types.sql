-- Desabilitar verificações de chave estrangeira temporariamente, se necessário (pode variar dependendo da versão do Postgres/Supabase)
-- SET session_replication_role = 'replica';

-- 1. Remover as chaves estrangeiras que referenciam 'categorias.id'
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_categoria_id_fkey;
ALTER TABLE public.categorias DROP CONSTRAINT IF EXISTS categorias_parent_id_fkey;
ALTER TABLE public.receitas DROP CONSTRAINT IF EXISTS receitas_tipo_receita_id_fkey;

-- 2. Remover a chave primária da tabela 'categorias'
ALTER TABLE public.categorias DROP CONSTRAINT IF EXISTS categorias_pkey;

-- 3. Alterar o tipo da coluna 'id' para TEXT na tabela 'categorias'
ALTER TABLE public.categorias ALTER COLUMN id TYPE TEXT;

-- 4. Alterar o tipo da coluna 'parent_id' para TEXT na tabela 'categorias'
ALTER TABLE public.categorias ALTER COLUMN parent_id TYPE TEXT;

-- 5. Alterar o tipo da coluna 'categoria_id' para TEXT na tabela 'despesas'
ALTER TABLE public.despesas ALTER COLUMN categoria_id TYPE TEXT;

-- 6. Alterar o tipo da coluna 'tipo_receita_id' para TEXT na tabela 'receitas'
ALTER TABLE public.receitas ALTER COLUMN tipo_receita_id TYPE TEXT;

-- 7. Re-adicionar a chave primária na tabela 'categorias'
ALTER TABLE public.categorias ADD PRIMARY KEY (id);

-- 8. Re-adicionar as chaves estrangeiras
ALTER TABLE public.despesas ADD CONSTRAINT despesas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);
ALTER TABLE public.categorias ADD CONSTRAINT categorias_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categorias(id);
ALTER TABLE public.receitas ADD CONSTRAINT receitas_tipo_receita_id_fkey FOREIGN KEY (tipo_receita_id) REFERENCES public.categorias(id);

-- Re-habilitar verificações de chave estrangeira
-- SET session_replication_role = 'origin';