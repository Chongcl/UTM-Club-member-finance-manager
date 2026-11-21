-- ClubSync Public Club Chat Lounge + Owner-Gated Sensitive Member Profiles Migration
-- Idempotent & safe to re-run in Supabase SQL Editor.

-- 1. Track when each member last viewed the Public Club Lounge
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS public_chat_read_at timestamptz NOT NULL DEFAULT now();

-- 2. Update privacy-safe users_public view (preserve exact existing column order, append course & year_of_study)
CREATE OR REPLACE VIEW public.users_public AS
SELECT
  id,
  full_name,
  matric_no,
  member_type,
  batch_year,
  role,
  member_status,
  allow_whatsapp_chat,
  created_at,
  course,
  year_of_study
FROM public.users;

GRANT SELECT ON public.users_public TO authenticated;

-- 3. Sensitive Profile Permission Gate (Owner always true; Admin requires explicit can_view_sensitive_profiles = true)
CREATE OR REPLACE FUNCTION public.can_view_sensitive_profiles()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND (
        role = 'owner'
        OR (
          role = 'treasurer'
          AND COALESCE((admin_permissions->>'can_view_sensitive_profiles')::boolean, false) = true
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_sensitive_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_sensitive_profiles() TO authenticated;

DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;
CREATE POLICY "users_select_self_or_admin"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.can_view_sensitive_profiles());

-- 4. On-demand authorized full profile RPC (returns 0 rows unless caller is self or has sensitive profile access)
CREATE OR REPLACE FUNCTION public.get_member_full_profile(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  matric_no text,
  phone_number text,
  ic_no text,
  course text,
  year_of_study text,
  dormitory text,
  hometown text,
  member_type text,
  batch_year text,
  role text,
  member_status text,
  bank_name text,
  bank_account_no text,
  bank_account_holder text,
  bank_qr_url text,
  allow_whatsapp_chat boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR target_user_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() <> target_user_id AND NOT public.can_view_sensitive_profiles() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.full_name::text,
    u.email::text,
    u.matric_no::text,
    u.phone_number::text,
    u.ic_no::text,
    u.course::text,
    u.year_of_study::text,
    u.dormitory::text,
    u.hometown::text,
    u.member_type::text,
    u.batch_year::text,
    u.role::text,
    u.member_status::text,
    u.bank_name::text,
    u.bank_account_no::text,
    u.bank_account_holder::text,
    u.bank_qr_url::text,
    COALESCE(u.allow_whatsapp_chat, false),
    u.created_at
  FROM public.users u
  WHERE u.id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_full_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_full_profile(uuid) TO authenticated;

-- 5. Public Club Lounge support on chat_rooms & soft moderation on chat_messages
ALTER TABLE IF EXISTS public.chat_rooms
  ADD COLUMN IF NOT EXISTS room_type text NOT NULL DEFAULT 'dm',
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pinned_message_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_rooms_room_type_check'
      AND conrelid = 'public.chat_rooms'::regclass
  ) THEN
    ALTER TABLE public.chat_rooms
      ADD CONSTRAINT chat_rooms_room_type_check CHECK (room_type IN ('dm', 'public'));
  END IF;
END $$;

INSERT INTO public.chat_rooms (dm_key, room_type, title)
VALUES ('PUBLIC::CLUB_LOUNGE', 'public', 'Club Lounge')
ON CONFLICT (dm_key) DO UPDATE
  SET room_type = 'public',
      title = CASE
        WHEN COALESCE(public.chat_rooms.title, '') = '' THEN 'Club Lounge'
        ELSE public.chat_rooms.title
      END;

ALTER TABLE IF EXISTS public.chat_messages
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- 6. Public room helper + updated RLS policies
CREATE OR REPLACE FUNCTION public.is_public_chat_room(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_rooms
    WHERE id = p_room_id AND room_type = 'public'
  );
$$;

REVOKE ALL ON FUNCTION public.is_public_chat_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_chat_room(uuid) TO authenticated;

DROP POLICY IF EXISTS "chat_rooms_select_member" ON public.chat_rooms;
CREATE POLICY "chat_rooms_select_member"
  ON public.chat_rooms FOR SELECT
  TO authenticated
  USING (room_type = 'public' OR public.is_chat_member(id));

DROP POLICY IF EXISTS "chat_rooms_update_public_admin" ON public.chat_rooms;
CREATE POLICY "chat_rooms_update_public_admin"
  ON public.chat_rooms FOR UPDATE
  TO authenticated
  USING (room_type = 'public' AND public.current_user_is_admin())
  WITH CHECK (room_type = 'public' AND public.current_user_is_admin());

DROP POLICY IF EXISTS "chat_messages_select_member" ON public.chat_messages;
CREATE POLICY "chat_messages_select_member"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.is_public_chat_room(room_id) OR public.is_chat_member(room_id));

DROP POLICY IF EXISTS "chat_messages_insert_member" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_member"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (public.is_public_chat_room(room_id) OR public.is_chat_member(room_id))
  );

-- 7. RPCs to resolve/ensure Public Club Lounge and soft-remove messages safely
CREATE OR REPLACE FUNCTION public.get_public_chat_room_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_room_id
  FROM public.chat_rooms
  WHERE dm_key = 'PUBLIC::CLUB_LOUNGE' AND room_type = 'public'
  LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO public.chat_rooms (dm_key, room_type, title)
    VALUES ('PUBLIC::CLUB_LOUNGE', 'public', 'Club Lounge')
    ON CONFLICT (dm_key) DO UPDATE SET room_type = 'public'
    RETURNING id INTO v_room_id;
  END IF;

  RETURN v_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_chat_room_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_chat_room_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.hide_chat_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_msg record;
BEGIN
  IF v_me IS NULL OR p_message_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, room_id, sender_id INTO v_msg
  FROM public.chat_messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_msg.sender_id <> v_me AND NOT (public.is_public_chat_room(v_msg.room_id) AND public.current_user_is_admin()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.chat_messages
  SET is_deleted = true,
      deleted_by = v_me
  WHERE id = p_message_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.hide_chat_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hide_chat_message(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
  END IF;
END $$;
