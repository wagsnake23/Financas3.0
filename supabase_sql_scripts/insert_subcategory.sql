INSERT INTO public.categorias (
    nome,
    icone,
    cor,
    forma_pagamento,
    parent_id,
    user_id
) VALUES (
    'Aluguel ou financiamento', -- Ex: 'Aluguel ou financiamento', 'Supermercado'
    '🏡',                      -- Ex: '🏡', '🛒'
    'hsl(210, 70%, 50%)',      -- Escolha uma cor do seu palette
    'pix',                     -- Opcional. Ex: 'credit', 'pix', 'cash', ou NULL
    'COLE_O_UUID_DA_CATEGORIA_PRINCIPAL_AQUI', -- <<<<<< SUBSTITUA AQUI PELO ID DA CATEGORIA PRINCIPAL
    'COLE_O_UUID_DO_USUARIO_AQUI'        -- <<<<<< SUBSTITUA AQUI PELO ID DO SEU USUÁRIO
);