-- ClubSync Phase 1 Migration: Trust, Data Integrity & Shared Database State
-- Idempotent & safe to re-run in Supabase SQL Editor.

-- 1. Helper functions for RLS (SECURITY DEFINER avoids infinite recursion on users RLS)
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('treasurer', 'owner')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'owner'
  );
$$;

-- 2. Extend club_settings with shared business fields (no stale localStorage needed)
ALTER TABLE IF EXISTS public.club_settings
  ADD COLUMN IF NOT EXISTS physical_cash numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bg_style text DEFAULT 'emerald-aurora',
  ADD COLUMN IF NOT EXISTS bg_image_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_qr_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_bank_info text DEFAULT '',
  ADD COLUMN IF NOT EXISTS claim_approval_threshold numeric DEFAULT 200,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS admin_pin text DEFAULT 'EXEC-2026',
  ADD COLUMN IF NOT EXISTS owner_pin text DEFAULT 'OWNER-2026',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

INSERT INTO public.club_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. Extend budgets with per-event QR, payment & pass settings
ALTER TABLE IF EXISTS public.budgets
  ADD COLUMN IF NOT EXISTS ticket_qr_mode text,
  ADD COLUMN IF NOT EXISTS pass_approval_rule text DEFAULT 'auto_after_payment',
  ADD COLUMN IF NOT EXISTS payment_qr_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_bank_info text DEFAULT '',
  ADD COLUMN IF NOT EXISTS show_payment_qr boolean DEFAULT true;

-- 4. Extend polls with DB-backed show_results flag
ALTER TABLE IF EXISTS public.polls
  ADD COLUMN IF NOT EXISTS show_results boolean DEFAULT true;

-- 5. Extend claims with claimant QR, bank & payout proof columns
ALTER TABLE IF EXISTS public.claims
  ADD COLUMN IF NOT EXISTS claimant_qr_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_info text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payout_proof_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payout_proof_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 6. Real deleted_at soft-delete columns & partial indexes on all tracked tables
ALTER TABLE IF EXISTS public.budgets
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by text NULL;
ALTER TABLE IF EXISTS public.claims
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by text NULL;
ALTER TABLE IF EXISTS public.activity_fee_payments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by text NULL;
ALTER TABLE IF EXISTS public.equipment_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by text NULL;
ALTER TABLE IF EXISTS public.equipment_loans
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by text NULL;
ALTER TABLE IF EXISTS public.ledger_entries
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by text NULL;
ALTER TABLE IF EXISTS public.announcements
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by text NULL;
ALTER TABLE IF EXISTS public.polls
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by text NULL;
ALTER TABLE IF EXISTS public.event_rsvps
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by text NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_active ON public.budgets (event_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_claims_active ON public.claims (created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fee_payments_active ON public.activity_fee_payments (budget_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_entries_active ON public.ledger_entries (entry_date) WHERE deleted_at IS NULL;

-- 7. Shared Budget Planner table (replaces clubsync_budget_planner_v1 localStorage)
CREATE TABLE IF NOT EXISTS public.budget_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id text NOT NULL DEFAULT 'ALL',
  entry_type text NOT NULL CHECK (entry_type IN ('IN', 'OUT')),
  item text NOT NULL,
  category text NOT NULL DEFAULT '',
  planned_amount numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_by uuid,
  deleted_at timestamptz NULL,
  deleted_by text NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_plan_items_active ON public.budget_plan_items (budget_id) WHERE deleted_at IS NULL;

ALTER TABLE public.budget_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_plan_select_authenticated" ON public.budget_plan_items;
CREATE POLICY "budget_plan_select_authenticated"
  ON public.budget_plan_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "budget_plan_write_admins" ON public.budget_plan_items;
CREATE POLICY "budget_plan_write_admins"
  ON public.budget_plan_items FOR ALL
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- 8. Privacy-safe views for club_settings and users
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
  updated_at
FROM public.club_settings;

GRANT SELECT ON public.club_settings_public TO authenticated, anon;

CREATE OR REPLACE VIEW public.users_public AS
SELECT
  id,
  full_name,
  matric_no,
  member_type,
  batch_year,
  role,
  member_status
FROM public.users;

GRANT SELECT ON public.users_public TO authenticated;

-- 9. RLS on club_settings (PIN columns readable directly only by Owner; view serves non-sensitive fields)
ALTER TABLE public.club_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_settings_select_admin_owner" ON public.club_settings;
CREATE POLICY "club_settings_select_admin_owner"
  ON public.club_settings FOR SELECT
  TO authenticated
  USING (public.current_user_is_owner());

DROP POLICY IF EXISTS "club_settings_update_admin_owner" ON public.club_settings;
CREATE POLICY "club_settings_update_admin_owner"
  ON public.club_settings FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "club_settings_insert_owner" ON public.club_settings;
CREATE POLICY "club_settings_insert_owner"
  ON public.club_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_owner());

-- 10. RLS on users (regular members read only own full row; admins/owners read roster)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;
CREATE POLICY "users_select_self_or_admin"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.current_user_is_admin());

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id OR public.current_user_is_admin());

