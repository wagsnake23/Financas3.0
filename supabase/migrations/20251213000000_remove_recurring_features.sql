-- Remove foreign key constraints first
ALTER TABLE public.despesas
DROP CONSTRAINT IF EXISTS despesas_recurring_entry_id_fkey;

ALTER TABLE public.receitas
DROP CONSTRAINT IF EXISTS receitas_recurring_entry_id_fkey;

-- Drop RPC functions related to recurring entries (ensure all are listed and dropped before tables)
DROP FUNCTION IF EXISTS public.rpc_create_or_update_recurring_exception(p_recurring_id uuid, p_year integer, p_month integer, p_payload jsonb);
DROP FUNCTION IF EXISTS public.rpc_update_recurring_master_future(p_recurring_id uuid, p_start_date date, p_payload jsonb, p_preserve_exceptions boolean);
DROP FUNCTION IF EXISTS public.rpc_update_recurring_master_global(p_recurring_id uuid, p_payload jsonb, p_preserve_exceptions boolean);
DROP FUNCTION IF EXISTS public.rpc_edit_recurring_entry(uuid,integer,integer,text,jsonb);

-- Drop recurring_entry_exceptions table with CASCADE
DROP TABLE IF EXISTS public.recurring_entry_exceptions CASCADE;

-- Drop recurring_entries table with CASCADE
DROP TABLE IF EXISTS public.recurring_entries CASCADE;

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

-- Drop Enums related to recurring entries
DROP TYPE IF EXISTS public.recurring_frequency;
DROP TYPE IF EXISTS public.recurring_status;
DROP TYPE IF EXISTS public.recurring_type;

-- RLS policies for the dropped tables are handled by CASCADE on table drops.
-- Explicit DROP POLICY statements for these tables are no longer needed and were causing the error.