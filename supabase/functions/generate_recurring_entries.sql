CREATE OR REPLACE FUNCTION public.generate_recurring_entries(
    p_user_id UUID,
    p_transaction_type TEXT, -- 'income' or 'expense'
    p_master_id UUID, -- ID of the master record (already created by frontend)
    p_first_occurrence_date DATE, -- Date of the first occurrence (from master)
    p_monthly_amount NUMERIC, -- Monthly amount for income, or value per installment for expense
    p_category_id UUID,
    p_description TEXT,
    p_status public.receita_status DEFAULT 'Prevista', -- for income
    p_forma_pagamento TEXT DEFAULT NULL, -- for expense
    p_cartao_id UUID DEFAULT NULL, -- for expense
    p_tipo_pagamento TEXT DEFAULT NULL, -- for expense
    p_recurrence_day INTEGER DEFAULT 1, -- CORRIGIDO: Adicionado valor padrão
    p_total_installments INTEGER DEFAULT 120 -- Total number of installments including the first
)
RETURNS VOID AS $$
DECLARE
    v_installment_date DATE;
    v_existing_id UUID;
    v_start_index INTEGER := 1; -- Start from the second occurrence (index 1, installment 2)
BEGIN
    -- Ensure the user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: User ID mismatch or not authenticated.';
    END IF;

    IF p_transaction_type = 'income' THEN
        -- For income, insert (p_total_installments - 1) records into 'receitas' (from 2nd to p_total_installments)
        FOR i IN v_start_index..(p_total_installments - 1) LOOP
            v_installment_date := (p_first_occurrence_date + (i || ' months')::INTERVAL);
            -- Adjust to the specific recurrence day, handling month-end overflows
            v_installment_date := LEAST(
                make_date(EXTRACT(YEAR FROM v_installment_date)::INTEGER, EXTRACT(MONTH FROM v_installment_date)::INTEGER, p_recurrence_day),
                (date_trunc('month', v_installment_date) + INTERVAL '1 month - 1 day')::DATE -- Last day of the month
            );

            -- Idempotency check for receitas
            SELECT id INTO v_existing_id
            FROM public.receitas
            WHERE user_id = p_user_id
              AND recurrence_id = p_master_id
              AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM v_installment_date)
              AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM v_installment_date)
              AND is_recurring_master = FALSE; -- Only check for occurrences

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
                    FALSE, -- Occurrences are not masters
                    p_master_id,
                    p_recurrence_day
                );
            END IF;
        END LOOP;

    ELSIF p_transaction_type = 'expense' THEN
        -- For expense, insert (p_total_installments - 1) records into 'despesas_parcelas' (from 2nd to p_total_installments)
        -- The p_master_id here refers to the 'despesas' master record
        -- p_monthly_amount for expenses is the value per installment
        
        FOR i IN v_start_index..(p_total_installments - 1) LOOP
            v_installment_date := (p_first_occurrence_date + (i || ' months')::INTERVAL);
            -- Adjust to the specific recurrence day, handling month-end overflows
            v_installment_date := LEAST(
                make_date(EXTRACT(YEAR FROM v_installment_date)::INTEGER, EXTRACT(MONTH FROM v_installment_date)::INTEGER, p_recurrence_day),
                (date_trunc('month', v_installment_date) + INTERVAL '1 month - 1 day')::DATE -- Last day of the month
            );

            -- Idempotency check for despesas_parcelas
            SELECT id INTO v_existing_id
            FROM public.despesas_parcelas
            WHERE despesa_id = p_master_id
              AND numero_parcela = (i + 1); -- Check by installment number

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
                    (i + 1),
                    p_monthly_amount, -- Use p_monthly_amount as valor_parcela
                    v_installment_date,
                    FALSE, -- Recurring expenses are initially pending
                    NULL
                );
            END IF;
        END LOOP;

        -- Update the master despesas record with the total number of installments and total value
        UPDATE public.despesas
        SET numero_parcelas = p_total_installments,
            valor_total = p_monthly_amount * p_total_installments, -- Total value is monthly amount * total installments
            is_recurring_master = TRUE -- Mark as recurring master
        WHERE id = p_master_id;

    ELSE
        RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_recurring_entries TO authenticated;