-- 12 – Nové designové komponenty: hero, parallax, header + sekce "Úvod"
-- =====================================================================

-- Vytvořit skrytou sekci "Úvod" pokud neexistuje
INSERT INTO sections (title, slug, description, menu_order, show_in_menu)
VALUES ('Úvod', 'uvod', 'Skrytá sekce – články se zobrazují jako bloky na homepage', 0, false)
ON CONFLICT (slug) DO NOTHING;

-- ── Hlavička (logo text) ────────────────────────────────────────────────────
INSERT INTO page_components (page_key, component, title, sort_order, is_active)
VALUES ('home', 'header', 'TJ Dobřany', 0, true)
ON CONFLICT DO NOTHING;

-- ── Hero sekce (fotky + overlay) ────────────────────────────────────────────
-- Deaktivujeme starý text_banner a aktivujeme hero
UPDATE page_components SET is_active = false WHERE page_key = 'home' AND component = 'text_banner';

INSERT INTO page_components (page_key, component, title, subtitle, sort_order, is_active, data)
VALUES (
  'home',
  'hero',
  'Tenisový oddíl TJ Dobřany',
  'Tradice a vášeň pro tenis od roku 1964. Přidejte se k nám a objevte kouzlo tohoto krásného sportu ve sportovním areálu "Džungle" v Dobřanech.',
  5,
  true,
  '{
    "buttons": [
      {"label": "Více o nás", "url": "/o-klubu", "variant": "primary"},
      {"label": "Kontakt", "url": "/uvod/kontakt-mapa", "variant": "outline"}
    ],
    "images": [
      "/images/hero/areaal_0.jpg",
      "/images/hero/areaal_1.jpg",
      "/images/hero/areaal_2.jpg",
      "/images/hero/areaal_3.jpg"
    ]
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- ── Parallax pruh (před kontakt-mapou) ──────────────────────────────────────
INSERT INTO page_components (page_key, component, title, sort_order, is_active, data)
VALUES (
  'home',
  'parallax_strip',
  NULL,
  30,
  true,
  '{"image_url": "/images/hero/areaal_o1.jpg"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ── Deaktivovat nepoužívané komponenty ──────────────────────────────────────
UPDATE page_components SET is_active = false
WHERE page_key = 'home'
  AND component IN ('text_image', 'section_cards', 'latest_articles', 'cta_buttons');
