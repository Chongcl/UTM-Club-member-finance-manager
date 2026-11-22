-- ClubSync Pre-Claims, Cash Advances & Public Event Showcase / Guest Registration Migration
-- Idempotent & safe to re-run in Supabase SQL Editor.

-- ============================================================================
-- PART A: PRE-CLAIMS & OPTIONAL CASH ADVANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pre_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  matric_no text NOT NULL DEFAULT '',
  phone_number text NOT NULL DEFAULT '',
  budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  custom_event_name text DEFAULT '',
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Member',
  estimated_amount numeric(12,2) NOT NULL CHECK (estimated_amount > 0),
  approved_cap numeric(12,2),
  needed_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text DEFAULT '',
  quote_url text DEFAULT '',
  needs_cash_advance boolean NOT NULL DEFAULT false,
  advance_amount numeric(12,2) DEFAULT 0,
  payment_info text DEFAULT '',
  claimant_qr_url text DEFAULT '',
  advance_disbursed_amount numeric(12,2) DEFAULT 0,
  advance_disbursed_at timestamptz,
  advance_proof_url text DEFAULT '',
  advance_account_type text DEFAULT 'Bank' CHECK (advance_account_type IN ('Bank', 'Cash')),
  return_balance_amount numeric(12,2) DEFAULT 0,
  return_proof_url text DEFAULT '',
  return_verified_by text,
  return_verified_at timestamptz,
  linked_claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (
    status IN (
      'Pending',
      'Pre-Approved',
      'Advance Disbursed',
      'Receipt Submitted',
      'Settled',
      'Rejected',
      'Cancelled'
    )
  ),
  treasurer_verified_by text,
  treasurer_verified_at timestamptz,
  reviewed_by text,
  review_remarks text DEFAULT '',
  reviewed_at timestamptz,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.claims
  ADD COLUMN IF NOT EXISTS pre_claim_id uuid REFERENCES public.pre_claims(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pre_claims_status_created
  ON public.pre_claims (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pre_claims_user_created
  ON public.pre_claims (user_id, created_at DESC);

ALTER TABLE public.pre_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pre_claims_select_own_or_admin" ON public.pre_claims;
CREATE POLICY "pre_claims_select_own_or_admin"
  ON public.pre_claims FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_admin());

DROP POLICY IF EXISTS "pre_claims_insert_self" ON public.pre_claims;
CREATE POLICY "pre_claims_insert_self"
  ON public.pre_claims FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "pre_claims_update_admin_or_own_active" ON public.pre_claims;
CREATE POLICY "pre_claims_update_admin_or_own_active"
  ON public.pre_claims FOR UPDATE
  TO authenticated
  USING (
    public.current_user_is_admin()
    OR (
      user_id = auth.uid()
      AND status IN ('Pending', 'Pre-Approved', 'Advance Disbursed', 'Receipt Submitted')
    )
  )
  WITH CHECK (
    public.current_user_is_admin()
    OR user_id = auth.uid()
  );

-- ============================================================================
-- PART B: PUBLIC SHOWCASE & SHAREABLE GUEST REGISTRATION
-- ============================================================================

-- 1. Club Settings Public Branding Fields
ALTER TABLE IF EXISTS public.club_settings
  ADD COLUMN IF NOT EXISTS club_tagline text DEFAULT 'Campus activities, events, and student community — all in one portal.',
  ADD COLUMN IF NOT EXISTS club_about text DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email text DEFAULT '';

DROP VIEW IF EXISTS public.club_settings_public;
CREATE VIEW public.club_settings_public AS
SELECT
  id,
  club_name,
  logo_url,
  current_batch,
  owner_user_id,
  departments,
  payment_qr_url,
  payment_bank_info,
  bg_style,
  bg_image_url,
  opening_bank_balance,
  opening_cash_balance,
  opening_balance_date,
  claim_approval_threshold,
  club_tagline,
  club_about,
  instagram_url,
  contact_email
FROM public.club_settings;

GRANT SELECT ON public.club_settings_public TO anon, authenticated;

-- 2. Public Event Registration Fields on Budgets + Anon Scoped Policies
ALTER TABLE IF EXISTS public.budgets
  ADD COLUMN IF NOT EXISTS is_public_registration boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS guest_fee numeric(12,2),
  ADD COLUMN IF NOT EXISTS guest_capacity integer DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'budgets_public_slug_key'
      AND conrelid = 'public.budgets'::regclass
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_public_slug_key UNIQUE (public_slug);
  END IF;
END $$;

GRANT SELECT ON public.budgets TO anon;
GRANT SELECT ON public.announcements TO anon;

DROP POLICY IF EXISTS "budgets_select_public_registration_anon" ON public.budgets;
CREATE POLICY "budgets_select_public_registration_anon"
  ON public.budgets FOR SELECT
  TO anon
  USING (deleted_at IS NULL AND is_public_registration = true);

DROP POLICY IF EXISTS "announcements_select_public_anon" ON public.announcements;
CREATE POLICY "announcements_select_public_anon"
  ON public.announcements FOR SELECT
  TO anon
  USING (deleted_at IS NULL AND (show_in_carousel = true OR is_pinned = true));

-- 3. Public Guest Registrations Table (Strict Admin-Only Direct Access)
CREATE TABLE IF NOT EXISTS public.public_guest_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  lookup_code text UNIQUE NOT NULL,
  guest_name text NOT NULL,
  institution_or_matric text DEFAULT '',
  email text NOT NULL,
  phone_number text NOT NULL,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  account_type text DEFAULT 'Bank' CHECK (account_type IN ('Bank', 'Cash')),
  receipt_url text DEFAULT '',
  receipt_file_name text DEFAULT '',
  payment_status text NOT NULL DEFAULT 'Pending' CHECK (
    payment_status IN ('Free', 'Pending', 'Verified', 'Rejected')
  ),
  pass_approved boolean NOT NULL DEFAULT false,
  qr_checked_in boolean NOT NULL DEFAULT false,
  qr_checked_in_at timestamptz,
  notes text DEFAULT '',
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_regs_budget_created
  ON public.public_guest_registrations (budget_id, created_at DESC);

ALTER TABLE public.public_guest_registrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.public_guest_registrations FROM anon;

DROP POLICY IF EXISTS "guest_regs_select_admin" ON public.public_guest_registrations;
CREATE POLICY "guest_regs_select_admin"
  ON public.public_guest_registrations FOR SELECT
  TO authenticated
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "guest_regs_insert_admin" ON public.public_guest_registrations;
CREATE POLICY "guest_regs_insert_admin"
  ON public.public_guest_registrations FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS "guest_regs_update_admin" ON public.public_guest_registrations;
CREATE POLICY "guest_regs_update_admin"
  ON public.public_guest_registrations FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- 4. Public SECURITY DEFINER RPCs (Accessible to anon & authenticated without exposing user roster)
CREATE OR REPLACE FUNCTION public.get_public_club_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'member_count', (SELECT COUNT(*)::integer FROM public.users),
    'open_events_count', (
      SELECT COUNT(*)::integer
      FROM public.budgets
      WHERE deleted_at IS NULL
        AND status = 'Active'
        AND is_public_registration = true
    ),
    'total_events_count', (
      SELECT COUNT(*)::integer
      FROM public.budgets
      WHERE deleted_at IS NULL
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_club_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_club_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_event_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_slug text := lower(trim(COALESCE(p_slug, '')));
  v_b public.budgets%ROWTYPE;
  v_s public.club_settings%ROWTYPE;
  v_guest_count integer := 0;
  v_show_qr boolean := false;
  v_pay_qr text := '';
  v_pay_bank text := '';
  v_eff_fee numeric(12,2) := 0;
BEGIN
  IF v_clean_slug = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_b
  FROM public.budgets
  WHERE deleted_at IS NULL
    AND lower(public_slug) = v_clean_slug
    AND is_public_registration = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_s
  FROM public.club_settings
  WHERE id = 1
  LIMIT 1;

  SELECT COUNT(*)::integer INTO v_guest_count
  FROM public.public_guest_registrations
  WHERE budget_id = v_b.id
    AND deleted_at IS NULL
    AND payment_status <> 'Rejected';

  v_eff_fee := COALESCE(v_b.guest_fee, v_b.registration_fee, 0);
  v_show_qr := COALESCE(v_b.show_payment_qr, true);

  IF v_show_qr THEN
    v_pay_qr := COALESCE(NULLIF(trim(v_b.payment_qr_url), ''), NULLIF(trim(v_s.payment_qr_url), ''), '');
    v_pay_bank := COALESCE(NULLIF(trim(v_b.payment_bank_info), ''), NULLIF(trim(v_s.payment_bank_info), ''), '');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_b.id,
    'event_name', v_b.event_name,
    'category', v_b.category,
    'event_date', v_b.event_date,
    'event_time', v_b.event_time,
    'location', v_b.location,
    'description', v_b.description,
    'status', v_b.status,
    'is_open', (v_b.status = 'Active' AND v_b.is_public_registration = true),
    'public_slug', v_b.public_slug,
    'registration_fee', COALESCE(v_b.registration_fee, 0),
    'guest_fee', v_b.guest_fee,
    'effective_fee', v_eff_fee,
    'guest_capacity', COALESCE(v_b.guest_capacity, 0),
    'guest_registered_count', v_guest_count,
    'show_payment_qr', v_show_qr,
    'payment_qr_url', v_pay_qr,
    'payment_bank_info', v_pay_bank,
    'club_name', COALESCE(NULLIF(trim(v_s.club_name), ''), 'ClubSync'),
    'logo_url', COALESCE(v_s.logo_url, ''),
    'club_tagline', COALESCE(NULLIF(trim(v_s.club_tagline), ''), 'Campus activities, events, and student community — all in one portal.'),
    'current_batch', COALESCE(NULLIF(trim(v_s.current_batch), ''), '2026/2027')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_event_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_event_by_slug(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_guest_registration(
  p_slug text,
  p_name text,
  p_institution text,
  p_email text,
  p_phone text,
  p_amount numeric,
  p_receipt_url text,
  p_receipt_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_slug text := lower(trim(COALESCE(p_slug, '')));
  v_name text := trim(COALESCE(p_name, ''));
  v_inst text := trim(COALESCE(p_institution, ''));
  v_email text := lower(trim(COALESCE(p_email, '')));
  v_phone text := trim(COALESCE(p_phone, ''));
  v_receipt_url text := trim(COALESCE(p_receipt_url, ''));
  v_receipt_name text := trim(COALESCE(p_receipt_name, ''));
  v_b public.budgets%ROWTYPE;
  v_guest_count integer := 0;
  v_fee numeric(12,2) := 0;
  v_amt numeric(12,2) := 0;
  v_pay_status text := 'Pending';
  v_pass_approved boolean := false;
  v_code text := '';
  v_reg_id uuid;
  v_qr_token text := '';
  v_qr_payload text := NULL;
BEGIN
  IF v_name = '' OR v_email = '' OR v_phone = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Full name, email, and WhatsApp phone are required.');
  END IF;

  SELECT * INTO v_b
  FROM public.budgets
  WHERE deleted_at IS NULL
    AND lower(public_slug) = v_clean_slug
    AND is_public_registration = true
    AND status = 'Active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This event registration is closed or unavailable.');
  END IF;

  SELECT COUNT(*)::integer INTO v_guest_count
  FROM public.public_guest_registrations
  WHERE budget_id = v_b.id
    AND deleted_at IS NULL
    AND payment_status <> 'Rejected';

  IF COALESCE(v_b.guest_capacity, 0) > 0 AND v_guest_count >= v_b.guest_capacity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sorry, guest registration spots for this event are full.');
  END IF;

  v_fee := COALESCE(v_b.guest_fee, v_b.registration_fee, 0);

  IF v_fee > 0 THEN
    IF v_receipt_url = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Please upload your payment receipt before submitting.');
    END IF;
    v_amt := CASE WHEN COALESCE(p_amount, 0) > 0 THEN round(p_amount::numeric, 2) ELSE v_fee END;
    v_pay_status := 'Pending';
    v_pass_approved := false;
  ELSE
    v_amt := 0;
    v_pay_status := 'Free';
    v_pass_approved := true;
  END IF;

  LOOP
    v_code := 'GST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.public_guest_registrations WHERE lookup_code = v_code
    );
  END LOOP;

  INSERT INTO public.public_guest_registrations (
    budget_id,
    lookup_code,
    guest_name,
    institution_or_matric,
    email,
    phone_number,
    amount_paid,
    account_type,
    receipt_url,
    receipt_file_name,
    payment_status,
    pass_approved
  )
  VALUES (
    v_b.id,
    v_code,
    v_name,
    v_inst,
    v_email,
    v_phone,
    v_amt,
    'Bank',
    v_receipt_url,
    v_receipt_name,
    v_pay_status,
    v_pass_approved
  )
  RETURNING id INTO v_reg_id;

  IF v_pass_approved THEN
    v_qr_token := upper(COALESCE(NULLIF(trim(v_b.qr_code_token), ''), left(v_b.id::text, 6)));
    v_qr_payload := 'CLUBSYNC_GUEST::v1::' || v_b.id::text || '::' || v_reg_id::text || '::' || v_qr_token;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_reg_id,
    'lookup_code', v_code,
    'payment_status', v_pay_status,
    'pass_approved', v_pass_approved,
    'qr_payload', v_qr_payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_guest_registration(text, text, text, text, text, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_guest_registration(text, text, text, text, text, numeric, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_guest_registration_status(
  p_slug text,
  p_lookup_or_email text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_slug text := lower(trim(COALESCE(p_slug, '')));
  v_query text := lower(trim(COALESCE(p_lookup_or_email, '')));
  v_b public.budgets%ROWTYPE;
  v_reg public.public_guest_registrations%ROWTYPE;
  v_qr_token text := '';
  v_qr_payload text := NULL;
BEGIN
  IF v_clean_slug = '' OR v_query = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_b
  FROM public.budgets
  WHERE deleted_at IS NULL
    AND lower(public_slug) = v_clean_slug
    AND is_public_registration = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_reg
  FROM public.public_guest_registrations
  WHERE budget_id = v_b.id
    AND deleted_at IS NULL
    AND (lower(lookup_code) = v_query OR lower(email) = v_query)
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  IF v_reg.pass_approved THEN
    v_qr_token := upper(COALESCE(NULLIF(trim(v_b.qr_code_token), ''), left(v_b.id::text, 6)));
    v_qr_payload := 'CLUBSYNC_GUEST::v1::' || v_b.id::text || '::' || v_reg.id::text || '::' || v_qr_token;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_reg.id,
    'guest_name', v_reg.guest_name,
    'institution_or_matric', v_reg.institution_or_matric,
    'lookup_code', v_reg.lookup_code,
    'payment_status', v_reg.payment_status,
    'pass_approved', v_reg.pass_approved,
    'qr_checked_in', v_reg.qr_checked_in,
    'qr_checked_in_at', v_reg.qr_checked_in_at,
    'amount_paid', v_reg.amount_paid,
    'event_id', v_b.id,
    'event_name', v_b.event_name,
    'event_date', v_b.event_date,
    'event_time', v_b.event_time,
    'location', v_b.location,
    'qr_payload', v_qr_payload
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_guest_registration_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_guest_registration_status(text, text) TO anon, authenticated;

-- 5. Storage Upload Policy for Anonymous Guest Fee Slips ONLY into receipts/guest-fees/*
DROP POLICY IF EXISTS "anon_upload_guest_fee_receipts" ON storage.objects;
CREATE POLICY "anon_upload_guest_fee_receipts"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'receipts'
    AND name LIKE 'guest-fees/%'
  );
