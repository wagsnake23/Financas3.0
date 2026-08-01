-- This migration updates the rpc_create_or_update_recurring_exception function
-- to correctly handle 'override_category_id' as TEXT, aligning with the table schema.

CREATE OR REPLACE FUNCTION public.rpc_create_or_update_recurring_exception(
    p_recurring_id uuid,
    p_year integer,
    p_month integer,
    p_payload jsonb
)
RETURNS public.recurring_entry_exceptions
LANGUAGE plpgsql
SECURITY DEFINER -- Use SECURITY DEFINER para permitir que a função atualize tabelas mesmo que o usuário chamador não tenha permissões diretas
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
    -- Extrair valores do payload JSONB, tratando potenciais NULLs e conversões de tipo
    -- Certifique-se de que 'override_category_id' é tratado como TEXT
    v_override_category_id := p_payload->>'override_category_id';
    v_override_value := (p_payload->>'override_value')::numeric;
    v_override_due_date := (p_payload->>'override_due_date')::date;
    v_note := p_payload->>'note';
    v_canceled := (p_payload->>'canceled')::boolean;
    v_paid := (p_payload->>'paid')::boolean;

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
        RETURNING * INTO v_result_exception;
    END IF;

    RETURN v_result_exception;
END;
$$;