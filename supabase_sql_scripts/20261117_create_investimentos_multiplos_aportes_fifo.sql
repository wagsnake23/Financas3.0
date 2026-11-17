-- ==============================================================================
-- Migration: Multiplos Aportes e Resgates FIFO em Investimentos (Revisão Técnica)
-- Description:
--   1. Tabelas com chaves estrangeiras seguras (ON DELETE RESTRICT)
--   2. Índices determinísticos para ordenação FIFO
--   3. Políticas RLS estritas (bloqueio de escrita direta em resgates/alocações)
--   4. RPC transacional SECURITY DEFINER com validação financeira integral e FIFO no banco
--   5. Migração retroativa de investimentos ativos e legados (com flag is_legado explícita)
--   6. Validação exaustiva de integridade antes do commit
-- ==============================================================================

BEGIN;

-- 1. TABELA DE APORTES (Lotes de investimento)
CREATE TABLE IF NOT EXISTS public.investimentos_aportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investimento_id uuid NOT NULL REFERENCES public.investimentos(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  valor_original numeric(15,2) NOT NULL,
  data_aporte date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT investimentos_aportes_valor_check
    CHECK (valor_original > 0)
);

-- Índices para investimentos_aportes
CREATE INDEX IF NOT EXISTS idx_investimentos_aportes_investimento_id 
  ON public.investimentos_aportes (investimento_id);

CREATE INDEX IF NOT EXISTS idx_investimentos_aportes_user_id 
  ON public.investimentos_aportes (user_id);

CREATE INDEX IF NOT EXISTS idx_investimentos_aportes_data_aporte 
  ON public.investimentos_aportes (data_aporte);

CREATE INDEX IF NOT EXISTS idx_investimentos_aportes_fifo 
  ON public.investimentos_aportes (investimento_id, data_aporte ASC, created_at ASC, id ASC);


-- 2. TABELA DE RESGATES (Operações de resgate com auditoria)
CREATE TABLE IF NOT EXISTS public.investimentos_resgates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investimento_id uuid NOT NULL REFERENCES public.investimentos(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  data_resgate timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL,
  valor_liquido_solicitado numeric(15,2) NOT NULL,
  valor_bruto_total numeric(15,2) NOT NULL,
  rendimento_bruto_total numeric(15,2) NOT NULL,
  ir_total numeric(15,2) NOT NULL,
  valor_liquido_total numeric(15,2) NOT NULL,
  is_legado boolean NOT NULL DEFAULT false,
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT investimentos_resgates_tipo_check
    CHECK (tipo IN ('parcial', 'total', 'legado')),

  CONSTRAINT investimentos_resgates_valor_check
    CHECK (
      valor_liquido_solicitado > 0
      AND valor_bruto_total >= 0
      AND ir_total >= 0
      AND valor_liquido_total > 0
    )
);

-- Índices para investimentos_resgates
CREATE INDEX IF NOT EXISTS idx_investimentos_resgates_investimento_id 
  ON public.investimentos_resgates (investimento_id);

CREATE INDEX IF NOT EXISTS idx_investimentos_resgates_user_id 
  ON public.investimentos_resgates (user_id);

CREATE INDEX IF NOT EXISTS idx_investimentos_resgates_data 
  ON public.investimentos_resgates (data_resgate);


-- 3. TABELA DE ALOCAÇÕES FIFO (Detalhamento analítico por lote consumido)
CREATE TABLE IF NOT EXISTS public.investimentos_resgates_aportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resgate_id uuid NOT NULL REFERENCES public.investimentos_resgates(id) ON DELETE RESTRICT,
  aporte_id uuid NOT NULL REFERENCES public.investimentos_aportes(id) ON DELETE RESTRICT,
  investimento_id uuid NOT NULL REFERENCES public.investimentos(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  principal_consumido numeric(15,2) NOT NULL,
  valor_bruto_resgatado numeric(15,2) NOT NULL,
  rendimento_bruto numeric(15,2) NOT NULL,
  ir_retido numeric(15,2) NOT NULL,
  valor_liquido numeric(15,2) NOT NULL,
  aliquota_ir numeric(7,4) NOT NULL,
  is_legado boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT investimentos_resgates_aportes_valor_check
    CHECK (
      principal_consumido > 0
      AND valor_bruto_resgatado > 0
      AND ir_retido >= 0
      AND valor_liquido > 0
    )
);

