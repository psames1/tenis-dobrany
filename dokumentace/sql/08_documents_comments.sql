-- =============================================================================
-- 08_documents_comments.sql — Přílohy a komentáře u článků, storage buckety
-- Supabase / PostgreSQL
--
-- JAK SPUSTIT:
--   Supabase Dashboard → SQL Editor → vlož a spusť
--   Idempotentní (IF NOT EXISTS / ON CONFLICT DO NOTHING) — bezpečné opakování.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. allow_comments — checkbox na stránce
-- -----------------------------------------------------------------------------

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pages.allow_comments IS 'TRUE = komentáře povoleny pod článkem (jen přihlášení)';

-- -----------------------------------------------------------------------------
-- 2. page_documents — přílohy ke článku
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.page_documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID        NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  file_url    TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_documents_page ON public.page_documents (page_id, sort_order);

COMMENT ON TABLE public.page_documents IS 'Přílohy (PDF, DOCX, …) připojené ke stránce';

-- RLS
ALTER TABLE public.page_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_documents: public read"  ON public.page_documents;
DROP POLICY IF EXISTS "page_documents: member read"  ON public.page_documents;
DROP POLICY IF EXISTS "page_documents: manager all"  ON public.page_documents;

-- Veřejné čtení: příloha veřejného článku
CREATE POLICY "page_documents: public read" ON public.page_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id
        AND p.is_active = true
        AND p.is_members_only = false
    )
  );

-- Omezené čtení: příloha členského článku — jen přihlášení aktivní členové
CREATE POLICY "page_documents: member read" ON public.page_documents
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id
        AND p.is_active = true
        AND p.is_members_only = true
        AND EXISTS (
          SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_active = true
        )
    )
  );

-- Plný přístup pro manager/admin
CREATE POLICY "page_documents: manager all" ON public.page_documents
  FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());

-- -----------------------------------------------------------------------------
-- 3. page_comments — komentáře pod článkem
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.page_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID        NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_comments_page ON public.page_comments (page_id, created_at);

COMMENT ON TABLE public.page_comments IS 'Komentáře přihlášených členů pod článkem';

-- RLS
ALTER TABLE public.page_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_comments: read"           ON public.page_comments;
DROP POLICY IF EXISTS "page_comments: member insert"  ON public.page_comments;
DROP POLICY IF EXISTS "page_comments: delete"         ON public.page_comments;
DROP POLICY IF EXISTS "page_comments: manager update" ON public.page_comments;

-- Čtení: aktivní komentáře pod stránkami, kde jsou komentáře povoleny
CREATE POLICY "page_comments: read" ON public.page_comments
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id
        AND p.is_active = true
        AND p.allow_comments = true
    )
  );

-- Vkládání: jen přihlášení aktivní členové, jen na stránkách s allow_comments
CREATE POLICY "page_comments: member insert" ON public.page_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_authenticated_member()
    AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id
        AND p.is_active = true
        AND p.allow_comments = true
    )
  );

-- Mazání: vlastní komentáře nebo manager+
CREATE POLICY "page_comments: delete" ON public.page_comments
  FOR DELETE
  USING (auth.uid() = user_id OR public.is_manager_or_above());

-- Deaktivace komentářů — jen manager+
CREATE POLICY "page_comments: manager update" ON public.page_comments
  FOR UPDATE
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());

-- -----------------------------------------------------------------------------
-- 4. Storage — bucket "avatars" (profilové fotky uživatelů)
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'avatars',
  'avatars',
  true,
  ARRAY['image/jpeg','image/png','image/webp','image/gif'],
  2097152   -- 2 MB
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars: public read"   ON storage.objects;
DROP POLICY IF EXISTS "avatars: owner upload"  ON storage.objects;
DROP POLICY IF EXISTS "avatars: owner update"  ON storage.objects;
DROP POLICY IF EXISTS "avatars: owner delete"  ON storage.objects;

-- Veřejné čtení
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Přihlášený uživatel může nahrát do svého adresáře
CREATE POLICY "avatars: owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Přihlášený uživatel může přepsat svůj soubor
CREATE POLICY "avatars: owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Přihlášený uživatel může smazat svůj soubor
CREATE POLICY "avatars: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- -----------------------------------------------------------------------------
-- 5. Storage — bucket "documents" (přílohy článků)
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'documents',
  'documents',
  true,
  10485760  -- 10 MB
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents: public read"    ON storage.objects;
DROP POLICY IF EXISTS "documents: manager upload" ON storage.objects;
DROP POLICY IF EXISTS "documents: manager delete" ON storage.objects;

-- Veřejné čtení (přístupnost řídí RLS na page_documents)
CREATE POLICY "documents: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

-- Nahrávání: pouze manager+
CREATE POLICY "documents: manager upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND public.is_manager_or_above());

-- Mazání: pouze manager+
CREATE POLICY "documents: manager delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND public.is_manager_or_above());
