-- Add user_id column
ALTER TABLE public.shopping_items
ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Enable Row Level Security
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can select their own rows" ON public.shopping_items
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rows" ON public.shopping_items
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rows" ON public.shopping_items
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rows" ON public.shopping_items
FOR DELETE USING (auth.uid() = user_id);

-- Optionally, update existing rows with a default user_id if needed,
-- but for a new feature, it's often better to ensure new inserts have it.
-- If you have existing data that needs to be assigned to a user,
-- you would run an UPDATE statement here, e.g.:
-- UPDATE public.shopping_items SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
-- (Be careful with this if you have multiple users and unassigned data)