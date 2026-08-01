-- Garante que todas as colunas de ID de categoria e suas referências sejam do tipo TEXT.

-- 1. Remover todas as chaves estrangeiras que dependem dos IDs de categoria.
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_categoria_id_fkey;
ALTER TABLE public.categorias DROP CONSTRAINT IF EXISTS categorias_parent_id_fkey;
ALTER TABLE public.receitas DROP CONSTRAINT IF EXISTS receitas_tipo_receita_id_fkey;

-- 2. Alterar o tipo das colunas para TEXT.
-- Primeiro, remover qualquer valor padrão (como gen_random_uuid()) da coluna 'id' em 'categorias'.
ALTER TABLE public.categorias ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.categorias ALTER COLUMN id TYPE TEXT USING id::TEXT;

ALTER TABLE public.categorias ALTER COLUMN parent_id TYPE TEXT USING parent_id::TEXT;
ALTER TABLE public.despesas ALTER COLUMN categoria_id TYPE TEXT USING categoria_id::TEXT;
ALTER TABLE public.receitas ALTER COLUMN tipo_receita_id TYPE TEXT USING tipo_receita_id::TEXT;

-- 3. Recriar todas as chaves estrangeiras com os novos tipos de coluna.
ALTER TABLE public.despesas ADD CONSTRAINT despesas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);
ALTER TABLE public.categorias ADD CONSTRAINT categorias_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categorias(id);
ALTER TABLE public.receitas ADD CONSTRAINT receitas_tipo_receita_id_fkey FOREIGN KEY (tipo_receita_id) REFERENCES public.categorias(id);