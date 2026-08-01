INSERT INTO public.categorias (
    nome,
    icone,
    cor,
    forma_pagamento,
    parent_id, -- Para uma categoria principal, este deve ser NULL
    user_id
) VALUES (
    'Moradia', -- Ex: 'Moradia', 'Alimentação', 'Transporte'
    '🏠',      -- Ex: '🏠', '🍔', '🚗'
    'hsl(210, 70%, 50%)', -- Escolha uma cor do seu palette
    NULL,      -- Forma de pagamento opcional para a categoria principal, ou NULL
    NULL,      -- ESTE É NULL PARA CATEGORIAS PRINCIPAIS
    'SEU_ID_DE_USUARIO_REAL_AQUI' -- <<<<<<< SUBSTITUA AQUI PELO UUID REAL QUE VOCÊ COPIOU DO SUPABASE
);