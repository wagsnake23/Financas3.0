CREATE OR REPLACE FUNCTION public.generate_recurring_entries(
    p_user_id uuid,
    p_transaction_type text, -- 'income' or 'expense'
    p_master_id uuid,
    p_first_occurrence_date date,
    p_monthly_amount numeric,
    p_category_id text,
    p_description text,
    p_status public.receita_status DEFAULT 'Prevista', -- Only for income
    p_forma_pagamento text DEFAULT NULL, -- Only for expense
    p_cartao_id text DEFAULT NULL, -- Only for expense
    p_tipo_pagamento text DEFAULT NULL, -- Only for expense
    p_recurrence_day integer DEFAULT NULL,
    p_total_installments integer DEFAULT 120 -- Total number of occurrences to generate
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_installment_date date;
    v_day_to_use integer;
    v_master_status public.receita_status;
    v_exists boolean;
BEGIN
    -- Determine the day to use for recurrence
    IF p_recurrence_day IS NOT NULL AND p_recurrence_day >= 1 AND p_recurrence_day <= 31 THEN
        v_day_to_use := p_recurrence_day;
    ELSE
        v_day_to_use := EXTRACT(DAY FROM p_first_occurrence_date)::integer;
    END IF;

    -- Fetch the status of the master record for income, if it exists
    IF p_transaction_type = 'income' THEN
        SELECT status INTO v_master_status FROM public.receitas WHERE id = p_master_id AND user_id = p_user_id;
    END IF;

    FOR i IN 0..(p_total_installments - 1) LOOP -- Start from 0 to include the first month
        -- Calculate installment date safely
        v_installment_date := (p_first_occurrence_date + (i || ' months')::INTERVAL)::date;

        -- Ajuste seguro para datas (não gerar 30/02, 31/04 etc.)
        v_installment_date := make_date(
            EXTRACT(YEAR FROM v_installment_date)::integer,
            EXTRACT(MONTH FROM v_installment_date)::integer,
            1 -- Start with the 1st of the month
        );
        v_installment_date := v_installment_date + (v_day_to_use - 1) * INTERVAL '1 day';

        -- Ensure the day does not exceed the actual days in the month
        v_installment_date := least(
            v_installment_date,
            (date_trunc('month', v_installment_date) + interval '1 month - 1 day')::date
        );

        IF p_transaction_type = 'income' THEN
            -- Idempotency check for income occurrences
            SELECT EXISTS (
                SELECT 1 FROM public.receitas
                WHERE recurrence_id = p_master_id
                AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM v_installment_date)
                AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM v_installment_date)
                AND user_id = p_user_id
            ) INTO v_exists;

            IF NOT v_exists THEN
                IF i = 0 THEN
                    -- Update the master record (which is the first occurrence)
                    UPDATE public.receitas
                    SET
                        data = v_installment_date,
                        valor = p_monthly_amount,
                        tipo_receita_id = p_category_id,
                        descricao = p_description,
                        status = v_master_status, -- Preserve the original status of the master
                        recurrence_day = v_day_to_use,
                        is_recurring_master = TRUE,
                        recurrence_id = p_master_id
                    WHERE id = p_master_id AND user_id = p_user_id;
                ELSE
                    -- Insert subsequent occurrences
                    INSERT INTO public.receitas (
                        id, user_id, tipo_receita_id, valor, data, descricao, status,
                        is_recurring_master, recurrence_id, recurrence_day
                    ) VALUES (
                        gen_random_uuid(), p_user_id, p_category_id, p_monthly_amount, v_installment_date, p_description, p_status,
                        FALSE, p_master_id, v_day_to_use
                    );
                END IF;
            END IF; -- END IF NOT v_exists

        ELSIF p_transaction_type = 'expense' THEN
            -- Idempotency check for expense installments
            SELECT EXISTS (
                SELECT 1 FROM public.despesas_parcelas
                WHERE despesa_id = p_master_id
                AND EXTRACT(YEAR FROM vencimento) = EXTRACT(YEAR FROM v_installment_date)
                AND EXTRACT(MONTH FROM vencimento) = EXTRACT(MONTH FROM v_installment_date)
            ) INTO v_exists;

            IF NOT v_exists THEN
                -- For expenses, insert into despesas_parcelas
                INSERT INTO public.despesas_parcelas (
                    id, despesa_id, numero_parcela, valor_parcela, vencimento, pago, data_pagamento
                ) VALUES (
                    gen_random_uuid(), p_master_id, i + 1, p_monthly_amount, v_installment_date, FALSE, NULL
                );
            END IF; -- END IF NOT v_exists
        END IF;
    END LOOP;

    -- After generating all installments for expenses, update the master despesas record's total_value and num_installments
    IF p_transaction_type = 'expense' THEN
        UPDATE public.despesas
        SET
            valor_total = (SELECT SUM(valor_parcela) FROM public.despesas_parcelas WHERE despesa_id = p_master_id),
            numero_parcelas = (SELECT COUNT(id) FROM public.despesas_parcelas WHERE despesa_id = p_master_id)
        WHERE id = p_master_id;
    END IF;

END;
$$;