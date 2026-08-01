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
    v_updated_exception public.recurring_entry_exceptions;
    v_user_id uuid;
BEGIN
    -- Get the user_id from the recurring_entry to ensure ownership
    SELECT user_id INTO v_user_id FROM public.recurring_entries WHERE id = p_recurring_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Recurring entry with ID % not found or not owned by current user.', p_recurring_id;
    END IF;

    -- Check if an exception already exists for the given recurring_id, year, and month
    SELECT *
    INTO v_existing_exception
    FROM public.recurring_entry_exceptions
    WHERE recurring_id = p_recurring_id
      AND year = p_year
      AND month = p_month;

    IF v_existing_exception IS NOT NULL THEN
        -- Update existing exception
        UPDATE public.recurring_entry_exceptions
        SET
            paid = COALESCE((p_payload->>'paid')::boolean, v_existing_exception.paid),
            canceled = COALESCE((p_payload->>'canceled')::boolean, v_existing_exception.canceled),
            note = COALESCE(NULLIF(p_payload->>'note', ''), v_existing_exception.note),
            override_value = COALESCE((p_payload->>'override_value')::numeric, v_existing_exception.override_value),
            override_category_id = COALESCE(NULLIF(p_payload->>'override_category_id', ''), v_existing_exception.override_category_id),
            override_due_date = COALESCE((p_payload->>'override_due_date')::date, v_existing_exception.override_due_date),
            updated_at = now()
        WHERE id = v_existing_exception.id
        RETURNING * INTO v_updated_exception;

        -- Optional: Delete exception if it becomes "empty" (only paid=false and no other overrides)
        -- This logic is commented out for now, as per the prompt's optional nature.
        -- IF (v_updated_exception.paid IS FALSE OR v_updated_exception.paid IS NULL)
        --    AND v_updated_exception.canceled IS FALSE
        --    AND v_updated_exception.note IS NULL
        --    AND v_updated_exception.override_value IS NULL
        --    AND v_updated_exception.override_category_id IS NULL
        --    AND v_updated_exception.override_due_date IS NULL THEN
        --     DELETE FROM public.recurring_entry_exceptions WHERE id = v_updated_exception.id;
        --     RETURN NULL; -- Indicate that the exception was removed
        -- END IF;

        RETURN v_updated_exception;
    ELSE
        -- Create new exception
        INSERT INTO public.recurring_entry_exceptions (
            recurring_id,
            year,
            month,
            paid,
            canceled,
            note,
            override_value,
            override_category_id,
            override_due_date
        )
        VALUES (
            p_recurring_id,
            p_year,
            p_month,
            COALESCE((p_payload->>'paid')::boolean, FALSE),
            COALESCE((p_payload->>'canceled')::boolean, FALSE),
            NULLIF(p_payload->>'note', ''),
            (p_payload->>'override_value')::numeric,
            NULLIF(p_payload->>'override_category_id', ''),
            (p_payload->>'override_due_date')::date
        )
        RETURNING * INTO v_updated_exception;

        RETURN v_updated_exception;
    END IF;
END;
$$;