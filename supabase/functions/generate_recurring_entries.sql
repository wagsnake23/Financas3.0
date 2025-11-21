CREATE OR REPLACE FUNCTION public.generate_recurring_entries(
    p_user_id uuid,
    p_transaction_type text,
    p_master_id uuid,
    p_first_occurrence_date date,
    p_monthly_amount numeric,
    p_category_id text,
    p_description text,
    p_status public.receita_status, -- Only relevant for income
    p_recurrence_day integer,
    p_total_installments integer,
    p_forma_pagamento text DEFAULT NULL, -- Only relevant for expenses
    p_cartao_id uuid DEFAULT NULL,       -- Only relevant for expenses
    p_tipo_pagamento text DEFAULT NULL   -- Only relevant for expenses
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_day_to_use integer;
    v_installment_date date;
    v_current_month_start date;
    v_current_month_end date;
    v_existing_id uuid;
    v_is_master_updated boolean := FALSE;
BEGIN
    -- Determine the day to use for recurrence
    IF p_recurrence_day IS NOT NULL THEN
        v_day_to_use := p_recurrence_day;
    ELSE
        v_day_to_use := EXTRACT(DAY FROM p_first_occurrence_date)::integer;
    END IF;

    -- Loop to generate occurrences
    FOR i IN 0..(p_total_installments - 1) LOOP
        -- Calculate installment date safely (including February edge cases)
        v_installment_date := (p_first_occurrence_date + (i || ' months')::INTERVAL)::date;

        -- Start at day 1 to avoid invalid dates like 30/02 or 31/04
        v_installment_date := make_date(
            EXTRACT(YEAR FROM v_installment_date)::integer,
            EXTRACT(MONTH FROM v_installment_date)::integer,
            1
        );

        -- Apply desired day
        BEGIN
            v_installment_date := make_date(
                EXTRACT(YEAR FROM v_installment_date)::int,
                EXTRACT(MONTH FROM v_installment_date)::int,
                v_day_to_use
            );
        EXCEPTION WHEN OTHERS THEN
            -- fallback para meses com menos dias (ex.: fevereiro)
            v_installment_date := (
                date_trunc('month', v_installment_date) 
                + interval '1 month - 1 day'
            )::date;
        END;

        -- Clamp to last day of month (handles Feb 28/29 automatically)
        v_installment_date := LEAST(
            v_installment_date,
            (date_trunc('month', v_installment_date) + INTERVAL '1 month - 1 day')::date
        );

        -- Handle income transactions
        IF p_transaction_type = 'income' THEN
            -- Check if this is the master record itself (i=0)
            IF i = 0 THEN
                -- Update the master record with recurrence details if it hasn't been updated yet
                IF NOT v_is_master_updated THEN
                    UPDATE public.receitas
                    SET
                        data = v_installment_date,
                        valor = p_monthly_amount,
                        tipo_receita_id = p_category_id,
                        descricao = p_description,
                        status = p_status,
                        is_recurring_master = TRUE,
                        recurrence_id = p_master_id,
                        recurrence_day = v_day_to_use
                    WHERE id = p_master_id AND user_id = p_user_id;
                    v_is_master_updated := TRUE;
                END IF;
            ELSE
                -- Check for existing occurrence to prevent duplicates (idempotency)
                SELECT id INTO v_existing_id
                FROM public.receitas
                WHERE recurrence_id = p_master_id
                  AND data = v_installment_date
                  AND user_id = p_user_id;

                IF v_existing_id IS NULL THEN
                    INSERT INTO public.receitas (
                        user_id,
                        tipo_receita_id,
                        valor,
                        data,
                        descricao,
                        status,
                        is_recurring_master,
                        recurrence_id,
                        recurrence_day
                    ) VALUES (
                        p_user_id,
                        p_category_id,
                        p_monthly_amount,
                        v_installment_date,
                        p_description,
                        p_status,
                        FALSE, -- Not the master itself
                        p_master_id,
                        v_day_to_use
                    );
                END IF;
            END IF;

        -- Handle expense transactions
        ELSIF p_transaction_type = 'expense' THEN
            -- Check for existing installment to prevent duplicates (idempotency)
            SELECT id INTO v_existing_id
            FROM public.despesas_parcelas
            WHERE despesa_id = p_master_id
              AND vencimento = v_installment_date;

            IF v_existing_id IS NULL THEN
                INSERT INTO public.despesas_parcelas (
                    despesa_id,
                    numero_parcela,
                    valor_parcela,
                    vencimento,
                    pago,
                    data_pagamento
                ) VALUES (
                    p_master_id,
                    i + 1, -- Installment number
                    p_monthly_amount,
                    v_installment_date,
                    FALSE, -- Expenses are initially pending
                    NULL
                );
            END IF;

            -- Update the master 'despesas' record with total value and number of installments
            -- This ensures the master record reflects the sum of all generated installments
            UPDATE public.despesas
            SET
                valor_total = (SELECT SUM(valor_parcela) FROM public.despesas_parcelas WHERE despesa_id = p_master_id),
                numero_parcelas = (SELECT COUNT(id) FROM public.despesas_parcelas WHERE despesa_id = p_master_id),
                categoria_id = p_category_id,
                descricao = p_description,
                forma_pagamento = p_forma_pagamento,
                cartao_id = p_cartao_id,
                tipo_pagamento = p_tipo_pagamento,
                is_recurring_master = TRUE -- Ensure master flag is set
            WHERE id = p_master_id AND user_id = p_user_id;
        END IF;
    END LOOP;
END;
$$;