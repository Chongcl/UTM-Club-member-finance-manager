-- ClubSync Phase 1 + Flexible Activity & Fee Collection Engine Migration
-- Idempotent & safe to re-run in Supabase SQL Editor.

-- 1. Optional flexible scheduling & configuration columns on public.budgets
ALTER TABLE IF EXISTS public.budgets
  ADD COLUMN IF NOT EXISTS end_date text,
  ADD COLUMN IF NOT EXISTS activity_config jsonb DEFAULT '{}'::jsonb;

-- 2. Optional tier & registration note columns on fee payment tables
ALTER TABLE IF EXISTS public.activity_fee_payments
  ADD COLUMN IF NOT EXISTS selected_tier text DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_note text DEFAULT '';

ALTER TABLE IF EXISTS public.public_guest_registrations
  ADD COLUMN IF NOT EXISTS selected_tier text DEFAULT '',
  ADD COLUMN IF NOT EXISTS registration_note text DEFAULT '';

-- 3. Update get_public_event_by_slug (ALWAYS strips secret access_link_url / access_code / access_instructions)
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
  v_safe_config jsonb := '{}'::jsonb;
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

  -- Strip sensitive post-payment access secrets from public event payload
  v_safe_config := COALESCE(v_b.activity_config, '{}'::jsonb)
    - 'access_link_url'
    - 'access_code'
    - 'access_instructions';

  RETURN jsonb_build_object(
    'found', true,
    'id', v_b.id,
    'event_name', v_b.event_name,
    'category', v_b.category,
    'event_date', v_b.event_date,
    'end_date', v_b.end_date,
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
    'activity_config', v_safe_config,
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

-- 4. Update submit_guest_registration (supports optional selected_tier & registration_note; only reveals secrets when pass_approved OR free)
DROP FUNCTION IF EXISTS public.submit_guest_registration(text, text, text, text, text, numeric, text, text);
DROP FUNCTION IF EXISTS public.submit_guest_registration(text, text, text, text, text, numeric, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_guest_registration(
  p_slug text,
  p_name text,
  p_institution text,
  p_email text,
  p_phone text,
  p_amount numeric,
  p_receipt_url text,
  p_receipt_name text,
  p_selected_tier text DEFAULT '',
  p_registration_note text DEFAULT ''
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
  v_tier text := trim(COALESCE(p_selected_tier, ''));
  v_note text := trim(COALESCE(p_registration_note, ''));
  v_b public.budgets%ROWTYPE;
  v_cfg jsonb := '{}'::jsonb;
  v_guest_count integer := 0;
  v_fee numeric(12,2) := 0;
  v_amt numeric(12,2) := 0;
  v_pay_status text := 'Pending';
  v_pass_approved boolean := false;
  v_code text := '';
  v_reg_id uuid;
  v_qr_token text := '';
  v_qr_payload text := NULL;
  v_access_url text := NULL;
  v_access_label text := NULL;
  v_access_code text := NULL;
  v_access_instructions text := NULL;
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

  v_cfg := COALESCE(v_b.activity_config, '{}'::jsonb);
  v_fee := COALESCE(v_b.guest_fee, v_b.registration_fee, 0);

  IF COALESCE(p_amount, 0) > 0 OR v_fee > 0 THEN
    IF v_receipt_url = '' AND v_fee > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Please upload your payment receipt before submitting.');
    END IF;
    IF v_receipt_url <> '' THEN
      v_amt := CASE WHEN COALESCE(p_amount, 0) > 0 THEN round(p_amount::numeric, 2) ELSE v_fee END;
      v_pay_status := 'Pending';
      v_pass_approved := false;
    ELSE
      v_amt := 0;
      v_pay_status := 'Free';
      v_pass_approved := true;
    END IF;
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
    selected_tier,
    registration_note,
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
    v_tier,
    v_note,
    v_pay_status,
    v_pass_approved
  )
  RETURNING id INTO v_reg_id;

  IF v_pass_approved OR v_pay_status = 'Free' THEN
    v_qr_token := upper(COALESCE(NULLIF(trim(v_b.qr_code_token), ''), left(v_b.id::text, 6)));
    v_qr_payload := 'CLUBSYNC_GUEST::v1::' || v_b.id::text || '::' || v_reg_id::text || '::' || v_qr_token;
    v_access_url := NULLIF(trim(COALESCE(v_cfg->>'access_link_url', '')), '');
    v_access_label := NULLIF(trim(COALESCE(v_cfg->>'access_link_label', '')), '');
    v_access_code := NULLIF(trim(COALESCE(v_cfg->>'access_code', '')), '');
    v_access_instructions := NULLIF(trim(COALESCE(v_cfg->>'access_instructions', '')), '');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_reg_id,
    'lookup_code', v_code,
    'payment_status', v_pay_status,
    'pass_approved', v_pass_approved,
    'qr_payload', v_qr_payload,
    'selected_tier', v_tier,
    'registration_note', v_note,
    'access_link_url', v_access_url,
    'access_link_label', v_access_label,
    'access_code', v_access_code,
    'access_instructions', v_access_instructions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_guest_registration(text, text, text, text, text, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_guest_registration(text, text, text, text, text, numeric, text, text, text, text) TO anon, authenticated;

-- 5. Update check_guest_registration_status (ONLY returns access secrets when pass_approved = true OR payment_status = 'Free')
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
  v_cfg jsonb := '{}'::jsonb;
  v_qr_token text := '';
  v_qr_payload text := NULL;
  v_access_url text := NULL;
  v_access_label text := NULL;
  v_access_code text := NULL;
  v_access_instructions text := NULL;
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

  v_cfg := COALESCE(v_b.activity_config, '{}'::jsonb);

  IF v_reg.pass_approved OR v_reg.payment_status = 'Free' THEN
    v_qr_token := upper(COALESCE(NULLIF(trim(v_b.qr_code_token), ''), left(v_b.id::text, 6)));
    v_qr_payload := 'CLUBSYNC_GUEST::v1::' || v_b.id::text || '::' || v_reg.id::text || '::' || v_qr_token;
    v_access_url := NULLIF(trim(COALESCE(v_cfg->>'access_link_url', '')), '');
    v_access_label := NULLIF(trim(COALESCE(v_cfg->>'access_link_label', '')), '');
    v_access_code := NULLIF(trim(COALESCE(v_cfg->>'access_code', '')), '');
    v_access_instructions := NULLIF(trim(COALESCE(v_cfg->>'access_instructions', '')), '');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_reg.id,
    'guest_name', v_reg.guest_name,
    'institution_or_matric', v_reg.institution_or_matric,
    'lookup_code', v_reg.lookup_code,
    'selected_tier', COALESCE(v_reg.selected_tier, ''),
    'registration_note', COALESCE(v_reg.registration_note, ''),
    'payment_status', v_reg.payment_status,
    'pass_approved', v_reg.pass_approved,
    'qr_checked_in', v_reg.qr_checked_in,
    'qr_checked_in_at', v_reg.qr_checked_in_at,
    'amount_paid', v_reg.amount_paid,
    'event_id', v_b.id,
    'event_name', v_b.event_name,
    'event_date', v_b.event_date,
    'end_date', v_b.end_date,
    'event_time', v_b.event_time,
    'location', v_b.location,
    'qr_payload', v_qr_payload,
    'unlock_mode', COALESCE(v_cfg->>'unlock_mode', ''),
    'access_link_url', v_access_url,
    'access_link_label', v_access_label,
    'access_code', v_access_code,
    'access_instructions', v_access_instructions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_guest_registration_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_guest_registration_status(text, text) TO anon, authenticated;
