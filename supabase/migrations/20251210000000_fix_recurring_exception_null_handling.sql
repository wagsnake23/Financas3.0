CREATE OR REPLACE FUNCTION public.rpc_create_or_update_recurring_exception(
    p_recurring_id uuid,
    p_year integer,
    p_month integer,
    p_payload jsonb
)
RETURNS public.recurring_entry_exceptions
LANGUAGE plpgsql
AS $function$
DECLARE
    v_exception_id uuid;
    v_override_value numeric;
    v_override_category_id uuid;
    v_override_due_date date;
    v_note text;
    v_paid boolean;
    v_canceled boolean;
    v_existing_exception public.recurring_entry_exceptions;
    v_updated_exception public.recurring_entry_exceptions;
BEGIN
    -- Extract values from payload, handling NULL explicitly if the key exists
    -- Use jsonb_typeof to distinguish between a missing key and a key with a null value
    v_override_value := CASE WHEN p_payload ? 'override_value' THEN (p_payload->>'override_value')::numeric ELSE NULL END;
    v_override_category_id := CASE WHEN p_payload ? 'override_category_id' THEN (p_payload->>'override_category_id')::uuid ELSE NULL END;
    v_override_due_date := CASE WHEN p_payload ? 'override_due_date' THEN (p_payload->>'override_due_date')::date ELSE NULL END;
    v_note := CASE WHEN p_payload ? 'note' THEN p_payload->>'note' ELSE NULL END;
    v_paid := CASE WHEN p_payload ? 'paid' THEN (p_payload->>'paid')::boolean ELSE NULL END;
    v_canceled := CASE WHEN p_payload ? 'canceled' THEN (p_payload->>'canceled')::boolean ELSE NULL END;

    -- Check if an exception already exists for this recurring_id, year, and month
    SELECT *
    INTO v_existing_exception
    FROM public.recurring_entry_exceptions
    WHERE recurring_id = p_recurring_id AND year = p_year AND month = p_month;

    IF v_existing_exception IS NOT NULL THEN
        -- Update existing exception
        UPDATE public.recurring_entry_exceptions
        SET
            override_value = CASE WHEN p_payload ? 'override_value' THEN v_override_value ELSE v_existing_exception.override_value END,
            override_category_id = CASE WHEN p_payload ? 'override_category_id' THEN v_override_category_id ELSE v_existing_exception.override_category_id END,
            override_due_date = CASE WHEN p_payload ? 'override_due_date' THEN v_override_due_date ELSE v_existing_exception.override_due_date END,
            note = CASE WHEN p_payload ? 'note' THEN v_note ELSE v_existing_exception.note END,
            paid = CASE WHEN p_payload ? 'paid' THEN v_paid ELSE v_existing_exception.paid END,
            canceled = CASE WHEN p_payload ? 'canceled' THEN v_canceled ELSE v_existing_exception.canceled END,
            updated_at = now()
        WHERE id = v_existing_exception.id
        RETURNING * INTO v_updated_exception;
    ELSE
        -- Insert new exception
        INSERT INTO public.recurring_entry_exceptions (
            recurring_id, year, month, override_value, override_category_id,
            override_due_date, note, paid, canceled
        ) VALUES (
            p_recurring_id, p_year, p_month, v_override_value, v_override_category_id,
            v_override_due_date, v_note, v_paid, v_canceled
        )
        RETURNING * INTO v_updated_exception;
    END IF;

    RETURN v_updated_exception;
END;
$function$;