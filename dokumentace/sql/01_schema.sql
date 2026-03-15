-- =============================================================================
-- 01_schema.sql — Databázové schéma pro Tenis Dobřany
-- Supabase / PostgreSQL
--
-- JAK SPUSTIT:
--   Supabase Dashboard → SQL Editor → vlevo "postgres" (Primary database)
--   → vlož celý soubor → Run
--
-- OPAKOVANÉ SPUŠTĚNÍ:
--   Skript je idempotentní — RESET sekce níže smaže a znovu vytvoří vše.
--   ⚠  DESTRUKTIVNÍ: smaže všechna data. Na produkci s daty nepoužívat
--      celý skript — jen izolované ALTER / CREATE ... IF NOT EXISTS.
--
-- POSTGRES ROLE V SQL EDITORU:
--   Supabase SQL Editor běží jako "postgres" (superuser s BYPASSRLS).
--   RLS politiky se na něj nevztahují — to je správné chování pro
--   admin/migrace. Nech to tak.
--   Aplikace (Vercel/Next.js) se nepřipojuje přes přímý PostgreSQL —
--   používá Supabase REST API (PostgREST), kde se požadavky provádějí
--   jako "anon" (nepřihlášen) nebo "authenticated" (přihlášen). RLS
--   se tam uplatňuje plně. DB heslo do Next.js nepotřebuješ.
-- =============================================================================


-- =============================================================================
-- RESET — smaže vše a znovu vytvoří od nuly
--   ⚠  DESTRUKTIVNÍ — jen pro vývoj / čistou instalaci!
-- =============================================================================

-- Triggery (musí být před DROP FUNCTION)
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created       ON auth.users;
DROP TRIGGER IF EXISTS set_updated_at             ON public.site_settings;
DROP TRIGGER IF EXISTS set_updated_at       ON public.user_profiles;
DROP TRIGGER IF EXISTS set_updated_at       ON public.footer_content;
DROP TRIGGER IF EXISTS set_updated_at       ON public.page_components;
DROP TRIGGER IF EXISTS set_updated_at       ON public.pages;
DROP TRIGGER IF EXISTS set_updated_at       ON public.sections;

-- Funkce
DROP FUNCTION IF EXISTS public.handle_user_email_change() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user()          CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at()        CASCADE;

-- Tabulky (CASCADE automaticky vyřeší FK závislosti)
DROP TABLE IF EXISTS public.site_settings   CASCADE;
DROP TABLE IF EXISTS public.documents       CASCADE;
DROP TABLE IF EXISTS public.media           CASCADE;
DROP TABLE IF EXISTS public.user_profiles   CASCADE;
DROP TABLE IF EXISTS public.footer_content  CASCADE;
DROP TABLE IF EXISTS public.page_components CASCADE;
DROP TABLE IF EXISTS public.pages           CASCADE;
DROP TABLE IF EXISTS public.sections        CASCADE;

-- Vlastní typy (až po tabulkách)
DROP TYPE IF EXISTS public.content_type CASCADE;
DROP TYPE IF EXISTS public.app_role     CASCADE;


-- -----------------------------------------------------------------------------
-- 0. Vlastní datové typy
-- -----------------------------------------------------------------------------

CREATE TYPE public.app_role AS ENUM ('member', 'manager', 'admin');
CREATE TYPE public.content_type AS ENUM ('article', 'html', 'markdown');


-- -----------------------------------------------------------------------------
-- 1. sections — Sekce webu + navigace
--    (musí být před pages kvůli FK)
-- -----------------------------------------------------------------------------

CREATE TABLE public.sections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT        UNIQUE NOT NULL,    -- 'aktuality', 'turnaje', 'o-klubu'
  title           TEXT        NOT NULL,
  description     TEXT,                           -- volitelný popis sekce
  menu_title      TEXT,                           -- vlastní název v menu (NULL = použije title)
  menu_url        TEXT,                           -- explicitní URL (NULL = /{slug})
  menu_order      INT         NOT NULL DEFAULT 0,
  menu_parent_id  UUID        REFERENCES public.sections(id) ON DELETE SET NULL,
  show_in_menu    BOOLEAN     NOT NULL DEFAULT false,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sections_menu
  ON public.sections (show_in_menu, menu_order)
  WHERE is_active = true;

