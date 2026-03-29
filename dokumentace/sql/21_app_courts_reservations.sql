-- =============================================================================
-- 21_app_courts_reservations.sql
-- Rezervační systém — kurty, pravidla a rezervace
-- SPUSTIT PO 20_app_organizations.sql
-- =============================================================================


-- =============================================================================
-- 1. app_courts — Kurty / hřiště
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_courts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.app_organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  surface         text        NOT NULL DEFAULT 'clay'
                              CHECK (surface IN ('clay', 'hard', 'grass', 'indoor_hard')),
  indoor          boolean     NOT NULL DEFAULT false,
  active          boolean     NOT NULL DEFAULT true,
  sort_order      int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courts_org
  ON public.app_courts (organization_id, sort_order)
  WHERE active = true;

COMMENT ON TABLE  public.app_courts              IS 'Kurty/hřiště organizace';
COMMENT ON COLUMN public.app_courts.surface      IS 'clay | hard | grass | indoor_hard';
COMMENT ON COLUMN public.app_courts.sort_order   IS 'Pořadí v gridu rezervací';


-- =============================================================================
-- 2. app_court_reservation_rules — Pravidla rezervací (časová okna, ceny)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_court_reservation_rules (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id            uuid         NOT NULL REFERENCES public.app_courts(id) ON DELETE CASCADE,
  valid_from          date         NOT NULL DEFAULT CURRENT_DATE,
  valid_to            date,        -- NULL = platí do odvolání
  time_from           time         NOT NULL DEFAULT '07:00',
  time_to             time         NOT NULL DEFAULT '21:00',
  slot_minutes        int          NOT NULL DEFAULT 60
                                   CHECK (slot_minutes IN (30, 60, 90, 120)),
  price_member        numeric(8,2) NOT NULL DEFAULT 0,
  price_guest         numeric(8,2) NOT NULL DEFAULT 0,
  min_advance_minutes int          NOT NULL DEFAULT 0,
  max_advance_days    int          NOT NULL DEFAULT 14,
  requires_approval   boolean      NOT NULL DEFAULT false,
  day_of_week         int[],       -- NULL = všechny dny; [0..6] = Ne=0, Po=1, ... So=6
  created_at          timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rules_court
  ON public.app_court_reservation_rules (court_id, valid_from);

COMMENT ON TABLE  public.app_court_reservation_rules                IS 'Pravidla pro rezervace kurtu — časová okna a ceny';
COMMENT ON COLUMN public.app_court_reservation_rules.slot_minutes   IS '30 | 60 | 90 | 120 minut';
COMMENT ON COLUMN public.app_court_reservation_rules.price_member   IS 'Cena pro člena v Kč (0 = zdarma)';
COMMENT ON COLUMN public.app_court_reservation_rules.day_of_week    IS 'NULL = všechny dny. Příklad: {1,2,3,4,5} = Po–Pá';


-- =============================================================================
-- 3. app_court_reservations — Samotné rezervace
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_court_reservations (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id        uuid         NOT NULL REFERENCES public.app_courts(id) ON DELETE RESTRICT,
  organization_id uuid         NOT NULL REFERENCES public.app_organizations(id) ON DELETE CASCADE,
  user_id         uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time      timestamptz  NOT NULL,
  end_time        timestamptz  NOT NULL,
  status          text         NOT NULL DEFAULT 'confirmed'
                               CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  price           numeric(8,2) NOT NULL DEFAULT 0,
  note            text,
  partner_name    text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  cancelled_at    timestamptz,
  cancelled_by    uuid         REFERENCES auth.users(id),

  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

-- Index pro detekci kolizí (filtruje zrušené)
CREATE INDEX IF NOT EXISTS idx_reservations_court_time
  ON public.app_court_reservations (court_id, start_time, end_time)
  WHERE status != 'cancelled';

-- Index pro výpis rezervací organizace podle data
CREATE INDEX IF NOT EXISTS idx_reservations_org_date
  ON public.app_court_reservations (organization_id, start_time);

-- Index pro výpis vlastních rezervací uživatele
CREATE INDEX IF NOT EXISTS idx_reservations_user
  ON public.app_court_reservations (user_id, start_time);

COMMENT ON TABLE  public.app_court_reservations              IS 'Rezervace kurtů — jedna řádka = jeden časový slot';
COMMENT ON COLUMN public.app_court_reservations.partner_name IS 'Nepovinné — jméno spoluhráče';
COMMENT ON COLUMN public.app_court_reservations.status       IS 'confirmed | pending | cancelled';


-- =============================================================================
-- 4. Realtime support — pro živé aktualizace gridu
-- =============================================================================

ALTER TABLE public.app_court_reservations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_court_reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_court_reservations;
  END IF;
END $$;


-- =============================================================================
-- 5. Trigger — zabrání kolizím rezervací
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_court_reservation_overlap()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.app_court_reservations
    WHERE court_id = NEW.court_id
      AND status != 'cancelled'
      AND id != NEW.id
      AND tstzrange(start_time, end_time, '[)') && tstzrange(NEW.start_time, NEW.end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'OVERLAP: Rezervace se překrývá s existující rezervací';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_court_overlap ON public.app_court_reservations;
CREATE TRIGGER trg_check_court_overlap
  BEFORE INSERT OR UPDATE ON public.app_court_reservations
  FOR EACH ROW EXECUTE FUNCTION public.check_court_reservation_overlap();


-- =============================================================================
-- 6. RLS polícy
-- =============================================================================

ALTER TABLE public.app_courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_court_reservation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_court_reservations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- app_courts: READ — všichni aktivní členové organizace
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "courts_select_org_member" ON public.app_courts;
CREATE POLICY "courts_select_org_member" ON public.app_courts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_organization_members
      WHERE organization_id = app_courts.organization_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

-- app_courts: WRITE — admin / manager organizace
DROP POLICY IF EXISTS "courts_manage_org_admin" ON public.app_courts;
CREATE POLICY "courts_manage_org_admin" ON public.app_courts
  FOR ALL TO authenticated
  USING (public.is_org_admin_or_manager(organization_id))
  WITH CHECK (public.is_org_admin_or_manager(organization_id));

-- ---------------------------------------------------------------------------
-- app_court_reservation_rules: READ — aktivní členové organizace
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "rules_select_org_member" ON public.app_court_reservation_rules;
CREATE POLICY "rules_select_org_member" ON public.app_court_reservation_rules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.app_courts c
      JOIN public.app_organization_members m ON m.organization_id = c.organization_id
      WHERE c.id = app_court_reservation_rules.court_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
    )
  );

-- app_court_reservation_rules: WRITE — admin / manager
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
-- app_court_reservations: READ — všichni aktivní členové (jméno v gridu)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "reservations_select_org_member" ON public.app_court_reservations;
CREATE POLICY "reservations_select_org_member" ON public.app_court_reservations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_organization_members
      WHERE organization_id = app_court_reservations.organization_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

-- app_court_reservations: INSERT — člen rezervuje sám za sebe
DROP POLICY IF EXISTS "reservations_insert_org_member" ON public.app_court_reservations;
CREATE POLICY "reservations_insert_org_member" ON public.app_court_reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.app_organization_members
      WHERE organization_id = app_court_reservations.organization_id
        AND user_id = auth.uid()
        AND is_active = true
    )
  );

-- app_court_reservations: UPDATE — vlastní rezervace nebo admin/manager
DROP POLICY IF EXISTS "reservations_update" ON public.app_court_reservations;
CREATE POLICY "reservations_update" ON public.app_court_reservations
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_admin_or_manager(organization_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_org_admin_or_manager(organization_id)
  );

-- app_court_reservations: DELETE — pouze admin/manager (ostatní mají cancel)
DROP POLICY IF EXISTS "reservations_delete_admin" ON public.app_court_reservations;
CREATE POLICY "reservations_delete_admin" ON public.app_court_reservations
  FOR DELETE TO authenticated
  USING (public.is_org_admin_or_manager(organization_id));
