-- =============================================================================
-- 20_app_organizations.sql
-- Multi-tenant základ pro SportKalendář platformu
-- Tabulky: app_organizations, app_organization_members, app_cross_domain_tokens
-- ALTER: user_profiles (nové sloupce)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. app_organizations — Organizace / oddíly / kluby
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,                       -- 'TK Dobřany'
  slug            TEXT UNIQUE NOT NULL,                -- 'tenis-dobrany' → subdoména
  sport_types     TEXT[] DEFAULT '{}',                 -- '{tenis,hokej}'
  active_modules  TEXT[] DEFAULT '{reservations}',     -- '{cms,reservations,teams}'
  custom_domain   TEXT,                                -- 'tenis-dobrany.cz' (prémiová funkce)
  settings        JSONB DEFAULT '{}',                  -- flexibilní konfigurace
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_organizations_slug ON public.app_organizations (slug)
  WHERE is_active = true;
CREATE INDEX idx_app_organizations_custom_domain ON public.app_organizations (custom_domain)
  WHERE custom_domain IS NOT NULL AND is_active = true;

CREATE TRIGGER app_organizations_updated_at BEFORE UPDATE ON public.app_organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 2. app_organization_members — Vazba uživatel ↔ organizace + role
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.app_organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'player'
                  CHECK (role IN ('admin', 'manager', 'player')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_app_org_members_user ON public.app_organization_members (user_id)
  WHERE is_active = true;
CREATE INDEX idx_app_org_members_org ON public.app_organization_members (organization_id, role)
  WHERE is_active = true;

CREATE TRIGGER app_org_members_updated_at BEFORE UPDATE ON public.app_organization_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 3. app_cross_domain_tokens — Jednorázové tokeny pro SSO mezi doménami
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_cross_domain_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  target_domain   TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 seconds'),
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cross_domain_token ON public.app_cross_domain_tokens (token)
  WHERE used_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. ALTER user_profiles — rozšíření pro SportKalendář
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS default_organization_id UUID REFERENCES public.app_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'local'
    CHECK (account_type IN ('gmail', 'local')),
  ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_google_auth BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT false;

-- ---------------------------------------------------------------------------
-- 5. RLS politiky
-- ---------------------------------------------------------------------------

-- app_organizations: čtení pro přihlášené, CRUD jen superadmin (service_role)
ALTER TABLE public.app_organizations ENABLE ROW LEVEL SECURITY;

-- Kdokoli přihlášený vidí aktivní organizace (pro výběr při registraci apod.)
CREATE POLICY "organizations: read active for authenticated"
  ON public.app_organizations FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Správa organizace: jen admin dané organizace
CREATE POLICY "organizations: update for org admin"
  ON public.app_organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_organization_members m
      WHERE m.organization_id = id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
        AND m.is_active = true
    )
  );

-- INSERT organizace: přes service_role nebo přes server action (budoucí self-service)
-- Zatím jen service_role (seed data, admin panel)

-- app_organization_members: čtení pro členy organizace, správa pro admin
ALTER TABLE public.app_organization_members ENABLE ROW LEVEL SECURITY;

-- Člen vidí ostatní členy své organizace
CREATE POLICY "org_members: read for org members"
  ON public.app_organization_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_organization_members my
      WHERE my.organization_id = app_organization_members.organization_id
        AND my.user_id = auth.uid()
        AND my.is_active = true
    )
  );

-- Uživatel vidí vlastní členství (i v organizacích kde ještě nemá přístup k členům)
CREATE POLICY "org_members: read own"
  ON public.app_organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin organizace spravuje členy
CREATE POLICY "org_members: manage for org admin"
  ON public.app_organization_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_organization_members admin_check
      WHERE admin_check.organization_id = app_organization_members.organization_id
        AND admin_check.user_id = auth.uid()
        AND admin_check.role = 'admin'
        AND admin_check.is_active = true
    )
  );

-- app_cross_domain_tokens: jen service_role (server-side operace)
ALTER TABLE public.app_cross_domain_tokens ENABLE ROW LEVEL SECURITY;
-- Žádné politiky pro authenticated — tokeny se generují a ověřují
-- výhradně přes service_role (admin client) na serveru.

-- ---------------------------------------------------------------------------
-- 6. Helper funkce pro multi-tenant
-- ---------------------------------------------------------------------------

-- Zjistí roli uživatele v organizaci (nebo NULL pokud není člen)
CREATE OR REPLACE FUNCTION public.get_user_org_role(org_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.app_organization_members
  WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Zjistí zda je uživatel admin nebo manager organizace
CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'manager')
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Zjistí zda je uživatel admin organizace
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
