-- Remover chaves estrangeiras que referenciam 'categorias.id'
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_categoria_id_fkey;
ALTER TABLE public.categorias DROP CONSTRAINT IF EXISTS categorias_parent_id_fkey;
ALTER TABLE public.receitas DROP CONSTRAINT IF EXISTS receitas_tipo_receita_id_fkey;

-- Remover a tabela 'categorias' se ela existir
DROP TABLE IF EXISTS public.categorias;

-- Remover a tabela 'tipos_receita' se ela existir (para simplificar, vamos usar apenas 'categorias' para tipos de receita também)
DROP TABLE IF EXISTS public.tipos_receita;