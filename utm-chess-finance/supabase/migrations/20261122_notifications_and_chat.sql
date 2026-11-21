-- ClubSync Notifications, Smart Reminders & Privacy-Safe Chat Migration
-- Idempotent & safe to re-run in Supabase SQL Editor.

-- 1. User privacy & read-state columns on public.users + privacy-safe users_public view
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS allow_whatsapp_chat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notifications_read_at timestamptz NOT NULL DEFAULT now();

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
  created_at
FROM public.users;

GRANT SELECT ON public.users_public TO authenticated;

-- 2. Club Notifications Table
CREATE TABLE IF NOT EXISTS public.club_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  target_tab text DEFAULT 'activities',
  target_id text DEFAULT '',
  actor_name text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_notifications_target_created
  ON public.club_notifications (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_notifications_created
  ON public.club_notifications (created_at DESC);

ALTER TABLE public.club_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_notifications_select_visible" ON public.club_notifications;
CREATE POLICY "club_notifications_select_visible"
  ON public.club_notifications FOR SELECT
  TO authenticated
  USING (target_user_id IS NULL OR target_user_id = auth.uid());

DROP POLICY IF EXISTS "club_notifications_insert_authenticated" ON public.club_notifications;
CREATE POLICY "club_notifications_insert_authenticated"
  ON public.club_notifications FOR INSERT
  TO authenticated
  WITH CHECK (target_user_id IS NOT NULL OR public.current_user_is_admin());

-- 3. Lightweight 3-Table Chat Schema (Text & Emoji only, max 1000 chars)
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_key text UNIQUE NOT NULL,
  last_message_text text NOT NULL DEFAULT '',
  last_message_sender_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
  ON public.chat_messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user
  ON public.chat_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_msg
  ON public.chat_rooms (last_message_at DESC);

CREATE OR REPLACE FUNCTION public.update_chat_room_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_rooms
  SET
    last_message_text = left(NEW.content, 120),
    last_message_sender_id = NEW.sender_id,
    last_message_at = NEW.created_at
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_messages_last_preview ON public.chat_messages;
DROP TRIGGER IF EXISTS trg_chat_message_preview ON public.chat_messages;
CREATE TRIGGER trg_chat_message_preview
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_room_last_message();

-- 4. Chat RLS + Realtime Publication
CREATE OR REPLACE FUNCTION public.is_chat_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE room_id = p_room_id AND user_id = auth.uid()
  );
$$;

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_rooms_select_member" ON public.chat_rooms;
CREATE POLICY "chat_rooms_select_member"
  ON public.chat_rooms FOR SELECT
  TO authenticated
  USING (public.is_chat_member(id));

DROP POLICY IF EXISTS "chat_participants_select_member" ON public.chat_participants;
CREATE POLICY "chat_participants_select_member"
  ON public.chat_participants FOR SELECT
  TO authenticated
  USING (public.is_chat_member(room_id));

DROP POLICY IF EXISTS "chat_participants_update_self" ON public.chat_participants;
CREATE POLICY "chat_participants_update_self"
  ON public.chat_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_messages_select_member" ON public.chat_messages;
CREATE POLICY "chat_messages_select_member"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.is_chat_member(room_id));

DROP POLICY IF EXISTS "chat_messages_insert_member" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_member"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (public.is_chat_member(room_id) AND sender_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- 5. Secure RPC Functions
CREATE OR REPLACE FUNCTION public.get_or_create_dm_room(target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_key text;
  v_room_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF target_user_id IS NULL OR target_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid target user';
  END IF;

  v_key := LEAST(v_me::text, target_user_id::text) || ':' || GREATEST(v_me::text, target_user_id::text);

  INSERT INTO public.chat_rooms (dm_key)
  VALUES (v_key)
  ON CONFLICT (dm_key) DO NOTHING;

  SELECT id INTO v_room_id FROM public.chat_rooms WHERE dm_key = v_key;

  INSERT INTO public.chat_participants (room_id, user_id)
  VALUES (v_room_id, v_me), (v_room_id, target_user_id)
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN v_room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_dm_room(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_whatsapp_chat_phone(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_phone text;
BEGIN
  IF v_me IS NULL OR target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT phone_number INTO v_phone
  FROM public.users
  WHERE id = target_user_id
    AND allow_whatsapp_chat = true;

  RETURN v_phone;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_whatsapp_chat_phone(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.prune_old_chat_messages(months_keep integer DEFAULT 6)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF NOT public.current_user_is_owner() THEN
    RAISE EXCEPTION 'Owner only';
  END IF;

  DELETE FROM public.chat_messages
  WHERE created_at < now() - make_interval(months => GREATEST(1, months_keep));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prune_old_chat_messages(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_unread_chat_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.chat_participants cp
  JOIN public.chat_rooms cr ON cr.id = cp.room_id
  WHERE cp.user_id = auth.uid()
    AND cr.last_message_sender_id IS NOT NULL
    AND cr.last_message_sender_id <> auth.uid()
    AND cr.last_message_at > cp.last_read_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_chat_count() TO authenticated;
