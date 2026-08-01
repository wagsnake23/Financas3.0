-- Correção da RPC rpc_create_or_update_recurring_exception para usar INSERT ... ON CONFLICT DO UPDATE
-- Isso garante que exceções sejam atualizadas se já existirem, ou inseridas se não, de forma atômica.

CREATE OR REPLACE FUNCTION public.rpc_create_or_update_recurring_exception(
    p_recurring_id uuid,
    p_year integer,
    p_month integer,
    p_payload jsonb
)
RETURNS public.recurring_entry_exceptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_existing_exception public.recurring_entry_exceptions;
    v_updated_exception public.recurring_entry_exceptions;
    v_old_data jsonb;
    v_new_data jsonb;
    v_action_type text;
BEGIN
    -- Verifica se o usuário é proprietário do lançamento recorrente
    IF NOT EXISTS (SELECT 1 FROM public.recurring_entries WHERE id = p_recurring_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Não Autorizado: O usuário não é proprietário deste lançamento recorrente.';
    END IF;

    -- Tenta encontrar a exceção existente para fins de auditoria (antes do UPSERT)
    SELECT *
    INTO v_existing_exception
    FROM public.recurring_entry_exceptions
    WHERE recurring_id = p_recurring_id AND year = p_year AND month = p_month;

    IF v_existing_exception IS NOT NULL THEN
        v_old_data := to_jsonb(v_existing_exception);
        v_action_type := 'exception_update';
    ELSE
        v_old_data := NULL; -- Não há dados antigos para uma nova inserção
        v_action_type := 'exception_create';
    END IF;

    -- Realiza o UPSERT (INSERT ... ON CONFLICT DO UPDATE)
    INSERT INTO public.recurring_entry_exceptions (
        recurring_id,
        year,
        month,
        override_value,
        override_category_id,
        override_due_date,
        note,
        paid,
        canceled,
        updated_at
    ) VALUES (
        p_recurring_id,
        p_year,
        p_month,
        COALESCE((p_payload->>'override_value')::numeric, NULL), -- NULL se não fornecido para INSERT inicial
        COALESCE(p_payload->>'override_category_id', NULL),
        COALESCE((p_payload->>'override_due_date')::date, NULL),
        COALESCE(p_payload->>'note', NULL),
        COALESCE((p_payload->>'paid')::boolean, FALSE),
        COALESCE((p_payload->>'canceled')::boolean, FALSE),
        now()
    )
    ON CONFLICT (recurring_id, year, month) DO UPDATE SET
        override_value = COALESCE((p_payload->>'override_value')::numeric, EXCLUDED.override_value),
        override_category_id = COALESCE(p_payload->>'override_category_id', EXCLUDED.override_category_id),
        override_due_date = COALESCE((p_payload->>'override_due_date')::date, EXCLUDED.override_due_date),
        note = COALESCE(p_payload->>'note', EXCLUDED.note),
        paid = COALESCE((p_payload->>'paid')::boolean, EXCLUDED.paid),
        canceled = COALESCE((p_payload->>'canceled')::boolean, EXCLUDED.canceled),
        updated_at = now()
    RETURNING * INTO v_updated_exception;

    v_new_data := to_jsonb(v_updated_exception);
    PERFORM public.rpc_audit(v_user_id, v_action_type, 'recurring_entry_exceptions', v_updated_exception.id::text, v_old_data, v_new_data, 'Exceção de recorrência processada.');

    RETURN v_updated_exception;
END;
$$;

-- Concede permissões de execução para usuários autenticados (se ainda não estiverem concedidas)
GRANT EXECUTE ON FUNCTION public.rpc_create_or_update_recurring_exception(uuid, integer, integer, jsonb) TO authenticated;