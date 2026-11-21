-- Ensure user default Bank & DuitNow/TNG QR columns exist on public.users
-- Idempotent & safe to re-run in Supabase SQL Editor.

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS bank_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account_no text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account_holder text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_qr_url text DEFAULT '';
