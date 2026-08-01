-- PRÉ-VISUALIZAÇÃO DA MIGRAÇÃO DE DESPESAS FIXAS PARA recurring_entries
-- Este script APENAS SELECIONA os dados que seriam migrados e deletados.
-- NENHUMA ALTERAÇÃO SERÁ FEITA NO SEU BANCO DE DADOS.

WITH FixedExpensesData AS (
    SELECT
        d.id AS despesa_id,
        d.user_id,
        d.descricao AS title,
        d.valor_total AS value,
        d.categoria_id,
        d.recurrence_frequency AS frequency,
        d.recurrence_installments_count AS installments_count,
        MIN(dp.vencimento) AS first_due_date,
        EXTRACT(DAY FROM MIN(dp.vencimento)) AS due_day
    FROM
        public.despesas d
    JOIN
        public.despesas_parcelas dp ON d.id = dp.despesa_id
    WHERE
        d.is_fixed = TRUE
    GROUP BY
        d.id, d.user_id, d.descricao, d.valor_total, d.categoria_id, d.recurrence_frequency, d.recurrence_installments_count
)
SELECT
    'INSERT INTO recurring_entries' AS action_type,
    fed.user_id,
    'despesa' AS type,
    fed.title,
    fed.value,
    fed.categoria_id AS category_id,
    fed.due_day,
    fed.frequency,
    fed.first_due_date AS start_date,
    CASE
        WHEN fed.installments_count IS NULL OR fed.installments_count <= 0 THEN NULL
        WHEN fed.frequency = 'monthly' THEN (fed.first_due_date + (fed.installments_count - 1) * INTERVAL '1 month')::date
        WHEN fed.frequency = 'quarterly' THEN (fed.first_due_date + (fed.installments_count - 1) * INTERVAL '3 months')::date
        WHEN fed.frequency = 'annually' THEN (fed.first_due_date + (fed.installments_count - 1) * INTERVAL '1 year')::date
        ELSE NULL
    END AS end_date,
    'active' AS status
FROM
    FixedExpensesData fed;

SELECT
    'DELETE FROM despesas_parcelas' AS action_type,
    dp.id AS parcela_id,
    dp.despesa_id
FROM
    public.despesas_parcelas dp
JOIN
    public.despesas d ON dp.despesa_id = d.id
WHERE
    d.is_fixed = TRUE;

SELECT
    'DELETE FROM despesas' AS action_type,
    d.id AS despesa_id
FROM
    public.despesas d
WHERE
    d.is_fixed = TRUE;