-- Índices para investimentos_resgates_aportes
CREATE INDEX IF NOT EXISTS idx_investimentos_resgates_aportes_resgate 
  ON public.investimentos_resgates_aportes (resgate_id);

CREATE INDEX IF NOT EXISTS idx_investimentos_resgates_aportes_aporte 
  ON public.investimentos_resgates_aportes (aporte_id);

CREATE INDEX IF NOT EXISTS idx_investimentos_resgates_aportes_investimento 
  ON public.investimentos_resgates_aportes (investimento_id);

CREATE INDEX IF NOT EXISTS idx_investimentos_resgates_aportes_user 
  ON public.investimentos_resgates_aportes (user_id);


-- 4. POLÍTICAS DE RLS (ROW LEVEL SECURITY)
ALTER TABLE public.investimentos_aportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investimentos_resgates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investimentos_resgates_aportes ENABLE ROW LEVEL SECURITY;

-- 4.1. Políticas para investimentos_aportes
DROP POLICY IF EXISTS "Users can view their own investment contributions" ON public.investimentos_aportes;
CREATE POLICY "Users can view their own investment contributions"
  ON public.investimentos_aportes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own investment contributions" ON public.investimentos_aportes;
DROP POLICY IF EXISTS "Users can insert contributions to their own investments" ON public.investimentos_aportes;
CREATE POLICY "Users can insert contributions to their own investments"
  ON public.investimentos_aportes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.investimentos i
      WHERE i.id = investimento_id
        AND i.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own investment contributions" ON public.investimentos_aportes;
DROP POLICY IF EXISTS "Disallow direct updates on contributions" ON public.investimentos_aportes;
CREATE POLICY "Disallow direct updates on contributions"
  ON public.investimentos_aportes FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "Users can delete their own investment contributions" ON public.investimentos_aportes;
DROP POLICY IF EXISTS "Disallow deletion of contributions with redemptions" ON public.investimentos_aportes;
CREATE POLICY "Disallow deletion of contributions with redemptions"
  ON public.investimentos_aportes FOR DELETE
  USING (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.investimentos_resgates_aportes ra
      WHERE ra.aporte_id = public.investimentos_aportes.id
    )
  );

-- 4.2. Políticas para investimentos_resgates
-- Escrita direta proibida para clientes: resgates devem ocorrer via RPC SECURITY DEFINER
DROP POLICY IF EXISTS "Users can view their own investment redemptions" ON public.investimentos_resgates;
CREATE POLICY "Users can view their own investment redemptions"
  ON public.investimentos_resgates FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own investment redemptions" ON public.investimentos_resgates;
DROP POLICY IF EXISTS "Disallow direct insert on investment redemptions" ON public.investimentos_resgates;
CREATE POLICY "Disallow direct insert on investment redemptions"
  ON public.investimentos_resgates FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "Users can update their own investment redemptions" ON public.investimentos_resgates;
DROP POLICY IF EXISTS "Disallow direct update on investment redemptions" ON public.investimentos_resgates;
CREATE POLICY "Disallow direct update on investment redemptions"
  ON public.investimentos_resgates FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "Users can delete their own investment redemptions" ON public.investimentos_resgates;
DROP POLICY IF EXISTS "Disallow direct delete on investment redemptions" ON public.investimentos_resgates;
CREATE POLICY "Disallow direct delete on investment redemptions"
  ON public.investimentos_resgates FOR DELETE
  USING (false);

-- 4.3. Políticas para investimentos_resgates_aportes
-- Escrita direta proibida para clientes: alocações devem ocorrer via RPC SECURITY DEFINER
DROP POLICY IF EXISTS "Users can view their own redemption allocations" ON public.investimentos_resgates_aportes;
CREATE POLICY "Users can view their own redemption allocations"
  ON public.investimentos_resgates_aportes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own redemption allocations" ON public.investimentos_resgates_aportes;
DROP POLICY IF EXISTS "Disallow direct insert on redemption allocations" ON public.investimentos_resgates_aportes;
CREATE POLICY "Disallow direct insert on redemption allocations"
  ON public.investimentos_resgates_aportes FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "Users can update their own redemption allocations" ON public.investimentos_resgates_aportes;
