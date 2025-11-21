-- Adiciona 'fixo' como um valor válido para a coluna 'tipo_pagamento' na tabela 'despesas'.

-- Remove a restrição de verificação existente, se houver, para que possamos adicionar a nova.
ALTER TABLE public.despesas DROP CONSTRAINT IF EXISTS despesas_tipo_pagamento_check;

-- Adiciona uma nova restrição de verificação com 'fixo' incluído na lista de valores permitidos.
ALTER TABLE public.despesas ADD CONSTRAINT despesas_tipo_pagamento_check CHECK (tipo_pagamento IN ('avista', 'parcelado', 'fixo'));