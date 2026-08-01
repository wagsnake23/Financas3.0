CREATE TABLE public.shopping_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product text NOT NULL,
    status boolean DEFAULT FALSE,
    date text DEFAULT '',
    "order" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read shopping_items"
ON public.shopping_items FOR SELECT
TO authenticated
USING (auth.uid() = (SELECT user_id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Allow authenticated users to insert shopping_items"
ON public.shopping_items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = (SELECT user_id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Allow authenticated users to update shopping_items"
ON public.shopping_items FOR UPDATE
TO authenticated
USING (auth.uid() = (SELECT user_id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Allow authenticated users to delete shopping_items"
ON public.shopping_items FOR DELETE
TO authenticated
USING (auth.uid() = (SELECT user_id FROM auth.users WHERE id = auth.uid()));

-- Add a trigger to update 'updated_at' column automatically
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shopping_items_updated_at
BEFORE UPDATE ON public.shopping_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();