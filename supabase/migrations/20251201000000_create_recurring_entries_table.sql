CREATE TABLE public.recurring_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type text CHECK (type IN ('despesa', 'receita')) NOT NULL,
    title text NOT NULL,
    value numeric NOT NULL,
    category_id text REFERENCES public.categorias(id) ON DELETE SET NULL,
    due_day int CHECK (due_day >= 1 AND due_day <= 31) NOT NULL,
    frequency text CHECK (frequency IN ('monthly', 'quarterly', 'annually')) NOT NULL,
    start_date date NOT NULL,
    end_date date NULL,
    status text CHECK (status IN ('active', 'canceled')) DEFAULT 'active' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.recurring_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recurring entries." ON public.recurring_entries
    FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_recurring_entries_user_id ON public.recurring_entries (user_id);
CREATE INDEX idx_recurring_entries_category_id ON public.recurring_entries (category_id);