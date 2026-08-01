-- MIGRAÇÃO DE DESPESAS FIXAS PARA recurring_entries
-- Este script irá INSERIR novos registros em recurring_entries e DELETAR os registros antigos de despesas e despesas_parcelas.
-- RECOMENDA-SE FORTEMENTE FAZER UM BACKUP DO SEU BANCO DE DADOS ANTES DE EXECUTAR ESTE SCRIPT.

BEGIN; -- Inicia uma transação para garantir atomicidade

-- 1. Coleta os dados das despesas fixas e calcula as datas de início e fim para a recorrência
WITH FixedExpensesToMigrate AS (
    SELECT
        d.id AS old_despesa_id,
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
-- 2. Insere os novos registros na tabela recurring_entries
INSERT INTO public.recurring_entries (
    user_id,
    type,
    title,
    value,
    category_id,
    due_day,
    frequency,
    start_date,
    end_date,
    status
)
SELECT
    fem.user_id,
    'despesa' AS type,
    fem.title,
    fem.value,
    fem.categoria_id,
    fem.due_day::integer, -- Garante que due_day seja INTEGER
    fem.frequency::public.recurring_frequency, -- Converte para o tipo ENUM
    fem.first_due_date AS start_date,
    CASE
        WHEN fem.installments_count IS NULL OR fem.installments_count <= 0 THEN NULL
        WHEN fem.frequency = 'monthly' THEN (fem.first_due_date + (fem.installments_count - 1) * INTERVAL '1 month')::date
        WHEN fem.frequency = 'quarterly' THEN (fem.first_due_date + (fem.installments_count - 1) * INTERVAL '3 months')::date
        WHEN fem.frequency = 'annually' THEN (fem.first_due_date + (fem.installments_count - 1) * INTERVAL '1 year')::date
        ELSE NULL
    END AS end_date,
    'active' AS status
FROM
    FixedExpensesToMigrate fem;

-- 3. Deleta as parcelas associadas às despesas fixas migradas
DELETE FROM public.despesas_parcelas
WHERE despesa_id IN (SELECT id FROM public.despesas WHERE is_fixed = TRUE);

-- 4. Deleta as despesas fixas originais da tabela despesas
DELETE FROM public.despesas
WHERE is_fixed = TRUE;

COMMIT; -- Confirma a transação se todas as operações foram bem-sucedidas