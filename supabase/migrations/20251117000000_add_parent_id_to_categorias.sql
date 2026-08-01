-- Adiciona a coluna 'parent_id' para permitir categorias aninhadas
ALTER TABLE public.categorias
ADD COLUMN parent_id uuid NULL;

-- Adiciona uma chave estrangeira para 'parent_id' referenciando a própria tabela 'categorias'
ALTER TABLE public.categorias
ADD CONSTRAINT categorias_parent_id_fkey
FOREIGN KEY (parent_id) REFERENCES public.categorias(id)
ON DELETE SET NULL;

-- Adiciona a coluna 'forma_pagamento' para especificar métodos de pagamento preferenciais para categorias
ALTER TABLE public.categorias
ADD COLUMN forma_pagamento text NULL;

-- Opcional: Se você quiser que 'forma_pagamento' use um ENUM específico, você precisaria criar o ENUM primeiro.
-- Por enquanto, 'text' é mais flexível.