-- =============================================================================
-- 22_fix_rls_policies.sql
-- Oprava cyklických RLS politik — náhrada za SECURITY DEFINER funkce
--
-- PROBLÉM: Polícy "courts_select_org_member" dělala EXISTS na tabulce
-- app_organization_members, která sama má SELECT politiku referující na sebe.
-- Supabase/PostgREST to vyhodnotí jako fail → prázdný výsledek → "Přístup odepřen".
--
-- ŘEŠENÍ: Všechny politiky přepisujeme pomocí existujících SECURITY DEFINER
-- funkcí (get_user_org_role, is_org_admin_or_manager), které vnitřně obcházejí RLS.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. app_organization_members — oprava "read for org members"
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_members: read for org members" ON public.app_organization_members;

-- Nahrazena verzí bez cyklické reference
CREATE POLICY "org_members: read for org members"
  ON public.app_organization_members FOR SELECT
  TO authenticated
  USING (
    -- vlastní řádek (bez subcorrelace)
    user_id = auth.uid()
    -- nebo člen téže organizace — přes SECURITY DEFINER funkci (bez RLS)
    OR public.get_user_org_role(organization_id) IS NOT NULL
  );

-- "org_members: read own" — ponechat, je bezpečná (jen auth.uid())


-- ---------------------------------------------------------------------------
-- 2. app_courts — oprava SELECT politiky
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "courts_select_org_member" ON public.app_courts;

CREATE POLICY "courts_select_org_member" ON public.app_courts
  FOR SELECT TO authenticated
  USING (public.get_user_org_role(organization_id) IS NOT NULL);


-- ---------------------------------------------------------------------------
-- 3. app_court_reservation_rules — oprava SELECT politiky
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "rules_select_org_member" ON public.app_court_reservation_rules;

CREATE POLICY "rules_select_org_member" ON public.app_court_reservation_rules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_courts c
      WHERE c.id = app_court_reservation_rules.court_id
        AND public.get_user_org_role(c.organization_id) IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "rules_manage_org_admin" ON public.app_court_reservation_rules;

CREATE POLICY "rules_manage_org_admin" ON public.app_court_reservation_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_courts c
      WHERE c.id = app_court_reservation_rules.court_id
        AND public.is_org_admin_or_manager(c.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_courts c
      WHERE c.id = app_court_reservation_rules.court_id
        AND public.is_org_admin_or_manager(c.organization_id)
    )
  );


-- ---------------------------------------------------------------------------
-- 4. app_court_reservations — oprava SELECT a INSERT politik
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "reservations_select_org_member" ON public.app_court_reservations;

CREATE POLICY "reservations_select_org_member" ON public.app_court_reservations
  FOR SELECT TO authenticated
  USING (public.get_user_org_role(organization_id) IS NOT NULL);

DROP POLICY IF EXISTS "reservations_insert_org_member" ON public.app_court_reservations;

CREATE POLICY "reservations_insert_org_member" ON public.app_court_reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.get_user_org_role(organization_id) IS NOT NULL
  );

-- UPDATE a DELETE politiky zůstávají — používají is_org_admin_or_manager (OK)


-- ---------------------------------------------------------------------------
-- Ověření — výpis aktuálních politik
-- ---------------------------------------------------------------------------
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('app_organization_members', 'app_courts', 'app_court_reservation_rules', 'app_court_reservations')
ORDER BY tablename, policyname;
