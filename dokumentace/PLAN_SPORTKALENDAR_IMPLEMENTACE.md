# Plán rozšíření tenis-dobrany → SportKalendář platforma

## Kompletní implementační postup pro AI agenta (Claude Sonnet)

> **Datum:** 2026-03-29
> **Podklad:** MIGRATION_SUPABASE_VERCEL.md (popis SportKalendáře), Rozsiření_aplikace_o_sportkalendar.md (cílová architektura), ARCHITECTURE.md + STATUS.md (aktuální stav CMS)

---

## 0. Výchozí stav a kontext

### Co už existuje a funguje
- **Next.js 16 + Supabase** CMS pro TK Dobřany na `tenis-dobrany.sportkalendar.cz`
- **Fáze 1–3 dokončeny**: auth (Google OAuth + email/heslo), veřejný web, admin CMS
- **12 CMS tabulek** v Supabase: `sections`, `pages`, `page_components`, `page_gallery`, `page_documents`, `page_comments`, `footer_content`, `article_contributors`, `user_profiles`, `media`, `documents`, `site_settings`
- **RLS politiky** s rolemi `member`, `manager`, `admin`
- **Stack**: Next.js 16.1.6, React 19, TipTap editor, Tailwind CSS 4, shadcn/ui, nodemailer
- **Fáze 4–6 rozpracovány** (členská sekce, migrace dat, rezervační systém)

### Co je SportKalendář (stávající PHP aplikace)
- PHP 8.1 / CodeIgniter 4 + MySQL + Vanilla JS + Bootstrap 5
- Správa týmů, sportovních událostí, registrace hráčů, platby přes FIO API, chat, push notifikace, PWA
- 20+ MySQL tabulek (users, teams, team_players, events, event_registrations, payments, notifications, chat, surveys...)
- Běží na produkci na starém serveru — zůstane v provozu paralelně

### Cíl
Vytvořit **jednu platformu** `sportkalendar.cz` (vývojově `app.sportkalendar.cz`) která spojuje:
1. **Rezervační systém kurtů** (PRIORITA — potřeba teď)
2. **CMS a web oddílu** (stávající kód — zachovat beze změny, stane se volitelným modulem)
3. **Správa týmů a událostí** (převod SportKalendáře — až jako třetí)

### Klíčová architektonická rozhodnutí
- **Jeden Supabase projekt**, jedna Next.js aplikace na Vercelu
- **Multi-tenant wildcard subdomény**: `*.sportkalendar.cz` → rozpoznání organizace v middleware
- **Sdílená auth** napříč subdoménami — jedno přihlášení, uživatel přechází z webu do app
- **Prefix `app_`** pro nové tabulky (sportkalendar + rezervace) — stávající CMS tabulky BEZ prefixu
- **`user_profiles`** zůstává **jediná** profilová tabulka, rozšíří se o `organization_id` a další atributy
- **Oddílový web** (tenis-dobrany.cz) = volitelný modul, hlavní službou je sportkalendar

---

## 1. FÁZE: Multi-tenant základ a sdílená auth

### 1.1 Tabulka `app_organizations`

**Priorita: VYSOKÁ — vše ostatní na ní závisí**

```sql
CREATE TABLE public.app_organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,                       -- 'TK Dobřany'
  slug            TEXT UNIQUE NOT NULL,                -- 'tenis-dobrany' → subdoména
  sport_types     TEXT[] DEFAULT '{}',                 -- {'tenis','hokej'}
  active_modules  TEXT[] DEFAULT '{reservations}',     -- {'cms','reservations','teams'}
  custom_domain   TEXT,                                -- 'tenis-dobrany.cz' (prémiová funkce)
  settings        JSONB DEFAULT '{}',                  -- flexibilní konfigurace
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER app_organizations_updated_at BEFORE UPDATE ON public.app_organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### 1.2 Tabulka `app_organization_members` (vazba uživatel ↔ organizace)

```sql
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

CREATE TRIGGER app_org_members_updated_at BEFORE UPDATE ON public.app_organization_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### 1.3 Rozšíření `user_profiles`

Stávající tabulku **neměnit**, pouze přidat sloupce:

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS default_organization_id UUID REFERENCES public.app_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'local' CHECK (account_type IN ('gmail', 'local')),
  ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_google_auth BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT FALSE;
