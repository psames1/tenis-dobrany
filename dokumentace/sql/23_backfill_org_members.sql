-- =============================================================================
-- 23_backfill_org_members.sql
-- Doplní chybějící záznamy v app_organization_members pro TK Dobřany.
--
-- PROBLÉM: Nově registrovaní uživatelé (nebo ti zaregistrovaní před spuštěním
-- 20b_app_organizations_seed.sql) nemají záznam v app_organization_members
-- → /rezervace vrací "Přístup odepřen" i přesto, že jsou přihlášeni.
--
-- ŘEŠENÍ: Idempotentní INSERT ON CONFLICT DO NOTHING pro všechny aktivní
-- uživatele v user_profiles, kteří v app_organization_members ještě nejsou.
--
-- BEZPEČNÉ na opakované spuštění — ON CONFLICT existující záznamy nezmění.
-- =============================================================================

DO $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id
  FROM public.app_organizations
  WHERE slug = 'tenis-dobrany'
    AND is_active = true
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organizace tenis-dobrany nebyla nalezena!';
  END IF;

  -- Admini (CMS role = admin → org role = admin)
  INSERT INTO public.app_organization_members (organization_id, user_id, role, is_active)
  SELECT v_org_id, up.id, 'admin', true
  FROM public.user_profiles up
  WHERE up.role = 'admin'
    AND up.is_active = true
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Manažeři (CMS role = manager → org role = manager)
  INSERT INTO public.app_organization_members (organization_id, user_id, role, is_active)
  SELECT v_org_id, up.id, 'manager', true
  FROM public.user_profiles up
  WHERE up.role = 'manager'
    AND up.is_active = true
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Členové (CMS role = member → org role = player)
  INSERT INTO public.app_organization_members (organization_id, user_id, role, is_active)
  SELECT v_org_id, up.id, 'player', true
  FROM public.user_profiles up
  WHERE up.role = 'member'
    AND up.is_active = true
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Nastavit default_organization_id všem, kteří ho ještě nemají
  UPDATE public.user_profiles
  SET default_organization_id = v_org_id
  WHERE id IN (
    SELECT user_id FROM public.app_organization_members
    WHERE organization_id = v_org_id
  )
  AND default_organization_id IS NULL;

  RAISE NOTICE 'Backfill dokončen pro organizaci: %', v_org_id;
END;
$$;

-- Ověření výsledku
SELECT
  up.email,
  up.full_name,
  up.role AS cms_role,
  m.role AS org_role,
  m.is_active
FROM public.user_profiles up
LEFT JOIN public.app_organization_members m
  ON m.user_id = up.id
  AND m.organization_id = (SELECT id FROM public.app_organizations WHERE slug = 'tenis-dobrany')
WHERE up.is_active = true
ORDER BY up.email;
