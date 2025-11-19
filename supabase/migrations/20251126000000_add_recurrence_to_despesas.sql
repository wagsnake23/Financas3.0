ALTER TABLE public.despesas
ADD COLUMN recurrence_frequency text NULL;

ALTER TABLE public.despesas
ADD COLUMN recurrence_installments_count integer NULL;