```

> **POZOR**: Sloupec `role` v `user_profiles` zůstává pro **CMS role** (member/manager/admin webového CMS). Role v **organizaci** (admin/manager/player) je v `app_organization_members`. Jeden uživatel může být admin CMS a zároveň player v jiné organizaci.

### 1.4 Middleware — rozpoznání organizace

Rozšířit stávající `middleware.ts`:

```typescript
// Logika:
// 1. Z hostname extrahovat slug: "tenis-dobrany.sportkalendar.cz" → "tenis-dobrany"
// 2. Speciální hostname "app.sportkalendar.cz" → hlavní aplikace (sportkalendar dashboard)
// 3. Custom doména → lookup v app_organizations.custom_domain
// 4. Uložit organization info do request headers pro server components
// 5. Stávající CMS middleware logika zůstává pro subdomény s modulem 'cms'
```

Konkrétní kroky:
1. Přidat do middleware detekci hostname
2. Pro `app.sportkalendar.cz` nastavit kontext hlavní aplikace
3. Pro `*.sportkalendar.cz` nastavit `x-organization-slug` header
4. Pro custom domény lookup v DB
5. Předat organizaci do server components přes `headers()` nebo cookie

### 1.5 Sdílená auth — 3 scénáře

**Klíčové pro UX: přihlášení na webu = přihlášení v app, i napříč doménami.**

Prohlížeče **neumožňují sdílet cookies napříč různými doménami** (tenis-dobrany.cz vs sportkalendar.cz). Proto je potřeba řešit 3 scénáře:

#### Scénář A: Vše na `*.sportkalendar.cz` (nejjednodušší)
- `tenis-dobrany.sportkalendar.cz` → CMS web
- `app.sportkalendar.cz` → rezervace/týmy
- **Řešení**: Cookie na doménu `.sportkalendar.cz` → SSO funguje automaticky

```typescript
cookieOptions: {
  domain: '.sportkalendar.cz',
  path: '/',
  sameSite: 'lax',
  secure: true,
}
```

#### Scénář B: Vlastní doména + sportkalendar.cz (případ TK Dobřany)
- `tenis-dobrany.cz` → CMS web oddílu (CNAME na Vercel)
- `sportkalendar.cz` (nebo `app.sportkalendar.cz`) → rezervace/týmy
- **Problém**: Cookie z `tenis-dobrany.cz` není viditelná na `sportkalendar.cz` a naopak
- **Řešení**: **Token-based cross-domain SSO** (viz 1.5.1)

#### Scénář C: Vše na vlastní doméně (prémiová varianta)
- `tenis-dobrany.cz` → CMS web
- `app.tenis-dobrany.cz` nebo `tenis-dobrany.cz/rezervace` → rezervace
- **Řešení**: Cookie na `.tenis-dobrany.cz` → SSO funguje automaticky (jako scénář A)

#### 1.5.1 Cross-domain SSO (pro scénář B)

Když uživatel přechází mezi různými doménami (tenis-dobrany.cz ↔ sportkalendar.cz), použijeme **token redirect flow** — podobný princip jako OAuth, ale jednodušší (je to stejný Supabase projekt):

```
1. Uživatel je přihlášen na tenis-dobrany.cz
2. Klikne na "Rezervace kurtů" → odkaz vede na:
   tenis-dobrany.cz/auth/cross-domain?target=https://app.sportkalendar.cz/rezervace
3. Server na tenis-dobrany.cz:
   a) Ověří session uživatele
   b) Vygeneruje jednorázový krátkodobý token (JWT, 30s platnost)
   c) Uloží token do DB (tabulka app_cross_domain_tokens)
   d) Redirect → https://app.sportkalendar.cz/auth/cross-domain?token=XXX&redirect=/rezervace
4. Server na sportkalendar.cz:
   a) Přijme token, ověří v DB (jednorázový, neprošlý)
   b) Smaže token z DB (one-time use)
   c) Vytvoří Supabase session (supabase.auth.admin.generateLink nebo custom session)
   d) Nastaví cookie pro sportkalendar.cz
   e) Redirect → /rezervace
5. Uživatel je přihlášen na obou doménách
```

**Implementace:**

```sql
-- Tabulka pro cross-domain tokeny
CREATE TABLE public.app_cross_domain_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  target_domain   TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 seconds'),
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-cleanup starých tokenů (pg_cron nebo Vercel cron)
-- DELETE FROM app_cross_domain_tokens WHERE expires_at < now() - interval '5 minutes';
```

```typescript
// app/auth/cross-domain/route.ts — GENEROVÁNÍ tokenu (zdrojová doména)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target');
  
  // 1. Ověřit přihlášení
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');
  
  // 2. Validovat target URL (whitelist povolených domén)
  if (!isAllowedDomain(target)) return Response.json({ error: 'Invalid target' }, { status: 400 });
  
  // 3. Vytvořit jednorázový token
  const token = crypto.randomUUID();
  const adminSupabase = createAdminClient(); // service_role
  await adminSupabase.from('app_cross_domain_tokens').insert({
    user_id: user.id,
    token,
    target_domain: new URL(target).hostname,
  });
  
  // 4. Redirect na cílovou doménu
  const targetUrl = new URL(target);
  targetUrl.pathname = '/auth/cross-domain';
  targetUrl.searchParams.set('token', token);
  targetUrl.searchParams.set('redirect', new URL(target).pathname);
  return redirect(targetUrl.toString());
}

// app/auth/cross-domain/route.ts — PŘIJETÍ tokenu (cílová doména)
// (rozlišení generování vs přijetí podle přítomnosti ?token= parametru)
```

```typescript
// lib/auth-helpers.ts
const ALLOWED_DOMAINS = [
  'sportkalendar.cz',
  'app.sportkalendar.cz',
  // Dynamicky: všechny custom_domain z app_organizations
];

