-- Inserir a categoria principal 'Receitas e Investimentos'
INSERT INTO public.categorias (id, nome, icone, cor, parent_id, user_id)
VALUES
    ('receitas_e_investimentos', 'Receitas e Investimentos', '💵', 'hsl(150, 65%, 55%)', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    icone = EXCLUDED.icone,
    cor = EXCLUDED.cor,
    parent_id = EXCLUDED.parent_id,
    user_id = EXCLUDED.user_id;

-- Inserir as subcategorias de 'Receitas e Investimentos'
INSERT INTO public.categorias (id, nome, icone, cor, parent_id, user_id)
VALUES
    ('receitas_e_investimentos_salario', 'Salário', '💼', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_acoes', 'Ações (dividendos, venda de ações)', '📈', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_fundos', 'Fundos (rendimentos de fundos)', '💼', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_tesouro', 'Tesouro (juros, resgates)', '🏦', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_criptomoedas', 'Criptomoedas (lucros, vendas)', '🪙', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_poupanca', 'Poupança (rendimentos, resgates)', '💰', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_dividendos', 'Dividendos', '💰', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_aportes', 'Aportes (entrada de capital)', '➕', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_reembolsos', 'Reembolsos', '🔁', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_extras', 'Receitas Extras', '💸', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_juros_capital', 'Juros sobre capital', '📉', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_aluguel_imoveis', 'Aluguel de imóveis', '🏘️', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_outros_rendimentos', 'Outros rendimentos', '📝', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL),
    ('receitas_e_investimentos_cofrinho', 'Cofrinho', '🐷', 'hsl(150, 65%, 55%)', 'receitas_e_investimentos', NULL)
ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    icone = EXCLUDED.icone,
    cor = EXCLUDED.cor,
    parent_id = EXCLUDED.parent_id,
    user_id = EXCLUDED.user_id;

-- Opcional: Se você tinha categorias antigas 'receitas' ou 'investimentos' como raízes e deseja removê-las,
-- você pode usar os comandos DELETE abaixo. Certifique-se de que nenhuma transação esteja vinculada a elas
-- antes de deletar, ou atualize as transações para as novas categorias.
-- DELETE FROM public.categorias WHERE id = 'receitas';
-- DELETE FROM public.categorias WHERE id = 'investimentos';