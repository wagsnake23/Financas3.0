ALTER TABLE despesas
ADD CONSTRAINT despesas_categoria_fkey
FOREIGN KEY (categoria_id)
REFERENCES categorias(id)
ON DELETE SET NULL;