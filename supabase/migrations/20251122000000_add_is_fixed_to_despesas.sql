ALTER TABLE public.despesas
ADD COLUMN is_fixed BOOLEAN DEFAULT FALSE;

-- Opcional: Adicionar uma política RLS se necessário, mas por padrão as políticas existentes devem cobrir.
-- Por exemplo, se você tiver uma política que permite SELECT para user_id = auth.uid(), ela já incluirá esta nova coluna.