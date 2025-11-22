-- Remover triggers existentes para evitar conflitos
DROP TRIGGER IF EXISTS trigger_updated_at_despesas ON public.despesas;
DROP TRIGGER IF EXISTS trigger_updated_at_despesas_parcelas ON public.despesas_parcelas;
DROP TRIGGER IF EXISTS trigger_updated_at_receitas ON public.receitas;

-- Criar trigger para a tabela despesas
CREATE TRIGGER trigger_updated_at_despesas
BEFORE UPDATE ON public.despesas
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Criar trigger para a tabela despesas_parcelas
CREATE TRIGGER trigger_updated_at_despesas_parcelas
BEFORE UPDATE ON public.despesas_parcelas
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Criar trigger para a tabela receitas
CREATE TRIGGER trigger_updated_at_receitas
BEFORE UPDATE ON public.receitas
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();