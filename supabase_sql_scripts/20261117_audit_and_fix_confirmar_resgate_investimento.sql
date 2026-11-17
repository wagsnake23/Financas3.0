-- ==============================================================================
-- Script SQL para Execução Manual no SQL Editor do Supabase
-- Arquivo: supabase_sql_scripts/20261117_audit_and_fix_confirmar_resgate_investimento.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.confirmar_resgate_investimento(
  p_investimento_id uuid,
  p_tipo text,
  p_valor_liquido_solicitado numeric,
  p_valor_bruto_total numeric,
  p_rendimento_bruto_total numeric,
  p_ir_total numeric,
  p_valor_liquido_total numeric,
  p_alocacoes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
DECLARE
  v_user_id uuid;
  v_investimento record;
  v_resgate_id uuid;
  v_alocacao jsonb;
  v_aporte_consumo record;
  v_aloc_idx int;
  v_num_alocacoes int;

  -- Valores acumulados das alocações para validação de integridade mestre
  v_soma_principal_consumido numeric(15,2) := 0;
  v_soma_bruto numeric(15,2) := 0;
  v_soma_rendimento numeric(15,2) := 0;
  v_soma_ir numeric(15,2) := 0;
  v_soma_liquido numeric(15,2) := 0;

  -- Variáveis por alocação individual
  v_aloc_aporte_id uuid;
  v_aloc_principal numeric(15,2);
  v_aloc_bruto numeric(15,2);
  v_aloc_rendimento numeric(15,2);
  v_aloc_ir numeric(15,2);
  v_aloc_liquido numeric(15,2);
  v_aloc_aliquota numeric(7,4);

  -- Controle de saldo e encerramento
  v_saldo_principal_restante numeric(15,2);
  v_novo_status text := 'ativo';

  -- Cursor FIFO com bloqueio FOR UPDATE para garantir consistência sob concorrência
  c_fifo CURSOR FOR
    SELECT 
      ap.id,
      ap.investimento_id,
      ap.user_id,
      ap.valor_original,
      ap.data_aporte,
      ap.created_at,
      ROUND(ap.valor_original - COALESCE((
        SELECT SUM(ra.principal_consumido)
        FROM public.investimentos_resgates_aportes ra
        WHERE ra.aporte_id = ap.id
      ), 0), 2) AS saldo_disponivel
    FROM public.investimentos_aportes ap
    WHERE ap.investimento_id = p_investimento_id
    ORDER BY ap.data_aporte ASC, ap.created_at ASC, ap.id ASC
    FOR UPDATE;

BEGIN
  -- 1. Validar autenticação do usuário
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Operação não autorizada. Usuário não autenticado.';
  END IF;

  -- 2. Validar parâmetros básicos e tipo de resgate
  IF p_tipo IS NULL OR p_tipo NOT IN ('parcial', 'total') THEN
    RAISE EXCEPTION 'Tipo de resgate inválido: %. Permitido apenas "parcial" ou "total".', p_tipo;
  END IF;

  IF p_investimento_id IS NULL THEN
    RAISE EXCEPTION 'Identificador do investimento não pode ser nulo.';
  END IF;

  -- 3. Obter lock transacional no investimento e validar propriedade e status
  SELECT * INTO v_investimento
  FROM public.investimentos
  WHERE id = p_investimento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investimento % não encontrado.', p_investimento_id;
  END IF;

  IF v_investimento.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Investimento não pertence ao usuário autenticado.';
  END IF;

  IF v_investimento.status = 'resgatado' THEN
    RAISE EXCEPTION 'Este investimento já se encontra totalmente resgatado.';
  END IF;

  -- 4. Validar formato e presença de alocações JSON
  IF p_alocacoes IS NULL OR jsonb_typeof(p_alocacoes) <> 'array' THEN
    RAISE EXCEPTION 'Alocações inválidas ou não fornecidas para o resgate.';
  END IF;

  v_num_alocacoes := jsonb_array_length(p_alocacoes);
  IF v_num_alocacoes = 0 THEN
    RAISE EXCEPTION 'Nenhuma alocação de aporte foi informada para o resgate.';
  END IF;

  -- 5. Validar consistência financeira dos parâmetros gerais recebidos
  IF p_valor_liquido_solicitado IS NULL OR p_valor_liquido_solicitado <= 0 THEN
    RAISE EXCEPTION 'Valor líquido solicitado deve ser maior que zero.';
  END IF;

  IF p_valor_liquido_total IS NULL OR p_valor_liquido_total <= 0 THEN
    RAISE EXCEPTION 'Valor líquido total deve ser maior que zero.';
  END IF;

  IF p_valor_bruto_total IS NULL OR p_valor_bruto_total <= 0 THEN
    RAISE EXCEPTION 'Valor bruto total deve ser maior que zero.';
  END IF;

  IF p_rendimento_bruto_total IS NULL OR p_rendimento_bruto_total < 0 THEN
    RAISE EXCEPTION 'Rendimento bruto total não pode ser negativo ou nulo.';
  END IF;

  IF p_ir_total IS NULL OR p_ir_total < 0 THEN
    RAISE EXCEPTION 'IR total não pode ser negativo ou nulo.';
  END IF;

  IF p_valor_bruto_total < p_rendimento_bruto_total THEN
    RAISE EXCEPTION 'Valor bruto total (%) não pode ser inferior ao rendimento bruto (%).',
      p_valor_bruto_total, p_rendimento_bruto_total;
  END IF;

  -- Coerência da equação fundamental nos totais: Líquido = Bruto - IR (tolerância de R$ 0,02 para centavos)
  IF ABS((p_valor_bruto_total - p_ir_total) - p_valor_liquido_total) > 0.02 THEN
    RAISE EXCEPTION 'Incoerência financeira nos totais: Bruto (%) - IR (%) difere do Líquido (%).',
      p_valor_bruto_total, p_ir_total, p_valor_liquido_total;
  END IF;

  -- Coerência entre solicitado e entregue
  IF ABS(p_valor_liquido_solicitado - p_valor_liquido_total) > 0.02 THEN
    RAISE EXCEPTION 'Valor líquido solicitado (%) diverge do valor líquido total calculado (%).',
      p_valor_liquido_solicitado, p_valor_liquido_total;
  END IF;

  -- 6. Validação FIFO determinística e Consistência Individual de cada Alocação
  OPEN c_fifo;

  FOR v_aloc_idx IN 0 .. (v_num_alocacoes - 1)
  LOOP
    v_alocacao := p_alocacoes->v_aloc_idx;

    -- Validar existência dos campos obrigatórios no JSON
    IF v_alocacao->>'aporte_id' IS NULL OR
       v_alocacao->>'principal_consumido' IS NULL OR
       v_alocacao->>'valor_bruto_resgatado' IS NULL OR
       v_alocacao->>'rendimento_bruto' IS NULL OR
       v_alocacao->>'ir_retido' IS NULL OR
       v_alocacao->>'valor_liquido' IS NULL OR
       v_alocacao->>'aliquota_ir' IS NULL THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Alocação no índice % não contém todos os campos obrigatórios.', v_aloc_idx;
    END IF;

    BEGIN
      v_aloc_aporte_id := (v_alocacao->>'aporte_id')::uuid;
      v_aloc_principal := ROUND((v_alocacao->>'principal_consumido')::numeric, 2);
      v_aloc_bruto := ROUND((v_alocacao->>'valor_bruto_resgatado')::numeric, 2);
      v_aloc_rendimento := ROUND((v_alocacao->>'rendimento_bruto')::numeric, 2);
      v_aloc_ir := ROUND((v_alocacao->>'ir_retido')::numeric, 2);
      v_aloc_liquido := ROUND((v_alocacao->>'valor_liquido')::numeric, 2);
      v_aloc_aliquota := ROUND((v_alocacao->>'aliquota_ir')::numeric, 4);
    EXCEPTION WHEN OTHERS THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Falha ao converter campos numéricos da alocação no índice %: %', v_aloc_idx, SQLERRM;
    END;

    -- Validações de domínio financeiro por alocação
    IF v_aloc_principal <= 0 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Principal consumido deve ser maior que zero no aporte %.', v_aloc_aporte_id;
    END IF;

    IF v_aloc_bruto <= 0 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Valor bruto resgatado deve ser maior que zero no aporte %.', v_aloc_aporte_id;
    END IF;

    IF v_aloc_rendimento < 0 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Rendimento bruto não pode ser negativo no aporte %.', v_aloc_aporte_id;
    END IF;

    IF v_aloc_ir < 0 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'IR retido não pode ser negativo no aporte %.', v_aloc_aporte_id;
    END IF;

    IF v_aloc_liquido <= 0 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Valor líquido deve ser maior que zero no aporte %.', v_aloc_aporte_id;
    END IF;

    IF v_aloc_bruto < v_aloc_principal THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Valor bruto resgatado (%) menor que o principal consumido (%) no aporte %.',
        v_aloc_bruto, v_aloc_principal, v_aloc_aporte_id;
    END IF;

    IF v_aloc_aliquota < 0 OR v_aloc_aliquota > 1 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Alíquota de IR inválida (%) no aporte %. Deve estar entre 0 e 1.', v_aloc_aliquota, v_aloc_aporte_id;
    END IF;

    -- Equação interna da alocação: Bruto = Principal + Rendimento (tolerância de R$ 0,02 para centavos)
    IF ABS((v_aloc_principal + v_aloc_rendimento) - v_aloc_bruto) > 0.02 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Incoerência na alocação do aporte %: Principal (%) + Rendimento (%) difere de Bruto (%).',
        v_aloc_aporte_id, v_aloc_principal, v_aloc_rendimento, v_aloc_bruto;
    END IF;

    -- Equação interna da alocação: Líquido = Bruto - IR (tolerância de R$ 0,02 para centavos)
    IF ABS((v_aloc_bruto - v_aloc_ir) - v_aloc_liquido) > 0.02 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Incoerência na alocação do aporte %: Bruto (%) - IR (%) difere de Líquido (%).',
        v_aloc_aporte_id, v_aloc_bruto, v_aloc_ir, v_aloc_liquido;
    END IF;

    -- Buscar o próximo lote elegível no cursor FIFO
    LOOP
      FETCH c_fifo INTO v_aporte_consumo;
      IF NOT FOUND THEN
        CLOSE c_fifo;
        RAISE EXCEPTION 'Violação FIFO: mais alocações foram enviadas do que lotes com saldo disponíveis no banco.';
      END IF;
      -- Pular aportes já integralmente consumidos em resgates passados
      EXIT WHEN v_aporte_consumo.saldo_disponivel > 0.009;
    END LOOP;

    -- Validar que o lote pertence ao usuário autenticado e ao investimento
    IF v_aporte_consumo.user_id <> v_user_id OR v_aporte_consumo.investimento_id <> p_investimento_id THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Aporte % não pertence ao usuário ou ao investimento indicado.', v_aporte_consumo.id;
    END IF;

    -- Regra FIFO: O aporte alocado DEVE ser exatamente o próximo aporte cronológico com saldo
    IF v_aloc_aporte_id <> v_aporte_consumo.id THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Violação da regra FIFO no banco: o lote esperado pela ordem cronológica é % (data: %), mas foi recebido %.',
        v_aporte_consumo.id, v_aporte_consumo.data_aporte, v_aloc_aporte_id;
    END IF;

    -- Validação de saldo disponível no aporte
    IF v_aloc_principal > (v_aporte_consumo.saldo_disponivel + 0.01) THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Tentativa de consumir principal (%) superior ao saldo disponível (%) no aporte %.',
        v_aloc_principal, v_aporte_consumo.saldo_disponivel, v_aloc_aporte_id;
    END IF;

    -- Regra FIFO de esgotamento: Se existem lotes subsequentes nesta operação, o lote atual OBRIGATORIAMENTE deve ser esgotado
    IF v_aloc_idx < (v_num_alocacoes - 1) THEN
      IF (v_aporte_consumo.saldo_disponivel - v_aloc_principal) > 0.01 THEN
        CLOSE c_fifo;
        RAISE EXCEPTION 'Violação da regra FIFO: o lote % ainda possui saldo disponível (%) e deve ser totalmente esgotado antes de consumir o próximo lote.',
          v_aloc_aporte_id, (v_aporte_consumo.saldo_disponivel - v_aloc_principal);
      END IF;
    END IF;

    -- Acumular totais individuais para conferência
    v_soma_principal_consumido := v_soma_principal_consumido + v_aloc_principal;
    v_soma_bruto := v_soma_bruto + v_aloc_bruto;
    v_soma_rendimento := v_soma_rendimento + v_aloc_rendimento;
    v_soma_ir := v_soma_ir + v_aloc_ir;
    v_soma_liquido := v_soma_liquido + v_aloc_liquido;

  END LOOP;

  CLOSE c_fifo;

  -- 7. Validar soma das alocações contra os totais gerais informados (tolerância R$ 0,02 para arredondamentos)
  IF ABS(v_soma_bruto - p_valor_bruto_total) > 0.02 THEN
    RAISE EXCEPTION 'Soma dos valores brutos alocados (%) difere do valor bruto total informado (%).',
      v_soma_bruto, p_valor_bruto_total;
  END IF;

  IF ABS(v_soma_rendimento - p_rendimento_bruto_total) > 0.02 THEN
    RAISE EXCEPTION 'Soma dos rendimentos brutos alocados (%) difere do rendimento bruto total informado (%).',
      v_soma_rendimento, p_rendimento_bruto_total;
  END IF;

  IF ABS(v_soma_ir - p_ir_total) > 0.02 THEN
    RAISE EXCEPTION 'Soma do IR retido alocado (%) difere do IR total informado (%).',
      v_soma_ir, p_ir_total;
  END IF;

  IF ABS(v_soma_liquido - p_valor_liquido_total) > 0.02 THEN
    RAISE EXCEPTION 'Soma dos valores líquidos alocados (%) difere do valor líquido total informado (%).',
      v_soma_liquido, p_valor_liquido_total;
  END IF;

  -- 8. Calcular saldo de principal restante em todo o investimento após a operação
  SELECT (
    COALESCE(SUM(valor_original), 0) - COALESCE((
      SELECT SUM(ra.principal_consumido)
      FROM public.investimentos_resgates_aportes ra
      WHERE ra.investimento_id = p_investimento_id
    ), 0) - v_soma_principal_consumido
  ) INTO v_saldo_principal_restante
  FROM public.investimentos_aportes
  WHERE investimento_id = p_investimento_id;

  -- 9. Validação estrita de Resgate Total vs Parcial e Atualização de Status
  -- REGRA DE SEGURANÇA 1: p_tipo = 'total' NÃO é suficiente para encerrar.
  -- Exige-se que todo o principal tenha sido efetivamente consumido (<= 0.01).
  IF p_tipo = 'total' THEN
    IF v_saldo_principal_restante > 0.01 THEN
      RAISE EXCEPTION 'Resgate solicitado como "total", mas ainda restaria saldo disponível de principal (%) no investimento.',
        v_saldo_principal_restante;
    END IF;
    v_novo_status := 'resgatado';
  ELSE -- p_tipo = 'parcial'
    IF v_saldo_principal_restante <= 0.01 THEN
      -- Se o resgate parcial consumiu 100% do principal de todos os aportes restantes
      v_novo_status := 'resgatado';
    ELSE
      v_novo_status := 'ativo';
    END IF;
  END IF;

  -- O status 'resgatado' do investimento só é efetivado se todos os aportes tiverem sido consumidos
  IF v_novo_status = 'resgatado' THEN
    UPDATE public.investimentos
    SET status = 'resgatado',
        data_resgate = pg_catalog.now()
    WHERE id = p_investimento_id;
  END IF;

  -- 10. Persistência Atômica dos Registros Financeiros
  -- 10.1. Criar registro mestre de resgate
  INSERT INTO public.investimentos_resgates (
    investimento_id,
    user_id,
    data_resgate,
    tipo,
    valor_liquido_solicitado,
    valor_bruto_total,
    rendimento_bruto_total,
    ir_total,
    valor_liquido_total,
    is_legado
  ) VALUES (
    p_investimento_id,
    v_user_id,
    pg_catalog.now(),
    p_tipo,
    ROUND(p_valor_liquido_solicitado, 2),
    v_soma_bruto,
    v_soma_rendimento,
    v_soma_ir,
    v_soma_liquido,
    false
  ) RETURNING id INTO v_resgate_id;

  -- 10.2. Inserir alocações por aporte individual
  FOR v_aloc_idx IN 0 .. (v_num_alocacoes - 1)
  LOOP
    v_alocacao := p_alocacoes->v_aloc_idx;

    INSERT INTO public.investimentos_resgates_aportes (
      resgate_id,
      aporte_id,
      investimento_id,
      user_id,
      principal_consumido,
      valor_bruto_resgatado,
      rendimento_bruto,
      ir_retido,
      valor_liquido,
      aliquota_ir,
      is_legado
    ) VALUES (
      v_resgate_id,
      (v_alocacao->>'aporte_id')::uuid,
      p_investimento_id,
      v_user_id,
      ROUND((v_alocacao->>'principal_consumido')::numeric, 2),
      ROUND((v_alocacao->>'valor_bruto_resgatado')::numeric, 2),
      ROUND((v_alocacao->>'rendimento_bruto')::numeric, 2),
      ROUND((v_alocacao->>'ir_retido')::numeric, 2),
      ROUND((v_alocacao->>'valor_liquido')::numeric, 2),
      ROUND((v_alocacao->>'aliquota_ir')::numeric, 4),
      false
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'resgate_id', v_resgate_id,
    'novo_status', v_novo_status,
    'saldo_principal_restante', v_saldo_principal_restante,
    'total_liquido_alocado', v_soma_liquido,
    'total_principal_consumido', v_soma_principal_consumido
  );
END;
$$;

-- Permissões de Segurança Estritas
REVOKE ALL ON FUNCTION public.confirmar_resgate_investimento(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_resgate_investimento(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirmar_resgate_investimento(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_resgate_investimento(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb) TO service_role;
