CREATE OR REPLACE FUNCTION public.rpc_edit_recurring_entry(
    p_recurring_id uuid,
    p_year integer,
    p_month integer,
    p_modo text,
    p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Ensure the user owns the recurring entry
    SELECT user_id INTO v_user_id FROM public.recurring_entries WHERE id = p_recurring_id;

    IF v_user_id IS NULL OR v_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Recurring entry with ID % not found or not owned by current user.', p_recurring_id;
    END IF;

    IF p_modo = 'este_mes' THEN
        -- Call the existing RPC for creating/updating an exception
        PERFORM public.rpc_create_or_update_recurring_exception(
            p_recurring_id,
            p_year,
            p_month,
            p_payload
        );
    ELSIF p_modo = 'deste_mes_em_diante' THEN
        -- Logic for updating master from this month forward
        -- This would involve calling rpc_update_recurring_master_future
        RAISE EXCEPTION 'Modo "deste_mes_em_diante" não implementado para esta função.';
    ELSIF p_modo = 'toda_recorrencia' THEN
        -- Logic for updating the entire recurring master
        -- This would involve calling rpc_update_recurring_master_global
        RAISE EXCEPTION 'Modo "toda_recorrencia" não implementado para esta função.';
    ELSE
        RAISE EXCEPTION 'Modo de edição "%" inválido.', p_modo;
    END IF;
END;
$$;