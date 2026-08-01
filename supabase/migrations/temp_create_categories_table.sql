CREATE TABLE public.categorias (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    icone TEXT NOT NULL,
    cor TEXT NOT NULL,
    forma_pagamento TEXT NULL,
    parent_id TEXT NULL REFERENCES public.categorias(id),
    user_id UUID NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.categorias FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.categorias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for users who own the category" ON public.categorias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete for users who own the category" ON public.categorias FOR DELETE USING (auth.uid() = user_id);