function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    // Kontrola: je to subdoména sportkalendar.cz NEBO registrovaná custom domain?
    return hostname.endsWith('.sportkalendar.cz')
      || hostname === 'sportkalendar.cz'
      || ALLOWED_DOMAINS.includes(hostname);
      // V produkci: lookup v app_organizations.custom_domain
  } catch { return false; }
}
```

#### 1.5.2 Konfigurace cookie domény (dynamická)

Cookie doména se nastaví **podle hostname requestu**, ne napevno:

```typescript
// lib/supabase/cookie-domain.ts
export function getCookieDomain(hostname: string): string | undefined {
  // *.sportkalendar.cz → '.sportkalendar.cz'
  if (hostname.endsWith('.sportkalendar.cz') || hostname === 'sportkalendar.cz') {
    return '.sportkalendar.cz';
  }
  // *.tenis-dobrany.cz → '.tenis-dobrany.cz' (pokud má subdomény)
  // tenis-dobrany.cz → undefined (cookie jen pro tuto doménu)
  // Vlastní doména s app subdoménou: app.tenis-dobrany.cz → '.tenis-dobrany.cz'
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return '.' + parts.slice(-2).join('.');
  }
  // Bez subdomény nebo localhost → výchozí chování (bez domain atributu)
  return undefined;
}
```

#### 1.5.3 UX při přechodu mezi doménami

Pro uživatele je přechod **transparentní** — klikne na odkaz a je přihlášen. Technicky:
- **Proklik z webu do app**: Tlačítko "Rezervace kurtů" na webu tenis-dobrany.cz interně vede přes `/auth/cross-domain?target=...` (ne přímo na sportkalendar.cz)
- **Proklik z app na web**: Odkaz na oddílový web v navigaci sportkalendáře jde přes stejný mechanismus
- **Už přihlášený na cíli**: Pokud má uživatel platnou session i na cílové doméně, cross-domain route rovnou redirect (bez generování tokenu)
- **Nepřihlášený**: Pokud uživatel není přihlášen nikde, přesměrování na login cílové domény

#### 1.5.4 Bezpečnost cross-domain SSO
- Token je **jednorázový** (smazán po použití)
- Token má **30s platnost** (expirace)
- Target URL je **whitelistovaný** (pouze povolené domény z DB)
- Token je **UUID** (kryptograficky náhodný, nehádatelný)
- Žádné citlivé údaje v URL (jen token reference, ne session data)

> **Lokální vývoj**: Na localhostu cross-domain SSO není potřeba — vše běží na `localhost:3000`. Pro multi-subdomain testing použít entries v hosts file (`127.0.0.1 app.local.test`, `127.0.0.1 tenis.local.test`).

### 1.6 Seed data — první organizace

```sql
INSERT INTO public.app_organizations (name, slug, sport_types, active_modules, custom_domain)
VALUES ('TK Dobřany', 'tenis-dobrany', '{tenis}', '{cms,reservations}', 'tenis-dobrany.cz');

-- Napojit stávajícího admina
INSERT INTO public.app_organization_members (organization_id, user_id, role)
SELECT o.id, up.id, 'admin'
FROM app_organizations o, user_profiles up
WHERE o.slug = 'tenis-dobrany' AND up.role = 'admin'
LIMIT 1;
```

### 1.7 Výstup fáze 1
- [ ] SQL migrace: `app_organizations`, `app_organization_members`, ALTER `user_profiles`
- [ ] RLS politiky pro nové tabulky
- [ ] Middleware rozšířen o hostname/organizace detekci
- [ ] Cookie doména nastavena na `.sportkalendar.cz`
- [ ] Seed data pro TK Dobřany
- [ ] Stávající CMS nadále funkční beze změn

---

## 2. FÁZE: Rezervační systém (PRIORITA)

### 2.1 Databázové tabulky

```sql
-- Kurty / hřiště
CREATE TABLE public.app_courts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.app_organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                       -- 'Kurt 1', 'Kurt 2'
  description     TEXT,
  surface_type    TEXT,                                -- 'antuka', 'tvrdý', 'tráva'
  sport_type      TEXT NOT NULL DEFAULT 'tenis',       -- 'tenis', 'squash', 'badminton'
  is_active       BOOLEAN NOT NULL DEFAULT true,
  display_order   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courts_org ON public.app_courts (organization_id, display_order)
  WHERE is_active = true;

-- Pravidla rezervací per organizace
CREATE TABLE public.app_court_reservation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID UNIQUE NOT NULL REFERENCES public.app_organizations(id) ON DELETE CASCADE,
  slot_duration_minutes   INT NOT NULL DEFAULT 60,     -- 30 nebo 60
  max_active_reservations INT DEFAULT 3,               -- max aktivních na hráče
  max_per_day             INT DEFAULT 1,               -- max na hráče za den
  max_per_week            INT DEFAULT 5,               -- max na hráče za týden
  max_days_in_advance     INT DEFAULT 14,              -- kolik dní dopředu
  min_cancel_hours        INT DEFAULT 2,               -- min hodin pro zrušení
  members_only            BOOLEAN DEFAULT true,        -- jen členové oddílu
  opening_hour            INT DEFAULT 7,               -- provozní hodiny od
  closing_hour            INT DEFAULT 21,              -- provozní hodiny do
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rezervace
CREATE TABLE public.app_court_reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id        UUID NOT NULL REFERENCES public.app_courts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.app_organizations(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  co_players      UUID[] DEFAULT '{}',                 -- pole spoluhráčů (pro notifikace)
  date            DATE NOT NULL,
  time_from       TIME NOT NULL,
  time_to         TIME NOT NULL,
  status          TEXT NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'cancelled', 'pending_payment')),
  note            TEXT,
  cancelled_at    TIMESTAMPTZ,
  cancelled_by    UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_court_date ON public.app_court_reservations (court_id, date, time_from)
  WHERE status = 'confirmed';
CREATE INDEX idx_reservations_player ON public.app_court_reservations (player_id, date)
  WHERE status = 'confirmed';
CREATE INDEX idx_reservations_org_date ON public.app_court_reservations (organization_id, date)
  WHERE status = 'confirmed';
