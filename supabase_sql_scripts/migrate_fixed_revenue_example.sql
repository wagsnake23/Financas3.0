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
) VALUES (
    'SEU_UUID_DE_USUARIO_AQUI', -- IMPORTANTE: Substitua este placeholder pelo ID real do seu usuário (um UUID válido do Supabase)
    'receita', -- 'receita' ou 'despesa'
    'Salário Mensal', -- Título do lançamento
    3000.00, -- Valor do lançamento
    'receitas_e_investimentos_salario', -- ID da categoria (substitua se necessário)
    1, -- Dia de vencimento (ex: dia 1 do mês)
    'monthly', -- Frequência: 'monthly', 'quarterly', 'annually'
    '2023-01-01', -- Data de início da recorrência
    NULL, -- Data de fim (NULL para indefinido)
    'active' -- Status: 'active' ou 'canceled'
);

-- Opcional: Após a migração, você pode deletar a entrada antiga da tabela 'receitas'
-- DELETE FROM public.receitas WHERE id = 'algum-uuid-antigo';