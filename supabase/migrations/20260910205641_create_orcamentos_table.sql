CREATE TABLE orcamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES auth.users(id),

    categoria_id TEXT NOT NULL REFERENCES categorias(id),

    mes_ano VARCHAR(7) NOT NULL,

    tipo_planejamento VARCHAR(20) NOT NULL DEFAULT 'valor',

    valor_planejado NUMERIC(10,2) NOT NULL DEFAULT 0,

    percentual_planejado NUMERIC(5,2) NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT check_tipo_planejamento
        CHECK (
            tipo_planejamento IN ('valor', 'percentual')
        ),

    CONSTRAINT check_valor_planejado
        CHECK (
            valor_planejado >= 0
        ),

    CONSTRAINT check_percentual_planejado
        CHECK (
            percentual_planejado >= 0
            AND percentual_planejado <= 100
        ),

    UNIQUE(user_id, categoria_id, mes_ano)
);

-- Índice para consultas do orçamento mensal
CREATE INDEX idx_orcamentos_user_mes
ON orcamentos(user_id, mes_ano);

-- Habilitar RLS
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

-- Política de acesso
CREATE POLICY "Users can manage their own orcamentos"
ON orcamentos
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger padrão do projeto
CREATE TRIGGER trigger_updated_at_orcamentos
BEFORE UPDATE ON orcamentos
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();