DROP POLICY IF EXISTS "users_update_self_or_admin" ON public.users;
CREATE POLICY "users_update_self_or_admin"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.current_user_is_admin())
  WITH CHECK (auth.uid() = id OR public.current_user_is_admin());

-- 11. Server-side Passcode RPCs (no hardcoded passcodes in frontend JS)
CREATE OR REPLACE FUNCTION public.verify_role_passcode(pin_input text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pin text := upper(trim(coalesce(pin_input, '')));
  v_owner_pin text;
  v_admin_pin text;
  v_user record;
  v_full_perms jsonb := '{"can_manage_activities":true,"can_manage_posters_polls":true,"can_manage_equipment":true,"can_manage_claims_fees":true,"can_manage_transport":true,"can_manage_finance":true,"can_manage_members":true}'::jsonb;
  v_default_perms jsonb := '{"can_manage_activities":true,"can_manage_posters_polls":true,"can_manage_equipment":true,"can_manage_claims_fees":false,"can_manage_transport":true,"can_manage_finance":false,"can_manage_members":false}'::jsonb;
BEGIN
  IF v_uid IS NULL OR v_pin = '' THEN
    RETURN jsonb_build_object('ok', false, 'role', null);
  END IF;

  SELECT
    upper(trim(coalesce(owner_pin, 'OWNER-2026'))),
    upper(trim(coalesce(admin_pin, 'EXEC-2026')))
  INTO v_owner_pin, v_admin_pin
  FROM public.club_settings
  WHERE id = 1;

  v_owner_pin := coalesce(v_owner_pin, 'OWNER-2026');
  v_admin_pin := coalesce(v_admin_pin, 'EXEC-2026');

  SELECT * INTO v_user FROM public.users WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'role', null);
  END IF;

  IF v_pin = v_owner_pin THEN
    UPDATE public.users SET role = 'treasurer' WHERE role = 'owner' AND id <> v_uid;
    UPDATE public.users
    SET role = 'owner', admin_permissions = v_full_perms
    WHERE id = v_uid;
    UPDATE public.club_settings SET owner_user_id = v_uid WHERE id = 1;

    INSERT INTO public.activity_logs (actor_id, actor_name, actor_matric, actor_role, category, action, details)
    VALUES (
      v_uid,
      coalesce(v_user.full_name, 'User'),
      coalesce(v_user.matric_no, ''),
      'Owner',
      'Members',
      'Unlocked Owner mode',
      coalesce(v_user.full_name, 'User') || ' unlocked Owner mode via verified passcode'
    );

    RETURN jsonb_build_object('ok', true, 'role', 'owner');
  END IF;

  IF v_pin = v_admin_pin THEN
    IF v_user.role = 'member' THEN
      UPDATE public.users
      SET role = 'treasurer', admin_permissions = coalesce(admin_permissions, v_default_perms)
      WHERE id = v_uid;
    END IF;

    INSERT INTO public.activity_logs (actor_id, actor_name, actor_matric, actor_role, category, action, details)
    VALUES (
      v_uid,
      coalesce(v_user.full_name, 'User'),
      coalesce(v_user.matric_no, ''),
      'Admin',
      'Members',
      'Unlocked Admin mode',
      coalesce(v_user.full_name, 'User') || ' unlocked Admin mode via verified passcode'
    );

    RETURN jsonb_build_object('ok', true, 'role', 'admin');
  END IF;

  RETURN jsonb_build_object('ok', false, 'role', null);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_role_passcode(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_club_passcodes(new_admin_pin text, new_owner_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user record;
  v_admin text := trim(coalesce(new_admin_pin, ''));
  v_owner text := trim(coalesce(new_owner_pin, ''));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = v_uid;
  IF NOT FOUND OR v_user.role <> 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Owner only');
  END IF;

  IF v_admin = '' OR v_owner = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Passcodes cannot be empty');
  END IF;

  UPDATE public.club_settings
  SET admin_pin = v_admin, owner_pin = v_owner, updated_at = now()
  WHERE id = 1;

  INSERT INTO public.activity_logs (actor_id, actor_name, actor_matric, actor_role, category, action, details)
  VALUES (
    v_uid,
    coalesce(v_user.full_name, 'Owner'),
    coalesce(v_user.matric_no, ''),
    'Owner',
    'Settings',
    'Passcodes updated',
    coalesce(v_user.full_name, 'Owner') || ' updated club passcodes'
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_club_passcodes(text, text) TO authenticated;
