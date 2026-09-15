-- JO Academy: إدارة المحتوى وصلاحيات المشرف
-- شغّل الملف كاملًا مرة واحدة من Supabase -> SQL Editor.
-- الملف قابل لإعادة التشغيل ولا يحذف أي بيانات موجودة.

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'supervisor'
  );
$$;

CREATE OR REPLACE FUNCTION public.academy_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.academy_validate_resource_url()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.url !~* '^https?://' THEN
    RAISE EXCEPTION 'رابط المورد يجب أن يبدأ بـ http:// أو https://';
  END IF;
  RETURN NEW;
END;
$$;

-- هذه الجداول موجودة في النسخة الحالية من المنصة. CREATE IF NOT EXISTS يجعل
-- الإعداد آمنًا لو كانت قاعدة البيانات الجديدة لم تُجهّز بالكامل بعد.
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  drive_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  is_open BOOLEAN NOT NULL DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- أعمدة التوافق مع قواعد البيانات القديمة.
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.units ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS drive_url TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS subject_id UUID;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.camps ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.camps ADD COLUMN IF NOT EXISTS subject_id UUID;
ALTER TABLE public.camps ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.camps ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.camps ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.camps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.camps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- مورد مستقل للملف أو الفيديو أو أي رابط إضافي للدرس.
CREATE TABLE IF NOT EXISTS public.lesson_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  resource_type TEXT NOT NULL DEFAULT 'link' CHECK (resource_type IN ('video', 'file', 'link')),
  url TEXT NOT NULL CHECK (char_length(trim(url)) BETWEEN 1 AND 2000),
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- إصلاح القيم القديمة الفارغة بدون إعادة ترتيب أو حذف محتوى فعلي.
UPDATE public.subjects SET order_index = 0 WHERE order_index IS NULL;
UPDATE public.units SET order_index = 0 WHERE order_index IS NULL;
UPDATE public.lessons SET order_index = 0 WHERE order_index IS NULL;
UPDATE public.lessons SET is_published = TRUE WHERE is_published IS NULL;
UPDATE public.exams SET duration_minutes = 30 WHERE duration_minutes IS NULL OR duration_minutes < 1;
UPDATE public.exams SET is_published = FALSE WHERE is_published IS NULL;
UPDATE public.camps SET is_open = FALSE WHERE is_open IS NULL;

DROP TRIGGER IF EXISTS subjects_touch_updated_at ON public.subjects;
CREATE TRIGGER subjects_touch_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.academy_touch_updated_at();
DROP TRIGGER IF EXISTS units_touch_updated_at ON public.units;
CREATE TRIGGER units_touch_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.academy_touch_updated_at();
DROP TRIGGER IF EXISTS lessons_touch_updated_at ON public.lessons;
CREATE TRIGGER lessons_touch_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.academy_touch_updated_at();
DROP TRIGGER IF EXISTS exams_touch_updated_at ON public.exams;
CREATE TRIGGER exams_touch_updated_at BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.academy_touch_updated_at();
DROP TRIGGER IF EXISTS camps_touch_updated_at ON public.camps;
CREATE TRIGGER camps_touch_updated_at BEFORE UPDATE ON public.camps FOR EACH ROW EXECUTE FUNCTION public.academy_touch_updated_at();
DROP TRIGGER IF EXISTS lesson_resources_touch_updated_at ON public.lesson_resources;
CREATE TRIGGER lesson_resources_touch_updated_at BEFORE UPDATE ON public.lesson_resources FOR EACH ROW EXECUTE FUNCTION public.academy_touch_updated_at();
DROP TRIGGER IF EXISTS lesson_resources_validate_url ON public.lesson_resources;
CREATE TRIGGER lesson_resources_validate_url BEFORE INSERT OR UPDATE ON public.lesson_resources FOR EACH ROW EXECUTE FUNCTION public.academy_validate_resource_url();

CREATE INDEX IF NOT EXISTS idx_subjects_order ON public.subjects(order_index, created_at);
CREATE INDEX IF NOT EXISTS idx_units_subject_order ON public.units(subject_id, order_index, created_at);
CREATE INDEX IF NOT EXISTS idx_lessons_unit_order ON public.lessons(unit_id, order_index, created_at);
CREATE INDEX IF NOT EXISTS idx_lesson_resources_lesson_order ON public.lesson_resources(lesson_id, order_index, created_at);
CREATE INDEX IF NOT EXISTS idx_exams_subject ON public.exams(subject_id);
CREATE INDEX IF NOT EXISTS idx_camps_subject ON public.camps(subject_id);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- القراءة العامة تظل متاحة للمحتوى المنشور، والإدارة الكاملة للمشرف فقط.
DROP POLICY IF EXISTS academy_subjects_read ON public.subjects;
CREATE POLICY academy_subjects_read ON public.subjects FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS academy_subjects_manage ON public.subjects;
CREATE POLICY academy_subjects_manage ON public.subjects FOR ALL USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

DROP POLICY IF EXISTS academy_units_read ON public.units;
CREATE POLICY academy_units_read ON public.units FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS academy_units_manage ON public.units;
CREATE POLICY academy_units_manage ON public.units FOR ALL USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

DROP POLICY IF EXISTS academy_lessons_read ON public.lessons;
CREATE POLICY academy_lessons_read ON public.lessons FOR SELECT USING (is_published = TRUE OR public.is_supervisor());
DROP POLICY IF EXISTS academy_lessons_manage ON public.lessons;
CREATE POLICY academy_lessons_manage ON public.lessons FOR ALL USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

DROP POLICY IF EXISTS academy_exams_read ON public.exams;
CREATE POLICY academy_exams_read ON public.exams FOR SELECT USING (is_published = TRUE OR public.is_supervisor());
DROP POLICY IF EXISTS academy_exams_manage ON public.exams;
CREATE POLICY academy_exams_manage ON public.exams FOR ALL USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

DROP POLICY IF EXISTS academy_camps_read ON public.camps;
CREATE POLICY academy_camps_read ON public.camps FOR SELECT USING (is_open = TRUE OR public.is_supervisor());
DROP POLICY IF EXISTS academy_camps_manage ON public.camps;
CREATE POLICY academy_camps_manage ON public.camps FOR ALL USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

DROP POLICY IF EXISTS academy_lesson_resources_read ON public.lesson_resources;
CREATE POLICY academy_lesson_resources_read ON public.lesson_resources FOR SELECT USING (is_published = TRUE OR public.is_supervisor());
DROP POLICY IF EXISTS academy_lesson_resources_manage ON public.lesson_resources;
CREATE POLICY academy_lesson_resources_manage ON public.lesson_resources FOR ALL USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());

DROP POLICY IF EXISTS academy_profiles_supervisor_manage ON public.profiles;
CREATE POLICY academy_profiles_supervisor_manage ON public.profiles FOR ALL USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());
