-- =============================================================================
-- 02_rls_policies.sql — Row Level Security pro Tenis Dobřany
-- Supabase / PostgreSQL
--
-- JAK SPUSTIT:
--   Supabase Dashboard → SQL Editor → vlevo "postgres" (Primary database)
--   → vlož celý soubor → Run
--   Předpoklad: 01_schema.sql byl úspěšně spuštěn.
--
-- OPAKOVANÉ SPUŠTĚNÍ:
--   Skript je idempotentní — RESET sekce smaže funkce (CASCADE odstraní
--   závislé write politiky) + explicitně smaže zbývající read politiky.
--   Data v tabulkách zůstávají nedotčena.
--
-- BEZPEČNOSTNÍ POZNÁMKY:
--   - Funkce jsou SECURITY DEFINER + STABLE — volají se s právy vlastníka,
--     nikoli volajícího uživatele. Brání obejití RLS přes set_config tricks.
--   - user_profiles.role nelze změnit přes UPDATE politiku vlastního profilu
--     (WITH CHECK zajistí, že role zůstane stejná jako před editací).
--   - Service Role Key Supabase RLS obchází — nikdy ho neposílej do klienta.
--   - postgres role v SQL Editoru také obchází RLS (má BYPASSRLS) — správné
--     pro admin práci. Aplikace běží jako "anon" / "authenticated".
-- =============================================================================


-- =============================================================================
-- RESET — bezpečné opakované spuštění (data v tabulkách zůstávají)
-- =============================================================================

-- Helper funkce — CASCADE smaže i všechny write politiky, které je volají
DROP FUNCTION IF EXISTS public.is_authenticated_member() CASCADE;
DROP FUNCTION IF EXISTS public.is_manager_or_above()     CASCADE;
DROP FUNCTION IF EXISTS public.is_admin()                CASCADE;
DROP FUNCTION IF EXISTS public.current_user_role()       CASCADE;

-- Read politiky bez závislosti na helper funkcích
-- (write politiky padly přes CASCADE výše)
DROP POLICY IF EXISTS "sections: public read"    ON public.sections;
DROP POLICY IF EXISTS "pages: public read"       ON public.pages;
DROP POLICY IF EXISTS "components: public read"  ON public.page_components;
DROP POLICY IF EXISTS "footer: public read"      ON public.footer_content;
DROP POLICY IF EXISTS "profiles: own read"       ON public.user_profiles;
DROP POLICY IF EXISTS "profiles: own update"     ON public.user_profiles;
DROP POLICY IF EXISTS "media: public read"       ON public.media;
DROP POLICY IF EXISTS "settings: public read"    ON public.site_settings;

-- Storage politiky
DROP POLICY IF EXISTS "storage images: public read"       ON storage.objects;
DROP POLICY IF EXISTS "storage images: manager upload"    ON storage.objects;
DROP POLICY IF EXISTS "storage images: manager delete"    ON storage.objects;
DROP POLICY IF EXISTS "storage images: manager update"    ON storage.objects;
DROP POLICY IF EXISTS "storage documents: member read"    ON storage.objects;
DROP POLICY IF EXISTS "storage documents: manager upload" ON storage.objects;
DROP POLICY IF EXISTS "storage documents: manager delete" ON storage.objects;


-- -----------------------------------------------------------------------------
-- 1. Helper funkce pro kontrolu rolí
--    STABLE = Postgres může výsledek cachovat v rámci jednoho query.
-- -----------------------------------------------------------------------------

-- Vrací roli aktuálního uživatele, nebo NULL pro anonymního návštěvníka.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id = auth.uid()
    AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin: nejvyšší úroveň — správa uživatelů, rolí, nastavení.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Manager nebo Admin: správa veškerého obsahu webu.
CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() IN ('manager', 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Ověřený člen (libovolná role): přihlášen + aktivní profil.
CREATE OR REPLACE FUNCTION public.is_authenticated_member()
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- =============================================================================
-- 2. RLS — sections
--    Visitor:  SELECT aktivní sekce
--    Manager+: plný CRUD
-- =============================================================================

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sections: public read"
  ON public.sections
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "sections: manager write"
  ON public.sections
  FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());


-- =============================================================================
-- 3. RLS — pages
--    Visitor:  SELECT veřejných aktivních stránek (is_members_only = false)
--    Member+:  SELECT + veřejné + members-only
--    Manager+: plný CRUD
-- =============================================================================

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- Visitor: jen veřejné stránky
CREATE POLICY "pages: public read"
  ON public.pages
  FOR SELECT
  USING (
    is_active = true
    AND is_members_only = false
  );

-- Member+: veřejné i members-only (politika se kombinuje s OR)
CREATE POLICY "pages: member read"
  ON public.pages
  FOR SELECT
  USING (
    is_active = true
    AND public.is_authenticated_member()
  );

