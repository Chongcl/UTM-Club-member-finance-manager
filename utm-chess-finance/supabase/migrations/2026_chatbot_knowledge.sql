-- ClubSync Support & Portal Chatbot Knowledge & Unanswered Inbox Migration
-- Idempotent & safe to re-run in Supabase SQL Editor.

-- 1. Custom Trained Q&A Rules Table
CREATE TABLE IF NOT EXISTS public.chatbot_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}'::text[],
  answer text NOT NULL,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'admin')),
  action_tab text NOT NULL DEFAULT 'none' CHECK (
    action_tab IN ('none', 'new_claim', 'activities', 'equipment', 'ledger', 'profile', 'claims')
  ),
  is_quick_chip boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_active
  ON public.chatbot_knowledge (is_active, audience, created_at DESC);

ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chatbot_knowledge_select_authenticated" ON public.chatbot_knowledge;
CREATE POLICY "chatbot_knowledge_select_authenticated"
  ON public.chatbot_knowledge
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'owner')
    )
    OR (is_active = true AND audience = 'all')
  );

DROP POLICY IF EXISTS "chatbot_knowledge_insert_admin" ON public.chatbot_knowledge;
CREATE POLICY "chatbot_knowledge_insert_admin"
  ON public.chatbot_knowledge
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'owner')
    )
  );

DROP POLICY IF EXISTS "chatbot_knowledge_update_admin" ON public.chatbot_knowledge;
CREATE POLICY "chatbot_knowledge_update_admin"
  ON public.chatbot_knowledge
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'owner')
    )
  );

DROP POLICY IF EXISTS "chatbot_knowledge_delete_admin" ON public.chatbot_knowledge;
CREATE POLICY "chatbot_knowledge_delete_admin"
  ON public.chatbot_knowledge
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'owner')
    )
  );

-- 2. Unanswered Questions Inbox Table
CREATE TABLE IF NOT EXISTS public.chatbot_unanswered_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text text NOT NULL,
  user_role text NOT NULL DEFAULT 'member',
  hit_count integer NOT NULL DEFAULT 1,
  resolved boolean NOT NULL DEFAULT false,
  last_asked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_unanswered_open
  ON public.chatbot_unanswered_queries (resolved, hit_count DESC, last_asked_at DESC);

ALTER TABLE public.chatbot_unanswered_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chatbot_unanswered_insert_auth" ON public.chatbot_unanswered_queries;
CREATE POLICY "chatbot_unanswered_insert_auth"
  ON public.chatbot_unanswered_queries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "chatbot_unanswered_select_admin" ON public.chatbot_unanswered_queries;
CREATE POLICY "chatbot_unanswered_select_admin"
  ON public.chatbot_unanswered_queries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'owner')
    )
  );

DROP POLICY IF EXISTS "chatbot_unanswered_update_admin" ON public.chatbot_unanswered_queries;
CREATE POLICY "chatbot_unanswered_update_admin"
  ON public.chatbot_unanswered_queries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'owner')
    )
  );

DROP POLICY IF EXISTS "chatbot_unanswered_delete_admin" ON public.chatbot_unanswered_queries;
CREATE POLICY "chatbot_unanswered_delete_admin"
  ON public.chatbot_unanswered_queries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('treasurer', 'owner')
    )
  );

-- 3. Atomic RPC to safely log or increment unanswered questions without exposing inbox reads to members
CREATE OR REPLACE FUNCTION public.log_chatbot_unanswered_query(
  p_query text,
  p_role text DEFAULT 'member'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text := trim(COALESCE(p_query, ''));
  v_existing_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_clean = '' THEN
    RETURN;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.chatbot_unanswered_queries
  WHERE lower(trim(query_text)) = lower(v_clean)
    AND resolved = false
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.chatbot_unanswered_queries
    SET hit_count = hit_count + 1,
        last_asked_at = now(),
        user_role = COALESCE(NULLIF(trim(p_role), ''), user_role)
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.chatbot_unanswered_queries (
      query_text,
      user_role,
      hit_count,
      resolved,
      last_asked_at
    )
    VALUES (
      v_clean,
      COALESCE(NULLIF(trim(p_role), ''), 'member'),
      1,
      false,
      now()
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.log_chatbot_unanswered_query(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_chatbot_unanswered_query(text, text) TO authenticated;