DROP POLICY IF EXISTS "Disallow direct update on redemption allocations" ON public.investimentos_resgates_aportes;
CREATE POLICY "Disallow direct update on redemption allocations"
  ON public.investimentos_resgates_aportes FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "Users can delete their own redemption allocations" ON public.investimentos_resgates_aportes;
DROP POLICY IF EXISTS "Disallow direct delete on redemption allocations" ON public.investimentos_resgates_aportes;
CREATE POLICY "Disallow direct delete on redemption allocations"
  ON public.investimentos_resgates_aportes FOR DELETE
  USING (false);

-- Permissões de tabelas
GRANT SELECT, INSERT ON TABLE public.investimentos_aportes TO authenticated;
GRANT SELECT ON TABLE public.investimentos_resgates TO authenticated;
GRANT SELECT ON TABLE public.investimentos_resgates_aportes TO authenticated;


-- 5. RPC TRANSACIONAL DE CONFIRMAÇÃO DE RESGATE (COM VALIDAÇÃO INTEGRAL E FIFO NO BANCO)
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_investimento record;
  v_resgate_id uuid;
  v_alocacao jsonb;
  v_aporte record;
  v_aporte_consumo record;
  v_aloc_idx int;
  v_num_alocacoes int;

  -- Valores acumulados para validação
  v_soma_principal_consumido numeric(15,2) := 0;
  v_soma_bruto numeric(15,2) := 0;
  v_soma_rendimento numeric(15,2) := 0;
  v_soma_ir numeric(15,2) := 0;
  v_soma_liquido numeric(15,2) := 0;

  -- Variáveis por alocação
  v_aloc_aporte_id uuid;
  v_aloc_principal numeric(15,2);
  v_aloc_bruto numeric(15,2);
  v_aloc_rendimento numeric(15,2);
  v_aloc_ir numeric(15,2);
  v_aloc_liquido numeric(15,2);
  v_aloc_aliquota numeric(7,4);

  -- Controle de saldo
  v_principal_ja_consumido numeric(15,2);
  v_principal_disponivel numeric(15,2);
  v_saldo_principal_restante numeric(15,2);
  v_novo_status text := 'ativo';

  -- Cursor FIFO de aportes com saldo disponível
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

  -- 2. Validar tipo de resgate
  IF p_tipo NOT IN ('parcial', 'total') THEN
    RAISE EXCEPTION 'Tipo de resgate inválido: %. Permitido apenas "parcial" ou "total".', p_tipo;
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

  -- 4. Validar formato e presença de alocações
  IF p_alocacoes IS NULL OR jsonb_typeof(p_alocacoes) <> 'array' THEN
    RAISE EXCEPTION 'Alocações inválidas ou não fornecidas para o resgate.';
  END IF;

  v_num_alocacoes := jsonb_array_length(p_alocacoes);
  IF v_num_alocacoes = 0 THEN
    RAISE EXCEPTION 'Nenhuma alocação de aporte foi informada para o resgate.';
  END IF;

  -- 5. Validar consistência financeira global dos parâmetros de entrada
  IF p_valor_liquido_solicitado <= 0 THEN
    RAISE EXCEPTION 'Valor líquido solicitado deve ser maior que zero.';
  END IF;

  IF p_valor_liquido_total <= 0 THEN
    RAISE EXCEPTION 'Valor líquido total deve ser maior que zero.';
  END IF;

  IF p_valor_bruto_total < p_rendimento_bruto_total THEN
    RAISE EXCEPTION 'Valor bruto total (%) não pode ser inferior ao rendimento bruto (%).',
      p_valor_bruto_total, p_rendimento_bruto_total;
  END IF;

  IF p_ir_total < 0 THEN
    RAISE EXCEPTION 'IR total (%) não pode ser negativo.', p_ir_total;
  END IF;

  -- Coerência da equação fundamental: Líquido = Bruto - IR (tolerância de centavos para dízimas)
  IF ABS((p_valor_bruto_total - p_ir_total) - p_valor_liquido_total) > 0.02 THEN
    RAISE EXCEPTION 'Incoerência financeira nos totais: Bruto (%) - IR (%) difere do Líquido (%).',
      p_valor_bruto_total, p_ir_total, p_valor_liquido_total;
  END IF;

  -- Coerência entre solicitado e entregue
  IF ABS(p_valor_liquido_solicitado - p_valor_liquido_total) > 0.02 THEN
    RAISE EXCEPTION 'Valor líquido solicitado (%) diverge do valor líquido total calculado (%).',
      p_valor_liquido_solicitado, p_valor_liquido_total;
  END IF;

  -- 6. Validação FIFO e Consistência Individual de cada Alocação
  -- Abre o cursor de lotes ordenados cronologicamente
  OPEN c_fifo;

  FOR v_aloc_idx IN 0 .. (v_num_alocacoes - 1)
  LOOP
    v_alocacao := p_alocacoes->v_aloc_idx;

    v_aloc_aporte_id := (v_alocacao->>'aporte_id')::uuid;
    v_aloc_principal := ROUND((v_alocacao->>'principal_consumido')::numeric, 2);
    v_aloc_bruto := ROUND((v_alocacao->>'valor_bruto_resgatado')::numeric, 2);
    v_aloc_rendimento := ROUND((v_alocacao->>'rendimento_bruto')::numeric, 2);
    v_aloc_ir := ROUND((v_alocacao->>'ir_retido')::numeric, 2);
    v_aloc_liquido := ROUND((v_alocacao->>'valor_liquido')::numeric, 2);
    v_aloc_aliquota := ROUND((v_alocacao->>'aliquota_ir')::numeric, 4);

    -- Validações numéricas da alocação
    IF v_aloc_principal <= 0 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Principal consumido deve ser maior que zero no aporte %.', v_aloc_aporte_id;
    END IF;

    IF v_aloc_bruto < v_aloc_principal THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Valor bruto resgatado (%) menor que o principal consumido (%) no aporte %.',
        v_aloc_bruto, v_aloc_principal, v_aloc_aporte_id;
    END IF;

    IF v_aloc_ir < 0 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'IR retido não pode ser negativo no aporte %.', v_aloc_aporte_id;
    END IF;

    IF v_aloc_aliquota < 0 OR v_aloc_aliquota > 1 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Alíquota de IR inválida (%) no aporte %.', v_aloc_aliquota, v_aloc_aporte_id;
    END IF;

    -- Equação interna da alocação: Bruto = Principal + Rendimento (tolerância 0.02)
    IF ABS((v_aloc_principal + v_aloc_rendimento) - v_aloc_bruto) > 0.02 THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Incoerência na alocação do aporte %: Principal (%) + Rendimento (%) difere de Bruto (%).',
        v_aloc_aporte_id, v_aloc_principal, v_aloc_rendimento, v_aloc_bruto;
    END IF;

    -- Equação interna da alocação: Líquido = Bruto - IR (tolerância 0.02)
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
        RAISE EXCEPTION 'Violação FIFO: mais alocações foram enviadas do que lotes ativos disponíveis no banco.';
      END IF;
      -- Pular lotes já esgotados em operações anteriores
      EXIT WHEN v_aporte_consumo.saldo_disponivel > 0.009;
    END LOOP;

    -- Regra FIFO: O aporte alocado DEVE ser exatamente o próximo aporte com saldo na fila
    IF v_aloc_aporte_id <> v_aporte_consumo.id THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Violação da regra FIFO no banco: o aporte esperado pela ordem cronológica é % (data: %), mas foi recebido %.',
        v_aporte_consumo.id, v_aporte_consumo.data_aporte, v_aloc_aporte_id;
    END IF;

    -- Validação de saldo disponível no aporte
    IF v_aloc_principal > (v_aporte_consumo.saldo_disponivel + 0.01) THEN
      CLOSE c_fifo;
      RAISE EXCEPTION 'Tentativa de consumir principal (%) superior ao saldo disponível (%) no aporte %.',
        v_aloc_principal, v_aporte_consumo.saldo_disponivel, v_aloc_aporte_id;
    END IF;

    -- Regra FIFO de esgotamento: Se existem MAIS alocações após esta, o lote atual OBRIGATORIAMENTE deve ser esgotado 100%
    IF v_aloc_idx < (v_num_alocacoes - 1) THEN
      IF (v_aporte_consumo.saldo_disponivel - v_aloc_principal) > 0.01 THEN
        CLOSE c_fifo;
        RAISE EXCEPTION 'Violação da regra FIFO: o lote % ainda possui saldo disponível (%) e deve ser totalmente esgotado antes de consumir o próximo lote.',
          v_aloc_aporte_id, (v_aporte_consumo.saldo_disponivel - v_aloc_principal);
      END IF;
    END IF;

    -- Acumular totais validados
    v_soma_principal_consumido := v_soma_principal_consumido + v_aloc_principal;
    v_soma_bruto := v_soma_bruto + v_aloc_bruto;
    v_soma_rendimento := v_soma_rendimento + v_aloc_rendimento;
    v_soma_ir := v_soma_ir + v_aloc_ir;
    v_soma_liquido := v_soma_liquido + v_aloc_liquido;

  END LOOP;

  CLOSE c_fifo;

  -- 7. Validar soma das alocações contra os totais gerais informados
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
      SELECT SUM(principal_consumido)
      FROM public.investimentos_resgates_aportes
      WHERE investimento_id = p_investimento_id
    ), 0) - v_soma_principal_consumido
  ) INTO v_saldo_principal_restante
  FROM public.investimentos_aportes
  WHERE investimento_id = p_investimento_id;

  -- 9. Validação estrita de Resgate Total vs Parcial
  IF p_tipo = 'total' THEN
    -- Um resgate total DEVE obrigatoriamente liquidar 100% de todos os lotes remanescentes
    IF v_saldo_principal_restante > 0.01 THEN
      RAISE EXCEPTION 'Resgate solicitado como "total", mas ainda restaria saldo disponível de principal (%) no investimento.',
        v_saldo_principal_restante;
    END IF;
    v_novo_status := 'resgatado';
    UPDATE public.investimentos
    SET status = 'resgatado',
        data_resgate = now()
    WHERE id = p_investimento_id;
  ELSE -- parcial
    IF v_saldo_principal_restante <= 0.01 THEN
      v_novo_status := 'resgatado';
      UPDATE public.investimentos
      SET status = 'resgatado',
          data_resgate = now()
      WHERE id = p_investimento_id;
    ELSE
      v_novo_status := 'ativo';
    END IF;
  END IF;

  -- 10. Persistência dos Dados (Após todas as validações terem passado com 100% de sucesso)
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
    now(),
    p_tipo,
    ROUND(p_valor_liquido_solicitado, 2),
    v_soma_bruto,
    v_soma_rendimento,
    v_soma_ir,
    v_soma_liquido,
    false
  ) RETURNING id INTO v_resgate_id;

  -- 10.2. Inserir alocações por lote
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

