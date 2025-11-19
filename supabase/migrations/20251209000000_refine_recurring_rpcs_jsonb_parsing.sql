-- This migration refines the JSONB parsing logic in all recurring entry RPC functions
-- to robustly handle missing keys, JSON nulls, and empty strings, ensuring correct updates.

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
    v_override_category_id text := NULL;
    v_override_value numeric := NULL;
    v_override_due_date date := NULL;
    v_note text := NULL;
    v_canceled boolean := NULL;
    v_paid boolean := NULL;
BEGIN
    -- Extract values from payload JSONB with robust handling for missing keys, JSON nulls, and empty strings
    IF p_payload ? 'override_category_id' THEN
        IF p_payload->>'override_category_id' IS NOT NULL AND p_payload->>'override_category_id' <> '' THEN
            v_override_category_id := p_payload->>'override_category_id';
        END IF;
    END IF;
    IF p_payload ? 'override_value' THEN
        IF p_payload->>'override_value' IS NOT NULL AND p_payload->>'override_value' <> '' THEN
            v_override_value := (p_payload->>'override_value')::numeric;
        END IF;
    END IF;
    IF p_payload ? 'override_due_date' THEN
        IF p_payload->>'override_due_date' IS NOT NULL AND p_payload->>'override_due_date' <> '' THEN
            v_override_due_date := (p_payload->>'override_due_date')::date;
        END IF;
    END IF;
    IF p_payload ? 'note' THEN
        IF p_payload->>'note' IS NOT NULL AND p_payload->>'note' <> '' THEN
            v_note := p_payload->>'note';
        END IF;
    END IF;
    IF p_payload ? 'canceled' THEN
        IF p_payload->>'canceled' IS NOT NULL AND p_payload->>'canceled' <> '' THEN
            v_canceled := (p_payload->>'canceled')::boolean;
        END IF;
    END IF;
    IF p_payload ? 'paid' THEN
        IF p_payload->>'paid' IS NOT NULL AND p_payload->>'paid' <> '' THEN
            v_paid := (p_payload->>'paid')::boolean;
        END IF;
    END IF;

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
        ON CONFLICT (recurring_id, year, month) DO UPDATE SET
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
    v_title text := NULL;
    v_value numeric := NULL;
    v_category_id text := NULL;
    v_due_day integer := NULL;
    v_frequency public.recurring_frequency := NULL;
    v_start_date date := NULL;
    v_end_date date := NULL;
    v_status public.recurring_status := NULL;
    v_forma_pagamento text := NULL;
    v_cartao_id uuid := NULL;
