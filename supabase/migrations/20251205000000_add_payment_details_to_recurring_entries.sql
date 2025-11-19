ALTER TABLE public.recurring_entries
ADD COLUMN forma_pagamento TEXT NULL,
ADD COLUMN cartao_id UUID NULL;

ALTER TABLE public.recurring_entries
ADD CONSTRAINT recurring_entries_cartao_id_fkey
FOREIGN KEY (cartao_id) REFERENCES public.cartoes(id)
ON DELETE SET NULL;