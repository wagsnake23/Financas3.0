-- Script para execução no Supabase SQL Editor
-- Cria a tabela de histórico de ajustes manuais de saldo e a função transacional RPC atômica
-- Cálculo 100% derivado dos dados do banco no PostgreSQL, sem dependência de parâmetros de saldo calculados pelo cliente.

-- 1. Criar a tabela public.historico_ajustes_saldo
CREATE TABLE IF NOT EXISTS public.historico_ajustes_saldo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    saldo_anterior NUMERIC(14,2) NOT NULL,
    saldo_informado NUMERIC(14,2) NOT NULL,
    valor_ajuste NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comentários descritivos
COMMENT ON TABLE public.historico_ajustes_saldo IS 'Histórico individual de ajustes manuais de saldo realizados pelo usuário.';
COMMENT ON COLUMN public.historico_ajustes_saldo.saldo_anterior IS 'Saldo efetivo existente antes da aplicação do ajuste.';
COMMENT ON COLUMN public.historico_ajustes_saldo.saldo_informado IS 'Saldo real desejado e informado pelo usuário.';
COMMENT ON COLUMN public.historico_ajustes_saldo.valor_ajuste IS 'Diferença calculada (saldo_informado - saldo_anterior) que representa o ajuste pontual.';

-- 2. Índices de performance
CREATE INDEX IF NOT EXISTS idx_historico_ajustes_saldo_user_id 
    ON public.historico_ajustes_saldo(user_id);

CREATE INDEX IF NOT EXISTS idx_historico_ajustes_saldo_user_created 
    ON public.historico_ajustes_saldo(user_id, created_at DESC);

-- 3. Habilitar RLS e criar políticas de segurança restritivas
ALTER TABLE public.historico_ajustes_saldo ENABLE ROW LEVEL SECURITY;

-- Política de leitura: cada usuário autenticado consulta apenas o seu próprio histórico
DROP POLICY IF EXISTS "Users can view their own balance adjustment history" ON public.historico_ajustes_saldo;
CREATE POLICY "Users can view their own balance adjustment history"
    ON public.historico_ajustes_saldo
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Permissões de tabela: apenas SELECT para authenticated (sem UPDATE ou DELETE)
GRANT SELECT ON TABLE public.historico_ajustes_saldo TO authenticated;
GRANT ALL ON TABLE public.historico_ajustes_saldo TO service_role;

-- 4. Remoção de assinaturas anteriores para prevenir sobrecargas desnecessárias
DROP FUNCTION IF EXISTS public.registrar_ajuste_saldo(NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.registrar_ajuste_saldo(NUMERIC);

-- 5. Função Transacional RPC: public.registrar_ajuste_saldo
-- Executa na mesma transação atômica a inserção do histórico e a atualização de profiles.saldo_ajuste.
-- O cálculo de saldoCalculadoSistema é feito de forma 100% autônoma e segura no banco de dados.
CREATE OR REPLACE FUNCTION public.registrar_ajuste_saldo(
    p_saldo_informado NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_saldo_ajuste_atual NUMERIC(14,2);
    v_saldo_calculado_sistema NUMERIC(14,2);
    v_saldo_anterior NUMERIC(14,2);
    v_valor_ajuste NUMERIC(14,2);
    v_novo_saldo_ajuste NUMERIC(14,2);
    v_created_at TIMESTAMPTZ;
    v_historico_id UUID;
    v_rec NUMERIC(14,2);
    v_desp NUMERIC(14,2);
    v_inv NUMERIC(14,2);
BEGIN
    -- 1. Identificar usuário autenticado via JWT
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Usuário não autenticado.';
    END IF;

    -- 2. Validações numéricas de segurança
    IF p_saldo_informado IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: Saldo informado não pode ser nulo.';
    END IF;

    IF p_saldo_informado = 'NaN'::numeric THEN
        RAISE EXCEPTION 'Operação não permitida: Saldo informado inválido (NaN).';
    END IF;

    IF p_saldo_informado < -999999999999.99 OR p_saldo_informado > 999999999999.99 THEN
        RAISE EXCEPTION 'Operação não permitida: Saldo informado fora dos limites numéricos suportados.';
    END IF;

    -- 3. Concorrência: Bloqueia a linha do perfil do usuário para atualização exclusiva na transação
    SELECT saldo_ajuste
    INTO v_saldo_ajuste_atual
    FROM public.profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil do usuário % não encontrado.', v_user_id;
    END IF;

    -- 4. Cálculo autônomo do saldoCalculadoSistema no banco
    -- Fórmula SSOT idêntica à de Home.tsx e Dashboard.tsx:
    -- saldoCalculadoSistema = globalReceivedIncome - globalPaidExpenses - currentActiveInvestments

    -- a) Receitas recebidas globais
    SELECT COALESCE(SUM(valor), 0)
    INTO v_rec
    FROM public.receitas
    WHERE user_id = v_user_id AND status = 'Recebida';

    -- b) Despesas parcelas pagas globais
    SELECT COALESCE(SUM(dp.valor_parcela), 0)
    INTO v_desp
    FROM public.despesas_parcelas dp
    JOIN public.despesas d ON dp.despesa_id = d.id
    WHERE d.user_id = v_user_id AND dp.pago = true;

    -- c) Investimentos ativos originados do saldo_atual
    SELECT COALESCE(SUM(valor), 0)
    INTO v_inv
    FROM public.investimentos
    WHERE user_id = v_user_id 
      AND (status = 'ativo' OR status IS NULL)
      AND origem_investimento = 'saldo_atual';

    v_saldo_calculado_sistema := v_rec - v_desp - v_inv;

    -- 5. Calcular o saldo anterior efetivo (saldoCalculadoSistema + saldo_ajuste atual)
    v_saldo_anterior := v_saldo_calculado_sistema + COALESCE(v_saldo_ajuste_atual, 0);

    -- 6. Calcular a variação individual do ajuste atual
    v_valor_ajuste := p_saldo_informado - v_saldo_anterior;

    -- 7. Calcular o novo saldo_ajuste acumulado a ser persistido no perfil (saldo_informado - saldoCalculadoSistema)
    v_novo_saldo_ajuste := p_saldo_informado - v_saldo_calculado_sistema;

    v_created_at := now();

    -- 8. Inserir registro individual no histórico
    INSERT INTO public.historico_ajustes_saldo (
        user_id,
        saldo_anterior,
        saldo_informado,
        valor_ajuste,
        created_at
    ) VALUES (
        v_user_id,
        v_saldo_anterior,
        p_saldo_informado,
        v_valor_ajuste,
        v_created_at
    )
    RETURNING id INTO v_historico_id;

    -- 9. Atualizar o profile com o novo saldo_ajuste e timestamp na mesma transação
    UPDATE public.profiles
    SET 
        saldo_ajuste = v_novo_saldo_ajuste,
        saldo_ajuste_updated_at = v_created_at,
        updated_at = v_created_at
    WHERE id = v_user_id;

    -- 10. Retornar payload com o resultado atômico
    RETURN jsonb_build_object(
        'success', true,
        'id', v_historico_id,
        'user_id', v_user_id,
        'saldo_anterior', v_saldo_anterior,
        'saldo_informado', p_saldo_informado,
        'valor_ajuste', v_valor_ajuste,
        'novo_saldo_ajuste', v_novo_saldo_ajuste,
        'created_at', v_created_at
    );
END;
$$;

-- 6. Permissões estritas da RPC
REVOKE ALL ON FUNCTION public.registrar_ajuste_saldo(NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_ajuste_saldo(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_ajuste_saldo(NUMERIC) TO service_role;
