-- ClubSync Customizable Public Landing Page Configuration Migration
-- Idempotent & safe to re-run in Supabase SQL Editor.

-- 1. Add JSONB column on public.club_settings to store full customizable public landing configuration
ALTER TABLE IF EXISTS public.club_settings
  ADD COLUMN IF NOT EXISTS public_landing_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Expose public_landing_config via public.club_settings_public (safe non-secret settings view)
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
  contact_email,
  public_landing_config
FROM public.club_settings;

GRANT SELECT ON public.club_settings_public TO anon, authenticated;

-- 3. Secure RPC allowing Owner or Poster/Showcase Admins to save public landing page configuration
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
          AND COALESCE((admin_permissions->>'can_manage_posters_polls')::boolean, false) = true
        )
      )
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Permission denied');
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
