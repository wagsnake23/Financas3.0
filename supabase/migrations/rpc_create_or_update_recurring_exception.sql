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
    v_existing_exception public.recurring_entry_exceptions;
    v_override_value numeric;
    v_override_category_id uuid;
    v_override_due_date date;
    v_note text;
    v_paid boolean;
    v_canceled boolean;
BEGIN
    -- Check if an exception already exists for the given recurring_id, year, and month
    SELECT *
    INTO v_existing_exception
    FROM public.recurring_entry_exceptions
    WHERE recurring_id = p_recurring_id AND year = p_year AND month = p_month;

    -- Extract values from payload, handling NULLs explicitly
    -- If a key is present, use its value (even if NULL). If not present, keep existing.
    v_override_value := CASE
        WHEN p_payload ? 'override_value' THEN (p_payload->>'override_value')::numeric
        ELSE v_existing_exception.override_value
    END;

    v_override_category_id := CASE
        WHEN p_payload ? 'override_category_id' THEN (p_payload->>'override_category_id')::uuid
        ELSE v_existing_exception.override_category_id
    END;

    v_override_due_date := CASE
        WHEN p_payload ? 'override_due_date' THEN (p_payload->>'override_due_date')::date
        ELSE v_existing_exception.override_due_date
    END;

    v_note := CASE
        WHEN p_payload ? 'note' THEN (p_payload->>'note')
        ELSE v_existing_exception.note
    END;

    v_paid := CASE
        WHEN p_payload ? 'paid' THEN (p_payload->>'paid')::boolean
        ELSE v_existing_exception.paid
    END;

    v_canceled := CASE
        WHEN p_payload ? 'canceled' THEN (p_payload->>'canceled')::boolean
        ELSE v_existing_exception.canceled
    END;

    IF v_existing_exception.id IS NOT NULL THEN
        -- Update existing exception
        UPDATE public.recurring_entry_exceptions
        SET
            override_value = v_override_value,
            override_category_id = v_override_category_id,
            override_due_date = v_override_due_date,
            note = v_note,
            paid = v_paid,
            canceled = v_canceled,
            updated_at = now()
        WHERE id = v_existing_exception.id
        RETURNING id INTO v_exception_id;
    ELSE
        -- Insert new exception
        INSERT INTO public.recurring_entry_exceptions (
            recurring_id,
            year,
            month,
            override_value,
            override_category_id,
            override_due_date,
            note,
            paid,
            canceled
        )
        VALUES (
            p_recurring_id,
            p_year,
            p_month,
            v_override_value,
            v_override_category_id,
            v_override_due_date,
            v_note,
            v_paid,
            v_canceled
        )
        RETURNING id INTO v_exception_id;
    END IF;

    -- Return the created or updated exception
    RETURN (SELECT * FROM public.recurring_entry_exceptions WHERE id = v_exception_id);
END;
$$;