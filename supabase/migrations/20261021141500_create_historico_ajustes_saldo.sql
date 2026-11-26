
BEGIN;

-- ============================================================
-- 1. Tabela de histórico dos ajustes manuais de saldo
-- ============================================================

CREATE TABLE IF NOT EXISTS public.historico_ajustes_saldo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    saldo_anterior NUMERIC(14,2) NOT NULL,
    saldo_informado NUMERIC(14,2) NOT NULL,
    valor_ajuste NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.historico_ajustes_saldo
IS 'Histórico individual dos ajustes manuais de saldo realizados pelos usuários.';

COMMENT ON COLUMN public.historico_ajustes_saldo.saldo_anterior
IS 'Saldo efetivo existente antes da aplicação do ajuste.';

COMMENT ON COLUMN public.historico_ajustes_saldo.saldo_informado
IS 'Saldo real desejado e informado pelo usuário.';

COMMENT ON COLUMN public.historico_ajustes_saldo.valor_ajuste
IS 'Diferença entre o saldo informado e o saldo anterior.';

-- ============================================================
-- 2. Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_historico_ajustes_saldo_user_id
    ON public.historico_ajustes_saldo (user_id);

CREATE INDEX IF NOT EXISTS idx_historico_ajustes_saldo_user_created
    ON public.historico_ajustes_saldo (user_id, created_at DESC);

-- ============================================================
-- 3. RLS e permissões restritivas da tabela
-- ============================================================

ALTER TABLE public.historico_ajustes_saldo
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
    "Users can view their own balance adjustment history"
    ON public.historico_ajustes_saldo;

CREATE POLICY "Users can view their own balance adjustment history"
    ON public.historico_ajustes_saldo
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Remover permissões anteriores, inclusive possíveis permissões
-- residuais de INSERT, UPDATE e DELETE.
REVOKE ALL PRIVILEGES
    ON TABLE public.historico_ajustes_saldo
    FROM PUBLIC, anon, authenticated;

GRANT SELECT
    ON TABLE public.historico_ajustes_saldo
    TO authenticated;

GRANT ALL PRIVILEGES
    ON TABLE public.historico_ajustes_saldo
    TO service_role;

-- ============================================================
-- 4. Remover a assinatura antiga de dois parâmetros
-- ============================================================

-- Se houver objetos dependentes desta função, o PostgreSQL
-- interromperá a transação em vez de removê-los em cascata.
DROP FUNCTION IF EXISTS
    public.registrar_ajuste_saldo(NUMERIC, NUMERIC);

-- A assinatura de um parâmetro será substituída abaixo.

