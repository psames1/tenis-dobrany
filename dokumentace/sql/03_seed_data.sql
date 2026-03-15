-- =============================================================================
-- 03_seed_data.sql — Výchozí data pro Tenis Dobřany
-- Supabase / PostgreSQL
--
-- JAK SPUSTIT:
--   Po úspěšném spuštění 01_schema.sql + 02_rls_policies.sql.
--   Supabase Dashboard → SQL Editor → Run
--
-- OPAKOVANÉ SPUŠTĚNÍ:
--   Idempotentní — sections přes UPSERT (slug je unique),
--   footer + homepage komponenty přes DELETE + INSERT.
--   Data jsou přepsána výchozími hodnotami, ostatní záznamy v DB nejsou
--   ovlivněny.
-- =============================================================================


-- =============================================================================
-- 1. Sekce webu + navigace
-- =============================================================================

INSERT INTO public.sections
  (slug, title, menu_title, menu_order, show_in_menu, is_active)
VALUES
  ('aktuality',   'Aktuality',     NULL,          10, true,  true),
  ('o-klubu',     'O klubu',       NULL,          20, true,  true),
  ('turnaje',     'Turnaje',       NULL,          30, true,  true),
  ('pro-cleny',   'Pro členy',     'Pro členy',   40, false, true)
ON CONFLICT (slug) DO UPDATE SET
  title        = EXCLUDED.title,
  menu_title   = EXCLUDED.menu_title,
  menu_order   = EXCLUDED.menu_order,
  show_in_menu = EXCLUDED.show_in_menu,
  is_active    = EXCLUDED.is_active;


-- =============================================================================
-- 2. Zápatí webu (4 sloupce)
-- =============================================================================

DELETE FROM public.footer_content
  WHERE column_key IN ('contact', 'links', 'social', 'about');

INSERT INTO public.footer_content
  (column_key, item_type, label, content, data, sort_order)
VALUES
  -- ── Kontakt ──────────────────────────────────────────────────────────────
  ('contact', 'heading',  NULL, 'Kontakt', '{}', 0),
  ('contact', 'address',  NULL, NULL,
    '{"street":"Areál Džungle","city":"Dobřany","postal":"334 41"}', 10),
  ('contact', 'phone',    NULL, '+420 xxx xxx xxx', '{}', 20),
  ('contact', 'email',    NULL, 'info@tenisdobrany.cz', '{}', 30),

  -- ── Rychlé odkazy ─────────────────────────────────────────────────────────
  ('links', 'heading',    NULL, 'Rychlé odkazy', '{}', 0),
  ('links', 'links_list', NULL, NULL,
    '[{"label":"O klubu","url":"/o-klubu"},{"label":"Aktuality","url":"/aktuality"},{"label":"Turnaje","url":"/turnaje"},{"label":"Kontakt","url":"/kontakt"}]',
    10),

  -- ── Sociální sítě ─────────────────────────────────────────────────────────
  ('social', 'heading',      NULL, 'Sledujte nás', '{}', 0),
  ('social', 'social_links', NULL, NULL,
    '[{"platform":"facebook","url":"https://www.facebook.com","label":"Facebook"}]',
    10),

  -- ── O klubu ───────────────────────────────────────────────────────────────
  ('about', 'heading', NULL, 'TJ Dobřany', '{}', 0),
  ('about', 'text',    NULL,
    'Tenisový oddíl TJ Dobřany, z.s. Hrajeme tenis od roku 1964. Provozujeme areál „Džungle" v Dobřanech u Plzně.',
    '{}', 10);


-- =============================================================================
-- 3. Homepage — PageBuilder komponenty
-- =============================================================================

DELETE FROM public.page_components WHERE page_key = 'home';

INSERT INTO public.page_components
  (page_key, component, title, subtitle, content, data, sort_order)
VALUES
  -- Hero sekce
  ('home', 'hero',
    'Tenisový oddíl TJ Dobřany',
    'Hrajeme tenis od roku 1964 v areálu Džungle',
    NULL,
    '{"buttons":[{"label":"O klubu","url":"/o-klubu","variant":"primary"},{"label":"Aktuality","url":"/aktuality","variant":"outline"}]}',
    10),

  -- O klubu (text + obrázek)
  ('home', 'text_image',
    'O klubu',
    NULL,
    '<p>Jsme tenisový oddíl se sídlem v Dobřanech u Plzně. Klub byl founded v roce 1964 a provozujeme areál „Džungle" s antukovanými dvorci. Vítáme hráče všech výkonnostních kategorií.</p>',
    '{"image_position":"right","icon":"🎾"}',
    20),

  -- Karty sekcí (generuje se dynamicky z tabulky sections)
  ('home', 'section_cards',
    'Naše sekce',
    'Vše, co u nás najdete',
    NULL,
    '{}',
    30),

  -- Nejnovější aktuality
  ('home', 'latest_articles',
    'Nejnovější aktuality',
    NULL,
    NULL,
    '{"source_section":"aktuality","limit":3,"columns":3}',
    40),

  -- CTA tlačítka
  ('home', 'cta_buttons',
    'Přidejte se k nám',
    'Zájem o členství nebo více informací? Neváhejte nás kontaktovat.',
    NULL,
    '{"buttons":[{"label":"Kontaktujte nás","url":"/kontakt","variant":"primary"}]}',
    50);
