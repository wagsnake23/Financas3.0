-- Criação das tabelas para importação de NFC-e

CREATE TABLE IF NOT EXISTS public.nfce_compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chave_acesso TEXT UNIQUE NOT NULL,
    url_nfce TEXT,
    estabelecimento TEXT,
    cnpj TEXT,
    data_compra TIMESTAMPTZ,
    valor_total NUMERIC(12,2),
    forma_pagamento TEXT,
    numero_parcelas INTEGER,
    raw_html TEXT,
    status_importacao TEXT DEFAULT 'processada',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar a coluna caso a tabela já exista e a migration seja reexecutada
ALTER TABLE public.nfce_compras
ADD COLUMN IF NOT EXISTS status_importacao TEXT DEFAULT 'processada';

CREATE INDEX IF NOT EXISTS idx_nfce_compras_data ON public.nfce_compras(data_compra);
CREATE INDEX IF NOT EXISTS idx_nfce_compras_estabelecimento ON public.nfce_compras(estabelecimento);

CREATE TABLE IF NOT EXISTS public.nfce_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compra_id UUID NOT NULL REFERENCES public.nfce_compras(id) ON DELETE CASCADE,
    descricao TEXT,
    quantidade NUMERIC(12,3),
    unidade TEXT,
    valor_unitario NUMERIC(12,2),
    valor_total NUMERIC(12,2),
    codigo_barras TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfce_itens_compra_id ON public.nfce_itens(compra_id);

-- Habilitar RLS
ALTER TABLE public.nfce_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfce_itens ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Usuários podem ver apenas suas próprias compras NFC-e" ON public.nfce_compras;
CREATE POLICY "Usuários podem ver apenas suas próprias compras NFC-e" 
    ON public.nfce_compras FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem inserir suas próprias compras NFC-e" ON public.nfce_compras;
CREATE POLICY "Usuários podem inserir suas próprias compras NFC-e" 
    ON public.nfce_compras FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias compras NFC-e" ON public.nfce_compras;
CREATE POLICY "Usuários podem atualizar suas próprias compras NFC-e" 
    ON public.nfce_compras FOR UPDATE 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem deletar suas próprias compras NFC-e" ON public.nfce_compras;
CREATE POLICY "Usuários podem deletar suas próprias compras NFC-e" 
    ON public.nfce_compras FOR DELETE 
    USING (auth.uid() = user_id);


DROP POLICY IF EXISTS "Usuários podem ver apenas os itens das suas compras NFC-e" ON public.nfce_itens;
CREATE POLICY "Usuários podem ver apenas os itens das suas compras NFC-e" 
    ON public.nfce_itens FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.nfce_compras 
            WHERE nfce_compras.id = nfce_itens.compra_id AND nfce_compras.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Usuários podem inserir itens nas suas compras NFC-e" ON public.nfce_itens;
CREATE POLICY "Usuários podem inserir itens nas suas compras NFC-e" 
    ON public.nfce_itens FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.nfce_compras 
            WHERE nfce_compras.id = compra_id AND nfce_compras.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Usuários podem atualizar itens das suas compras NFC-e" ON public.nfce_itens;
CREATE POLICY "Usuários podem atualizar itens das suas compras NFC-e" 
    ON public.nfce_itens FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.nfce_compras 
            WHERE nfce_compras.id = nfce_itens.compra_id AND nfce_compras.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Usuários podem deletar itens das suas compras NFC-e" ON public.nfce_itens;
CREATE POLICY "Usuários podem deletar itens das suas compras NFC-e" 
    ON public.nfce_itens FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.nfce_compras 
            WHERE nfce_compras.id = nfce_itens.compra_id AND nfce_compras.user_id = auth.uid()
        )
    );
