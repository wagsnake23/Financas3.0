ALTER TABLE public.receitas
ADD COLUMN updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Opcional: Se o trigger já existe, ele continuará funcionando.
-- Se você precisar recriar o trigger por algum motivo, o código seria:
-- DROP TRIGGER IF EXISTS trigger_updated_at_receitas ON public.receitas;
-- CREATE TRIGGER trigger_updated_at_receitas BEFORE
-- UPDATE ON public.receitas FOR EACH row
-- EXECUTE FUNCTION handle_updated_at ();