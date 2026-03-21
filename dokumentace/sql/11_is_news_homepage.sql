-- =============================================================================
-- 11_is_news_homepage.sql
-- Supabase / PostgreSQL — Idempotentní
--
-- CO DĚLÁ:
--   1. Přidá sloupec `is_news` do tabulky `pages`
--      → TRUE = článek se zobrazuje i v sekci Aktuality na homepage
--   2. Aktualizuje / vloží záznamy page_components pro homepage:
--      - text_banner  (zelený pruh nad aktualitami, editovatelný)
--      - text_o_klubu (text pod aktualitami, editovatelný)
--   3. Aktualizuje záznamy footer_content — přejmenuje column_key
--      contact → paticka_kontakt
--      links   → paticka_odkazy
--      about   → paticka_dobrany
--      social  → odstraní (sledujte nás)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. is_news na pages
-- ---------------------------------------------------------------------------

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS is_news BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pages.is_news IS
  'TRUE = článek se zobrazí i v sekci Aktuality na homepage (bez ohledu na sekci)';

-- ---------------------------------------------------------------------------
-- 2. page_components — text_banner a text_o_klubu
-- ---------------------------------------------------------------------------

-- text_banner — editovatelný text v zeleném pruhu + tlačítka
INSERT INTO public.page_components
  (page_key, component, title, subtitle, content, data, sort_order, is_active)
VALUES
  (
    'home', 'text_banner',
    'Rezervujte kurt nebo nás kontaktujte',
    NULL,
    NULL,
    '{"buttons": [{"label": "Rezervace", "url": "/kontakt", "variant": "primary"}, {"label": "Kontakt", "url": "/uvod/kontakt-mapa", "variant": "outline"}]}'::jsonb,
    10, true
  )
ON CONFLICT DO NOTHING;

-- text_o_klubu — blok „O klubu" pod aktualitami
INSERT INTO public.page_components
  (page_key, component, title, subtitle, content, data, sort_order, is_active)
VALUES
  (
    'home', 'text_o_klubu',
    'O našem oddíle',
    NULL,
    '<p>Tenisový oddíl TJ Dobřany, z.s. pořádá tenis od roku 1964 v areálu Džungle v Dobřanech u Plzně. Nabízíme antukové kurty, trénink pro děti i dospělé a přátelskou atmosféru.</p>',
    '{}'::jsonb,
    30, true
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. footer_content — přejmenování column_key sloupců
-- ---------------------------------------------------------------------------

-- Nejprve odstraníme CHECK constraint, který povoloval jen staré hodnoty
ALTER TABLE public.footer_content
  DROP CONSTRAINT IF EXISTS footer_content_column_key_check;

UPDATE public.footer_content SET column_key = 'paticka_kontakt' WHERE column_key = 'contact';
UPDATE public.footer_content SET column_key = 'paticka_odkazy'  WHERE column_key = 'links';
UPDATE public.footer_content SET column_key = 'paticka_dobrany' WHERE column_key = 'about';

-- Deaktivovat social sloupec (sledujte nás)
UPDATE public.footer_content SET is_active = false WHERE column_key = 'social';

-- Přidáme nový CHECK constraint s aktuálními hodnotami
ALTER TABLE public.footer_content
  ADD CONSTRAINT footer_content_column_key_check
  CHECK (column_key IN ('paticka_kontakt', 'paticka_odkazy', 'paticka_dobrany', 'social'));