```

### 2.2 RLS politiky pro rezervační systém

```sql
-- app_courts: čtení pro členy organizace, CRUD pro admin/manager organizace
ALTER TABLE public.app_courts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courts: read for org members" ON public.app_courts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM app_organization_members m
            WHERE m.organization_id = app_courts.organization_id
            AND m.user_id = auth.uid() AND m.is_active = true)
  );

CREATE POLICY "courts: manage for org admin/manager" ON public.app_courts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM app_organization_members m
            WHERE m.organization_id = app_courts.organization_id
            AND m.user_id = auth.uid() AND m.role IN ('admin', 'manager') AND m.is_active = true)
  );

-- app_court_reservations: čtení pro členy organizace, CRUD podléhá pravidlům
ALTER TABLE public.app_court_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations: read for org members" ON public.app_court_reservations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM app_organization_members m
            WHERE m.organization_id = app_court_reservations.organization_id
            AND m.user_id = auth.uid() AND m.is_active = true)
  );

CREATE POLICY "reservations: insert own" ON public.app_court_reservations
  FOR INSERT WITH CHECK (
    player_id = auth.uid()
    AND EXISTS (SELECT 1 FROM app_organization_members m
                WHERE m.organization_id = app_court_reservations.organization_id
                AND m.user_id = auth.uid() AND m.is_active = true)
  );

CREATE POLICY "reservations: update own or manager" ON public.app_court_reservations
  FOR UPDATE USING (
    player_id = auth.uid()
    OR EXISTS (SELECT 1 FROM app_organization_members m
               WHERE m.organization_id = app_court_reservations.organization_id
               AND m.user_id = auth.uid() AND m.role IN ('admin', 'manager') AND m.is_active = true)
  );

-- app_court_reservation_rules: čtení pro členy, CRUD pro admin
ALTER TABLE public.app_court_reservation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rules: read for org members" ON public.app_court_reservation_rules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM app_organization_members m
            WHERE m.organization_id = app_court_reservation_rules.organization_id
            AND m.user_id = auth.uid() AND m.is_active = true)
  );

CREATE POLICY "rules: manage for org admin" ON public.app_court_reservation_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM app_organization_members m
            WHERE m.organization_id = app_court_reservation_rules.organization_id
            AND m.user_id = auth.uid() AND m.role = 'admin' AND m.is_active = true)
  );
```

### 2.3 Validační funkce na straně DB (volitelné, ale doporučené)

```sql
-- Kontrola kolize rezervací
CREATE OR REPLACE FUNCTION public.check_reservation_conflict()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.app_court_reservations
    WHERE court_id = NEW.court_id
      AND date = NEW.date
      AND status = 'confirmed'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND time_from < NEW.time_to
      AND time_to > NEW.time_from
  ) THEN
    RAISE EXCEPTION 'Časový slot je již obsazený';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_reservation_conflict
  BEFORE INSERT OR UPDATE ON public.app_court_reservations
  FOR EACH ROW EXECUTE FUNCTION public.check_reservation_conflict();
```

### 2.4 Adresářová struktura — Frontend

```
app/
  (sportkalendar)/                    -- route group pro sportkalendar modul
    layout.tsx                        -- layout s navigací sportkalendáře
    dashboard/
      page.tsx                        -- osobní dashboard (nadcházející rezervace + události)
    rezervace/
      page.tsx                        -- dashboard obsazenosti (tabulka: sloty × kurty)
      [courtId]/
        page.tsx                      -- týdenní přehled jednoho kurtu
    moje-rezervace/
      page.tsx                        -- přehled vlastních rezervací
    profil/
      page.tsx                        -- rozšířený profil (ze sportkalendáře)
    nastaveni/
      page.tsx                        -- nastavení (push, heslo, apod.)
    admin/
      layout.tsx                      -- admin layout sportkalendáře
      kurty/
        page.tsx                      -- správa kurtů
      pravidla/
        page.tsx                      -- pravidla rezervací
      uzivatele/
        page.tsx                      -- správa členů organizace
```

### 2.5 Klíčové komponenty

```
components/
  sportkalendar/
    ReservationGrid.tsx              -- hlavní grid: řádky=sloty, sloupce=kurty, buňky=iniciály/volné
    ReservationDialog.tsx            -- dialog pro vytvoření rezervace (datum, kurt, čas, spoluhráči)
    CourtWeekView.tsx                -- týdenní přehled jednoho kurtu
    MyReservationsList.tsx           -- seznam vlastních nadcházejících rezervací
    CourtCard.tsx                    -- karta kurtu (pro správu)
    RulesForm.tsx                    -- formulář pravidel rezervací
    OrgSwitcher.tsx                  -- přepínač organizace (pokud uživatel ve více)
    SportkalenNavbar.tsx             -- navigace sportkalendáře
```

### 2.6 Server Actions — obchodní logika rezervací

```typescript
// app/(sportkalendar)/rezervace/actions.ts

'use server'

// createReservation(formData):
//   1. Ověřit auth + membership v organizaci
//   2. Načíst pravidla organizace (app_court_reservation_rules)
//   3. Validace:
//      a) Kurt existuje a je aktivní
//      b) Datum je v rozmezí (dnes .. dnes + max_days_in_advance)
//      c) Časový slot je v provozních hodinách
//      d) Slot odpovídá slot_duration_minutes
//      e) Neexistuje kolize (jiná confirmed rezervace na stejném kurtu/čase)
//      f) Hráč nepřekročil max_active_reservations
//      g) Hráč nepřekročil max_per_day pro daný den
//      h) Hráč nepřekročil max_per_week pro daný týden
//   4. INSERT do app_court_reservations
//   5. Odeslat notifikaci hráči + spoluhráčům (email + push)
//   6. Revalidate stránky