COMMENT ON TABLE  public.sections             IS 'Sekce webu — definice navigace a URL struktury';
COMMENT ON COLUMN public.sections.slug        IS 'URL slug — zároveň identifikátor sekce v queries';
COMMENT ON COLUMN public.sections.menu_url    IS 'Pokud NULL, generuje se jako /{slug}';


-- -----------------------------------------------------------------------------
-- 2. pages — Stránky a články
-- -----------------------------------------------------------------------------

CREATE TABLE public.pages (
  id              UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id      UUID                 REFERENCES public.sections(id) ON DELETE SET NULL,
  slug            TEXT                 NOT NULL,
  title           TEXT                 NOT NULL,
  excerpt         TEXT,                           -- perex / krátký popis pro výpis
  content         TEXT,                           -- HTML nebo Markdown tělo článku
  content_type    public.content_type  NOT NULL DEFAULT 'html',
  image_url       TEXT,                           -- URL náhledového obrázku
  meta            JSONB                DEFAULT '{}',  -- SEO: title, description, og:image
  is_active       BOOLEAN              NOT NULL DEFAULT true,
  is_members_only BOOLEAN              NOT NULL DEFAULT false,  -- jen přihlášení členové
  sort_order      INT                  NOT NULL DEFAULT 0,
  published_at    TIMESTAMPTZ          DEFAULT now(),
  created_by      UUID                 REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ          NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ          NOT NULL DEFAULT now(),
  UNIQUE (section_id, slug)
);

CREATE INDEX idx_pages_section
  ON public.pages (section_id, sort_order)
  WHERE is_active = true;

CREATE INDEX idx_pages_published
  ON public.pages (published_at DESC)
  WHERE is_active = true;

COMMENT ON TABLE  public.pages                    IS 'Stránky a články — hlavní obsahová tabulka';
COMMENT ON COLUMN public.pages.is_members_only    IS 'TRUE = dostupné jen přihlášeným členům';
COMMENT ON COLUMN public.pages.meta               IS 'JSON: { "seo_title": "", "seo_description": "", "og_image": "" }';


-- -----------------------------------------------------------------------------
-- 3. page_components — Homepage PageBuilder bloky
-- -----------------------------------------------------------------------------

