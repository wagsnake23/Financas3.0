-- rpc_create_exception(recurring_id, year, month, payload)
CREATE OR REPLACE FUNCTION public.rpc_create_exception(
    p_recurring_id uuid,
    p_year int,
    p_month int,
    p_payload jsonb
)
RETURNS public.recurring_entry_exceptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_exception public.recurring_entry_exceptions;
BEGIN
    -- Check if the user owns the recurring entry
    SELECT user_id INTO v_user_id FROM public.recurring_entries WHERE id = p_recurring_id;
    IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: User does not own this recurring entry.';
    END IF;

    INSERT INTO public.recurring_entry_exceptions (
        recurring_id,
        year,
        month,
        override_value,
        override_category_id,
        override_due_date,
        canceled,
        paid,
        note
    ) VALUES (
        p_recurring_id,
        p_year,
        p_month,
        (p_payload->>'override_value')::numeric,
        p_payload->>'override_category_id',
        (p_payload->>'override_due_date')::date,
        COALESCE((p_payload->>'canceled')::boolean, FALSE),
        COALESCE((p_payload->>'paid')::boolean, FALSE),
        p_payload->>'note'
    )
    ON CONFLICT (recurring_id, year, month) DO UPDATE SET
        override_value = COALESCE(EXCLUDED.override_value, recurring_entry_exceptions.override_value),
        override_category_id = COALESCE(EXCLUDED.override_category_id, recurring_entry_exceptions.override_category_id),
        override_due_date = COALESCE(EXCLUDED.override_due_date, recurring_entry_exceptions.override_due_date),
        canceled = EXCLUDED.canceled,
        paid = EXCLUDED.paid,
        note = COALESCE(EXCLUDED.note, recurring_entry_exceptions.note),
        updated_at = now()
    RETURNING * INTO v_exception;

    RETURN v_exception;
END;
$$;

-- rpc_update_recurring_master(recurring_id, payload)
CREATE OR REPLACE FUNCTION public.rpc_update_recurring_master(
    p_recurring_id uuid,
    p_payload jsonb
)
RETURNS public.recurring_entries
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_entry public.recurring_entries;
BEGIN
    -- Check if the user owns the recurring entry
    SELECT user_id INTO v_user_id FROM public.recurring_entries WHERE id = p_recurring_id;
    IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: User does not own this recurring entry.';
    END IF;

    UPDATE public.recurring_entries
    SET
        type = COALESCE((p_payload->>'type')::text, type),
        title = COALESCE(p_payload->>'title', title),
        value = COALESCE((p_payload->>'value')::numeric, value),
        category_id = COALESCE(p_payload->>'category_id', category_id),
        due_day = COALESCE((p_payload->>'due_day')::int, due_day),
        frequency = COALESCE((p_payload->>'frequency')::text, frequency),
        start_date = COALESCE((p_payload->>'start_date')::date, start_date),
        end_date = COALESCE((p_payload->>'end_date')::date, end_date),
        status = COALESCE((p_payload->>'status')::text, status),
        updated_at = now()
    WHERE id = p_recurring_id
    RETURNING * INTO v_entry;

    RETURN v_entry;
END;
$$;

-- rpc_end_recurring_at(recurring_id, end_year, end_month)
CREATE OR REPLACE FUNCTION public.rpc_end_recurring_at(
    p_recurring_id uuid,
    p_end_year int,
    p_end_month int
)
RETURNS public.recurring_entries
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_entry public.recurring_entries;
    v_end_date date;
BEGIN
    -- Check if the user owns the recurring entry
    SELECT user_id INTO v_user_id FROM public.recurring_entries WHERE id = p_recurring_id;
    IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: User does not own this recurring entry.';
    END IF;

    -- Calculate the last day of the specified end_month
    v_end_date := (date_trunc('month', make_date(p_end_year, p_end_month, 1)) + interval '1 month - 1 day')::date;

    UPDATE public.recurring_entries
    SET
        end_date = v_end_date,
        status = 'active', -- Ensure it's active up to the end_date
        updated_at = now()
    WHERE id = p_recurring_id
    RETURNING * INTO v_entry;

    RETURN v_entry;
END;
$$;

-- rpc_cancel_month(recurring_id, year, month)
CREATE OR OR REPLACE FUNCTION public.rpc_cancel_month(
    p_recurring_id uuid,
    p_year int,
    p_month int
)
RETURNS public.recurring_entry_exceptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_exception public.recurring_entry_exceptions;
BEGIN
    -- Check if the user owns the recurring entry
    SELECT user_id INTO v_user_id FROM public.recurring_entries WHERE id = p_recurring_id;
    IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: User does not own this recurring entry.';
    END IF;

    INSERT INTO public.recurring_entry_exceptions (
        recurring_id,
        year,
        month,
        canceled,
        paid
    ) VALUES (
        p_recurring_id,
        p_year,
        p_month,
        TRUE,
        FALSE -- A canceled month cannot be paid
    )
    ON CONFLICT (recurring_id, year, month) DO UPDATE SET
        canceled = TRUE,
        paid = FALSE, -- A canceled month cannot be paid
        updated_at = now()
    RETURNING * INTO v_exception;

    RETURN v_exception;
END;
$$;

-- rpc_mark_month_paid(recurring_id, year, month, is_paid)
CREATE OR REPLACE FUNCTION public.rpc_mark_month_paid(
    p_recurring_id uuid,
    p_year int,
    p_month int,
    p_is_paid boolean
)
RETURNS public.recurring_entry_exceptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_exception public.recurring_entry_exceptions;
BEGIN
    -- Check if the user owns the recurring entry
    SELECT user_id INTO v_user_id FROM public.recurring_entries WHERE id = p_recurring_id;
    IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: User does not own this recurring entry.';
    END IF;

    INSERT INTO public.recurring_entry_exceptions (
        recurring_id,
        year,
        month,
        paid,
        canceled -- Ensure it's not canceled if being marked paid
    ) VALUES (
        p_recurring_id,
        p_year,
        p_month,
        p_is_paid,
        FALSE
    )
    ON CONFLICT (recurring_id, year, month) DO UPDATE SET
        paid = EXCLUDED.paid,
        canceled = FALSE, -- Ensure it's not canceled if being marked paid
        updated_at = now()
    RETURNING * INTO v_exception;

    RETURN v_exception;
END;
$$;