// cancelReservation(reservationId):
//   1. Ověřit auth + je vlastník NEBO manager organizace
//   2. Pokud vlastník: ověřit min_cancel_hours pravidlo
//   3. UPDATE status = 'cancelled', cancelled_at, cancelled_by
//   4. Notifikace všem účastníkům
//   5. Revalidate

// getAvailableSlots(courtId, date):
//   1. Načíst pravidla (opening_hour, closing_hour, slot_duration)
//   2. Vygenerovat všechny časové sloty pro den
//   3. Načíst confirmed rezervace pro daný kurt a den
//   4. Vrátit sloty s údajem volné/obsazené (+ iniciály hráče)
```

### 2.7 Notifikace pro rezervace

Využít sdílenou infrastrukturu:
- **Ihned po vytvoření**: email + push hlavnímu hráči i spoluhráčům
- **Připomínka** (konfigurovatelná, default 60 min před): Vercel Cron / pg_cron
- **Při zrušení**: email + push všem účastníkům

Notifikační tabulka:
```sql
-- Použít buď stávající jednoduchou logiku nebo app_notifications (viz fáze 4)
-- Pro fázi 2 stačí jednoduchý email přes nodemailer + volitelně push
```

### 2.8 Výstup fáze 2
- [ ] SQL migrace: `app_courts`, `app_court_reservation_rules`, `app_court_reservations`
- [ ] RLS politiky + trigger na kolize
- [ ] Server Actions: createReservation, cancelReservation, getAvailableSlots
- [ ] Dashboard obsazenosti (ReservationGrid)
- [ ] Dialog vytvoření rezervace
- [ ] Týdenní přehled kurtu
- [ ] Moje rezervace
- [ ] Admin: správa kurtů + pravidel
- [ ] Notifikace (email minimálně)
- [ ] Seed data: 3 kurty pro TK Dobřany + pravidla

---

## 3. FÁZE: CMS integrace do multi-tenant

### 3.1 Co se mění

Stávající CMS kód **zůstává funkční**. Změny jsou minimální:

1. **Napojení na `app_organizations`**: CMS tabulky nepotřebují `organization_id` — CMS běží jen na subdoméně organizace, middleware zajistí kontext
2. **Sdílená auth**: Uživatel přihlášený v CMS může prokliknout do sportkalendáře bez nového přihlášení (cookie na `.sportkalendar.cz`)
3. **Navigace**: Na webu oddílu přidat odkaz/tlačítko „Rezervace kurtů" → přesměrování na `app.sportkalendar.cz/rezervace?org=tenis-dobrany` nebo `tenis-dobrany.sportkalendar.cz/rezervace`
4. **Profil uživatele**: V členské sekci zobrazit rozšířené atributy (nadcházející rezervace, týmy, události) pokud je modul aktivní

### 3.2 Rozhodnutí o routingu

**3 varianty — organizace si vybere v nastavení:**

**Varianta A** (výchozí): Subdomény sportkalendar.cz
- `tenis-dobrany.sportkalendar.cz` → CMS web oddílu
- `app.sportkalendar.cz` → rezervace/týmy (přepínač organizace)
- SSO: cookie na `.sportkalendar.cz` — automatické

**Varianta B** (případ TK Dobřany): Vlastní doména pro web + sportkalendar pro app
- `tenis-dobrany.cz` → CMS web oddílu (CNAME na Vercel)
- `app.sportkalendar.cz` → rezervace/týmy
- SSO: cross-domain token redirect (viz 1.5.1)
- Proklik z webu na rezervace: tlačítko "Rezervace" → `/auth/cross-domain?target=https://app.sportkalendar.cz/...`

**Varianta C** (prémiová): Vše na vlastní doméně
- `tenis-dobrany.cz` → CMS web oddílu
- `app.tenis-dobrany.cz` → rezervace/týmy
- SSO: cookie na `.tenis-dobrany.cz` — automatické (jako varianta A)
- Nebo: `tenis-dobrany.cz/rezervace` → rezervace (path-based, bez subdomény)

Middleware rozhoduje podle hostname:
- `app.sportkalendar.cz` → sportkalendar layout
- `*.sportkalendar.cz` (jiné) → CMS layout pro daný slug
- Custom doména → lookup v `app_organizations.custom_domain` → CMS layout
- Custom subdoména (`app.*`) → lookup v `app_organizations` → sportkalendar layout

> **Doporučení**: Implementovat nejprve variantu A + B (pokrývá případ TK Dobřany). Varianta C je snadné rozšíření — stačí přidat wildcard DNS na vlastní doméně a middleware logiku.

### 3.3 Výstup fáze 3
- [ ] Middleware routing pro CMS vs APP subdomény
- [ ] Odkaz z webu oddílu na rezervační systém
- [ ] Členská sekce CMS vidí rezervace uživatele (read-only)
- [ ] Modul CMS zůstává volitelný v `app_organizations.active_modules`

---

## 4. FÁZE: Správa týmů a událostí (převod SportKalendáře)

### 4.1 Databázové tabulky s prefixem `app_`

Převzít strukturu z MIGRATION_SUPABASE_VERCEL.md, přidat prefix `app_` a sloupec `organization_id`:

