-- Step 1: Drop all foreign key constraints that reference or are referenced by category IDs.
-- This is crucial before altering the type of the columns.

-- From 'despesas' to 'categorias'
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_categoria_id_fkey;

-- From 'categorias' to 'categorias' (for parent_id)
ALTER TABLE public.categorias DROP CONSTRAINT IF EXISTS categorias_parent_id_fkey;

-- From 'receitas' to 'categorias'
ALTER TABLE public.receitas DROP CONSTRAINT IF EXISTS receitas_tipo_receita_id_fkey;

-- Step 2: Alter the 'id' and 'parent_id' columns in 'categorias' to TEXT.
-- First, remove any default UUID generation for 'id'.
ALTER TABLE public.categorias ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.categorias ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE public.categorias ALTER COLUMN parent_id TYPE TEXT USING parent_id::TEXT;

-- Step 3: Alter the 'categoria_id' column in 'despesas' to TEXT.
ALTER TABLE public.despesas ALTER COLUMN categoria_id TYPE TEXT USING categoria_id::TEXT;

-- Step 4: Alter the 'tipo_receita_id' column in 'receitas' to TEXT.
ALTER TABLE public.receitas ALTER COLUMN tipo_receita_id TYPE TEXT USING tipo_receita_id::TEXT;

-- Step 5: Re-add the foreign key constraints.
-- Re-add constraint from 'despesas' to 'categorias'
ALTER TABLE public.despesas ADD CONSTRAINT despesas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);

-- Re-add constraint from 'categorias' to 'categorias' (for parent_id)
ALTER TABLE public.categorias ADD CONSTRAINT categorias_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categorias(id);

-- Re-add constraint from 'receitas' to 'categorias'
ALTER TABLE public.receitas ADD CONSTRAINT receitas_tipo_receita_id_fkey FOREIGN KEY (tipo_receita_id) REFERENCES public.categorias(id);