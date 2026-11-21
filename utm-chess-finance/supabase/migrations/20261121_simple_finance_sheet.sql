-- ClubSync Simple Finance Sheet Migration
-- Idempotent & safe to re-run in Supabase SQL Editor.

-- 1. Starting Club Savings (Bank + Cash + Date) on club_settings
ALTER TABLE IF EXISTS public.club_settings
  ADD COLUMN IF NOT EXISTS opening_bank_balance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_cash_balance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_date date DEFAULT CURRENT_DATE;

-- 2. Update club_settings_public view keeping existing 13 columns in exact order, appending the 3 opening balance columns
CREATE OR REPLACE VIEW public.club_settings_public AS
SELECT
  id,
  club_name,
  current_batch,
  departments,
  owner_user_id,
  claim_approval_threshold,
  physical_cash,
  bg_style,
  bg_image_url,
  logo_url,
  payment_qr_url,
  payment_bank_info,
  updated_at,
  opening_bank_balance,
  opening_cash_balance,
  opening_balance_date
FROM public.club_settings;

GRANT SELECT ON public.club_settings_public TO authenticated, anon;

-- 3. Add Bank / Cash tag ('Bank' | 'Cash') across financial tables
ALTER TABLE IF EXISTS public.ledger_entries
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'Bank';

ALTER TABLE IF EXISTS public.claims
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'Bank';

ALTER TABLE IF EXISTS public.activity_fee_payments
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'Bank';

UPDATE public.ledger_entries SET account_type = 'Bank' WHERE account_type IS NULL;
UPDATE public.claims SET account_type = 'Bank' WHERE account_type IS NULL;
UPDATE public.activity_fee_payments SET account_type = 'Bank' WHERE account_type IS NULL;
