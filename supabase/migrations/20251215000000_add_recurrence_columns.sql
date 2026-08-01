-- Adicionar colunas à tabela 'receitas'
ALTER TABLE public.receitas
ADD COLUMN is_recurring_master BOOLEAN DEFAULT FALSE,
ADD COLUMN recurrence_id UUID,
ADD COLUMN recurrence_day INTEGER;

-- Adicionar uma chave estrangeira para recurrence_id referenciando a própria tabela receitas
ALTER TABLE public.receitas
ADD CONSTRAINT fk_receitas_recurrence_id
FOREIGN KEY (recurrence_id) REFERENCES public.receitas(id)
ON DELETE SET NULL;

-- Criar um índice para buscas mais rápidas em recurrence_id
CREATE INDEX idx_receitas_recurrence_id ON public.receitas (recurrence_id);

-- Adicionar coluna à tabela 'despesas'
ALTER TABLE public.despesas
ADD COLUMN is_recurring_master BOOLEAN DEFAULT FALSE;