-- Idempotent RPC upgrade for flexible public event status lookup (Name, Email, Matric/ID, or Lookup Code)
CREATE OR REPLACE FUNCTION public.lookup_public_event_registration(
  p_slug text,
  p_query text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_slug text := lower(trim(COALESCE(p_slug, '')));
  v_raw_query text := trim(regexp_replace(COALESCE(p_query, ''), E'[\u200B-\u200D\uFEFF]', '', 'g'));
  v_query text := lower(v_raw_query);
  v_escaped_like text := '';
  v_b public.budgets%ROWTYPE;
  v_s public.club_settings%ROWTYPE;
  v_reg public.public_guest_registrations%ROWTYPE;
  v_found_reg boolean := false;
  v_distinct_people integer := 0;
  v_total_rows integer := 0;
  v_cfg jsonb := '{}'::jsonb;
  v_safe_config jsonb := '{}'::jsonb;
  v_qr_token text := '';
  v_qr_payload text := NULL;
  v_access_url text := NULL;
  v_access_label text := NULL;
  v_access_code text := NULL;
  v_access_instructions text := NULL;
  v_email_local text := '';
  v_email_domain text := '';
  v_masked_email text := '';
BEGIN
  IF v_clean_slug = '' OR v_query = '' THEN
    RETURN jsonb_build_object('found', false, 'multiple_matches', false);
  END IF;

  SELECT * INTO v_b
  FROM public.budgets
  WHERE deleted_at IS NULL
    AND lower(public_slug) = v_clean_slug
    AND is_public_registration = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'multiple_matches', false);
  END IF;

  SELECT * INTO v_s
  FROM public.club_settings
  WHERE id = 1
  LIMIT 1;

  -- 1. Priority exact Lookup Code
  SELECT * INTO v_reg
  FROM public.public_guest_registrations
  WHERE budget_id = v_b.id
    AND deleted_at IS NULL
    AND upper(trim(lookup_code)) = upper(v_raw_query)
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_found_reg := true;
  END IF;

  -- 2. Priority exact Email
  IF NOT v_found_reg THEN
    SELECT * INTO v_reg
    FROM public.public_guest_registrations
    WHERE budget_id = v_b.id
      AND deleted_at IS NULL
      AND lower(trim(email)) = v_query
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_found_reg := true;
    END IF;
  END IF;

  -- 3. Matric / Institution ID or Full/Partial Name (detect ambiguity across different people)
  IF NOT v_found_reg THEN
    v_escaped_like := replace(replace(replace(v_raw_query, '\', '\\'), '%', '\%'), '_', '\_');

    SELECT
      COUNT(DISTINCT COALESCE(NULLIF(lower(trim(email)), ''), lower(trim(guest_name))))::integer,
      COUNT(*)::integer
    INTO v_distinct_people, v_total_rows
    FROM public.public_guest_registrations
    WHERE budget_id = v_b.id
      AND deleted_at IS NULL
      AND (
        (NULLIF(trim(institution_or_matric), '') IS NOT NULL AND lower(trim(institution_or_matric)) = v_query)
        OR lower(trim(guest_name)) = v_query
        OR (length(v_raw_query) >= 3 AND guest_name ILIKE '%' || v_escaped_like || '%' ESCAPE '\')
      );

    IF v_distinct_people > 1 THEN
      RETURN jsonb_build_object(
        'found', false,
        'multiple_matches', true,
        'match_count', v_distinct_people
      );
    END IF;

    IF v_total_rows >= 1 THEN
      SELECT * INTO v_reg
      FROM public.public_guest_registrations
      WHERE budget_id = v_b.id
        AND deleted_at IS NULL
        AND (
          (NULLIF(trim(institution_or_matric), '') IS NOT NULL AND lower(trim(institution_or_matric)) = v_query)
          OR lower(trim(guest_name)) = v_query
          OR (length(v_raw_query) >= 3 AND guest_name ILIKE '%' || v_escaped_like || '%' ESCAPE '\')
        )
      ORDER BY
        (
          (NULLIF(trim(institution_or_matric), '') IS NOT NULL AND lower(trim(institution_or_matric)) = v_query)
          OR lower(trim(guest_name)) = v_query
        ) DESC,
        created_at DESC
      LIMIT 1;

      IF FOUND THEN
        v_found_reg := true;
      END IF;
    END IF;
  END IF;

  IF NOT v_found_reg THEN
    RETURN jsonb_build_object('found', false, 'multiple_matches', false);
  END IF;

  v_email_local := split_part(COALESCE(v_reg.email, ''), '@', 1);
  v_email_domain := split_part(COALESCE(v_reg.email, ''), '@', 2);
  IF v_email_local <> '' AND v_email_domain <> '' THEN
    v_masked_email := left(v_email_local, LEAST(2, length(v_email_local))) || '***@' || v_email_domain;
  END IF;

  v_cfg := COALESCE(v_b.activity_config, '{}'::jsonb);
  v_safe_config := v_cfg
    - 'access_link_url'
    - 'access_code'
    - 'access_instructions';

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
    'multiple_matches', false,
    'id', v_reg.id,
    'guest_name', v_reg.guest_name,
    'institution_or_matric', v_reg.institution_or_matric,
    'masked_email', v_masked_email,
    'lookup_code', v_reg.lookup_code,
    'selected_tier', COALESCE(v_reg.selected_tier, ''),
    'registration_note', COALESCE(v_reg.registration_note, ''),
    'payment_status', v_reg.payment_status,
    'pass_approved', v_reg.pass_approved,
    'qr_checked_in', v_reg.qr_checked_in,
    'qr_checked_in_at', v_reg.qr_checked_in_at,
    'amount_paid', v_reg.amount_paid,
    'created_at', v_reg.created_at,
    'event_id', v_b.id,
    'event_name', v_b.event_name,
    'category', v_b.category,
    'event_date', v_b.event_date,
    'end_date', v_b.end_date,
    'event_time', v_b.event_time,
    'location', v_b.location,
    'description', v_b.description,
    'club_name', COALESCE(NULLIF(trim(v_s.club_name), ''), 'ClubSync'),
    'activity_config', v_safe_config,
    'qr_payload', v_qr_payload,
    'unlock_mode', COALESCE(v_cfg->>'unlock_mode', ''),
    'access_link_url', v_access_url,
    'access_link_label', v_access_label,
    'access_code', v_access_code,
    'access_instructions', v_access_instructions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_public_event_registration(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_public_event_registration(text, text) TO anon, authenticated;

-- Keep legacy RPC name pointing to the upgraded lookup function for full backward compatibility
CREATE OR REPLACE FUNCTION public.check_guest_registration_status(
  p_slug text,
  p_lookup_or_email text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.lookup_public_event_registration(p_slug, p_lookup_or_email);
$$;

REVOKE ALL ON FUNCTION public.check_guest_registration_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_guest_registration_status(text, text) TO anon, authenticated;