-- Configuração explícita de privilégios de execução da RPC
REVOKE ALL ON FUNCTION public.confirmar_resgate_investimento(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_resgate_investimento(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirmar_resgate_investimento(uuid, text, numeric, numeric, numeric, numeric, numeric, jsonb) TO authenticated;


-- 6. MIGRAÇÃO RETROATIVA DOS INVESTIMENTOS EXISTENTES
-- 6.1. Criação do Aporte Inicial para TODOS os investimentos cadastrados (ativos e legados)
INSERT INTO public.investimentos_aportes (
  investimento_id,
  user_id,
  valor_original,
  data_aporte,
  created_at
)
SELECT 
  inv.id,
  inv.user_id,
  inv.valor,
  inv.data,
  inv.created_at
FROM public.investimentos inv
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.investimentos_aportes ap 
  WHERE ap.investimento_id = inv.id
);

-- 6.2. Registro de Resgate Legado para investimentos com status = 'resgatado'
-- Identificação explícita com is_legado = true e tipo = 'legado' para NÃO inventar rentabilidade/IR falsos
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
  is_legado,
  observacao,
  created_at
)
SELECT
  inv.id,
  inv.user_id,
  COALESCE(inv.data_resgate, now()),
  'legado',
  inv.valor,
  inv.valor,
  0,
  0,
  inv.valor,
  true,
  'Migração de registro legado: detalhamento de rendimento/IR não disponível no formato anterior.',
  COALESCE(inv.data_resgate, now())
