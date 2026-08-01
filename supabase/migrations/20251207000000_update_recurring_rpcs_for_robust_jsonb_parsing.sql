-- This migration updates the RPC functions for recurring entries
-- to robustly parse JSONB payloads, correctly handling 'null' string values
-- and distinguishing between missing keys and explicit nulls.

-- Function: rpc_create_or_update_recurring_exception
CREATE OR REPLACE FUNCTION public.rpc_create_or_update_recurring_exception(
    p_recurring_id uuid,
    p_year integer,
    p_month integer,
    p_payload jsonb
)
RETURNS public.recurring_entry_exceptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_exception_id uuid;
    v_result_exception public.recurring_entry_exceptions;
    v_override_category_id text;
    v_override_value numeric;
    v_override_due_date date;
    v_note text;
    v_canceled boolean;
    v_paid boolean;
BEGIN
    -- Extract values from payload JSONB, handling potential NULLs and conversions of type
    -- Use CASE WHEN to correctly interpret 'null' string from JSONB as SQL NULL
    v_override_category_id := CASE
        WHEN p_payload ? 'override_category_id' AND p_payload->>'override_category_id' = 'null' THEN NULL
        WHEN p_payload ? 'override_category_id' THEN p_payload->>'override_category_id'
        ELSE NULL -- If key is not present, let COALESCE handle it by passing NULL
    END;
    v_override_value := CASE
        WHEN p_payload ? 'override_value' AND p_payload->>'override_value' = 'null' THEN NULL
        WHEN p_payload ? 'override_value' THEN (p_payload->>'override_value')::numeric
        ELSE NULL
    END;
    v_override_due_date := CASE
        WHEN p_payload ? 'override_due_date' AND p_payload->>'override_due_date' = 'null' THEN NULL
        WHEN p_payload ? 'override_due_date' THEN (p_payload->>'override_due_date')::date
        ELSE NULL
    END;
    v_note := CASE
        WHEN p_payload ? 'note' AND p_payload->>'note' = 'null' THEN NULL
        WHEN p_payload ? 'note' THEN p_payload->>'note'
        ELSE NULL
    END;
    v_canceled := CASE
        WHEN p_payload ? 'canceled' AND p_payload->>'canceled' = 'null' THEN NULL
        WHEN p_payload ? 'canceled' THEN (p_payload->>'canceled')::boolean
        ELSE NULL
    END;
    v_paid := CASE
        WHEN p_payload ? 'paid' AND p_payload->>'paid' = 'null' THEN NULL
        WHEN p_payload ? 'paid' THEN (p_payload->>'paid')::boolean
        ELSE NULL
    END;

    -- Verificar se uma exceção para este recurring_id, ano e mês já existe
    SELECT id INTO v_existing_exception_id
    FROM public.recurring_entry_exceptions
    WHERE recurring_id = p_recurring_id AND year = p_year AND month = p_month;

    IF v_existing_exception_id IS NOT NULL THEN
        -- Atualizar exceção existente
        UPDATE public.recurring_entry_exceptions
        SET
            override_value = COALESCE(v_override_value, override_value),
            override_category_id = COALESCE(v_override_category_id, override_category_id),
            override_due_date = COALESCE(v_override_due_date, override_due_date),
            note = COALESCE(v_note, note),
            canceled = COALESCE(v_canceled, canceled),
            paid = COALESCE(v_paid, paid),
            updated_at = now()
        WHERE id = v_existing_exception_id
        RETURNING * INTO v_result_exception;
    ELSE
        -- Inserir nova exceção
        INSERT INTO public.recurring_entry_exceptions (
            recurring_id, year, month,
            override_value, override_category_id, override_due_date,
            note, canceled, paid
        ) VALUES (
            p_recurring_id, p_year, p_month,
            v_override_value, v_override_category_id, v_override_due_date,
            v_note, v_canceled, v_paid
        )
        ON CONFLICT (recurring_id, year, month) DO UPDATE SET -- Added ON CONFLICT for robustness
            override_value = COALESCE(EXCLUDED.override_value, recurring_entry_exceptions.override_value),
            override_category_id = COALESCE(EXCLUDED.override_category_id, recurring_entry_exceptions.override_category_id),
            override_due_date = COALESCE(EXCLUDED.override_due_date, recurring_entry_exceptions.override_due_date),
            note = COALESCE(EXCLUDED.note, recurring_entry_exceptions.note),
            canceled = COALESCE(EXCLUDED.canceled, recurring_entry_exceptions.canceled),
            paid = COALESCE(EXCLUDED.paid, recurring_entry_exceptions.paid),
            updated_at = now()
        RETURNING * INTO v_result_exception;
    END IF;

    RETURN v_result_exception;
