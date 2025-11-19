ALTER TABLE public.receitas
ADD COLUMN is_fixed BOOLEAN DEFAULT FALSE,
ADD COLUMN recurrence_frequency TEXT NULL,
ADD COLUMN recurrence_installments_count INTEGER NULL;