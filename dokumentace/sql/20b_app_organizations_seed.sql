-- =============================================================================
-- 20b_app_organizations_seed.sql
-- Seed data: organizace TK Dobřany + napojení stávajícího admina
-- SPUSTIT PO 20_app_organizations.sql
-- =============================================================================

-- 1. Vytvořit organizaci TK Dobřany
INSERT INTO public.app_organizations (name, slug, sport_types, active_modules, custom_domain)
VALUES (
  'TK Dobřany',
  'tenis-dobrany',
  '{tenis}',
  '{cms,reservations}',
  'tenis-dobrany.cz'
);

-- 2. Napojit stávající adminy jako org admin
-- (všechny uživatele s rolí admin v CMS přidáme jako admin organizace)
INSERT INTO public.app_organization_members (organization_id, user_id, role)
SELECT
  o.id,
  up.id,
  'admin'
FROM public.app_organizations o
CROSS JOIN public.user_profiles up
WHERE o.slug = 'tenis-dobrany'
  AND up.role = 'admin'
  AND up.is_active = true
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 3. Napojit stávající manažery jako org manager
INSERT INTO public.app_organization_members (organization_id, user_id, role)
SELECT
  o.id,
  up.id,
  'manager'
FROM public.app_organizations o
CROSS JOIN public.user_profiles up
WHERE o.slug = 'tenis-dobrany'
  AND up.role = 'manager'
  AND up.is_active = true
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 4. Napojit stávající members jako player
INSERT INTO public.app_organization_members (organization_id, user_id, role)
SELECT
  o.id,
  up.id,
  'player'
FROM public.app_organizations o
CROSS JOIN public.user_profiles up
WHERE o.slug = 'tenis-dobrany'
  AND up.role = 'member'
  AND up.is_active = true
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 5. Nastavit default_organization_id pro všechny napojené uživatele
UPDATE public.user_profiles
SET default_organization_id = (
  SELECT id FROM public.app_organizations WHERE slug = 'tenis-dobrany'
)
WHERE id IN (
  SELECT user_id FROM public.app_organization_members
  WHERE organization_id = (
    SELECT id FROM public.app_organizations WHERE slug = 'tenis-dobrany'
  )
)
AND default_organization_id IS NULL;