END;
$$;

-- Function: rpc_update_recurring_master_global
CREATE OR REPLACE FUNCTION public.rpc_update_recurring_master_global(
    p_recurring_id uuid,
    p_payload jsonb,
    p_preserve_exceptions boolean DEFAULT TRUE
)
RETURNS public.recurring_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result_entry public.recurring_entries;
    v_title text;
    v_value numeric;
    v_category_id text;
    v_due_day integer;
    v_frequency public.recurring_frequency;
    v_start_date date;
    v_end_date date;
    v_status public.recurring_status;
    v_forma_pagamento text;
    v_cartao_id uuid;
BEGIN
    -- Extract values from payload, handling potential NULLs and type conversions
    v_title := CASE WHEN p_payload ? 'title' AND p_payload->>'title' = 'null' THEN NULL WHEN p_payload ? 'title' THEN p_payload->>'title' ELSE NULL END;
    v_value := CASE WHEN p_payload ? 'value' AND p_payload->>'value' = 'null' THEN NULL WHEN p_payload ? 'value' THEN (p_payload->>'value')::numeric ELSE NULL END;
    v_category_id := CASE WHEN p_payload ? 'category_id' AND p_payload->>'category_id' = 'null' THEN NULL WHEN p_payload ? 'category_id' THEN p_payload->>'category_id' ELSE NULL END;
    v_due_day := CASE WHEN p_payload ? 'due_day' AND p_payload->>'due_day' = 'null' THEN NULL WHEN p_payload ? 'due_day' THEN (p_payload->>'due_day')::integer ELSE NULL END;
    v_frequency := CASE WHEN p_payload ? 'frequency' AND p_payload->>'frequency' = 'null' THEN NULL WHEN p_payload ? 'frequency' THEN (p_payload->>'frequency')::public.recurring_frequency ELSE NULL END;
    v_start_date := CASE WHEN p_payload ? 'start_date' AND p_payload->>'start_date' = 'null' THEN NULL WHEN p_payload ? 'start_date' THEN (p_payload->>'start_date')::date ELSE NULL END;
    v_end_date := CASE WHEN p_payload ? 'end_date' AND p_payload->>'end_date' = 'null' THEN NULL WHEN p_payload ? 'end_date' THEN (p_payload->>'end_date')::date ELSE NULL END;
    v_status := CASE WHEN p_payload ? 'status' AND p_payload->>'status' = 'null' THEN NULL WHEN p_payload ? 'status' THEN (p_payload->>'status')::public.recurring_status ELSE NULL END;
    v_forma_pagamento := CASE WHEN p_payload ? 'forma_pagamento' AND p_payload->>'forma_pagamento' = 'null' THEN NULL WHEN p_payload ? 'forma_pagamento' THEN p_payload->>'forma_pagamento' ELSE NULL END;
    v_cartao_id := CASE WHEN p_payload ? 'cartao_id' AND p_payload->>'cartao_id' = 'null' THEN NULL WHEN p_payload ? 'cartao_id' THEN (p_payload->>'cartao_id')::uuid ELSE NULL END;

    UPDATE public.recurring_entries
    SET
        title = COALESCE(v_title, title),
        value = COALESCE(v_value, value),
        category_id = COALESCE(v_category_id, category_id),
        due_day = COALESCE(v_due_day, due_day),
        frequency = COALESCE(v_frequency, frequency),
        start_date = COALESCE(v_start_date, start_date),
        end_date = COALESCE(v_end_date, end_date),
        status = COALESCE(v_status, status),
        forma_pagamento = COALESCE(v_forma_pagamento, forma_pagamento),
        cartao_id = COALESCE(v_cartao_id, cartao_id),
        updated_at = now()
    WHERE id = p_recurring_id
    RETURNING * INTO v_result_entry;

    IF NOT p_preserve_exceptions THEN
        -- Delete all exceptions for this recurring entry
        DELETE FROM public.recurring_entry_exceptions
        WHERE recurring_id = p_recurring_id;
    END IF;

    RETURN v_result_entry;
