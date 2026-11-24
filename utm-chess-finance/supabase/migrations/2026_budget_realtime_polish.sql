-- ClubSync Budget Caps & Supabase Realtime Publication Polish
-- Idempotent & safe to re-run in Supabase SQL Editor.

-- 1. Ensure budgets.allocated_amount defaults cleanly to 0 and backfill NULLs
ALTER TABLE IF EXISTS public.budgets
  ADD COLUMN IF NOT EXISTS allocated_amount numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.budgets
SET allocated_amount = 0
WHERE allocated_amount IS NULL;

-- 2. Idempotently enable Supabase Realtime on live tracker tables
DO $$
DECLARE
  v_table text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    FOREACH v_table IN ARRAY ARRAY['claims', 'pre_claims', 'budgets', 'ledger_entries']
    LOOP
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = v_table
      ) AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END;
$$;
