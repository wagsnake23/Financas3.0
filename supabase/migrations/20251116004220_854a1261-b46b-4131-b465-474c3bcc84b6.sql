-- Add payment_method column to categorias table
ALTER TABLE categorias 
ADD COLUMN IF NOT EXISTS forma_pagamento text;

COMMENT ON COLUMN categorias.forma_pagamento IS 'Forma de pagamento associada à categoria (PIX, cartão de crédito, etc.)';