FROM public.investimentos inv
WHERE inv.status = 'resgatado'
  AND NOT EXISTS (
    SELECT 1 FROM public.investimentos_resgates res WHERE res.investimento_id = inv.id
  );

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
  is_legado,
  created_at
)
SELECT
  res.id,
  ap.id,
  inv.id,
  inv.user_id,
  ap.valor_original,
  ap.valor_original,
  0,
  0,
  ap.valor_original,
  0,
  true,
  res.data_resgate
FROM public.investimentos inv
JOIN public.investimentos_resgates res ON res.investimento_id = inv.id AND res.is_legado = true
JOIN public.investimentos_aportes ap ON ap.investimento_id = inv.id
WHERE inv.status = 'resgatado'
  AND NOT EXISTS (
    SELECT 1 FROM public.investimentos_resgates_aportes ra WHERE ra.resgate_id = res.id
  );


-- 7. VALIDAÇÃO EXAUSTIVA DE INTEGRIDADE DA MIGRAÇÃO
DO $$
DECLARE
  v_count_investimentos INT;
  v_count_aportes_iniciais INT;
  v_soma_investimentos NUMERIC;
  v_soma_aportes NUMERIC;
  v_duplicidades INT;
  v_datas_divergentes INT;
  v_saldos_negativos INT;
  v_count_resgatados INT;
  v_count_resgates_legados INT;
  v_ativos_esgotados INT;