-- Manager+: plný CRUD
CREATE POLICY "pages: manager write"
  ON public.pages
  FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());


-- =============================================================================
-- 4. RLS — page_components
--    Visitor+: SELECT aktivních
--    Manager+: plný CRUD
-- =============================================================================

ALTER TABLE public.page_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "components: public read"
  ON public.page_components
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "components: manager write"
  ON public.page_components
  FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());


-- =============================================================================
-- 5. RLS — footer_content
--    Visitor+: SELECT aktivních
--    Manager+: plný CRUD
-- =============================================================================

ALTER TABLE public.footer_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "footer: public read"
  ON public.footer_content
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "footer: manager write"
  ON public.footer_content
  FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());


-- =============================================================================
-- 6. RLS — user_profiles
--    Visitor:  žádný přístup
--    Member:   SELECT + UPDATE vlastního profilu (NELZE změnit role!)
--    Admin:    plný přístup ke všem profilům
-- =============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Čtení vlastního profilu
CREATE POLICY "profiles: own read"
  ON public.user_profiles
  FOR SELECT
  USING (id = auth.uid());

-- Úprava vlastního profilu — WITH CHECK zakazuje změnu role
CREATE POLICY "profiles: own update"
  ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- role musí zůstat stejná jako před editací
    AND role = (
      SELECT role FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- Admin: plný přístup (včetně změny role jiným uživatelům)
CREATE POLICY "profiles: admin all"
  ON public.user_profiles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =============================================================================
-- 7. RLS — media
--    Visitor+: SELECT (obrázky jsou veřejné)
--    Manager+: INSERT + DELETE
--    Admin:    UPDATE (alt_text, metadata)
-- =============================================================================

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media: public read"
  ON public.media
  FOR SELECT
  USING (true);

CREATE POLICY "media: manager insert"
  ON public.media
  FOR INSERT
  WITH CHECK (public.is_manager_or_above());

CREATE POLICY "media: manager delete"
  ON public.media
  FOR DELETE
  USING (public.is_manager_or_above());

CREATE POLICY "media: manager update"
  ON public.media
  FOR UPDATE
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());


-- =============================================================================
-- 8. RLS — documents
--    Visitor:  žádný přístup
--    Member+:  SELECT aktivních dokumentů
--    Manager+: plný CRUD
-- =============================================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents: member read"
  ON public.documents
  FOR SELECT
  USING (
    is_active = true
    AND public.is_authenticated_member()
  );

CREATE POLICY "documents: manager write"
  ON public.documents
  FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());


-- =============================================================================
-- 9. RLS — site_settings
--    Visitor+: SELECT (čtení nastavení je veřejné — neobsahuje citlivá data)
--    Manager+: UPDATE existujících klíčů
--    Admin:    INSERT nových klíčů + DELETE
-- =============================================================================

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings: public read"
  ON public.site_settings
  FOR SELECT
  USING (true);

CREATE POLICY "settings: manager update"
  ON public.site_settings
  FOR UPDATE
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());

CREATE POLICY "settings: admin insert"
  ON public.site_settings
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "settings: admin delete"
  ON public.site_settings
  FOR DELETE
  USING (public.is_admin());


-- =============================================================================
-- 10. Supabase Storage politiky
--
-- POZOR: Před spuštěním tohoto bloku musí existovat buckety:
--   - "images"    (Public bucket)
--   - "documents" (Private bucket)
--
-- Buckety vytvoř v Supabase Dashboard → Storage → New Bucket,
-- nebo přes SQL níže.
-- =============================================================================

-- Vytvoření bucketů (pokud ještě neexistují)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('images',    'images',    true),
  ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- Bucket: images (veřejný)
-- -----------------------------------------------------------------------------

-- Všichni mohou číst (veřejný bucket)
CREATE POLICY "storage images: public read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'images');

-- Manager+ může nahrávat
CREATE POLICY "storage images: manager upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'images'
    AND public.is_manager_or_above()
  );

-- Manager+ může mazat
CREATE POLICY "storage images: manager delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'images'
    AND public.is_manager_or_above()
  );

-- Manager+ může přepisovat (update = replace)
CREATE POLICY "storage images: manager update"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'images'
    AND public.is_manager_or_above()
  );


-- -----------------------------------------------------------------------------
-- Bucket: documents (privátní — jen přihlášení členové)
-- -----------------------------------------------------------------------------

-- Přihlášený člen může číst (stahovat přes signed URL)
CREATE POLICY "storage documents: member read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents'
    AND public.is_authenticated_member()
  );

-- Manager+ může nahrávat dokumenty
CREATE POLICY "storage documents: manager upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_manager_or_above()
  );

-- Manager+ může mazat dokumenty
CREATE POLICY "storage documents: manager delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'documents'
    AND public.is_manager_or_above()
  );
