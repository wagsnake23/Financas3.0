-- Manual balance adjustment

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS saldo_ajuste NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS saldo_ajuste_updated_at TIMESTAMPTZ NULL;