BEGIN
    -- Extract values from payload with robust handling for missing keys, JSON nulls, and empty strings
    IF p_payload ? 'title' THEN
        IF p_payload->>'title' IS NOT NULL AND p_payload->>'title' <> '' THEN
            v_title := p_payload->>'title';
        END IF;
    END IF;
    IF p_payload ? 'value' THEN
        IF p_payload->>'value' IS NOT NULL AND p_payload->>'value' <> '' THEN
            v_value := (p_payload->>'value')::numeric;
        END IF;
    END IF;
    IF p_payload ? 'category_id' THEN
        IF p_payload->>'category_id' IS NOT NULL AND p_payload->>'category_id' <> '' THEN
            v_category_id := p_payload->>'category_id';
        END IF;
    END IF;
    IF p_payload ? 'due_day' THEN
        IF p_payload->>'due_day' IS NOT NULL AND p_payload->>'due_day' <> '' THEN
            v_due_day := (p_payload->>'due_day')::integer;
        END IF;
    END IF;
    IF p_payload ? 'frequency' THEN
        IF p_payload->>'frequency' IS NOT NULL AND p_payload->>'frequency' <> '' THEN
            v_frequency := (p_payload->>'frequency')::public.recurring_frequency;
        END IF;
    END IF;
    IF p_payload ? 'start_date' THEN
        IF p_payload->>'start_date' IS NOT NULL AND p_payload->>'start_date' <> '' THEN
            v_start_date := (p_payload->>'start_date')::date;
        END IF;
    END IF;
    IF p_payload ? 'end_date' THEN
        IF p_payload->>'end_date' IS NOT NULL AND p_payload->>'end_date' <> '' THEN
            v_end_date := (p_payload->>'end_date')::date;
        END IF;
    END IF;
    IF p_payload ? 'status' THEN
        IF p_payload->>'status' IS NOT NULL AND p_payload->>'status' <> '' THEN
            v_status := (p_payload->>'status')::public.recurring_status;
        END IF;
    END IF;
    IF p_payload ? 'forma_pagamento' THEN
        IF p_payload->>'forma_pagamento' IS NOT NULL AND p_payload->>'forma_pagamento' <> '' THEN
            v_forma_pagamento := p_payload->>'forma_pagamento';
        END IF;
    END IF;
    IF p_payload ? 'cartao_id' THEN
        IF p_payload->>'cartao_id' IS NOT NULL AND p_payload->>'cartao_id' <> '' THEN
            v_cartao_id := (p_payload->>'cartao_id')::uuid;
        END IF;
    END IF;

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
    v_title text := NULL;
    v_value numeric := NULL;
    v_category_id text := NULL;
    v_due_day integer := NULL;
    v_frequency public.recurring_frequency := NULL;
    v_end_date date := NULL;
    v_status public.recurring_status := NULL;
    v_forma_pagamento text := NULL;
    v_cartao_id uuid := NULL;
BEGIN
    -- Extract values from payload with robust handling for missing keys, JSON nulls, and empty strings
    IF p_payload ? 'title' THEN
        IF p_payload->>'title' IS NOT NULL AND p_payload->>'title' <> '' THEN
            v_title := p_payload->>'title';
        END IF;
    END IF;
    IF p_payload ? 'value' THEN
        IF p_payload->>'value' IS NOT NULL AND p_payload->>'value' <> '' THEN
            v_value := (p_payload->>'value')::numeric;
        END IF;
    END IF;
    IF p_payload ? 'category_id' THEN
        IF p_payload->>'category_id' IS NOT NULL AND p_payload->>'category_id' <> '' THEN
            v_category_id := p_payload->>'category_id';
        END IF;
    END IF;
    IF p_payload ? 'due_day' THEN
        IF p_payload->>'due_day' IS NOT NULL AND p_payload->>'due_day' <> '' THEN
            v_due_day := (p_payload->>'due_day')::integer;
        END IF;
    END IF;
    IF p_payload ? 'frequency' THEN
        IF p_payload->>'frequency' IS NOT NULL AND p_payload->>'frequency' <> '' THEN
            v_frequency := (p_payload->>'frequency')::public.recurring_frequency;
        END IF;
    END IF;
    IF p_payload ? 'end_date' THEN
        IF p_payload->>'end_date' IS NOT NULL AND p_payload->>'end_date' <> '' THEN
            v_end_date := (p_payload->>'end_date')::date;
        END IF;
    END IF;
    IF p_payload ? 'status' THEN
        IF p_payload->>'status' IS NOT NULL AND p_payload->>'status' <> '' THEN
            v_status := (p_payload->>'status')::public.recurring_status;
        END IF;
    END IF;
    IF p_payload ? 'forma_pagamento' THEN
        IF p_payload->>'forma_pagamento' IS NOT NULL AND p_payload->>'forma_pagamento' <> '' THEN
            v_forma_pagamento := p_payload->>'forma_pagamento';
        END IF;
    END IF;
    IF p_payload ? 'cartao_id' THEN
        IF p_payload->>'cartao_id' IS NOT NULL AND p_payload->>'cartao_id' <> '' THEN
            v_cartao_id := (p_payload->>'cartao_id')::uuid;
        END IF;
    END IF;

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