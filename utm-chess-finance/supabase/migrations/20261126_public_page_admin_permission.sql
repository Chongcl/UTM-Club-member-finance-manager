-- ClubSync Public Landing Page Admin Permission Migration
-- Restricts Public Landing Page customization to Owner or Admins explicitly granted `can_manage_public_page`.
-- Idempotent & safe to re-run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.save_public_landing_config(
  p_config jsonb,
  p_tagline text DEFAULT NULL,
  p_about text DEFAULT NULL,
  p_instagram text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_allowed boolean := false;
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = v_me
      AND (
        role = 'owner'
        OR (
          role = 'treasurer'
          AND COALESCE((admin_permissions->>'can_manage_public_page')::boolean, false) = true
        )
      )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Permission denied: Public Landing Page adjustment is disabled for this admin.');
  END IF;

  UPDATE public.club_settings
  SET
    public_landing_config = COALESCE(p_config, '{}'::jsonb),
    club_tagline = COALESCE(p_tagline, club_tagline),
    club_about = COALESCE(p_about, club_about),
    instagram_url = COALESCE(p_instagram, instagram_url),
    contact_email = COALESCE(p_email, contact_email)
  WHERE id = 1;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_public_landing_config(jsonb, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_public_landing_config(jsonb, text, text, text, text) TO authenticated;
