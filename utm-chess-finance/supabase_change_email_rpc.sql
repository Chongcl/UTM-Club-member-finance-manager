-- Idempotent RPC for instant authenticated login email update (no confirmation link required after password verification)
CREATE OR REPLACE FUNCTION public.change_my_email(p_new_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Authentication required.');
  END IF;

  v_email := lower(trim(regexp_replace(coalesce(p_new_email, ''), E'[\u200B-\u200D\uFEFF]', '', 'g')));

  IF v_email = '' OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please enter a valid email address.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = v_email
      AND id <> v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This email address is already in use by another account.');
  END IF;

  UPDATE auth.users
  SET
    email = v_email,
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', v_email, 'email_verified', true),
    email_change = '',
    email_change_token_new = '',
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = v_uid;

  UPDATE auth.identities
  SET
    identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_email), true),
    updated_at = now()
  WHERE user_id = v_uid
    AND provider = 'email';

  UPDATE public.users
  SET email = v_email
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'email', v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.change_my_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_my_email(text) TO authenticated;