| Původní (ze sportkalendáře) | Nový název | Poznámka |
|---|---|---|
| `profiles` (sportkal.) | **`user_profiles`** (stávající) | Rozšířit, neduplicovat. Využít stávající tabulku. |
| `teams` | `app_teams` | + `organization_id`, BEZ `manager_id`/`assistant_manager_id` — manažeři přes `app_team_players.role` |
| `team_players` | `app_team_players` | + sloupec `role` ('manager'\|'player') — umožní N manažerů |
| `enum_team_jersey` | `app_enum_team_jersey` | |
| `events` | `app_events` | + `organization_id` |
| `event_registrations` | `app_event_registrations` | |
| `registration_history` | `app_registration_history` | |
| `payments` | `app_payments` | |
| `bank_transactions_originals` | `app_bank_transactions_originals` | |
| `bank_payments_rel` | `app_bank_payments_rel` | |
| `users_bank_accounts` | `app_users_bank_accounts` | |
| `fio_allocations` | `app_fio_allocations` | |
| `notifications` | `app_notifications` | Sdílené — i pro rezervace |
| `push_subscriptions` | `app_push_subscriptions` | Sdílené |
| `push_notification_log` | `app_push_notification_log` | |
| `event_chat` | `app_event_chat` | |
| `event_chat_reactions` | `app_event_chat_reactions` | |
| `chat_read_status` | `app_chat_read_status` | |
| `surveys` | `app_surveys` | |
| `survey_questions` | `app_survey_questions` | |
| `survey_options` | `app_survey_options` | |
| `survey_answers` | `app_survey_answers` | |
| `conf_attributes` | `app_conf_attributes` | |
| `audit_logs` | `app_audit_logs` | |
| `error_logs` | `app_error_logs` | |

### 4.2 Klíčový rozdíl: profilová tabulka

**NETVOŘIT novou `app_users` tabulku.** Existuje `user_profiles` z CMS, ta se rozšíří:

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS login TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- full_name zachovat pro zpětnou kompatibilitu CMS
-- first_name + last_name přidat pro sportkalendar (potřeba rozlišení)
-- Trigger: při UPDATE first_name/last_name → aktualizovat full_name
```

### 4.3 Priorita implementace v rámci fáze 4

1. `app_teams` + `app_team_players` — správa týmů a hráčů
2. `app_events` + `app_event_registrations` — události a registrace
3. `app_notifications` + `app_push_subscriptions` — notifikační systém (sdílený i s rezervacemi)
4. `app_event_chat` — chat k událostem (Supabase Realtime)
5. `app_payments` + FIO integrace — platby a bankovní párování
6. `app_surveys` — ankety
7. PWA + Service Worker

### 4.4 Frontend struktura

```
app/
  (sportkalendar)/
    tymy/
      page.tsx                      -- seznam týmů uživatele
      [id]/
        page.tsx                    -- detail týmu (hráči, události)
    udalosti/
      page.tsx                      -- seznam událostí
      [id]/
        page.tsx                    -- detail události (registrace, platby, chat)
    platby/
      page.tsx                      -- přehled plateb
    ankety/
      page.tsx                      -- ankety
```

### 4.5 API Routes (server-side logika)

```
app/api/
  sportkalendar/
    fio/
      sync/route.ts               -- FIO banka sync
    payments/
      match/route.ts              -- auto-match plateb
      qr/route.ts                 -- SPAYD QR generátor
    push/
      send/route.ts               -- push notifikace
    cron/
      reminders/route.ts          -- připomínky (Vercel Cron)
    import/
      route.ts                    -- import uživatelů (CSV, hromadný)
```

### 4.6 Business logika k přenesení

Z MIGRATION_SUPABASE_VERCEL.md převzít a implementovat:
- **lib/fio.ts** — FIO Bank API klient (fetch transakcí)
- **lib/payment-matching.ts** — Dvou-průchodový algoritmus párování plateb (KRITICKÉ — přesně dle specifikace)
- **lib/push.ts** — Web Push (VAPID, web-push npm)
- **lib/qr.ts** — SPAYD QR kódy pro české bankovnictví
- **lib/email.ts** — Rozšířit stávající nodemailer o šablony sportkalendáře
- **hooks/useRealtime.ts** — Supabase Realtime pro chat

### 4.7 Výstup fáze 4
- [ ] Všechny app_ tabulky vytvořeny v Supabase
- [ ] RLS politiky pro všechny tabulky (multi-tenant izolace přes organization_id)
- [ ] Správa týmů a hráčů (CRUD + pozvánky)
- [ ] Události a registrace (+ kapacitní management, waitlist)
- [ ] FIO integrace a platební modul
- [ ] Chat k událostem (Supabase Realtime)
- [ ] Push notifikace (VAPID)
- [ ] Ankety
- [ ] PWA manifest + Service Worker

---

## 5. FÁZE: Migrace dat ze starého SportKalendáře

### 5.1 Migrace dat z MySQL → Supabase

Pro migrace dat ze starého PHP SportKalendáře:

1. **Export z MySQL** do JSON/CSV (skript nebo MySQL Workbench)
2. **Transformace**: MySQL → PostgreSQL typy, přidání `organization_id`, prefix `app_`
3. **Import přes API Route** `/api/sportkalendar/import/route.ts` s SUPABASE_SERVICE_ROLE_KEY
4. **Uživatelé**: Speciální pozornost — propojit s existujícími Supabase Auth uživateli pokud email matchuje
5. **Hesla**: SHA256 → Supabase bcrypt — bude nutné vyzvat uživatele k resetování hesla, nelze převést

### 5.2 Paralelní provoz

Starý SportKalendář zůstává na produkci dokud nový nebude plně otestován. Migrace dat proběhne jednorázově s cut-over dnem.

### 5.3 Výstup fáze 5
- [ ] Import skript pro uživatele (email matching)
- [ ] Import týmů, hráčů, událostí, plateb
- [ ] Verifikace dat
- [ ] DNS přepnutí sportkalendar.cz → Vercel
- [ ] Odpojení starého serveru

---

## 6. FÁZE: Finalizace a produkce

### 6.1 DNS a domény

```
# Výchozí (varianta A — vše na sportkalendar.cz)
*.sportkalendar.cz           → Vercel (wildcard)
sportkalendar.cz             → Vercel (redirect na app.sportkalendar.cz)
app.sportkalendar.cz         → hlavní sportkalendar dashboard + rezervace
tenis-dobrany.sportkalendar.cz → CMS web oddílu

