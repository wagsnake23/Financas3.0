-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.rpc_update_recurring_master_future(
    p_recurring_id uuid,
    p_start_date date,
    p_payload jsonb
);

-- Recreate the function with p_preserve_exceptions parameter
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
    v_updated_entry public.recurring_entries;
    v_old_entry public.recurring_entries;
    v_user_id uuid;
BEGIN
    -- Get user_id from the recurring entry
    SELECT user_id INTO v_user_id FROM public.recurring_entries WHERE id = p_recurring_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Recurring entry not found or user not authorized.';
    END IF;

    -- Store old data for audit
    SELECT * INTO v_old_entry FROM public.recurring_entries WHERE id = p_recurring_id;

    -- Update the recurring_entry master record
    UPDATE public.recurring_entries
    SET
        title = COALESCE(p_payload->>'title', title),
        value = COALESCE((p_payload->>'value')::numeric, value),
        category_id = COALESCE(NULLIF(p_payload->>'category_id', ''), category_id),
        due_day = COALESCE((p_payload->>'due_day')::integer, due_day),
        frequency = COALESCE((p_payload->>'frequency')::public.recurring_frequency, frequency),
        start_date = COALESCE((p_payload->>'start_date')::date, start_date),
        end_date = COALESCE(NULLIF(p_payload->>'end_date', '')::date, end_date),
        status = COALESCE((p_payload->>'status')::public.recurring_status, status),
        forma_pagamento = COALESCE(NULLIF(p_payload->>'forma_pagamento', ''), forma_pagamento),
        cartao_id = COALESCE(NULLIF(p_payload->>'cartao_id', ''), cartao_id),
        updated_at = NOW()
    WHERE
        id = p_recurring_id
        AND user_id = v_user_id
    RETURNING * INTO v_updated_entry;

    IF v_updated_entry IS NULL THEN
        RAISE EXCEPTION 'Failed to update recurring entry.';
    END IF;

    -- If p_preserve_exceptions is FALSE, delete exceptions from p_start_date onwards
    IF NOT p_preserve_exceptions THEN
        DELETE FROM public.recurring_entry_exceptions
        WHERE
            recurring_id = p_recurring_id
            AND (
                (year = EXTRACT(YEAR FROM p_start_date) AND month >= EXTRACT(MONTH FROM p_start_date))
                OR
                (year > EXTRACT(YEAR FROM p_start_date))
            );
    END IF;

    -- Audit the change
    PERFORM public.rpc_audit(
        v_user_id,
        'UPDATE',
        'recurring_entries',
        p_recurring_id::text,
        jsonb_build_object(
            'old_title', v_old_entry.title,
            'old_value', v_old_entry.value,
            'old_category_id', v_old_entry.category_id,
            'old_due_day', v_old_entry.due_day,
            'old_frequency', v_old_entry.frequency,
            'old_start_date', v_old_entry.start_date,
            'old_end_date', v_old_entry.end_date,
            'old_status', v_old_entry.status,
            'old_forma_pagamento', v_old_entry.forma_pagamento,
            'old_cartao_id', v_old_entry.cartao_id
        ),
        jsonb_build_object(
            'new_title', v_updated_entry.title,
            'new_value', v_updated_entry.value,
            'new_category_id', v_updated_entry.category_id,
            'new_due_day', v_updated_entry.due_day,
            'new_frequency', v_updated_entry.frequency,
            'new_start_date', v_updated_entry.start_date,
            'new_end_date', v_updated_entry.end_date,
            'new_status', v_updated_entry.status,
            'new_forma_pagamento', v_updated_entry.forma_pagamento,
            'new_cartao_id', v_updated_entry.cartao_id
        ),
        'Updated recurring entry from specific date forward.' || CASE WHEN NOT p_preserve_exceptions THEN ' Existing exceptions cleared.' ELSE '' END
    );

    RETURN v_updated_entry;
END;
$$;