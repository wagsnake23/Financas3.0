CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type text NOT NULL, -- Ex: 'create', 'update', 'delete', 'exception_create', 'exception_update', 'recurring_end', 'recurring_update_global', 'recurring_update_future'
    table_name text NOT NULL, -- Ex: 'recurring_entries', 'recurring_entry_exceptions'
    record_id text, -- ID do registro afetado (pode ser recurring_id ou exception_id)
    old_data jsonb,
    new_data jsonb,
    notes text
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (auth.uid() = user_id);