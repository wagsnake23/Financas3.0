-- Função para registrar eventos de auditoria
CREATE OR REPLACE FUNCTION public.rpc_audit(
    p_user_id uuid,
    p_action_type text,
    p_table_name text,
    p_record_id text,
    p_old_data jsonb DEFAULT NULL,
    p_new_data jsonb DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Permite que a função seja executada com os privilégios do definidor (ex: inserir em audit_logs)
AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, action_type, table_name, record_id, old_data, new_data, notes)
    VALUES (p_user_id, p_action_type, p_table_name, p_record_id, p_old_data, p_new_data, p_notes);
END;
$$;

-- RPC para "Somente esta parcela" (Criar ou Atualizar Exceção)
CREATE OR REPLACE FUNCTION public.rpc_create_or_update_recurring_exception(
    p_recurring_id uuid,
    p_year integer,
    p_month integer,
    p_payload jsonb
)
RETURNS public.recurring_entry_exceptions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_existing_exception public.recurring_entry_exceptions;
    v_updated_exception public.recurring_entry_exceptions;
    v_old_data jsonb;
    v_new_data jsonb;
BEGIN
    -- Verifica se o usuário é proprietário do lançamento recorrente
    IF NOT EXISTS (SELECT 1 FROM public.recurring_entries WHERE id = p_recurring_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Não Autorizado: O usuário não é proprietário deste lançamento recorrente.';
    END IF;

    SELECT *
    INTO v_existing_exception
    FROM public.recurring_entry_exceptions
    WHERE recurring_id = p_recurring_id AND year = p_year AND month = p_month;

    IF v_existing_exception IS NOT NULL THEN
        v_old_data := to_jsonb(v_existing_exception);
        
        UPDATE public.recurring_entry_exceptions
        SET
            override_value = COALESCE((p_payload->>'override_value')::numeric, override_value),
            override_category_id = COALESCE(p_payload->>'override_category_id', override_category_id),
            override_due_date = COALESCE((p_payload->>'override_due_date')::date, override_due_date),
            note = COALESCE(p_payload->>'note', note),
            paid = COALESCE((p_payload->>'paid')::boolean, paid),
            canceled = COALESCE((p_payload->>'canceled')::boolean, canceled),
            updated_at = now()
        WHERE id = v_existing_exception.id
        RETURNING * INTO v_updated_exception;

        v_new_data := to_jsonb(v_updated_exception);
        PERFORM public.rpc_audit(v_user_id, 'exception_update', 'recurring_entry_exceptions', v_updated_exception.id::text, v_old_data, v_new_data, 'Exceção de recorrência atualizada para o mês.');
    ELSE
        INSERT INTO public.recurring_entry_exceptions (
            recurring_id,
            year,
            month,
            override_value,
            override_category_id,
            override_due_date,
            note,
            paid,
            canceled,
            updated_at
        ) VALUES (
            p_recurring_id,
            p_year,
            p_month,
            (p_payload->>'override_value')::numeric,
            p_payload->>'override_category_id',
            (p_payload->>'override_due_date')::date,
            p_payload->>'note',
            COALESCE((p_payload->>'paid')::boolean, FALSE), -- Padrão para FALSE se não fornecido
            COALESCE((p_payload->>'canceled')::boolean, FALSE), -- Padrão para FALSE se não fornecido
            now()
        )
        RETURNING * INTO v_updated_exception;

        v_new_data := to_jsonb(v_updated_exception);
        PERFORM public.rpc_audit(v_user_id, 'exception_create', 'recurring_entry_exceptions', v_updated_exception.id::text, NULL, v_new_data, 'Nova exceção de recorrência criada para o mês.');
    END IF;

    RETURN v_updated_exception;
END;
$$;

-- RPC para "A partir desta parcela" (Atualizar Registro Mestre Recorrente a partir de um mês específico)
CREATE OR REPLACE FUNCTION public.rpc_update_recurring_master_future(
    p_recurring_id uuid,
    p_start_date date, -- A nova data de início para a recorrência atualizada
    p_payload jsonb -- Novos valores para title, value, category_id, due_day, frequency, end_date, status
)
RETURNS public.recurring_entries
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_old_master public.recurring_entries;
    v_new_master public.recurring_entries;
    v_new_recurring_id uuid;
    v_old_data jsonb;
    v_new_data jsonb;
BEGIN
    -- Verifica se o usuário é proprietário do lançamento recorrente
    SELECT * INTO v_old_master FROM public.recurring_entries WHERE id = p_recurring_id AND user_id = v_user_id;
    IF v_old_master IS NULL THEN
        RAISE EXCEPTION 'Não Autorizado ou Não Encontrado: O usuário não é proprietário deste lançamento recorrente ou ele não existe.';
    END IF;

    -- 1. Encerra o lançamento recorrente antigo no mês ANTES de p_start_date
    v_old_data := to_jsonb(v_old_master);
    UPDATE public.recurring_entries
    SET
        end_date = (p_start_date - INTERVAL '1 day')::date,
        updated_at = now()
    WHERE id = p_recurring_id
    RETURNING * INTO v_old_master; -- Atualiza v_old_master com a nova end_date

    PERFORM public.rpc_audit(v_user_id, 'recurring_end', 'recurring_entries', v_old_master.id::text, v_old_data, to_jsonb(v_old_master), 'Lançamento recorrente antigo encerrado antes do início da nova recorrência futura.');

    -- 2. Cria um novo lançamento recorrente com os detalhes atualizados, começando de p_start_date
    v_new_recurring_id := gen_random_uuid();
    INSERT INTO public.recurring_entries (
        id,
        user_id,
        type,
        title,
        value,
        category_id,
        due_day,
        frequency,
        start_date,
        end_date,
        status,
        created_at,
        updated_at
    ) VALUES (
        v_new_recurring_id,
        v_user_id,
        v_old_master.type, -- O tipo permanece o mesmo
        COALESCE(p_payload->>'title', v_old_master.title),
        COALESCE((p_payload->>'value')::numeric, v_old_master.value),
        COALESCE(p_payload->>'category_id', v_old_master.category_id),
        COALESCE((p_payload->>'due_day')::integer, v_old_master.due_day),
        COALESCE((p_payload->>'frequency')::public.recurring_frequency, v_old_master.frequency),
        p_start_date, -- Nova data de início
        COALESCE((p_payload->>'end_date')::date, v_old_master.end_date), -- Pode ter nova data de fim
        COALESCE((p_payload->>'status')::public.recurring_status, v_old_master.status),
        now(),
        now()
    )
    RETURNING * INTO v_new_master;

    v_new_data := to_jsonb(v_new_master);
    PERFORM public.rpc_audit(v_user_id, 'recurring_create', 'recurring_entries', v_new_master.id::text, NULL, v_new_data, 'Novo lançamento recorrente criado para ocorrências futuras.');

    RETURN v_new_master;
END;
$$;

-- RPC para "Toda a recorrência" (Atualizar Registro Mestre Globalmente)
CREATE OR REPLACE FUNCTION public.rpc_update_recurring_master_global(
    p_recurring_id uuid,
    p_payload jsonb,
    p_preserve_exceptions boolean DEFAULT TRUE -- Se TRUE, exceções existentes são mantidas. Se FALSE, são deletadas.
)
RETURNS public.recurring_entries
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_old_master public.recurring_entries;
    v_updated_master public.recurring_entries;
    v_old_data jsonb;
    v_new_data jsonb;
BEGIN
    -- Verifica se o usuário é proprietário do lançamento recorrente
    SELECT * INTO v_old_master FROM public.recurring_entries WHERE id = p_recurring_id AND user_id = v_user_id;
    IF v_old_master IS NULL THEN
        RAISE EXCEPTION 'Não Autorizado ou Não Encontrado: O usuário não é proprietário deste lançamento recorrente ou ele não existe.';
    END IF;

    v_old_data := to_jsonb(v_old_master);

    UPDATE public.recurring_entries
    SET
        title = COALESCE(p_payload->>'title', v_old_master.title),
        value = COALESCE((p_payload->>'value')::numeric, v_old_master.value),
        category_id = COALESCE(p_payload->>'category_id', v_old_master.category_id),
        due_day = COALESCE((p_payload->>'due_day')::integer, v_old_master.due_day),
        frequency = COALESCE((p_payload->>'frequency')::public.recurring_frequency, v_old_master.frequency),
        start_date = COALESCE((p_payload->>'start_date')::date, v_old_master.start_date),
        end_date = COALESCE((p_payload->>'end_date')::date, v_old_master.end_date),
        status = COALESCE((p_payload->>'status')::public.recurring_status, v_old_master.status),
        updated_at = now()
    WHERE id = p_recurring_id
    RETURNING * INTO v_updated_master;

    v_new_data := to_jsonb(v_updated_master);
    PERFORM public.rpc_audit(v_user_id, 'recurring_update_global', 'recurring_entries', v_updated_master.id::text, v_old_data, v_new_data, 'Lançamento recorrente atualizado globalmente.');

    -- Opcionalmente, deleta todas as exceções se p_preserve_exceptions for FALSE
    IF NOT p_preserve_exceptions THEN
        DELETE FROM public.recurring_entry_exceptions
        WHERE recurring_id = p_recurring_id;
        PERFORM public.rpc_audit(v_user_id, 'exceptions_delete_all', 'recurring_entry_exceptions', p_recurring_id::text, NULL, NULL, 'Todas as exceções para o lançamento recorrente foram deletadas devido à atualização global.');
    END IF;

    RETURN v_updated_master;
END;
$$;

-- Concede permissões de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.rpc_audit(uuid, text, text, text, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_or_update_recurring_exception(uuid, integer, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_recurring_master_future(uuid, date, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_recurring_master_global(uuid, jsonb, boolean) TO authenticated;