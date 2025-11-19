-- Alterar o tipo da coluna 'categoria_id' para TEXT na tabela 'despesas'
ALTER TABLE public.despesas ALTER COLUMN categoria_id TYPE TEXT;

-- Alterar o tipo da coluna 'tipo_receita_id' para TEXT na tabela 'receitas'
ALTER TABLE public.receitas ALTER COLUMN tipo_receita_id TYPE TEXT;

-- Re-adicionar as chaves estrangeiras
ALTER TABLE public.despesas ADD CONSTRAINT despesas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);
ALTER TABLE public.receitas ADD CONSTRAINT receitas_tipo_receita_id_fkey FOREIGN KEY (tipo_receita_id) REFERENCES public.categorias(id);