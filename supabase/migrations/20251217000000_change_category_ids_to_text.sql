-- Step 1: Drop the foreign key constraint from 'despesas' to 'categorias'
-- This is necessary before altering the type of the referenced column.
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_categoria_id_fkey;

-- Step 2: Alter the 'categoria_id' column in 'despesas' to TEXT
-- This will convert any existing UUIDs to their text representation if they were UUIDs.
ALTER TABLE public.despesas ALTER COLUMN categoria_id TYPE TEXT USING categoria_id::TEXT;

-- Step 3: Alter the 'id' column in 'categorias' to TEXT
-- This is the primary key. We first remove any default UUID generation function.
ALTER TABLE public.categorias ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.categorias ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Step 4: Re-add the foreign key constraint
-- Now that both columns are TEXT, the foreign key can be re-established.
ALTER TABLE public.despesas ADD CONSTRAINT despesas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id);