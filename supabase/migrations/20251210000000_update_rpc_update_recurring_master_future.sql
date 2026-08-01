CREATE OR REPLACE FUNCTION public.rpc_update_recurring_master_future(
    p_recurring_id uuid,
    p_start_date date,
    p_payload jsonb,
    p_preserve_exceptions boolean DEFAULT TRUE
)
RETURNS public.recurring_entries
LANGUAGE plpgsql
AS $function$
DECLARE
    v_current_entry public.recurring_entries;
    v_new_entry public.recurring_entries;
    v_old_payload jsonb;
    v_new_payload jsonb;
BEGIN
    -- Obter a entrada recorrente atual
    SELECT * INTO v_current_entry FROM public.recurring_entries WHERE id = p_recurring_id;

    IF v_current_entry IS NULL THEN
        RAISE EXCEPTION 'Recurring entry with ID % not found.', p_recurring_id;
    END IF;

    -- Construir o payload antigo para auditoria
    v_old_payload := to_jsonb(v_current_entry);

    -- Aplicar as atualizações do payload
    v_new_payload := v_old_payload || p_payload;

    -- Validar e ajustar campos de data
    IF v_new_payload->>'start_date' IS NOT NULL AND v_new_payload->>'start_date' = '' THEN
        v_new_payload := v_new_payload - 'start_date';
    END IF;
    IF v_new_payload->>'end_date' IS NOT NULL AND v_new_payload->>'end_date' = '' THEN
        v_new_payload := v_new_payload - 'end_date';
    END IF;
    IF v_new_payload->>'category_id' IS NOT NULL AND v_new_payload->>'category_id' = '' THEN
        v_new_payload := v_new_payload - 'category_id';
    END IF;
    IF v_new_payload->>'forma_pagamento' IS NOT NULL AND v_new_payload->>'forma_pagamento' = '' THEN
        v_new_payload := v_new_payload - 'forma_pagamento';
    END IF;
    IF v_new_payload->>'cartao_id' IS NOT NULL AND v_new_payload->>'cartao_id' = '' THEN
        v_new_payload := v_new_payload - 'cartao_id';
    END IF;
    IF v_new_payload->>'note' IS NOT NULL AND v_new_payload->>'note' = '' THEN
        v_new_payload := v_new_payload - 'note';
    END IF;

    -- Atualizar a entrada recorrente
    UPDATE public.recurring_entries
    SET
        title = COALESCE((v_new_payload->>'title')::text, title),
        value = COALESCE((v_new_payload->>'value')::numeric, value),
        category_id = COALESCE((v_new_payload->>'category_id')::uuid, category_id),
        due_day = COALESCE((v_new_payload->>'due_day')::integer, due_day),
        frequency = COALESCE((v_new_payload->>'frequency')::public.recurring_frequency, frequency),
        start_date = COALESCE((v_new_payload->>'start_date')::date, start_date),
        end_date = COALESCE((v_new_payload->>'end_date')::date, end_date),
        status = COALESCE((v_new_payload->>'status')::public.recurring_status, status),
        forma_pagamento = COALESCE((v_new_payload->>'forma_pagamento')::text, forma_pagamento),
        cartao_id = COALESCE((v_new_payload->>'cartao_id')::uuid, cartao_id),
        updated_at = now()
    WHERE id = p_recurring_id
    RETURNING * INTO v_new_entry;

    -- Se p_preserve_exceptions for FALSE, remover exceções futuras
    IF NOT p_preserve_exceptions THEN
        DELETE FROM public.recurring_entry_exceptions
        WHERE recurring_id = p_recurring_id
          AND (year > EXTRACT(YEAR FROM p_start_date) OR (year = EXTRACT(YEAR FROM p_start_date) AND month >= EXTRACT(MONTH FROM p_start_date)));
    END IF;

    -- Registrar auditoria
    PERFORM public.rpc_audit(
        p_user_id := auth.uid(),
        p_action_type := 'UPDATE',
        p_table_name := 'recurring_entries',
        p_record_id := p_recurring_id::text,
        p_old_data := v_old_payload,
        p_new_data := to_jsonb(v_new_entry),
        p_notes := 'Updated recurring entry master from a specific future month.'
    );

    RETURN v_new_entry;
END;
$function$;