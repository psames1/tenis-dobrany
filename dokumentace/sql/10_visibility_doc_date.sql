-- =============================================================================
-- 10_visibility_doc_date.sql
-- Supabase / PostgreSQL
--
-- JAK SPUSTIT:
--   Supabase Dashboard → SQL Editor → vlož a spusť
--   Idempotentní — bezpečné opakování.
--
-- CO DĚLÁ:
--   1. Přidá sloupec `visibility` do tabulky `pages`:
--        'public'  = kdokoliv (výchozí)
--        'member'  = jen přihlášení aktivní členové
--        'editor'  = editor / manager / admin
--        'admin'   = pouze manager / admin
--   2. Migruje stávající is_members_only → visibility = 'member'
--   3. Přidá sloupec `document_date` do `page_documents` (datum souboru)
--   4. Opraví/vytvoří bucket 'documents' a jeho RLS politiky
--   5. Aktualizuje RLS politiky page_documents tak, aby používaly visibility
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. visibility na pages
-- ---------------------------------------------------------------------------

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

ALTER TABLE public.pages
  DROP CONSTRAINT IF EXISTS pages_visibility_check;

ALTER TABLE public.pages
  ADD CONSTRAINT pages_visibility_check
  CHECK (visibility IN ('public', 'member', 'editor', 'admin'));

COMMENT ON COLUMN public.pages.visibility IS
  'public=kdokoliv | member=přihlášení | editor=manager+ | admin=manager+';

-- Migrace ze starého pole
UPDATE public.pages
SET visibility = 'member'
WHERE is_members_only = true AND visibility = 'public';

-- ---------------------------------------------------------------------------
-- 2. document_date na page_documents
-- ---------------------------------------------------------------------------

ALTER TABLE public.page_documents
  ADD COLUMN IF NOT EXISTS document_date DATE NOT NULL DEFAULT CURRENT_DATE;

COMMENT ON COLUMN public.page_documents.document_date IS
  'Datum dokumentu (zobrazuje se u přílohy, defaultně datum nahrání)';

-- ---------------------------------------------------------------------------
-- 3. Bucket 'documents' — vytvoření (pokud chyběl)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', true, 10485760)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

-- ---------------------------------------------------------------------------
-- 4. Storage RLS — documents (DROP + CREATE pro idempotenci)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "documents: public read"    ON storage.objects;
DROP POLICY IF EXISTS "documents: manager upload" ON storage.objects;
DROP POLICY IF EXISTS "documents: manager update" ON storage.objects;
DROP POLICY IF EXISTS "documents: manager delete" ON storage.objects;

CREATE POLICY "documents: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

CREATE POLICY "documents: manager upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND public.is_manager_or_above());

CREATE POLICY "documents: manager update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND public.is_manager_or_above());

CREATE POLICY "documents: manager delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND public.is_manager_or_above());

-- ---------------------------------------------------------------------------
-- 5. RLS na page_documents — přepíšeme politiky, aby používaly visibility
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "page_documents: public read"  ON public.page_documents;
DROP POLICY IF EXISTS "page_documents: member read"  ON public.page_documents;
DROP POLICY IF EXISTS "page_documents: manager all"  ON public.page_documents;

-- Veřejné přílohy
CREATE POLICY "page_documents: public read" ON public.page_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id
        AND p.is_active = true
        AND p.visibility = 'public'
    )
  );

-- Přílohy článků pro přihlášené členy
CREATE POLICY "page_documents: member read" ON public.page_documents
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id
        AND p.is_active = true
        AND p.visibility = 'member'
        AND EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid() AND is_active = true
        )
    )
  );

-- Přílohy článků pro editor a výše (v DB neexistuje role 'editor' — zahrnuje manager+)
CREATE POLICY "page_documents: editor read" ON public.page_documents
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id
        AND p.is_active = true
        AND p.visibility = 'editor'
        AND EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid()
            AND is_active = true
            AND role IN ('manager', 'admin')
        )
    )
  );

-- Přílohy pouze admin článků
CREATE POLICY "page_documents: admin read" ON public.page_documents
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id
        AND p.is_active = true
        AND p.visibility = 'admin'
    )
    AND public.is_manager_or_above()
  );

-- Plný přístup pro manager/admin
CREATE POLICY "page_documents: manager all" ON public.page_documents
  FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());
