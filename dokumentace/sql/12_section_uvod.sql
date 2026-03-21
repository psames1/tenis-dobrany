-- 12 – Sekce "Úvod" pro designove bloky na homepage
-- Články ze sekce "uvod" s show_in_menu = true se zobrazují na homepage
-- jako obsahové bloky (kontakt-mapa, o klubu, atd.)

-- Vytvořit sekci pokud neexistuje
INSERT INTO sections (name, slug, description, sort_order, show_in_menu)
VALUES ('Úvod', 'uvod', 'Skrytá sekce – články se zobrazují jako bloky na homepage', 0, false)
ON CONFLICT (slug) DO NOTHING;
