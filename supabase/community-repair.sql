-- JO Academy Community Repair
-- شغّل الملف كاملًا مرة واحدة من Supabase -> SQL Editor
-- الملف آمن لإعادة التشغيل ولا يحذف أي بيانات.

-- السماح بتعيين المشرف من SQL Editor فقط.
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_supervisor() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'غير مسموح بتغيير الصلاحية (role)';
    END IF;
    IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
      RAISE EXCEPTION 'غير مسموح بتغيير حالة الحظر';
    END IF;
    IF NEW.xp IS DISTINCT FROM OLD.xp THEN
      RAISE EXCEPTION 'غير مسموح بتعديل XP يدوياً';
    END IF;
    IF NEW.streak IS DISTINCT FROM OLD.streak THEN
      RAISE EXCEPTION 'غير مسموح بتعديل الستريك يدوياً';
    END IF;
    IF NEW.study_hours IS DISTINCT FROM OLD.study_hours THEN
      RAISE EXCEPTION 'غير مسموح بتعديل ساعات المذاكرة يدوياً';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.community_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_settings
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'posts';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_settings_mode_check'
  ) THEN
    ALTER TABLE public.community_settings
      ADD CONSTRAINT community_settings_mode_check
      CHECK (mode IN ('posts', 'chat'));
  END IF;
END $$;

INSERT INTO public.community_settings (mode, is_locked)
SELECT 'posts', FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.community_settings);

ALTER TABLE public.community_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_read ON public.community_settings;
CREATE POLICY settings_read ON public.community_settings
  FOR SELECT USING (true);
DROP POLICY IF EXISTS settings_manage ON public.community_settings;
CREATE POLICY settings_manage ON public.community_settings
  FOR ALL USING (public.is_supervisor())
  WITH CHECK (public.is_supervisor());

CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_read ON public.community_messages;
CREATE POLICY messages_read ON public.community_messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS messages_insert ON public.community_messages;
CREATE POLICY messages_insert ON public.community_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_supervisor()
      OR EXISTS (
      SELECT 1 FROM public.community_settings
      WHERE mode = 'chat' AND is_locked = FALSE
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_banned = TRUE
    )
    AND char_length(content) BETWEEN 1 AND 1000
  );

DROP POLICY IF EXISTS messages_delete ON public.community_messages;
CREATE POLICY messages_delete ON public.community_messages
  FOR DELETE USING (public.is_supervisor());

DROP POLICY IF EXISTS community_posts_read ON public.community_posts;
CREATE POLICY community_posts_read ON public.community_posts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS community_posts_insert ON public.community_posts;
CREATE POLICY community_posts_insert ON public.community_posts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_supervisor()
      OR EXISTS (
      SELECT 1 FROM public.community_settings
      WHERE mode = 'posts' AND is_locked = FALSE
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_banned = TRUE
    )
  );

DROP POLICY IF EXISTS community_posts_delete ON public.community_posts;
CREATE POLICY community_posts_delete ON public.community_posts
  FOR DELETE USING (user_id = auth.uid() OR public.is_supervisor());

DROP POLICY IF EXISTS community_comments_read ON public.community_comments;
CREATE POLICY community_comments_read ON public.community_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS community_comments_insert ON public.community_comments;
CREATE POLICY community_comments_insert ON public.community_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_supervisor()
      OR EXISTS (
      SELECT 1 FROM public.community_settings
      WHERE mode = 'posts' AND is_locked = FALSE
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_banned = TRUE
    )
  );

DROP POLICY IF EXISTS community_comments_delete ON public.community_comments;
CREATE POLICY community_comments_delete ON public.community_comments
  FOR DELETE USING (user_id = auth.uid() OR public.is_supervisor());

CREATE INDEX IF NOT EXISTS idx_community_messages_created
  ON public.community_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created
  ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON public.community_comments(post_id, created_at);