# Vlastní doména pro web (varianta B — TK Dobřany)
tenis-dobrany.cz             → CNAME na Vercel (přidat v Vercel Dashboard)
                              → middleware pozná custom_domain → CMS layout
                              → cross-domain SSO pro přechod na sportkalendar.cz

# Prémiová varianta C (vše na vlastní doméně)
tenis-dobrany.cz             → CMS web
app.tenis-dobrany.cz         → CNAME na Vercel → sportkalendar layout
                              → cookie na .tenis-dobrany.cz → SSO automatické
```

### 6.2 Vercel konfigurace

```json
// vercel.json
{
  "crons": [
    { "path": "/api/sportkalendar/cron/reminders", "schedule": "*/15 * * * *" }
  ]
}
```

### 6.3 Environment variables

```
# Stávající (zachovat)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Nové
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
RESEND_API_KEY=           # nebo SMTP credentials
CRON_SECRET=              # pro autorizaci cron endpointů
```

---

## 7. Souhrn klíčových principů

### Co NEMĚNIT
- Stávající CMS tabulky (bez prefixu) — fungují, zůstávají
- Stávající RLS politiky CMS — rozšířit, nerozbíjet
- Stávající admin panel — doplnit, nerefaktorovat
- `user_profiles` tabulka — rozšiřovat, neduplikovat

### Konvence pojmenování
- CMS tabulky: bez prefixu (`sections`, `pages`, `page_components`, ...)
- SportKalendář tabulky: prefix `app_` (`app_teams`, `app_events`, `app_courts`, ...)
- CMS role: `member`, `manager`, `admin` (v `user_profiles.role`)
- Organizační role: `admin`, `manager`, `player` (v `app_organization_members.role`)

### Architektura route groups
```
app/
  (auth)/          -- přihlášení, registrace, callback (stávající)
  (web)/           -- nebo root: veřejný web CMS oddílu (stávající)
  admin/           -- CMS admin (stávající)
  clenove/         -- členská sekce CMS (stávající)
  (sportkalendar)/ -- sportkalendar modul (NOVÝ)
    dashboard/
    rezervace/
    tymy/
    udalosti/
    platby/
    ankety/
    profil/
    admin/         -- admin sportkalendáře (správa kurtů, pravidel, organizace)
