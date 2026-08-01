-- Adiciona a coluna recurrence_frequency à tabela despesas
ALTER TABLE public.despesas
ADD COLUMN recurrence_frequency TEXT;

-- Adiciona a coluna recurrence_installments_count à tabela despesas
ALTER TABLE public.despesas
ADD COLUMN recurrence_installments_count INTEGER;