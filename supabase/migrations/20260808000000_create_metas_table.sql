-- ============================================================
-- Migration: Criar tabela de Metas Financeiras
-- ============================================================

CREATE TABLE public.metas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid
        REFERENCES auth.users(id)
        ON DELETE CASCADE
        NOT NULL,

    categoria_id text
        NOT NULL
        REFERENCES public.categorias(id),

    valor_objetivo numeric
        NOT NULL,

    valor_mensal numeric
        NOT NULL,

    data_limite date
        NULL,

    created_at timestamp with time zone
        DEFAULT now()
        NOT NULL,

    updated_at timestamp with time zone
        DEFAULT now()
        NOT NULL,

    -- O objetivo da Meta deve ser maior que zero
    CONSTRAINT metas_valor_objetivo_check
        CHECK (valor_objetivo > 0),

    -- O planejamento mensal deve ser maior que zero
    CONSTRAINT metas_valor_mensal_check
        CHECK (valor_mensal > 0)
);


-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- Policies
-- ============================================================

CREATE POLICY "Users can insert their own metas"
ON public.metas
FOR INSERT
WITH CHECK (auth.uid() = user_id);


CREATE POLICY "Users can view their own metas"
ON public.metas
FOR SELECT
USING (auth.uid() = user_id);


CREATE POLICY "Users can update their own metas"
ON public.metas
FOR UPDATE
USING (auth.uid() = user_id);


CREATE POLICY "Users can delete their own metas"
ON public.metas
FOR DELETE
USING (auth.uid() = user_id);