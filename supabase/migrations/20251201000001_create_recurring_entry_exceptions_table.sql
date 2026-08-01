CREATE TABLE public.recurring_entry_exceptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_id uuid REFERENCES public.recurring_entries(id) ON DELETE CASCADE NOT NULL,
    year int NOT NULL,
    month int CHECK (month >= 1 AND month <= 12) NOT NULL,
    override_value numeric NULL,
    override_category_id text REFERENCES public.categorias(id) ON DELETE SET NULL,
    override_due_date date NULL,
    canceled boolean DEFAULT false NOT NULL,
    paid boolean DEFAULT false NOT NULL,
    note text NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    
    CONSTRAINT unique_recurring_month UNIQUE (recurring_id, year, month)
);

ALTER TABLE public.recurring_entry_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recurring entry exceptions." ON public.recurring_entry_exceptions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.recurring_entries WHERE id = recurring_id AND user_id = auth.uid())
    );

CREATE INDEX idx_recurring_exceptions_recurring_id ON public.recurring_entry_exceptions (recurring_id);
CREATE INDEX idx_recurring_exceptions_year_month ON public.recurring_entry_exceptions (year, month);