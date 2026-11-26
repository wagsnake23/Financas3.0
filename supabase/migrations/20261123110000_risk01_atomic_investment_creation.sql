-- ==============================================================================
-- Migration: 20261123110000_risk01_atomic_investment_creation.sql
-- Descrição: Implementação RISK-01 - Cadastro atômico, idempotência no servidor,
--            reconciliação de operações, FK composta e exclusão segura.
-- ==============================================================================

-- 1. TABELA DE CONTROLE DE OPERAÇÕES DE IDEMPOTÊNCIA
CREATE TABLE IF NOT EXISTS public.investimento_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  investimento_id uuid NULL REFERENCES public.investimentos(id) ON DELETE SET NULL,
  aporte_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT investimento_operacoes_user_key_uniq UNIQUE (user_id, idempotency_key),
  CONSTRAINT investimento_operacoes_status_check CHECK (status IN ('pending', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_investimento_operacoes_user_status 
  ON public.investimento_operacoes (user_id, status);

ALTER TABLE public.investimento_operacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own investment operations" ON public.investimento_operacoes;
CREATE POLICY "Users can view their own investment operations"
  ON public.investimento_operacoes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Disallow direct insert on investment operations" ON public.investimento_operacoes;
CREATE POLICY "Disallow direct insert on investment operations"
  ON public.investimento_operacoes FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "Disallow direct update on investment operations" ON public.investimento_operacoes;
CREATE POLICY "Disallow direct update on investment operations"
  ON public.investimento_operacoes FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "Disallow direct delete on investment operations" ON public.investimento_operacoes;
CREATE POLICY "Disallow direct delete on investment operations"
  ON public.investimento_operacoes FOR DELETE
  USING (false);

GRANT SELECT ON TABLE public.investimento_operacoes TO authenticated;

-- 2. SCHEMA: Estrutura física de investimentos e aporte inicial
ALTER TABLE public.investimentos
ADD COLUMN IF NOT EXISTS idempotency_key uuid NULL;

ALTER TABLE public.investimentos
ADD COLUMN IF NOT EXISTS initial_aporte_id uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_investimentos_user_idempotency_key
  ON public.investimentos (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2.1. Constraint UNIQUE composta em investimentos_aportes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'investimentos_aportes_id_inv_user_uniq'
  ) THEN
    ALTER TABLE public.investimentos_aportes
    ADD CONSTRAINT investimentos_aportes_id_inv_user_uniq 
    UNIQUE (id, investimento_id, user_id);
  END IF;
END $$;

-- 2.2. Chave Estrangeira Composta com ON DELETE RESTRICT e DEFERRABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'investimentos_initial_aporte_fk'
  ) THEN
    ALTER TABLE public.investimentos
    ADD CONSTRAINT investimentos_initial_aporte_fk
      FOREIGN KEY (initial_aporte_id, id, user_id)
      REFERENCES public.investimentos_aportes (id, investimento_id, user_id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_investimentos_initial_aporte_id
  ON public.investimentos (initial_aporte_id)
  WHERE initial_aporte_id IS NOT NULL;

-- ==============================================================================
-- 3. RPC 1: CONSULTAR ESTADO DE UMA OPERAÇÃO (Leitura Pura e Reconciliação)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.consultar_operacao_investimento(
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_op record;
  v_inv record;
  v_aporte record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Operação não autorizada. Usuário não autenticado.';
  END IF;

  SELECT * INTO v_op
  FROM public.investimento_operacoes
  WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'not_found',
      'exists', false
    );
  END IF;

  IF v_op.status = 'completed' AND v_op.investimento_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.investimentos WHERE id = v_op.investimento_id;
    SELECT * INTO v_aporte FROM public.investimentos_aportes WHERE id = v_op.aporte_id;

    RETURN jsonb_build_object(
      'status', 'completed',
      'exists', true,
      'investimento_id', v_op.investimento_id,
      'aporte_id', v_op.aporte_id,
      'investimento', row_to_json(v_inv),
      'aporte', row_to_json(v_aporte)
    );
  END IF;

  RETURN jsonb_build_object(
    'status', v_op.status,
    'exists', true
  );
END;
$$;

-- ==============================================================================
-- 4. RPC 2: CANCELAR OPERAÇÃO AMBÍGUA COM SEGURANÇA
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.cancelar_operacao_investimento(
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_op record;
  v_inv record;
  v_aporte record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Operação não autorizada. Usuário não autenticado.';
  END IF;

  -- Lock consultivo serializado por chave
  PERFORM pg_catalog.pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(p_idempotency_key::text)
  );

  SELECT * INTO v_op
  FROM public.investimento_operacoes
  WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  -- Se a operação já foi completed, o cancelamento É RECUSADO
  IF FOUND AND v_op.status = 'completed' THEN
    SELECT * INTO v_inv FROM public.investimentos WHERE id = v_op.investimento_id;
    SELECT * INTO v_aporte FROM public.investimentos_aportes WHERE id = v_op.aporte_id;

    RETURN jsonb_build_object(
      'success', false,
      'cancelled', false,
      'message', 'Operação já havia sido confirmada anteriormente no banco de dados.',
      'investimento_id', v_op.investimento_id,
      'aporte_id', v_op.aporte_id,
      'investimento', row_to_json(v_inv),
      'aporte', row_to_json(v_aporte)
    );
  END IF;

  -- Se não existia ou estava pending, marca como cancelled
  IF NOT FOUND THEN
    INSERT INTO public.investimento_operacoes (
      user_id, idempotency_key, payload_hash, status
    ) VALUES (
      v_user_id, p_idempotency_key, 'cancelled_without_payload', 'cancelled'
    );
  ELSE
    UPDATE public.investimento_operacoes
    SET status = 'cancelled', updated_at = pg_catalog.now()
    WHERE id = v_op.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled', true,
    'message', 'Operação cancelada com sucesso.'
  );
END;
$$;

-- ==============================================================================
-- 5. RPC 3: CRIAR INVESTIMENTO ATÔMICO COM APORTE E IDEMPOTÊNCIA
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.criar_investimento_com_aporte(
  p_idempotency_key uuid,
  p_nome text,
  p_tipo text,
  p_valor numeric,
  p_data date,
  p_data_vencimento date DEFAULT NULL,
  p_tipo_rentabilidade text DEFAULT 'indexado',
  p_indexador text DEFAULT NULL,
  p_percentual_indexador numeric DEFAULT NULL,
  p_taxa_fixa numeric DEFAULT NULL,
  p_origem_investimento text DEFAULT 'saldo_atual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_valor_arredondado numeric(15,2);
  v_tipo_rentabilidade text;
  v_indexador text;
  v_percentual_indexador numeric;
  v_taxa_fixa numeric;
  v_payload_hash text;
  v_op record;
  v_inv_existente record;
  v_aporte_existente record;
  v_investimento record;
  v_aporte record;
BEGIN
  -- 1. Validar autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Operação não autorizada. Usuário não autenticado.';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Chave de idempotência (p_idempotency_key) é obrigatória.';
  END IF;

  -- 2. Lock transacional serializado
  PERFORM pg_catalog.pg_advisory_xact_lock(
    hashtext(v_user_id::text),
    hashtext(p_idempotency_key::text)
  );

  -- 3. Validação de campos textuais básicos
  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'O nome/categoria do investimento é obrigatório.';
  END IF;

  IF p_tipo IS NULL OR btrim(p_tipo) NOT IN ('fixed', 'variable', 'real-estate', 'crypto', 'other') THEN
    RAISE EXCEPTION 'Tipo de investimento inválido ("%"). Valores permitidos: fixed, variable, real-estate, crypto, other.', p_tipo;
  END IF;

  -- 4. Validação de finitude e precisão monetária (anti-NaN, anti-Infinity)
  IF p_valor IS NULL 
     OR p_valor = 'NaN'::numeric 
     OR p_valor = 'Infinity'::numeric 
     OR p_valor = '-Infinity'::numeric THEN
    RAISE EXCEPTION 'O valor do investimento deve ser um número finito válido.';
  END IF;
  
  v_valor_arredondado := ROUND(p_valor, 2);
  IF v_valor_arredondado <= 0.00 THEN
    RAISE EXCEPTION 'O valor do investimento após arredondamento deve ser maior que zero (mínimo R$ 0,01).';
  END IF;

  -- 5. Validação de datas
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'A data da aplicação é obrigatória.';
  END IF;

  IF p_data_vencimento IS NOT NULL AND p_data_vencimento < p_data THEN
    RAISE EXCEPTION 'A data de vencimento não pode ser anterior à data da aplicação.';
  END IF;

  -- 6. Validação de origem
  IF p_origem_investimento IS NULL OR p_origem_investimento NOT IN ('saldo_atual', 'caixa_externo') THEN
    RAISE EXCEPTION 'Origem do investimento inválida. Valores permitidos: saldo_atual, caixa_externo.';
  END IF;

  -- 7. Coerência e finitude dos campos de rentabilidade
  v_tipo_rentabilidade := COALESCE(p_tipo_rentabilidade, 'indexado');
  IF v_tipo_rentabilidade NOT IN ('fixo', 'indexado') THEN
    RAISE EXCEPTION 'Tipo de rentabilidade inválido. Valores permitidos: fixo, indexado.';
  END IF;

  IF v_tipo_rentabilidade = 'fixo' THEN
    IF p_taxa_fixa IS NULL 
       OR p_taxa_fixa = 'NaN'::numeric 
       OR p_taxa_fixa = 'Infinity'::numeric 
       OR p_taxa_fixa = '-Infinity'::numeric 
       OR p_taxa_fixa < 0 THEN
      RAISE EXCEPTION 'Para rentabilidade fixa, a taxa anual deve ser um número finito não negativo.';
    END IF;
    v_taxa_fixa := p_taxa_fixa;
    v_indexador := NULL;
    v_percentual_indexador := NULL;
  ELSE -- indexado
    IF p_indexador IS NULL OR p_indexador NOT IN ('CDI', 'IPCA') THEN
      RAISE EXCEPTION 'Para rentabilidade indexada, o indexador deve ser informado (CDI ou IPCA).';
    END IF;
    IF p_percentual_indexador IS NULL 
       OR p_percentual_indexador = 'NaN'::numeric 
       OR p_percentual_indexador = 'Infinity'::numeric 
       OR p_percentual_indexador = '-Infinity'::numeric 
       OR p_percentual_indexador <= 0 THEN
      RAISE EXCEPTION 'Para rentabilidade indexada, o percentual do indexador / taxa real deve ser um número finito maior que zero.';
    END IF;
    v_indexador := p_indexador;
    v_percentual_indexador := p_percentual_indexador;
    v_taxa_fixa := NULL;
  END IF;

  -- Gerar hash determinístico do payload normalizado usando extensions.digest
  v_payload_hash := encode(extensions.digest(
    btrim(p_nome) || '|' || btrim(p_tipo) || '|' || v_valor_arredondado::text || '|' ||
    p_data::text || '|' || COALESCE(p_data_vencimento::text, '') || '|' ||
    v_tipo_rentabilidade || '|' || COALESCE(v_indexador, '') || '|' ||
    COALESCE(v_percentual_indexador::text, '') || '|' || COALESCE(v_taxa_fixa::text, '') || '|' ||
    p_origem_investimento, 'sha256'
  ), 'hex');

  -- 8. VERIFICAR TABELA DE OPERAÇÕES DE IDEMPOTÊNCIA
  SELECT * INTO v_op
  FROM public.investimento_operacoes
  WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    -- 8.1. Se estiver cancelada, REJEITA imediatamente
    IF v_op.status = 'cancelled' THEN
      RAISE EXCEPTION 'Esta operação de cadastro foi previamente cancelada e não pode ser executada.';
    END IF;

    -- 8.2. Se estiver completed, recupera de forma idempotente
    IF v_op.status = 'completed' AND v_op.investimento_id IS NOT NULL THEN
      SELECT * INTO v_inv_existente
      FROM public.investimentos
      WHERE id = v_op.investimento_id AND user_id = v_user_id;

      -- Comparação integral null-safe
      IF v_inv_existente.nome IS DISTINCT FROM btrim(p_nome)
         OR v_inv_existente.tipo IS DISTINCT FROM btrim(p_tipo)
         OR v_inv_existente.valor IS DISTINCT FROM v_valor_arredondado
         OR v_inv_existente.data IS DISTINCT FROM p_data
         OR v_inv_existente.data_vencimento IS DISTINCT FROM p_data_vencimento
         OR v_inv_existente.tipo_rentabilidade IS DISTINCT FROM v_tipo_rentabilidade
         OR v_inv_existente.indexador IS DISTINCT FROM v_indexador
         OR v_inv_existente.percentual_indexador IS DISTINCT FROM v_percentual_indexador
         OR v_inv_existente.taxa_fixa IS DISTINCT FROM v_taxa_fixa
         OR v_inv_existente.origem_investimento IS DISTINCT FROM p_origem_investimento THEN
        RAISE EXCEPTION 'Chave de idempotência já utilizada com parâmetros diferentes. Operação rejeitada.';
      END IF;

      -- Recuperação estrita do aporte inicial
      SELECT * INTO v_aporte_existente
      FROM public.investimentos_aportes
      WHERE id = v_inv_existente.initial_aporte_id
        AND user_id = v_user_id
        AND investimento_id = v_inv_existente.id;

      IF NOT FOUND OR v_aporte_existente.id IS NULL THEN
        RAISE EXCEPTION 'Inconsistência de integridade detectada: o aporte inicial vinculado ao investimento não foi encontrado. Operação rejeitada.';
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'idempotente', true,
        'investimento_id', v_inv_existente.id,
        'aporte_id', v_aporte_existente.id,
        'investimento', row_to_json(v_inv_existente),
        'aporte', row_to_json(v_aporte_existente)
      );
    END IF;
  ELSE
    -- Cria o registro de operação com status pending
    INSERT INTO public.investimento_operacoes (
      user_id, idempotency_key, payload_hash, status
    ) VALUES (
      v_user_id, p_idempotency_key, v_payload_hash, 'pending'
    ) RETURNING * INTO v_op;
  END IF;

  -- 9. CADASTRO ATÔMICO
  -- 9.1. Inserir o investimento
  INSERT INTO public.investimentos (
    user_id,
    idempotency_key,
    nome,
    tipo,
    valor,
    data,
    data_vencimento,
    tipo_rentabilidade,
    indexador,
    percentual_indexador,
    taxa_fixa,
    origem_investimento,
    status
  ) VALUES (
    v_user_id,
    p_idempotency_key,
    btrim(p_nome),
    btrim(p_tipo),
    v_valor_arredondado,
    p_data,
    p_data_vencimento,
    v_tipo_rentabilidade,
    v_indexador,
    v_percentual_indexador,
    v_taxa_fixa,
    p_origem_investimento,
    'ativo'
  )
  RETURNING * INTO v_investimento;

  -- 9.2. Inserir o aporte inicial atômico
  INSERT INTO public.investimentos_aportes (
    investimento_id,
    user_id,
    valor_original,
    data_aporte
  ) VALUES (
    v_investimento.id,
    v_user_id,
    v_valor_arredondado,
    p_data
  )
  RETURNING * INTO v_aporte;

  -- 9.3. Atualizar initial_aporte_id ativando a FK composta
  UPDATE public.investimentos
  SET initial_aporte_id = v_aporte.id
  WHERE id = v_investimento.id
  RETURNING * INTO v_investimento;

  -- 9.4. Atualizar o registro de operação para 'completed'
  UPDATE public.investimento_operacoes
  SET status = 'completed',
      investimento_id = v_investimento.id,
      aporte_id = v_aporte.id,
      updated_at = pg_catalog.now()
  WHERE id = v_op.id;

  -- 10. Retornar resposta estruturada
  RETURN jsonb_build_object(
    'success', true,
    'idempotente', false,
    'investimento_id', v_investimento.id,
    'aporte_id', v_aporte.id,
    'investimento', row_to_json(v_investimento),
    'aporte', row_to_json(v_aporte)
  );
END;
$$;

-- ==============================================================================
-- 6. RPC 4: EXCLUIR INVESTIMENTO ATÔMICO COM DESVINCULAÇÃO SEGURA
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.excluir_investimento_atomico(
  p_investimento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_inv record;
  v_tem_resgates boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Operação não autorizada. Usuário não autenticado.';
  END IF;

  -- 1. Validar propriedade do investimento
  SELECT * INTO v_inv
  FROM public.investimentos
  WHERE id = p_investimento_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investimento não encontrado ou não pertence ao usuário autenticado.';
  END IF;

  -- 2. Validar se existem resgates ou alocações associadas (proteção financeira inegociável)
  SELECT EXISTS (
    SELECT 1 FROM public.investimentos_resgates_aportes ra
    WHERE ra.investimento_id = p_investimento_id
  ) INTO v_tem_resgates;

  IF v_tem_resgates THEN
    RAISE EXCEPTION 'Não é permitido excluir investimentos que possuem resgates vinculados.';
  END IF;

  -- 3. Sequência Atômica de Exclusão (Respeita a FK Composta)
  -- 3.1. Desvincular initial_aporte_id
  UPDATE public.investimentos
  SET initial_aporte_id = NULL
  WHERE id = p_investimento_id;

  -- 3.2. Deletar aportes filhos
  DELETE FROM public.investimentos_aportes
  WHERE investimento_id = p_investimento_id;

  -- 3.3. Deletar o investimento
  DELETE FROM public.investimentos
  WHERE id = p_investimento_id;

  RETURN jsonb_build_object(
    'success', true,
    'investimento_id', p_investimento_id,
    'message', 'Investimento e aportes removidos com sucesso.'
  );
END;
$$;

-- ==============================================================================
-- 7. PERMISSÕES ESTRITAS
-- ==============================================================================
REVOKE ALL ON FUNCTION public.consultar_operacao_investimento(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.consultar_operacao_investimento(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.cancelar_operacao_investimento(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_operacao_investimento(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.criar_investimento_com_aporte(uuid, text, text, numeric, date, date, text, text, numeric, numeric, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.criar_investimento_com_aporte(uuid, text, text, numeric, date, date, text, text, numeric, numeric, text) TO authenticated;

REVOKE ALL ON FUNCTION public.excluir_investimento_atomico(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.excluir_investimento_atomico(uuid) TO authenticated;
