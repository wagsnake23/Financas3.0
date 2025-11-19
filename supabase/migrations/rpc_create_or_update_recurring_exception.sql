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
    v_result public.recurring_entry_exceptions;
    v_override_category_id uuid;
    v_override_value numeric;
    v_override_due_date date;
    v_note text;
BEGIN
    -- Extrai e sanitiza valores do payload
    v_note := NULLIF(p_payload->>'note', '');
    
    -- Lida com override_value, convertendo string vazia para NULL antes do cast
    BEGIN
        v_override_value := NULLIF(p_payload->>'override_value', '')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
        v_override_value := NULL; -- Define como NULL se o cast falhar (ex: string não numérica)
    END;

    -- Lida com override_category_id, convertendo "unselected" ou string vazia para NULL antes do cast
    IF p_payload->>'override_category_id' = 'unselected' OR p_payload->>'override_category_id' = '' THEN
        v_override_category_id := NULL;
    ELSE
        BEGIN
            v_override_category_id := (p_payload->>'override_category_id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
            v_override_category_id := NULL; -- Define como NULL se o cast falhar (ex: string não UUID)
        END;
    END IF;

    -- Lida com override_due_date, convertendo string vazia para NULL antes do cast
    BEGIN
        v_override_due_date := NULLIF(p_payload->>'override_due_date', '')::date;
    EXCEPTION WHEN invalid_datetime_format THEN
        v_override_due_date := NULL; -- Define como NULL se o cast falhar (ex: string de data inválida)
    END;

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
    ) VALUES (
        p_recurring_id,
        p_year,
        p_month,
        COALESCE((p_payload->>'paid')::boolean, false),
        COALESCE((p_payload->>'canceled')::boolean, false),
        v_note,
        v_override_value,
        v_override_category_id,
        v_override_due_date
    )
    ON CONFLICT (recurring_id, year, month) DO UPDATE SET
        paid = COALESCE((p_payload->>'paid')::boolean, recurring_entry_exceptions.paid),
        canceled = COALESCE((p_payload->>'canceled')::boolean, recurring_entry_exceptions.canceled),
        note = COALESCE(v_note, recurring_entry_exceptions.note),
        override_value = COALESCE(v_override_value, recurring_entry_exceptions.override_value),
        override_category_id = COALESCE(v_override_category_id, recurring_entry_exceptions.override_category_id),
        override_due_date = COALESCE(v_override_due_date, recurring_entry_exceptions.override_due_date),
        updated_at = now()
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;