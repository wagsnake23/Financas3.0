-- Recreate rpc_create_or_update_recurring_exception
CREATE OR REPLACE FUNCTION public.rpc_create_or_update_recurring_exception(
    p_recurring_id uuid,
    p_year integer,
    p_month integer,
    p_payload jsonb
)
RETURNS public.recurring_entry_exceptions
LANGUAGE plpgsql
AS $$
DECLARE
    v_exception_id uuid;
    v_override_category_id TEXT;
    v_override_due_date DATE;
    v_override_value NUMERIC;
    v_note TEXT;
    v_paid BOOLEAN;
    v_canceled BOOLEAN;
    v_updated_exception public.recurring_entry_exceptions;
BEGIN
    -- Extract values from payload, explicitly casting where necessary
    v_override_category_id := p_payload->>'override_category_id';
    v_override_due_date := (p_payload->>'override_due_date')::DATE;
    v_override_value := (p_payload->>'override_value')::NUMERIC;
    v_note := p_payload->>'note';
    v_paid := (p_payload->>'paid')::BOOLEAN;
    v_canceled := (p_payload->>'canceled')::BOOLEAN;

    -- Check if an exception already exists for the given recurring_id, year, and month
    SELECT id INTO v_exception_id
    FROM public.recurring_entry_exceptions
    WHERE recurring_id = p_recurring_id AND year = p_year AND month = p_month;

    IF v_exception_id IS NOT NULL THEN
        -- Update existing exception
        UPDATE public.recurring_entry_exceptions
        SET
            override_category_id = COALESCE(v_override_category_id, override_category_id),
            override_due_date = COALESCE(v_override_due_date, override_due_date),
            override_value = COALESCE(v_override_value, override_value),
            note = COALESCE(v_note, note),
            paid = COALESCE(v_paid, paid),
            canceled = COALESCE(v_canceled, canceled),
            updated_at = NOW()
        WHERE id = v_exception_id
        RETURNING * INTO v_updated_exception;
    ELSE
        -- Insert new exception
        INSERT INTO public.recurring_entry_exceptions (
            recurring_id, year, month, override_category_id, override_due_date, override_value, note, paid, canceled
        )
        VALUES (
            p_recurring_id, p_year, p_month, v_override_category_id, v_override_due_date, v_override_value, v_note, v_paid, v_canceled
        )
        RETURNING * INTO v_updated_exception;
    END IF;

    RETURN v_updated_exception;
END;
$$;

-- Recreate rpc_update_recurring_master_future
CREATE OR REPLACE FUNCTION public.rpc_update_recurring_master_future(
    p_recurring_id uuid,
    p_start_date date,
    p_payload jsonb,
    p_preserve_exceptions boolean DEFAULT TRUE
)
RETURNS public.recurring_entries
LANGUAGE plpgsql
AS $$
DECLARE
    v_category_id TEXT;
    v_cartao_id UUID;
    v_title TEXT;
    v_value NUMERIC;
    v_due_day INTEGER;
    v_frequency public.recurring_frequency;
    v_end_date DATE;
    v_status public.recurring_status;
    v_forma_pagamento TEXT;
    v_updated_entry public.recurring_entries;
BEGIN
    -- Extract values from payload, explicitly casting where necessary
    v_title := p_payload->>'title';
    v_value := (p_payload->>'value')::NUMERIC;
    v_category_id := p_payload->>'category_id';
    v_due_day := (p_payload->>'due_day')::INTEGER;
    v_frequency := (p_payload->>'frequency')::public.recurring_frequency;
    v_end_date := (p_payload->>'end_date')::DATE;
    v_status := (p_payload->>'status')::public.recurring_status;
    v_forma_pagamento := p_payload->>'forma_pagamento';
    -- Robust UUID handling: convert empty string to NULL before casting
    v_cartao_id := NULLIF(TRIM(p_payload->>'cartao_id'), '')::UUID;

    -- Update the recurring_entry master record
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
        updated_at = NOW()
    WHERE id = p_recurring_id
    RETURNING * INTO v_updated_entry;

    -- If p_preserve_exceptions is FALSE, delete exceptions from p_start_date onwards
    IF NOT p_preserve_exceptions THEN
        DELETE FROM public.recurring_entry_exceptions
        WHERE recurring_id = p_recurring_id
          AND (year > EXTRACT(YEAR FROM p_start_date)
               OR (year = EXTRACT(YEAR FROM p_start_date) AND month >= EXTRACT(MONTH FROM p_start_date)));
    END IF;

    RETURN v_updated_entry;
END;
$$;

-- Recreate rpc_update_recurring_master_global
CREATE OR REPLACE FUNCTION public.rpc_update_recurring_master_global(
    p_recurring_id uuid,
    p_payload jsonb,
    p_preserve_exceptions boolean DEFAULT TRUE
)
RETURNS public.recurring_entries
LANGUAGE plpgsql
AS $$
DECLARE
    v_category_id TEXT;
    v_cartao_id UUID;
    v_title TEXT;
    v_value NUMERIC;
    v_due_day INTEGER;
    v_frequency public.recurring_frequency;
    v_start_date DATE;
    v_end_date DATE;
    v_status public.recurring_status;
    v_forma_pagamento TEXT;
    v_updated_entry public.recurring_entries;
BEGIN
    -- Extract values from payload, explicitly casting where necessary
    v_title := p_payload->>'title';
    v_value := (p_payload->>'value')::NUMERIC;
    v_category_id := p_payload->>'category_id';
    v_due_day := (p_payload->>'due_day')::INTEGER;
    v_frequency := (p_payload->>'frequency')::public.recurring_frequency;
    v_start_date := (p_payload->>'start_date')::DATE;
    v_end_date := (p_payload->>'end_date')::DATE;
    v_status := (p_payload->>'status')::public.recurring_status;
    v_forma_pagamento := p_payload->>'forma_pagamento';
    -- Robust UUID handling: convert empty string to NULL before casting
    v_cartao_id := NULLIF(TRIM(p_payload->>'cartao_id'), '')::UUID;

    -- Update the recurring_entry master record
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
        updated_at = NOW()
    WHERE id = p_recurring_id
    RETURNING * INTO v_updated_entry;

    -- If p_preserve_exceptions is FALSE, delete all exceptions for this recurring entry
    IF NOT p_preserve_exceptions THEN
        DELETE FROM public.recurring_entry_exceptions
        WHERE recurring_id = p_recurring_id;
    END IF;

    RETURN v_updated_entry;
END;
$$;