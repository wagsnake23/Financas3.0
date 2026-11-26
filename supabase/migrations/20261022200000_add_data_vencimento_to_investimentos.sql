-- Migration: Add data_vencimento and check constraint to public.investimentos
-- Description: Campo opcional de data de vencimento no módulo Investimentos
-- Restrição: data_vencimento IS NULL OR data_vencimento >= data

ALTER TABLE public.investimentos
ADD COLUMN IF NOT EXISTS data_vencimento DATE NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_data_vencimento'
  ) THEN
    ALTER TABLE public.investimentos
    ADD CONSTRAINT check_data_vencimento
    CHECK (
      data_vencimento IS NULL
      OR data_vencimento >= data
    );
  END IF;
END $$;