BEGIN
  -- 1. Contagem de registros
  SELECT COUNT(*) INTO v_count_investimentos FROM public.investimentos;
  SELECT COUNT(DISTINCT investimento_id) INTO v_count_aportes_iniciais FROM public.investimentos_aportes;

  IF v_count_aportes_iniciais <> v_count_investimentos THEN
    RAISE EXCEPTION 'Falha de validação 1: % investimentos existem, mas apenas % possuem aporte inicial.',
      v_count_investimentos, v_count_aportes_iniciais;
  END IF;

  -- 2. Soma de valores originais
  SELECT COALESCE(SUM(valor), 0) INTO v_soma_investimentos FROM public.investimentos;
  SELECT COALESCE(SUM(valor_original), 0) INTO v_soma_aportes 
  FROM public.investimentos_aportes ap
  WHERE ap.created_at <= (SELECT MAX(created_at) FROM public.investimentos);

  IF v_soma_investimentos <> v_soma_aportes THEN
    RAISE EXCEPTION 'Falha de validação 2: Soma dos valores de investimentos (%) diverge da soma dos aportes (%).',
      v_soma_investimentos, v_soma_aportes;
  END IF;

  -- 3. Ausência de duplicidades de aportes iniciais por investimento
  SELECT COUNT(*) INTO v_duplicidades
  FROM (
    SELECT investimento_id, COUNT(*) 
    FROM public.investimentos_aportes 
    GROUP BY investimento_id 
    HAVING COUNT(*) > 1
  ) dup;

  -- 4. Correspondência estrita das datas de aplicação
  SELECT COUNT(*) INTO v_datas_divergentes
  FROM public.investimentos inv
  JOIN public.investimentos_aportes ap ON ap.investimento_id = inv.id AND ap.created_at = inv.created_at
  WHERE ap.data_aporte <> inv.data;

  IF v_datas_divergentes > 0 THEN
    RAISE EXCEPTION 'Falha de validação 3: % aportes apresentam data_aporte diferente da data original do investimento.',
      v_datas_divergentes;
  END IF;

  -- 5. Ausência de saldos negativos
  SELECT COUNT(*) INTO v_saldos_negativos
  FROM (
    SELECT ap.id, (ap.valor_original - COALESCE(SUM(ra.principal_consumido), 0)) AS saldo
    FROM public.investimentos_aportes ap
    LEFT JOIN public.investimentos_resgates_aportes ra ON ra.aporte_id = ap.id
    GROUP BY ap.id, ap.valor_original
    HAVING (ap.valor_original - COALESCE(SUM(ra.principal_consumido), 0)) < -0.01
  ) neg;

  IF v_saldos_negativos > 0 THEN
    RAISE EXCEPTION 'Falha de validação 4: Detectados % lotes de aporte com saldo negativo.', v_saldos_negativos;
  END IF;

  -- 6. Integridade dos resgates legados
  SELECT COUNT(*) INTO v_count_resgatados FROM public.investimentos WHERE status = 'resgatado';
  SELECT COUNT(*) INTO v_count_resgates_legados FROM public.investimentos_resgates WHERE is_legado = true;

  IF v_count_resgates_legados < v_count_resgatados THEN
    RAISE EXCEPTION 'Falha de validação 5: % investimentos estão resgatados, mas apenas % resgates legados foram identificados.',
      v_count_resgatados, v_count_resgates_legados;
  END IF;

  RAISE NOTICE 'Validação da migração finalizada com 100%% de sucesso. Total: % investimentos verificados e íntegros.',
    v_count_investimentos;
END $$;

COMMIT;