-- ============================================================
-- 5. RPC transacional para registrar o ajuste
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_ajuste_saldo(
    p_saldo_informado NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_user_id UUID;

    v_saldo_ajuste_atual NUMERIC(14,2);
    v_saldo_calculado_sistema NUMERIC(14,2);
    v_saldo_anterior NUMERIC(14,2);
    v_valor_ajuste NUMERIC(14,2);
    v_novo_saldo_ajuste NUMERIC(14,2);

    v_saldo_informado NUMERIC(14,2);

    v_created_at TIMESTAMPTZ;
    v_historico_id UUID;

    v_rec NUMERIC(14,2);
    v_desp NUMERIC(14,2);
    v_inv NUMERIC(14,2);
BEGIN
    -- --------------------------------------------------------
    -- 5.1. Identificar o usuário autenticado
    -- --------------------------------------------------------

    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
            'Operação não permitida: usuário não autenticado.';
    END IF;

    -- --------------------------------------------------------
    -- 5.2. Validar o saldo informado
    -- NUMERIC(14,2): máximo de 12 dígitos inteiros e 2 decimais.
    -- --------------------------------------------------------

    IF p_saldo_informado IS NULL THEN
        RAISE EXCEPTION
            'O saldo informado não pode ser nulo.';
    END IF;

    IF p_saldo_informado = 'NaN'::NUMERIC THEN
        RAISE EXCEPTION
            'O saldo informado é inválido.';
    END IF;

    -- A comparação também rejeita Infinity e -Infinity.
    IF p_saldo_informado < -999999999999.99
       OR p_saldo_informado > 999999999999.99 THEN
        RAISE EXCEPTION
            'Saldo informado fora dos limites numéricos suportados.';
    END IF;

    -- Normalizar para duas casas decimais antes dos cálculos.
    v_saldo_informado := p_saldo_informado;

    -- --------------------------------------------------------
    -- 5.3. Bloquear o perfil para serializar ajustes simultâneos
    -- --------------------------------------------------------

    SELECT p.saldo_ajuste
      INTO v_saldo_ajuste_atual
      FROM public.profiles AS p
     WHERE p.id = v_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Perfil do usuário % não encontrado.',
            v_user_id;
    END IF;

    -- --------------------------------------------------------
    -- 5.4. Calcular o saldo do sistema no banco
    --
    -- Fórmula proposta:
    -- receitas recebidas - despesas pagas - investimentos ativos
    -- originados do saldo atual.
    -- --------------------------------------------------------

    -- Receitas recebidas
    SELECT COALESCE(SUM(r.valor), 0)
      INTO v_rec
      FROM public.receitas AS r
     WHERE r.user_id = v_user_id
       AND r.status = 'Recebida';

    -- Parcelas de despesas pagas
    SELECT COALESCE(SUM(dp.valor_parcela), 0)
      INTO v_desp
      FROM public.despesas_parcelas AS dp
      JOIN public.despesas AS d
        ON d.id = dp.despesa_id
     WHERE d.user_id = v_user_id
       AND dp.pago = TRUE;

    -- Investimentos ativos originados do saldo_atual
    SELECT COALESCE(SUM(i.valor), 0)
      INTO v_inv
      FROM public.investimentos AS i
     WHERE i.user_id = v_user_id
       AND (i.status = 'ativo' OR i.status IS NULL)
       AND i.origem_investimento = 'saldo_atual';

    v_saldo_calculado_sistema := v_rec - v_desp - v_inv;

    -- --------------------------------------------------------
    -- 5.5. Calcular o saldo anterior efetivo
    -- --------------------------------------------------------

    v_saldo_anterior :=
        v_saldo_calculado_sistema
        + COALESCE(v_saldo_ajuste_atual, 0);

    -- --------------------------------------------------------
    -- 5.6. Calcular o ajuste pontual e o novo offset acumulado
    -- --------------------------------------------------------

    v_valor_ajuste :=
        v_saldo_informado - v_saldo_anterior;

    v_novo_saldo_ajuste :=
        v_saldo_informado - v_saldo_calculado_sistema;

    -- Utilizar um único timestamp para todos os registros.
    v_created_at := clock_timestamp();

    -- --------------------------------------------------------
    -- 5.7. Registrar o ajuste individual
    -- --------------------------------------------------------

    INSERT INTO public.historico_ajustes_saldo (
        user_id,
        saldo_anterior,
        saldo_informado,
        valor_ajuste,
        created_at
    )
    VALUES (
        v_user_id,
        v_saldo_anterior,
        v_saldo_informado,
        v_valor_ajuste,
        v_created_at
    )
    RETURNING id INTO v_historico_id;

    -- --------------------------------------------------------
    -- 5.8. Atualizar o perfil na mesma transação
    -- --------------------------------------------------------

    UPDATE public.profiles
       SET saldo_ajuste = v_novo_saldo_ajuste,
           saldo_ajuste_updated_at = v_created_at,
           updated_at = v_created_at
     WHERE id = v_user_id;

    -- --------------------------------------------------------
    -- 5.9. Retornar o resultado da operação
    -- --------------------------------------------------------

    RETURN jsonb_build_object(
        'success', TRUE,
        'id', v_historico_id,
        'user_id', v_user_id,
        'saldo_anterior', v_saldo_anterior,
        'saldo_informado', v_saldo_informado,
        'valor_ajuste', v_valor_ajuste,
        'novo_saldo_ajuste', v_novo_saldo_ajuste,
        'created_at', v_created_at
    );
END;
$function$;

-- ============================================================
-- 6. Permissões restritivas da RPC
-- ============================================================

REVOKE ALL PRIVILEGES
    ON FUNCTION public.registrar_ajuste_saldo(NUMERIC)
    FROM PUBLIC, anon;

GRANT EXECUTE
    ON FUNCTION public.registrar_ajuste_saldo(NUMERIC)
    TO authenticated;

GRANT EXECUTE
    ON FUNCTION public.registrar_ajuste_saldo(NUMERIC)
    TO service_role;

COMMIT;
