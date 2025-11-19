-- Desabilitar verificações de chave estrangeira temporariamente, se necessário (pode variar dependendo da versão do Postgres/Supabase)
-- SET session_replication_role = 'replica';

-- 1. Remover as chaves estrangeiras que referenciam 'categorias.id'
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_categoria_id_fkey;
ALTER TABLE public.categorias DROP CONSTRAINT IF EXISTS categorias_parent_id_fkey;

-- 2. Remover a chave primária da tabela 'categorias'
ALTER TABLE public.categorias DROP CONSTRAINT IF EXISTS categorias_pkey;

-- 3. Alterar o tipo da coluna 'id' para TEXT
ALTER TABLE public.categorias ALTER COLUMN id TYPE TEXT;

-- 4. Alterar o tipo da coluna 'parent_id' para TEXT
ALTER TABLE public.categorias ALTER COLUMN parent_id TYPE TEXT;

-- 5. Re-adicionar a chave primária na tabela 'categorias'
ALTER TABLE public.categorias ADD PRIMARY KEY (id);

-- 6. Re-adicionar as chaves estrangeiras
ALTER TABLE public.despesas ADD CONSTRAINT despesas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);
ALTER TABLE public.categorias ADD CONSTRAINT categorias_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categorias(id);

-- Re-habilitar verificações de chave estrangeira
-- SET session_replication_role = 'origin';