-- Exemplo 1: Inserir uma Categoria Principal (sem parent_id)
-- Esta categoria não tem um pai, então 'parent_id' é NULL.
-- 'user_id' também é NULL aqui, mas você pode substituí-lo pelo UUID de um usuário específico se quiser vincular a categoria a ele.
INSERT INTO public.categorias (nome, icone, cor, user_id, forma_pagamento, parent_id)
VALUES ('Moradia', '🏠', 'hsl(210, 70%, 50%)', NULL, NULL, NULL);

-- Exemplo 2: Inserir outra Categoria Principal
INSERT INTO public.categorias (nome, icone, cor, user_id, forma_pagamento, parent_id)
VALUES ('Alimentação', '🍔', 'hsl(30, 95%, 55%)', NULL, NULL, NULL);

-- --- IMPORTANTE PARA SUBCATEGORIAS ---
-- Para inserir uma subcategoria, você precisa do 'id' da categoria principal (ou de outra subcategoria) que será o seu pai.
-- Siga estes passos:

-- PASSO A: Obtenha o 'id' da categoria pai que você acabou de criar (ou de uma existente).
-- Execute a seguinte consulta no SQL Editor para encontrar o ID da categoria 'Moradia':
-- SELECT id FROM public.categorias WHERE nome = 'Moradia' AND user_id IS NULL;
-- (Se você vinculou a categoria a um usuário, substitua 'user_id IS NULL' pelo ID do usuário: WHERE nome = 'Moradia' AND user_id = 'SEU_USER_ID_AQUI')

-- PASSO B: Use o 'id' retornado na consulta acima para a coluna 'parent_id' da sua subcategoria.
-- Substitua 'ID_DA_CATEGORIA_MORADIA' pelo ID real que você obteve no PASSO A.

-- Exemplo 3: Inserir uma Subcategoria para 'Moradia'
INSERT INTO public.categorias (nome, icone, cor, user_id, forma_pagamento, parent_id)
VALUES ('Aluguel ou financiamento', '🏡', 'hsl(210, 70%, 50%)', NULL, NULL, 'ID_DA_CATEGORIA_MORADIA');

-- Exemplo 4: Inserir uma Subcategoria para 'Alimentação'
-- Primeiro, obtenha o ID da categoria 'Alimentação':
-- SELECT id FROM public.categorias WHERE nome = 'Alimentação' AND user_id IS NULL;
-- Substitua 'ID_DA_CATEGORIA_ALIMENTACAO' pelo ID real.
INSERT INTO public.categorias (nome, icone, cor, user_id, forma_pagamento, parent_id)
VALUES ('Supermercado', '🛒', 'hsl(30, 95%, 55%)', NULL, 'cartao', 'ID_DA_CATEGORIA_ALIMENTACAO');

-- Você pode continuar inserindo mais categorias e subcategorias seguindo o mesmo padrão.
-- Lembre-se de que 'icone' aceita emojis diretamente e 'cor' aceita strings HSL.