CREATE TABLE public.page_components (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key        TEXT        NOT NULL DEFAULT 'home',  -- 'home' nebo slug stránky
  component       TEXT        NOT NULL,
  -- Povolené hodnoty: hero | text_image | section_cards | latest_articles
  --                   parallax | cta_buttons | text_block
  title           TEXT,
  subtitle        TEXT,
  content         TEXT,
  data            JSONB       DEFAULT '{}',  -- slides[], buttons[], konfigurace komponenty
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order      INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_components_page
  ON public.page_components (page_key, sort_order)
  WHERE is_active = true;

COMMENT ON TABLE  public.page_components          IS 'PageBuilder bloky — primárně homepage komponenty';
COMMENT ON COLUMN public.page_components.data     IS 'Konfigurace komponenty — struktura závisí na hodnotě "component"';


-- -----------------------------------------------------------------------------
-- 4. footer_content — Zápatí webu (4 sloupce)
-- -----------------------------------------------------------------------------

CREATE TABLE public.footer_content (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key      TEXT        NOT NULL
                              CHECK (column_key IN ('contact', 'links', 'social', 'about')),
  item_type       TEXT        NOT NULL,
  -- Povolené hodnoty: heading | address | links_list | social_links | text | phone | email
  label           TEXT,                           -- viditelný popisek položky
  content         TEXT,                           -- textový obsah
  data            JSONB       DEFAULT '{}',       -- strukturovaná data (ikony, URL, adresy)
  sort_order      INT         NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_footer_column
  ON public.footer_content (column_key, sort_order)
  WHERE is_active = true;

COMMENT ON TABLE  public.footer_content            IS 'Zápatí webu rozdělené do 4 sloupců';
COMMENT ON COLUMN public.footer_content.data       IS 'Příklad links_list: [{"label":"O nás","url":"/o-nas"}]';


-- -----------------------------------------------------------------------------
-- 5. user_profiles — Rozšíření Supabase Auth
--    (propojeno s auth.users přes 1:1 FK)
-- -----------------------------------------------------------------------------

CREATE TABLE public.user_profiles (
  id              UUID            PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,                           -- synchronizováno z auth.users.email
  full_name       TEXT,
  phone           TEXT,
  role            public.app_role NOT NULL DEFAULT 'member',
  avatar_url      TEXT,
  is_active       BOOLEAN         NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.user_profiles          IS 'Profily uživatelů — rozšíření auth.users o roli a metadata';
COMMENT ON COLUMN public.user_profiles.email    IS 'Denormalizováno z auth.users.email — sync přes trigger on_auth_user_email_updated';
COMMENT ON COLUMN public.user_profiles.role     IS 'member | manager | admin — kaskádová kontrola v RLS';


-- -----------------------------------------------------------------------------
-- 6. media — Katalog médií (metadata souborů z Supabase Storage)
-- -----------------------------------------------------------------------------

CREATE TABLE public.media (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket          TEXT        NOT NULL DEFAULT 'images',
  path            TEXT        NOT NULL,           -- cesta v Supabase Storage bucketu
  filename        TEXT        NOT NULL,
  mime_type       TEXT,
  size_bytes      INT,
  alt_text        TEXT,                           -- popisek pro <img alt="">
  uploaded_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_bucket
  ON public.media (bucket, created_at DESC);

COMMENT ON TABLE  public.media            IS 'Katalog nahraných médií — soubory samotné jsou v Supabase Storage';
COMMENT ON COLUMN public.media.path       IS 'Relativní cesta v bucketu, např. "2026/03/logo.png"';


-- -----------------------------------------------------------------------------
-- 7. documents — Dokumenty pro členy (zápisy ze schůzí, pravidla, ...)
-- -----------------------------------------------------------------------------

CREATE TABLE public.documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT        NOT NULL,
  description     TEXT,
  file_url        TEXT        NOT NULL,           -- Storage path pro signed URL generování
  category        TEXT        NOT NULL DEFAULT 'general'
                              CHECK (category IN ('minutes', 'rules', 'forms', 'other')),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  published_at    TIMESTAMPTZ DEFAULT now(),
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_category
  ON public.documents (category, published_at DESC)
  WHERE is_active = true;

COMMENT ON TABLE  public.documents              IS 'Dokumenty přístupné přihlášeným členům';
COMMENT ON COLUMN public.documents.category     IS 'minutes=zápisy | rules=stanovy | forms=formuláře | other=ostatní';
COMMENT ON COLUMN public.documents.file_url     IS 'Storage path pro generování signed URL na straně serveru';


-- -----------------------------------------------------------------------------
-- 8. site_settings — Globální nastavení webu (key-value)
-- -----------------------------------------------------------------------------

CREATE TABLE public.site_settings (
  key             TEXT        PRIMARY KEY,
  value           TEXT        NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.site_settings IS 'Globální konfigurace webu — klíče: site_name, contact_email, ga_id, ...';

-- Výchozí hodnoty
INSERT INTO public.site_settings (key, value) VALUES
  ('site_name',      'Tenisový oddíl TJ Dobřany'),
  ('contact_email',  'info@tenisdobrany.cz'),
  ('contact_phone',  ''),
  ('contact_address','Dobřany u Plzně');


-- -----------------------------------------------------------------------------
-- 9. Triggery — auto-update updated_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.page_components
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.footer_content
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- -----------------------------------------------------------------------------
-- 10. Trigger — auto-vytvoření user_profiles po registraci
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 11. Trigger — sync emailu při změně v Supabase Auth
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_change();
