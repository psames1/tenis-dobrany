-- =============================================================================
-- 21b_app_courts_seed.sql
-- Seed data: 3 antukové kurty TK Dobřany + výchozí pravidla
-- SPUSTIT PO 21_app_courts_reservations.sql
-- =============================================================================

-- 1. Vložit 3 antukové kurty pro TK Dobřany
INSERT INTO public.app_courts (organization_id, name, surface, indoor, active, sort_order)
SELECT o.id, 'Kurt 1', 'clay', false, true, 1
FROM public.app_organizations o
WHERE o.slug = 'tenis-dobrany';

INSERT INTO public.app_courts (organization_id, name, surface, indoor, active, sort_order)
SELECT o.id, 'Kurt 2', 'clay', false, true, 2
FROM public.app_organizations o
WHERE o.slug = 'tenis-dobrany';

INSERT INTO public.app_courts (organization_id, name, surface, indoor, active, sort_order)
SELECT o.id, 'Kurt 3', 'clay', false, true, 3
FROM public.app_organizations o
WHERE o.slug = 'tenis-dobrany';

-- 2. Výchozí pravidla pro všechny 3 kurty
-- Po–Ne, 07:00–21:00, 60min slot, pro členy zdarma, hosté 100 Kč, max 14 dní dopředu
INSERT INTO public.app_court_reservation_rules (
  court_id,
  valid_from,
  time_from,
  time_to,
  slot_minutes,
  price_member,
  price_guest,
  min_advance_minutes,
  max_advance_days,
  requires_approval,
  day_of_week
)
SELECT
  c.id,
  CURRENT_DATE,
  '07:00'::time,
  '21:00'::time,
  60,
  0,           -- členové zdarma
  100,         -- hosté 100 Kč
  0,           -- lze rezervovat i v den hry
  14,          -- max 2 týdny dopředu
  false,       -- bez schválení
  NULL         -- všechny dny
FROM public.app_courts c
JOIN public.app_organizations o ON o.id = c.organization_id
WHERE o.slug = 'tenis-dobrany';

-- Kontrola výstupu
SELECT c.name, r.time_from, r.time_to, r.slot_minutes, r.price_member, r.max_advance_days
FROM public.app_courts c
JOIN public.app_court_reservation_rules r ON r.court_id = c.id
JOIN public.app_organizations o ON o.id = c.organization_id
WHERE o.slug = 'tenis-dobrany'
ORDER BY c.sort_order;