END;
$$;

-- Function: rpc_update_recurring_master_future
CREATE OR REPLACE FUNCTION public.rpc_update_recurring_master_future(
    p_recurring_id uuid,
    p_start_date date,
    p_payload jsonb
)
RETURNS public.recurring_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result_entry public.recurring_entries;
    v_title text;
    v_value numeric;
    v_category_id text;
    v_due_day integer;
    v_frequency public.recurring_frequency;
    v_end_date date;
    v_status public.recurring_status;
    v_forma_pagamento text;
    v_cartao_id uuid;
BEGIN
    -- Extract values from payload, handling potential NULLs and type conversions
    v_title := CASE WHEN p_payload ? 'title' AND p_payload->>'title' = 'null' THEN NULL WHEN p_payload ? 'title' THEN p_payload->>'title' ELSE NULL END;
    v_value := CASE WHEN p_payload ? 'value' AND p_payload->>'value' = 'null' THEN NULL WHEN p_payload ? 'value' THEN (p_payload->>'value')::numeric ELSE NULL END;
    v_category_id := CASE WHEN p_payload ? 'category_id' AND p_payload->>'category_id' = 'null' THEN NULL WHEN p_payload ? 'category_id' THEN p_payload->>'category_id' ELSE NULL END;
    v_due_day := CASE WHEN p_payload ? 'due_day' AND p_payload->>'due_day' = 'null' THEN NULL WHEN p_payload ? 'due_day' THEN (p_payload->>'due_day')::integer ELSE NULL END;
    v_frequency := CASE WHEN p_payload ? 'frequency' AND p_payload->>'frequency' = 'null' THEN NULL WHEN p_payload ? 'frequency' THEN (p_payload->>'frequency')::public.recurring_frequency ELSE NULL END;
    v_end_date := CASE WHEN p_payload ? 'end_date' AND p_payload->>'end_date' = 'null' THEN NULL WHEN p_payload ? 'end_date' THEN (p_payload->>'end_date')::date ELSE NULL END;
    v_status := CASE WHEN p_payload ? 'status' AND p_payload->>'status' = 'null' THEN NULL WHEN p_payload ? 'status' THEN (p_payload->>'status')::public.recurring_status ELSE NULL END;
    v_forma_pagamento := CASE WHEN p_payload ? 'forma_pagamento' AND p_payload->>'forma_pagamento' = 'null' THEN NULL WHEN p_payload ? 'forma_pagamento' THEN p_payload->>'forma_pagamento' ELSE NULL END;
    v_cartao_id := CASE WHEN p_payload ? 'cartao_id' AND p_payload->>'cartao_id' = 'null' THEN NULL WHEN p_payload ? 'cartao_id' THEN (p_payload->>'cartao_id')::uuid ELSE NULL END;

    UPDATE public.recurring_entries
    SET
        title = COALESCE(v_title, title),
        value = COALESCE(v_value, value),
        category_id = COALESCE(v_category_id, category_id),
        due_day = COALESCE(v_due_day, due_day),
        frequency = COALESCE(v_frequency, frequency),
        end_date = COALESCE(v_end_date, end_date),
        status = COALESCE(v_status, status),
        forma_pagamento = COALESCE(v_forma_pagamento, forma_pagamento),
        cartao_id = COALESCE(v_cartao_id, cartao_id),
        updated_at = now()
    WHERE id = p_recurring_id AND start_date >= p_start_date
    RETURNING * INTO v_result_entry;

    RETURN v_result_entry;
END;
$$;