-- Remove foreign key constraints first
ALTER TABLE public.despesas
DROP CONSTRAINT IF EXISTS despesas_recurring_entry_id_fkey;

ALTER TABLE public.receitas
DROP CONSTRAINT IF EXISTS receitas_recurring_entry_id_fkey;

-- Drop recurring_entry_exceptions table
DROP TABLE IF EXISTS public.recurring_entry_exceptions;

-- Drop recurring_entries table
DROP TABLE IF EXISTS public.recurring_entries;

-- Remove columns from 'despesas' table
ALTER TABLE public.despesas
DROP COLUMN IF EXISTS is_fixed,
DROP COLUMN IF EXISTS recurrence_frequency,
DROP COLUMN IF EXISTS recurrence_installments_count;

-- Remove columns from 'receitas' table
ALTER TABLE public.receitas
DROP COLUMN IF EXISTS is_fixed,
DROP COLUMN IF EXISTS recurrence_frequency,
DROP COLUMN IF EXISTS recurrence_installments_count;

-- Drop RPC functions related to recurring entries
DROP FUNCTION IF EXISTS public.rpc_create_or_update_recurring_exception(p_recurring_id uuid, p_year integer, p_month integer, p_payload jsonb);
DROP FUNCTION IF EXISTS public.rpc_update_recurring_master_future(p_recurring_id uuid, p_start_date date, p_payload jsonb, p_preserve_exceptions boolean);
DROP FUNCTION IF EXISTS public.rpc_update_recurring_master_global(p_recurring_id uuid, p_payload jsonb, p_preserve_exceptions boolean);

-- Drop Enums related to recurring entries
DROP TYPE IF EXISTS public.recurring_frequency;
DROP TYPE IF EXISTS public.recurring_status;
DROP TYPE IF EXISTS public.recurring_type;

-- Remove RLS policies for the dropped tables (if they exist)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.recurring_entries;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.recurring_entries;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.recurring_entries;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.recurring_entries;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.recurring_entry_exceptions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.recurring_entry_exceptions;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.recurring_entry_exceptions;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.recurring_entry_exceptions;