INSERT INTO public.categorias (id, nome, icone, cor, parent_id, user_id)
VALUES ('alimentacao_pizza', 'Pizza', '🍕', 'hsl(30, 95%, 55%)', 'alimentacao', NULL)
ON CONFLICT (id) DO NOTHING;