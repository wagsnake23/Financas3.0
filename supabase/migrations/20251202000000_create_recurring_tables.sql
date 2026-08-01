-- Create enums for recurring entries
CREATE TYPE public.recurring_frequency AS ENUM ('monthly', 'quarterly', 'annually');
CREATE TYPE public.recurring_status AS ENUM ('active', 'canceled');
CREATE TYPE public.recurring_type AS ENUM ('despesa', 'receita');

-- Create recurring_entries table
CREATE TABLE public.recurring_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid NOT NULL,
    type public.recurring_type NOT NULL,
    title text NOT NULL,
    value numeric NOT NULL,
    category_id text,
    due_day integer NOT NULL,
    frequency public.recurring_frequency NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status public.recurring_status DEFAULT 'active'::public.recurring_status NOT NULL,

    CONSTRAINT recurring_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT recurring_entries_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categorias(id) ON DELETE SET NULL,
    CONSTRAINT recurring_entries_due_day_check CHECK (due_day >= 1 AND due_day <= 31)
);

-- Enable Row Level Security (RLS) for recurring_entries
ALTER TABLE public.recurring_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for recurring_entries
CREATE POLICY "Users can view their own recurring entries." ON public.recurring_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring entries." ON public.recurring_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring entries." ON public.recurring_entries
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring entries." ON public.recurring_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Create recurring_entry_exceptions table
CREATE TABLE public.recurring_entry_exceptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    recurring_id uuid NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    canceled boolean DEFAULT false NOT NULL,
    paid boolean DEFAULT false NOT NULL,
    override_value numeric,
    override_category_id text,
    override_due_date date,
    note text,

    CONSTRAINT recurring_entry_exceptions_recurring_id_fkey FOREIGN KEY (recurring_id) REFERENCES public.recurring_entries(id) ON DELETE CASCADE,
    CONSTRAINT recurring_entry_exceptions_override_category_id_fkey FOREIGN KEY (override_category_id) REFERENCES public.categorias(id) ON DELETE SET NULL,
    CONSTRAINT recurring_entry_exceptions_month_check CHECK (month >= 1 AND month <= 12),
    CONSTRAINT recurring_entry_exceptions_unique_per_month UNIQUE (recurring_id, year, month)
);

-- Enable Row Level Security (RLS) for recurring_entry_exceptions
ALTER TABLE public.recurring_entry_exceptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for recurring_entry_exceptions
CREATE POLICY "Users can view their own recurring entry exceptions." ON public.recurring_entry_exceptions
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.recurring_entries WHERE id = recurring_id AND user_id = auth.uid()));

CREATE POLICY "Users can insert their own recurring entry exceptions." ON public.recurring_entry_exceptions
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.recurring_entries WHERE id = recurring_id AND user_id = auth.uid()));

CREATE POLICY "Users can update their own recurring entry exceptions." ON public.recurring_entry_exceptions
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.recurring_entries WHERE id = recurring_id AND user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.recurring_entries WHERE id = recurring_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete their own recurring entry exceptions." ON public.recurring_entry_exceptions
    FOR DELETE USING (EXISTS (SELECT 1 FROM public.recurring_entries WHERE id = recurring_id AND user_id = auth.uid()));