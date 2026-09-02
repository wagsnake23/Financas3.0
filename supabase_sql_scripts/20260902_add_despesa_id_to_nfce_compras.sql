-- Adicionar a coluna despesa_id na tabela nfce_compras
ALTER TABLE public.nfce_compras
ADD COLUMN IF NOT EXISTS despesa_id UUID;

-- Adicionar a restrição de chave estrangeira com exclusão em cascata
ALTER TABLE public.nfce_compras
ADD CONSTRAINT fk_nfce_compras_despesa
FOREIGN KEY (despesa_id)
REFERENCES public.despesas (id)
ON DELETE CASCADE;

-- Criar índice para melhorar a performance das exclusões/buscas
CREATE INDEX IF NOT EXISTS idx_nfce_compras_despesa_id ON public.nfce_compras(despesa_id);
