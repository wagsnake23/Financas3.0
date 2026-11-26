-- ============================================================
-- MIGRATION: 20261119213500_update_registrar_ajuste_saldo_v2.sql
-- Substituição segura da RPC registrar_ajuste_saldo
-- ============================================================

-- 1. Remoção segura das assinaturas anteriores para evitar sobrecarga (overloading)
DROP FUNCTION IF EXISTS public.registrar_ajuste_saldo(NUMERIC);
DROP FUNCTION IF EXISTS public.registrar_ajuste_saldo(NUMERIC, NUMERIC);

-- 2. Criação da nova função com busca segura e validação completa
CREATE OR REPLACE FUNCTION public.registrar_ajuste_saldo(
    p_saldo_informado NUMERIC,
    p_saldo_calculado_sistema NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
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
    -- 1. Identificar o usuário autenticado
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operação não permitida: usuário não autenticado.';
    END IF;

    -- 2. Validar p_saldo_informado
    IF p_saldo_informado IS NULL THEN
        RAISE EXCEPTION 'O saldo informado não pode ser nulo.';
    END IF;

    IF p_saldo_informado = 'NaN'::NUMERIC THEN
        RAISE EXCEPTION 'O saldo informado é inválido.';
    END IF;

    IF p_saldo_informado < -999999999999.99 OR p_saldo_informado > 999999999999.99 THEN
        RAISE EXCEPTION 'Saldo informado fora dos limites numéricos suportados.';
    END IF;

    v_saldo_informado := ROUND(p_saldo_informado, 2);

    -- 3. Validar p_saldo_calculado_sistema (se fornecido)
    IF p_saldo_calculado_sistema IS NOT NULL THEN
        IF p_saldo_calculado_sistema = 'NaN'::NUMERIC THEN
            RAISE EXCEPTION 'O saldo calculado do sistema é inválido.';
        END IF;

        IF p_saldo_calculado_sistema < -999999999999.99 OR p_saldo_calculado_sistema > 999999999999.99 THEN
            RAISE EXCEPTION 'Saldo calculado do sistema fora dos limites numéricos suportados.';
        END IF;

        v_saldo_calculado_sistema := ROUND(p_saldo_calculado_sistema, 2);
    END IF;

    -- 4. Bloquear o perfil para serializar ajustes simultâneos
    SELECT p.saldo_ajuste
      INTO v_saldo_ajuste_atual
      FROM public.profiles AS p
     WHERE p.id = v_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil do usuário % não encontrado.', v_user_id;
    END IF;

    -- 5. Se o saldo do sistema não foi enviado pelo frontend, calcular no banco de forma híbrida (legado + FIFO)
    IF v_saldo_calculado_sistema IS NULL THEN
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
          JOIN public.despesas AS d ON d.id = dp.despesa_id
         WHERE d.user_id = v_user_id
           AND dp.pago = TRUE;

        -- Investimentos ativos originados de saldo_atual (cobre aportes FIFO e legado)
        SELECT COALESCE(SUM(
            CASE 
                WHEN ap_summary.total_aportes IS NOT NULL THEN
                    GREATEST(0, ap_summary.total_aportes - COALESCE(ra_summary.total_resgates, 0))
                ELSE
                    COALESCE(i.valor, 0)
            END
        ), 0)
          INTO v_inv
          FROM public.investimentos AS i
          LEFT JOIN (
              SELECT ap.investimento_id, SUM(ap.valor_original) AS total_aportes
              FROM public.investimentos_aportes ap
              WHERE ap.user_id = v_user_id
              GROUP BY ap.investimento_id
          ) ap_summary ON ap_summary.investimento_id = i.id
          LEFT JOIN (
              SELECT ra.investimento_id, SUM(ra.principal_consumido) AS total_resgates
              FROM public.investimentos_resgates_aportes ra
              WHERE ra.user_id = v_user_id
              GROUP BY ra.investimento_id
          ) ra_summary ON ra_summary.investimento_id = i.id
         WHERE i.user_id = v_user_id
           AND (i.status = 'ativo' OR i.status IS NULL)
           AND i.origem_investimento = 'saldo_atual';

        v_saldo_calculado_sistema := v_rec - v_desp - v_inv;
    END IF;

    -- 6. Calcular o saldo anterior efetivo
    v_saldo_anterior := v_saldo_calculado_sistema + COALESCE(v_saldo_ajuste_atual, 0);

    -- 7. Calcular o ajuste pontual e o novo offset acumulado
    v_valor_ajuste := v_saldo_informado - v_saldo_anterior;
    v_novo_saldo_ajuste := v_saldo_informado - v_saldo_calculado_sistema;

    v_created_at := clock_timestamp();

    -- 8. Registrar no histórico de ajustes
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

    -- 9. Atualizar o perfil com o novo offset de ajuste
    UPDATE public.profiles
       SET saldo_ajuste = v_novo_saldo_ajuste,
           saldo_ajuste_updated_at = v_created_at,
           updated_at = v_created_at
     WHERE id = v_user_id;

    -- 10. Retornar os dados consolidados da operação
    RETURN jsonb_build_object(
        'success', TRUE,
        'id', v_historico_id,
        'user_id', v_user_id,
        'saldo_anterior', v_saldo_anterior,
        'saldo_informado', v_saldo_informado,
        'valor_ajuste', v_valor_ajuste,
        'novo_saldo_ajuste', v_novo_saldo_ajuste,
        'saldo_calculado_sistema', v_saldo_calculado_sistema,
        'created_at', v_created_at
    );
END;
$function$;

-- 3. Permissões
REVOKE ALL PRIVILEGES ON FUNCTION public.registrar_ajuste_saldo(NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ajuste_saldo(NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_ajuste_saldo(NUMERIC, NUMERIC) TO service_role;
