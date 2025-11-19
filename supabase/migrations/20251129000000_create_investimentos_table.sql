CREATE TABLE public.investimentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    nome text NOT NULL,
    tipo text NOT NULL,
    valor numeric NOT NULL,
    data date NOT NULL,
    rentabilidade numeric NOT NULL
);

ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own investments" ON public.investimentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own investments" ON public.investimentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own investments" ON public.investimentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own investments" ON public.investimentos FOR DELETE USING (auth.uid() = user_id);