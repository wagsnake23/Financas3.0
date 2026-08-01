-- Create the enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.receita_status AS ENUM ('Prevista', 'Pendente', 'Recebida', 'Cancelada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add the status column to the receitas table
ALTER TABLE public.receitas
ADD COLUMN status public.receita_status NOT NULL DEFAULT 'Pendente';