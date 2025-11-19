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
    v_paid boolean;
    v_canceled boolean;
BEGIN
    -- Extrai e sanitiza valores do payload para variáveis locais
    v_note := NULLIF(p_payload->>'note', '');
    v_paid := COALESCE((p_payload->>'paid')::boolean, false);
    v_canceled := COALESCE((p_payload->>'canceled')::boolean, false);
    
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

    -- Tenta inserir a exceção. Se houver conflito (já existe uma exceção para o mês/ano), atualiza.
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
        v_paid,
        v_canceled,
        v_note,
        v_override_value,
        v_override_category_id,
        v_override_due_date
    )
    ON CONFLICT (recurring_id, year, month) DO UPDATE SET
        -- Para cada campo, usa o novo valor (v_variavel) se ele não for NULL,
        -- caso contrário, mantém o valor existente na linha (EXCLUDED.coluna).
        -- Isso garante que apenas os campos fornecidos no payload sejam atualizados,
        -- e que os tipos sejam sempre consistentes.
        paid = v_paid, -- paid e canceled sempre vêm no payload, então não precisam de COALESCE com EXCLUDED
        canceled = v_canceled,
        note = CASE WHEN v_note IS NOT NULL THEN v_note ELSE EXCLUDED.note END,
        override_value = CASE WHEN v_override_value IS NOT NULL THEN v_override_value ELSE EXCLUDED.override_value END,
        override_category_id = CASE WHEN v_override_category_id IS NOT NULL THEN v_override_category_id ELSE EXCLUDED.override_category_id END,
        override_due_date = CASE WHEN v_override_due_date IS NOT NULL THEN v_override_due_date ELSE EXCLUDED.override_due_date END,
        updated_at = now()
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;