ALTER TABLE public.despesas
ADD COLUMN numero_parcelas INTEGER DEFAULT 1;

-- Update existing 'avista' expenses to have numero_parcelas = 1
UPDATE public.despesas
SET numero_parcelas = 1
WHERE tipo_pagamento = 'avista';

-- Set default for new rows
ALTER TABLE public.despesas
ALTER COLUMN numero_parcelas SET NOT NULL;