```

### Sdílené vs. oddělené
| Vrstva | Sdílené | Oddělené |
|--------|---------|----------|
| Supabase projekt | ✅ jeden | — |
| Auth (cookies) | ✅ `.sportkalendar.cz` | — |
| `user_profiles` | ✅ jedna tabulka | — |
| DB tabulky | — | CMS (bez prefixu) vs app_ (s prefixem) |
| Layout / navigace | — | CMS layout vs sportkalendar layout |
| Admin panel | — | CMS admin vs sportkalendar admin |
| Notifikace | ✅ `app_notifications` + `app_push_subscriptions` | — |

---

## 8. Doporučený postup pro Sonneta (krok za krokem)

### KROK 1 — Multi-tenant základ
1. Vytvoř SQL migraci `dokumentace/sql/20_app_organizations.sql` s tabulkami `app_organizations` a `app_organization_members`
2. Vytvoř SQL ALTER pro `user_profiles` (nové sloupce)
3. Vytvoř RLS politiky
4. Vytvoř seed data pro TK Dobřany
5. **ČEKEJ NA POTVRZENÍ** — uživatel spustí SQL v Supabase

### KROK 2 — Middleware rozšíření
1. Uprav `middleware.ts` — přidej hostname detekci a organization context
2. Vytvoř helper `lib/organization.ts` — funkce pro zjištění aktuální organizace z requestu
3. Uprav Supabase cookie konfiguraci pro `.sportkalendar.cz` doménu
4. Otestuj že stávající CMS stále funguje

### KROK 3 — Rezervační tabulky
1. Vytvoř SQL migraci `dokumentace/sql/21_app_courts_reservations.sql`
2. Všechny tabulky + RLS + trigger na kolize
3. Seed data: 3 kurty, pravidla pro TK Dobřany
4. **ČEKEJ NA POTVRZENÍ** — spustit v Supabase

### KROK 4 — Rezervační frontend
1. Vytvoř `app/(sportkalendar)/layout.tsx` s vlastní navigací
2. Implementuj `ReservationGrid` komponentu (hlavní view)
3. Implementuj `ReservationDialog` (vytvoření rezervace)
4. Server Actions: `createReservation`, `cancelReservation`, `getAvailableSlots`
5. Stránky: dashboard obsazenosti, moje rezervace
6. Admin: správa kurtů, pravidla

### KROK 5 — Notifikace pro rezervace
1. Email notifikace (nodemailer nebo Resend)
2. Volitelně push notifikace (web-push npm)
3. Cron endpoint pro připomínky

### KROK 6 — CMS integrace
1. Odkaz z webu oddílu na sportkalendar
2. V členské sekci zobrazit nadcházející rezervace
3. Routing middleware pro CMS vs APP

### KROK 7+ — Správa týmů (následující iterace)
Podle fáze 4 výše, po dokončení a otestování rezervačního systému.

---

## 9. Rozhodnuté otázky ✅

### 1. Layout sportkalendáře → **Tailwind/shadcn** ✅
Vizuálně může vypadat podobně jako stávající SportKalendář (Bootstrap 5), ale postaveno na Tailwind + shadcn/ui pro konzistenci se stávajícím CMS kódem. Tailwind je plně kompatibilní s PWA i s generováním APK (přes TWA/Bubblewrap). Výhody:
- Konzistence s existujícím kódem (CMS už Tailwind používá)
- Lepší mobilní responsivita (utility-first)
- shadcn/ui komponenty jsou přístupné a optimalizované pro touch
- PWA (next-pwa) i APK (TWA wrapper přes Bubblewrap) fungují bez problémů

### 2. Přihlašovací stránka → **Dedikovaný login s brandem SportKalendář** ✅
Půjde o **samostatnou přihlašovací stránku** s logem a vizuálem SportKalendáře, ale technicky využije stejný Supabase Auth backend. Konkrétně:
- Na `app.sportkalendar.cz/login` bude login stránka s logem SportKalendáře
- Na `tenis-dobrany.sportkalendar.cz/login` (CMS) zůstane stávající login s logem oddílu
- Obě stránky volají stejný Supabase Auth (sdílená cookie na `.sportkalendar.cz`)
- Po přihlášení na jedné stránce je uživatel automaticky přihlášený i na druhé
- Nový uživatel se registruje přes SportKalendář login → po registraci si vybere/vytvoří organizaci

### 3. Role → **Oddělené, tým může mít více manažerů** ✅
- **CMS role** (`user_profiles.role`): `member`, `manager`, `admin` — pro správu webu oddílu
- **Organizační role** (`app_organization_members.role`): `admin`, `manager`, `player` — pro sportkalendar
- **Týmová role**: ZMĚNA oproti starému SportKalendáři — místo pevného 1 manažer + 1 zástupce → **N manažerů** přes `app_team_players.role`

```sql
-- Upravit app_team_players: role místo pevného manager_id
ALTER TABLE public.app_team_players
  ADD COLUMN role TEXT NOT NULL DEFAULT 'player'
  CHECK (role IN ('manager', 'player'));

-- app_teams: ODEBRAT manager_id a assistant_manager_id
-- Místo toho: manažeři = hráči s role='manager' v app_team_players
```

Hierarchie práv:
- **Org admin**: plná správa organizace, kurtů, pravidel, členů
- **Org manager**: správa rezervací, přehled členů
- **Team manager** (1..N): správa konkrétního týmu, událostí, hráčů
- **Player**: rezervace kurtů, registrace na události

### 4. Real-time aktualizace → **Ano** ✅
Supabase Realtime subscription na `app_court_reservations` — když jeden hráč rezervuje slot, grid se ostatním aktualizuje okamžitě. Implementace:
```typescript
// hooks/useReservationRealtime.ts
supabase.channel('reservations')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'app_court_reservations',
    filter: `organization_id=eq.${orgId}`,
  }, (payload) => { /* refresh grid */ })
  .subscribe();
```

### 5. Mobilní zobrazení rezervačního gridu ✅

**Portrait (na výšku):**
- Jeden kurt najednou, swipe vlevo/vpravo pro přepínání
- Každý kurt má **specifickou barvu** (automatická škála jednoho odstínu nebo konfigurovatelné barvy) — záhlaví, border, nebo pozadí slotů
- Selector/tabs nahoře s barevnými indikátory pro rychlou orientaci
- Typicky 3–9 kurtů — swipe je pohodlný

**Landscape (na šířku):**
- Grid pohled: sloupce = kurty, řádky = časové sloty
- Pro 3–5 kurtů se vejde celý grid
- Pro 6+ kurtů horizontální scroll (nebo stále swipe skupin po 4–5)

**Desktop:**
- Plný grid všech kurtů najednou
- Klikatelné buňky pro rychlou rezervaci

**Barevné rozlišení kurtů:**
```typescript
// Automatická generace barev pro kurty
const COURT_COLORS = [
  'hsl(210, 70%, 50%)',  // modrá
  'hsl(150, 70%, 40%)',  // zelená
  'hsl(30, 90%, 50%)',   // oranžová
  'hsl(340, 70%, 50%)',  // růžová
  'hsl(270, 60%, 50%)',  // fialová
  'hsl(180, 60%, 40%)',  // teal
  'hsl(50, 80%, 45%)',   // žlutá
  'hsl(0, 70%, 50%)',    // červená
  'hsl(120, 50%, 40%)',  // tmavě zelená
];
// Nebo: organization settings s možností vlastních barev per kurt
```
