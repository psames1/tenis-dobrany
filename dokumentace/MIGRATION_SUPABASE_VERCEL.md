# Sport Kalendář — Kompletní migrační plán: CI4/PHP/MySQL → Supabase + Vercel (Next.js)

## Účel dokumentu

Tento dokument slouží jako **kompletní zadání pro AI agenta (Sonnet)**, aby krok za krokem přestavěl projekt Sport Kalendář z architektury CodeIgniter 4 + MySQL + Vanilla JS na architekturu **Next.js (App Router) + Supabase (PostgreSQL + Auth + Storage + Edge Functions) + Vercel**. Grafika i funkcionalita musí zůstat zachovány.

---

## OBSAH

1. [Přehled současné architektury](#1-přehled-současné-architektury)
2. [Cílová architektura](#2-cílová-architektura)
3. [Mapování technologií](#3-mapování-technologií)
4. [Databázové schéma (Supabase/PostgreSQL)](#4-databázové-schéma-supabasepostgresql)
5. [Autentizace a autorizace](#5-autentizace-a-autorizace)
6. [API Routes (Next.js)](#6-api-routes-nextjs)
7. [Frontend stránky](#7-frontend-stránky)
8. [Služby a business logika](#8-služby-a-business-logika)
9. [PWA, Push notifikace, Service Worker](#9-pwa-push-notifikace-service-worker)
10. [Krok za krokem — TODO checklist](#10-krok-za-krokem--todo-checklist)

---

## 1. Přehled současné architektury

### Tech stack
| Vrstva | Technologie |
|--------|-------------|
| Backend framework | PHP 8.1+ / CodeIgniter 4.4 |
| Databáze | MySQL 5.7+ (charset utf8mb4) |
| Frontend | Vanilla JS + Bootstrap 5.3.0 + Bootstrap Icons 1.11.0 |
| Autentizace | JWT (HS256) + Google OAuth 2.0 |
| Bankovní integrace | FIO Bank REST API |
| QR kódy | SPAYD formát (generované na backendu) |
| Push notifikace | Web Push API (VAPID, minishlink/web-push) |
| Email | SMTP (CodeIgniter Email) |
| PWA | Service Worker v1.7.0, manifest.json |
| Hosting | Laragon (lokální), Apache na produkci |

### Adresářová struktura (výtah)
```
app/
  Config/          — Routes.php, App.php, Database.php, Filters.php
  Controllers/     — 18 kontrolerů (viz níže)
  Models/          — 15 modelů
  Services/        — 7 služeb (JWT, Google, Email, FIO, QR, Push, DynamicData)
  Filters/         — AuthFilter.php (JWT validace)
  Helpers/         — payment_helper.php (fuzzy matching, normalizace účtů)
  Views/           — 2 šablony (CLI, HTML)
public/
  *.html           — 15+ HTML stránek (SPA-like, vanilla JS)
  assets/css/      — style.css (~600 řádků custom CSS)
  assets/js/       — app.js (TokenManager, UserManager, ApiClient, Auth, UI, AppManager)
  assets/icons/    — PWA ikony (128×128 až 384×384)
  components/      — navbar.html, layout.js, event-chat.js, push-notifications.js, event-chat.css
  service-worker.js
  manifest.json
```

---

## 2. Cílová architektura

### Tech stack
| Vrstva | Technologie | Free plán |
|--------|-------------|-----------|
| Frontend + SSR | Next.js 14+ (App Router) | Vercel Free |
| Backend API | Next.js API Routes + Supabase Edge Functions | Vercel Free + Supabase Free |
| Databáze | Supabase PostgreSQL | 500 MB, 2 projekty |
| Auth | Supabase Auth (email/password + Google OAuth) | 50 000 MAU |
| Úložiště | Supabase Storage (profilové obrázky, QR kódy) | 1 GB |
| Realtime | Supabase Realtime (chat, notifikace) | zahrnuto |
| Email | Resend / Supabase built-in (omezeně) | 100 emails/den Supabase |
| Push notifikace | Web Push API (VAPID) přes Next.js API Route | — |
| PWA | next-pwa nebo vlastní SW | — |
| Cron | Vercel Cron Jobs | 1×/den free, nebo Supabase pg_cron |
| Hosting | Vercel | Free tier |

### Adresářová struktura (cíl)
```
sportbook-next/
├── .env.local
├── next.config.js
├── package.json
├── public/
│   ├── icons/              — PWA ikony
│   ├── screenshots/
│   ├── manifest.json
│   ├── service-worker.js
│   └── offline.html
├── src/
│   ├── app/
│   │   ├── layout.tsx           — Root layout (Bootstrap CDN, metadata)
│   │   ├── page.tsx             — Redirect na /dashboard
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── teams/
│   │   │   ├── page.tsx         — Seznam týmů
│   │   │   └── [id]/page.tsx    — Detail týmu
│   │   ├── events/
│   │   │   ├── page.tsx         — Seznam událostí
│   │   │   └── [id]/page.tsx    — Detail události (registrace, platby, chat)
│   │   ├── payments/page.tsx
│   │   ├── surveys/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── accept-invitation/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── google/route.ts
│   │       │   └── callback/route.ts
│   │       ├── fio/
│   │       │   ├── sync/route.ts
│   │       │   └── unmatched/route.ts
│   │       ├── payments/
│   │       │   ├── match/route.ts
│   │       │   └── qr/route.ts
│   │       ├── push/route.ts
│   │       ├── email/route.ts
│   │       ├── cron/
│   │       │   └── reminders/route.ts
│   │       └── import/route.ts
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── EventChat.tsx
│   │   ├── PushNotifications.tsx
│   │   ├── PwaInstallBanner.tsx
│   │   ├── JerseySelector.tsx
│   │   ├── QrCode.tsx
│   │   └── PaymentCard.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        — Browser Supabase klient
│   │   │   ├── server.ts        — Server-side Supabase klient
│   │   │   └── middleware.ts    — Auth session middleware
│   │   ├── fio.ts               — FIO Bank API klient
│   │   ├── payment-matching.ts  — Algoritmus párování plateb
│   │   ├── qr.ts                — SPAYD QR generátor
│   │   ├── push.ts              — Web Push odesílání (web-push npm)
│   │   └── email.ts             — Email service (Resend)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTeams.ts
│   │   ├── useEvents.ts
│   │   └── useRealtime.ts
│   ├── types/
│   │   └── index.ts             — TypeScript typy pro všechny entity
│   └── styles/
│       ├── globals.css          — Přenesený style.css
│       └── event-chat.css
├── supabase/
│   ├── migrations/              — SQL migrace
│   ├── seed.sql                 — Seed data (conf_attributes atd.)
│   └── config.toml
└── middleware.ts                 — Supabase Auth middleware
```

---

## 3. Mapování technologií

| Původní (CI4/PHP) | Nové (Supabase/Vercel) |
|--------------------|------------------------|
| CodeIgniter 4 Router | Next.js App Router |
| CI4 Controllers | Next.js API Routes (`app/api/`) + Server Actions |
| CI4 Models (MySQLi) | Supabase Client (`@supabase/supabase-js`) + RLS policies |
| JWT (firebase/php-jwt) | Supabase Auth (session-based, automatický JWT) |
| Google OAuth (google/apiclient) | Supabase Auth Google Provider |
| AuthFilter.php | Next.js middleware.ts + Supabase `getUser()` |
| EmailService (SMTP) | Resend SDK / Supabase Auth Emails |
| PushNotificationService (minishlink/web-push) | `web-push` npm balík v API Route |
| FioApiService | `lib/fio.ts` (fetch v API Route) |
| QRCodeService (backend) | `lib/qr.ts` (klientská strana, qrcode npm) |
| MySQL | Supabase PostgreSQL |
| Apache .htaccess | Vercel automatický routing |
| Cron (systémový) | Vercel Cron Jobs (vercel.json) |
| Service Worker | next-pwa nebo manuální SW |
| Bootstrap 5 CDN | Bootstrap 5 CDN (zachovat) |
| Vanilla JS (app.js) | React komponenty (zachovat vizuální strukturu) |
| localStorage (TokenManager) | Supabase Auth session (automatické) |

---

## 4. Databázové schéma (Supabase/PostgreSQL)

### Konverze MySQL → PostgreSQL

Všechny tabulky přepsat do PostgreSQL syntaxe. Hlavní rozdíly:
- `AUTO_INCREMENT` → `GENERATED ALWAYS AS IDENTITY` nebo `SERIAL`
- `TINYINT(1)` → `BOOLEAN`
- `LONGBLOB` → `BYTEA` (nebo Supabase Storage pro QR kódy)
- `ENUM(...)` → PostgreSQL `CHECK` constraint nebo custom `TYPE`
- `CURRENT_TIMESTAMP` → `NOW()`
- `ON UPDATE CURRENT_TIMESTAMP` → trigger
- `JSON` → `JSONB`

### Tabulky (v pořadí vytvoření)

#### 4.1 `users`
```sql
-- Supabase Auth spravuje auth.users automaticky.
-- Tato tabulka je "profiles" — rozšíření auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  login VARCHAR(100) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20),
  picture_url TEXT,                   -- URL v Supabase Storage místo filename
  account_type VARCHAR(10) DEFAULT 'local' CHECK (account_type IN ('gmail', 'local')),
  has_password BOOLEAN DEFAULT FALSE,
  has_google_auth BOOLEAN DEFAULT FALSE,
  push_enabled BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  activation_token VARCHAR(255),
  activation_sent_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger pro updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-vytvoření profilu při registraci
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

#### 4.2 `teams`
```sql
CREATE TABLE public.teams (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sport VARCHAR(50) DEFAULT 'hokej',
  name VARCHAR(100) NOT NULL,
  description TEXT,
  manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assistant_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  bank_account_number VARCHAR(50),
  bank_variable_symbol VARCHAR(20),
  bank_payment_description TEXT,
  fio_api_token VARCHAR(100),
  is_temporary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### 4.3 `team_players`
```sql
CREATE TABLE public.team_players (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  jersey_preference_id BIGINT,      -- FK na enum_team_jersey
  bank_account_number VARCHAR(50),
  bank_account_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'invited')),
  invitation_token VARCHAR(255),
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, player_id)
);
```

#### 4.4 `enum_team_jersey`
```sql
CREATE TABLE public.enum_team_jersey (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Přidat FK na team_players
ALTER TABLE public.team_players
  ADD CONSTRAINT fk_jersey_preference
  FOREIGN KEY (jersey_preference_id) REFERENCES public.enum_team_jersey(id) ON DELETE SET NULL;
```

#### 4.5 `events`
```sql
CREATE TABLE public.events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ,
  max_participants INT,
  location VARCHAR(500),
  bank_account_number VARCHAR(50),
  bank_variable_symbol VARCHAR(20),
  bank_payment_description TEXT,
  amount_per_participant DECIMAL(10,2),
  qr_code_url TEXT,                     -- URL v Supabase Storage
  qr_code_generated_at TIMESTAMPTZ,
  reminder_offset_hours INT,
  reminder_sent_at TIMESTAMPTZ,
  is_active SMALLINT DEFAULT 1 CHECK (is_active IN (0, 1, 3)),
  -- 0=neaktivní, 1=aktivní, 3=zrušen
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_team_date ON public.events(team_id, start_datetime);
CREATE INDEX idx_events_reminder ON public.events(reminder_offset_hours, reminder_sent_at, start_datetime, is_active);
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### 4.6 `event_registrations`
```sql
CREATE TABLE public.event_registrations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'no_response'
    CHECK (status IN ('confirmed','going','pending','maybe','declined','not_going','no','waiting','no_response')),
  jersey_choice_id BIGINT REFERENCES public.enum_team_jersey(id) ON DELETE SET NULL,
  status_changed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, player_id)
);
CREATE INDEX idx_er_event_status ON public.event_registrations(event_id, status);
CREATE INDEX idx_er_player_status ON public.event_registrations(player_id, status);
```

#### 4.7 `registration_history`
```sql
CREATE TABLE public.registration_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.8 `payments`
```sql
CREATE TABLE public.payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fio_transaction_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10,2),
  variable_symbol VARCHAR(50),
  specific_symbol VARCHAR(50),
  transaction_date DATE,
  processed_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  payment_message TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payments_event_vs ON public.payments(event_id, variable_symbol);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_ss ON public.payments(specific_symbol);
```

#### 4.9 `users_bank_accounts`
```sql
CREATE TABLE public.users_bank_accounts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_account_number VARCHAR(50),
  bank_code VARCHAR(10),
  account_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_account_number, bank_code)
);
```

#### 4.10 `bank_transactions_originals`
```sql
CREATE TABLE public.bank_transactions_originals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bank_transaction_id VARCHAR(255) UNIQUE NOT NULL,
  account VARCHAR(100),
  bank_code VARCHAR(10),
  amount DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'CZK',
  transaction_date DATE,
  variable_symbol VARCHAR(50),
  specific_symbol VARCHAR(50),
  constant_symbol VARCHAR(50),
  payer_name VARCHAR(255),
  payer_account VARCHAR(100),
  message TEXT,
  comment TEXT,
  user_identification VARCHAR(255),
  team_id BIGINT REFERENCES public.teams(id) ON DELETE SET NULL,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bto_team ON public.bank_transactions_originals(team_id);
CREATE INDEX idx_bto_date ON public.bank_transactions_originals(transaction_date);
```

#### 4.11 `bank_payments_rel`
```sql
CREATE TABLE public.bank_payments_rel (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bank_transaction_id VARCHAR(255),
  payment_id BIGINT REFERENCES public.payments(id) ON DELETE SET NULL,
  event_id BIGINT REFERENCES public.events(id) ON DELETE SET NULL,
  player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id BIGINT REFERENCES public.teams(id) ON DELETE SET NULL,
  amount DECIMAL(10,2),
  assigned_by UUID,
  assigned_by_type VARCHAR(20) DEFAULT 'manual',
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  source VARCHAR(50),
  comment TEXT
);
CREATE INDEX idx_bpr_bank_tx ON public.bank_payments_rel(bank_transaction_id);
CREATE INDEX idx_bpr_payment ON public.bank_payments_rel(payment_id);
```

#### 4.12 `notifications`
```sql
CREATE TABLE public.notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  -- typy: team_invitation, event_reminder, payment_due, event_update, team_update, chat
  title VARCHAR(255),
  message TEXT,
  link VARCHAR(500),
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  team_id BIGINT,
  event_id BIGINT,
  chat_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX idx_notif_user_read ON public.notifications(user_id, is_read);
```

#### 4.13 `event_chat`
```sql
CREATE TABLE public.event_chat (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  send_email BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_event ON public.event_chat(event_id, created_at);
```

#### 4.14 `event_chat_reactions`
```sql
CREATE TABLE public.event_chat_reactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES public.event_chat(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, user_id, emoji)
);
```

#### 4.15 `chat_read_status`
```sql
CREATE TABLE public.chat_read_status (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  last_read_message_id BIGINT,
  last_read_at TIMESTAMPTZ,
  UNIQUE(user_id, event_id)
);
```

#### 4.16 `push_subscriptions`
```sql
CREATE TABLE public.push_subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_push_user ON public.push_subscriptions(user_id);
```

#### 4.17 `surveys` + related
```sql
CREATE TABLE public.surveys (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.survey_questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id BIGINT NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_order INT DEFAULT 0,
  allow_free_text BOOLEAN DEFAULT FALSE
);

CREATE TABLE public.survey_options (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  option_text VARCHAR(255) NOT NULL,
  option_order INT DEFAULT 0
);

CREATE TABLE public.survey_answers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id BIGINT NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  option_id BIGINT REFERENCES public.survey_options(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  free_text TEXT,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, user_id)
);

-- View pro výsledky
CREATE VIEW public.v_survey_results AS
SELECT
  sq.survey_id,
  sq.id AS question_id,
  sq.question_text,
  so.id AS option_id,
  so.option_text,
  COUNT(sa.id) AS vote_count
FROM survey_questions sq
LEFT JOIN survey_options so ON so.question_id = sq.id
LEFT JOIN survey_answers sa ON sa.option_id = so.id
GROUP BY sq.survey_id, sq.id, sq.question_text, so.id, so.option_text
ORDER BY sq.question_order, so.option_order;
```

#### 4.18 `conf_attributes`
```sql
CREATE TABLE public.conf_attributes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  display_label VARCHAR(255),
  description TEXT,
  data_type VARCHAR(50),
  is_required BOOLEAN DEFAULT FALSE,
  is_primary_key BOOLEAN DEFAULT FALSE,
  is_foreign_key BOOLEAN DEFAULT FALSE,
  foreign_key_table VARCHAR(100),
  foreign_key_column VARCHAR(100),
  foreign_key_source_column VARCHAR(100),
  fetch_fields TEXT,
  is_visible BOOLEAN DEFAULT TRUE,
  is_editable BOOLEAN DEFAULT TRUE,
  is_searchable BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  validation_rules VARCHAR(500),
  field_type VARCHAR(50),
  field_options JSONB,
  UNIQUE(table_name, column_name)
);
```

#### 4.19 `error_logs`
```sql
CREATE TABLE public.error_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source VARCHAR(20) CHECK (source IN ('frontend','backend','push','cron','other')),
  level VARCHAR(20) CHECK (level IN ('debug','info','warning','error','critical')),
  category VARCHAR(100),
  message TEXT,
  context JSONB,
  page VARCHAR(500),
  user_agent TEXT,
  url TEXT,
  user_id UUID,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.20 `audit_logs`
```sql
CREATE TABLE public.audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  action VARCHAR(50),
  table_name VARCHAR(100),
  record_id BIGINT,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS) — klíčové politiky

```sql
-- Zapnout RLS na všech tabulkách
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- atd. pro všechny tabulky

-- Profiles: uživatel vidí všechny profily (pro zobrazení jmen), edituje jen svůj
CREATE POLICY "Profiles: čtení pro přihlášené" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Profiles: vlastní editace" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Teams: vidí členové týmu
CREATE POLICY "Teams: čtení pro členy" ON public.teams
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_players WHERE team_id = teams.id AND player_id = auth.uid() AND status = 'active')
    OR manager_id = auth.uid()
    OR assistant_manager_id = auth.uid()
  );
CREATE POLICY "Teams: manažer CRUD" ON public.teams
  FOR ALL USING (manager_id = auth.uid());

-- Events: čtení pro členy týmu, CRUD pro manažera
CREATE POLICY "Events: čtení pro členy týmu" ON public.events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_players tp ON tp.team_id = t.id
      WHERE t.id = events.team_id
      AND (t.manager_id = auth.uid() OR t.assistant_manager_id = auth.uid() OR (tp.player_id = auth.uid() AND tp.status = 'active'))
    )
  );

-- Notifications: pouze vlastní
CREATE POLICY "Notifications: vlastní" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- Chat: čtení pro účastníky eventu
CREATE POLICY "Chat: čtení pro účastníky" ON public.event_chat
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM event_registrations er
      WHERE er.event_id = event_chat.event_id AND er.player_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM events e JOIN teams t ON t.id = e.team_id
      WHERE e.id = event_chat.event_id AND (t.manager_id = auth.uid() OR t.assistant_manager_id = auth.uid())
    )
  );

-- Push subscriptions: pouze vlastní
CREATE POLICY "Push: vlastní" ON public.push_subscriptions
  FOR ALL USING (user_id = auth.uid());
```

---

## 5. Autentizace a autorizace

### Současný stav (CI4)
- **Lokální login**: email/login + SHA256(password + salt)
- **Google OAuth**: server-side flow (google/apiclient), redirect callback
- **JWT**: HS256, access token (1h) + refresh token (7-30d)
- **Filtr**: AuthFilter.php kontroluje JWT v hlavičce `Authorization: Bearer ...`
- **Dual auth**: Uživatel může mít současně password i Google auth

### Cílový stav (Supabase Auth)
- **Lokální login**: `supabase.auth.signInWithPassword({ email, password })`
- **Google OAuth**: `supabase.auth.signInWithOAuth({ provider: 'google' })`
- **Session**: Automatická správa přes Supabase cookies (ne JWT ručně)
- **Middleware**: `middleware.ts` ověřuje session na každém requestu
- **Dual auth**: Supabase podporuje linking identity providers

### Implementace

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
};

// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  // Přesměrování nepřihlášených
  const publicPaths = ['/login', '/register', '/accept-invitation', '/api/cron'];
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p));
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|service-worker.js|offline.html).*)'],
};
```

### Role-based přístup (helper funkce)

```typescript
// src/lib/auth-helpers.ts
import { createClient } from '@/lib/supabase/server';

export async function isTeamManager(teamId: number): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: team } = await supabase
    .from('teams')
    .select('manager_id, assistant_manager_id')
    .eq('id', teamId)
    .single();

  return team?.manager_id === user.id || team?.assistant_manager_id === user.id;
}

export async function isEventManager(eventId: number): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: event } = await supabase
    .from('events')
    .select('team_id, teams(manager_id, assistant_manager_id)')
    .eq('id', eventId)
    .single();

  const team = event?.teams as any;
  return team?.manager_id === user.id || team?.assistant_manager_id === user.id;
}
```

---

## 6. API Routes (Next.js)

### Mapování původních CI4 routes na Next.js API routes

Většinu CRUD operací lze řešit **přímo přes Supabase client** z klientských komponent (díky RLS). API Routes potřebujeme pouze pro:

1. **Server-side logiku** (FIO sync, payment matching, push notifications)
2. **Cron joby** (reminders)
3. **Server-side callbacks** (Google OAuth, pokud custom)
4. **Operace s tajnými klíči** (VAPID private key, FIO tokeny)

### API Routes struktura

```
src/app/api/
├── fio/
│   └── sync/route.ts           POST — FIO sync + auto-match
├── payments/
│   ├── match/route.ts          POST — manuální match
│   ├── allocate/route.ts       POST — manuální alokace
│   ├── unassign/route.ts       POST — odebrání přiřazení
│   ├── reset/route.ts          POST — reset přiřazení za event
│   ├── create-pending/route.ts POST — vytvoření pending plateb
│   └── qr/route.ts             POST — generování SPAYD QR
├── push/
│   └── send/route.ts           POST — odeslání push notifikace
├── email/
│   ├── invitation/route.ts     POST — pozvánka do týmu
│   ├── reminder/route.ts       POST — připomínka
│   └── activation/route.ts     POST — aktivační email
├── cron/
│   └── reminders/route.ts      GET  — Vercel Cron: připomínky eventů
├── import/
│   ├── users/route.ts          POST — import uživatelů
│   └── csv/route.ts            POST — import z CSV
└── log/route.ts                POST — error logging
```

### Příklad: FIO sync API route

```typescript
// src/app/api/fio/sync/route.ts
import { createClient } from '@/lib/supabase/server';
import { fetchFioTransactions, parseTransactions } from '@/lib/fio';
import { autoMatchPayments } from '@/lib/payment-matching';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId, eventId } = await request.json();

  // Ověřit, že je manažer
  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (team?.manager_id !== user.id && team?.assistant_manager_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!team.fio_api_token) {
    return NextResponse.json({ error: 'FIO token not configured' }, { status: 400 });
  }

  // Stáhnout transakce z FIO
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 30);
  const transactions = await fetchFioTransactions(
    team.fio_api_token,
    dateFrom.toISOString().split('T')[0],
    new Date().toISOString().split('T')[0]
  );

  // Uložit raw transakce
  for (const tx of transactions) {
    await supabase.from('bank_transactions_originals').upsert({
      bank_transaction_id: tx.id,
      account: tx.account,
      bank_code: tx.bankCode,
      amount: tx.amount,
      currency: tx.currency,
      transaction_date: tx.date,
      variable_symbol: tx.vs,
      specific_symbol: tx.ss,
      constant_symbol: tx.ks,
      payer_name: tx.payerName,
      payer_account: tx.payerAccount,
      message: tx.message,
      team_id: teamId,
      raw_json: tx.raw,
    }, { onConflict: 'bank_transaction_id' });
  }

  // Auto-match
  const result = await autoMatchPayments(supabase, teamId, eventId);

  return NextResponse.json({
    fetched: transactions.length,
    matched: result.matched,
    unmatched: result.unmatched,
  });
}
```

### Příklad: Vercel Cron job

```typescript
// src/app/api/cron/reminders/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Cron endpoint používá service_role key (obejde RLS)
export async function GET(request: Request) {
  // Ověřit Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Najít eventy, kde je čas na připomínku
  const { data: events } = await supabase
    .from('events')
    .select('*, teams(*)')
    .eq('is_active', 1)
    .is('reminder_sent_at', null)
    .not('reminder_offset_hours', 'is', null);

  let sent = 0;
  for (const event of events || []) {
    const reminderTime = new Date(event.start_datetime);
    reminderTime.setHours(reminderTime.getHours() - event.reminder_offset_hours);

    if (new Date() >= reminderTime) {
      // Odeslat push + email přes API
      // ... (implementace push + email)
      await supabase
        .from('events')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', event.id);
      sent++;
    }
  }

  return NextResponse.json({ sent });
}

// vercel.json
// {
//   "crons": [{
//     "path": "/api/cron/reminders",
//     "schedule": "0 * * * *"
//   }]
// }
```

---

## 7. Frontend stránky

### Zásady konverze
1. **Bootstrap 5.3 zůstává** — načítat z CDN v root layout
2. **Vizuální identita zachována** — barvy, rozložení, cards, taby
3. **CSS** — přenést celý `style.css` + `event-chat.css`
4. **Komponenty** — každá stránka = React Server/Client Component
5. **Data fetching** — Server Components pro initial load, client-side Supabase pro interakce

### Stránka po stránce

#### 7.1 Login (`/login/page.tsx`) — Client Component
- Gradient pozadí (zachovat `.login-container`)
- Google OAuth tlačítko → `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Email + heslo → `supabase.auth.signInWithPassword({ email, password })`
- „Zapomenuté heslo" modal → `supabase.auth.resetPasswordForEmail(email)`
- Po přihlášení: redirect na `/dashboard`
- Kontrola pending team invitation v localStorage

#### 7.2 Register (`/register/page.tsx`) — Client Component
- Google registrace → `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Lokální registrace → `supabase.auth.signUp({ email, password, options: { data: { first_name, last_name, login, phone_number } } })`
- Email kontrola (debounce 500ms) → `supabase.from('profiles').select('id').eq('email', val)`
- Pre-fill z team invitation query params

#### 7.3 Dashboard (`/dashboard/page.tsx`) — Server Component s Client children
- **Notifikace**: `supabase.from('notifications').select('*').eq('user_id', userId).eq('is_read', false).limit(5)`
- **Upcoming events**: Pro každý tým přes `supabase.from('events').select('*').gte('start_datetime', now)`
- **Pozvánky**: Z `team_players` kde `status = 'invited'`
- **Nepřečtené platby**: `supabase.from('payments').select('*').eq('player_id', userId).eq('status', 'pending')`
- **Realtime**: Supabase Realtime subscription na notifications tabulku
- Badge aktualizace v navbar

#### 7.4 Teams (`/teams/page.tsx`)
- Card grid (col-md-6, col-lg-4) — zachovat
- 3 sekce: Pozvánky (zelený border), Regulérní, Dočasné (žlutý border)
- Create team modal (Bootstrap modal)
- Data: `supabase.from('team_players').select('*, teams(*)')...`

#### 7.5 Team Detail (`/teams/[id]/page.tsx`)
- Breadcrumb → Header → Info Cards → Tabs (Hráči | Události)
- **Tab Hráči**: Tabulka s jersey selektorem, status
- **Tab Události**: Seznam eventů týmu
- Modaly: Edit team, Add player, Jersey management
- Manager-only: Import hráčů, send activation, block/remove

#### 7.6 Events (`/events/page.tsx`)
- Filtr: tým dropdown + stav (nadcházející/minulé/vše)
- Create event modal s recurrence options (denně/týdně/měsíčně)
- Bank payment fields (účet, VS, popis)
- Reminder offset (1h až 120h)

#### 7.7 Event Detail (`/events/[id]/page.tsx`) — **NEJKOMPLEXNĚJŠÍ STRÁNKA**
- **Header**: Název, tým, datum, místo, počty účastníků + jersey statistiky
- **Manager akce**: Edit, Delete, Add Participant, Player view toggle

- **Tab 1 — Registrace**: 4 skupiny:
  - JDU (zelená) — status `confirmed`/`going`
  - NEVÍM (žlutá) — status `maybe`/`pending`
  - NEJDU (červená) — status `declined`/`not_going`/`no`
  - VE FRONTĚ (modrá) — status `waiting`
  - Klikatelné status tlačítka pro přepínání
  - Kapacitní management (auto-waitlist, auto-promote)
  - Registrační deadline

- **Tab 2 — Platby**:
  - QR kód (SPAYD) pro platbu
  - Sync z FIO banka tlačítko
  - Seznam plateb se statusem (pending/completed)
  - Manager: manual match, allocate, unassign, reset
  - QR generování klientsky (qrcode npm)

- **Tab 3 — Chat** → `<EventChat />` komponenta
  - Polling → **nahradit Supabase Realtime**
  - Emoji reakce (smile, sad, laugh, thumbs_up, facepalm)
  - Edit/Delete (vlastník nebo manažer)
  - Mark as read
  - Push notifikace při nové zprávě

#### 7.8 Payments (`/payments/page.tsx`)
- 3 stat karty: nezaplaceno, zaplaceno, celkem
- Taby: Nezaplacené | Zaplacené | Vše
- Manager: team selector, sync FIO button
- Hráč: jen vlastní platby s QR kódem

#### 7.9 Profile (`/profile/page.tsx`)
- Avatar upload → Supabase Storage (`avatars` bucket)
- Formulář: jméno, příjmení, telefon
- Account info cards (typ, status, datum)

#### 7.10 Settings (`/settings/page.tsx`)
- Změna hesla → `supabase.auth.updateUser({ password })`
- Jersey preference selector
- Push notifications toggle
- Cache management (clear cache, SW update)
- Service Worker status

#### 7.11 Surveys (`/surveys/page.tsx`)
- Dual-panel: LEFT (seznam anket) + RIGHT (detail/odpovídání/výsledky)
- Manager: CRUD anket + otázek + možností + export CSV
- Hráč: odpovídání + indikátor „již zodpovězeno"
- Výsledky: progress bary + statistiky

#### 7.12 Accept Invitation (`/accept-invitation/page.tsx`)
- Veřejná stránka (bez auth)
- Ověření invitation_token
- Nabídka: přihlásit se / registrovat / propojit Google

---

## 8. Služby a business logika

### 8.1 FIO Bank API klient (`lib/fio.ts`)

```typescript
// Klíčová logika pro přenos:
interface FioTransaction {
  id: string;
  date: string;
  amount: number;
  account: string;
  bankCode: string;
  vs: string;      // variabilní symbol
  ss: string;      // specifický symbol
  ks: string;      // konstantní symbol
  payerName: string;
  payerAccount: string;
  message: string;
  currency: string;
  raw: any;
}

export async function fetchFioTransactions(
  token: string,
  dateFrom: string,   // YYYY-MM-DD
  dateTo: string
): Promise<FioTransaction[]> {
  const url = `https://fio.cz/ib_api/rest/periods/${token}/${dateFrom}/${dateTo}/transactions.json`;
  const response = await fetch(url);
  const data = await response.json();

  return (data.accountStatement?.transactionList?.transaction || []).map((tx: any) => ({
    id: tx.column22?.value?.toString(),            // ID transakce
    date: tx.column0?.value,                       // datum
    amount: tx.column1?.value,                     // částka
    account: tx.column2?.value,                    // protiúčet
    bankCode: tx.column3?.value,                   // kód banky
    vs: tx.column5?.value?.toString(),             // VS
    ss: tx.column6?.value?.toString(),             // SS
    ks: tx.column4?.value?.toString(),             // KS
    payerName: tx.column10?.value,                 // jméno plátce
    payerAccount: tx.column2?.value,               // účet plátce
    message: tx.column16?.value,                   // zpráva
    currency: tx.column14?.value || 'CZK',
    raw: tx,
  }));
}
```

### 8.2 Algoritmus párování plateb (`lib/payment-matching.ts`)

**KRITICKÁ BUSINESS LOGIKA — přenést přesně!**

```typescript
/**
 * Dvou-průchodový algoritmus párování FIO transakcí na pending platby:
 *
 * PRŮCHOD 1: Datum eventu → event + 5 dní
 *   Priorita 1: Specifický symbol (SS) → player_id (přesná shoda)
 *   Priorita 2: Bankovní účet plátce → lookup v users_bank_accounts
 *   Priorita 3: Jméno plátce → fuzzy match (Levenshtein, práh ≥70%)
 *   Priorita 4: Zpráva → fuzzy match na jména
 *
 * PRŮCHOD 2: Event + 5 dní → dnes
 *   POUZE přesný QR match (SS musí existovat)
 *
 * Validace shody:
 * - Částka >= amount_per_participant
 * - Hráč musí mít registraci confirmed/going
 * - Žádná existující aktivní relace v bank_payments_rel
 * - Žádná completed platba pro hráče+event
 *
 * Při shodě:
 * - Vytvořit bank_payments_rel záznam (status='active', assigned_by_type='auto')
 * - Aktualizovat payments.status = 'completed'
 * - Propojit payments.fio_transaction_id
 */

// Pomocné funkce (přenést z payment_helper.php):
function stringSimilarity(a: string, b: string): number {
  // Levenshtein distance normalizovaná na procenta
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return ((maxLen - distance) / maxLen) * 100;
}

function normalizeAccountNumber(account: string): string {
  return account.replace(/[\s\-\/]/g, '');
}

function normalizeName(name: string): string {
  // Odstranit diakritiku, lowercase, trim
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
```

### 8.3 Chat Realtime (`src/hooks/useRealtime.ts`)

**Nahradit polling Supabase Realtime:**

```typescript
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useChatRealtime(eventId: number) {
  const [messages, setMessages] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // Initial load
    const loadMessages = async () => {
      const { data } = await supabase
        .from('event_chat')
        .select('*, profiles(first_name, last_name, picture_url), event_chat_reactions(*)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    };
    loadMessages();

    // Realtime subscriptions
    const channel = supabase
      .channel(`event-chat-${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'event_chat',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        // Enrichovat profil a přidat
        setMessages(prev => [...prev, payload.new]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'event_chat',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_chat_reactions',
      }, () => {
        // Reload reactions
        loadMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  return messages;
}
```

### 8.4 Push notifikace (`lib/push.ts`)

```typescript
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@sportkalendar.cz',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushToUser(
  supabase: any,               // service_role klient
  userId: string,
  payload: { title: string; body: string; icon?: string; link?: string }
) {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  for (const sub of subscriptions || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 86400 }
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', sub.id);
      }
    }
  }
}
```

### 8.5 QR kód — SPAYD formát (`lib/qr.ts`)

```typescript
/**
 * SPAYD (Short Payment Descriptor) pro české bankovnictví
 * Formát: SPD*1.0*ACC:CZnnnnnnnnnnnnnnnnnnnn*AM:100.00*CC:CZK*X-VS:12345*X-SS:67890*MSG:popis
 *
 * Konverze čísla účtu na IBAN:
 * Vstup: "2345678901/0800" → IBAN: "CZ6508000000002345678901"
 * Algoritmus:
 * 1. Rozdělit na číslo účtu a kód banky
 * 2. Doplnit na 16 číslic (bez prefixu) nebo prefix-číslo
 * 3. Vypočítat IBAN kontrolní číslo (mod 97)
 */

export function generateSPAYD(params: {
  account: string;      // české číslo účtu "123456/0800"
  amount: number;
  vs?: string;
  ss?: string;
  message?: string;
  currency?: string;
}): string {
  const iban = accountToIBAN(params.account);
  let spayd = `SPD*1.0*ACC:${iban}*AM:${params.amount.toFixed(2)}*CC:${params.currency || 'CZK'}`;
  if (params.vs) spayd += `*X-VS:${params.vs}`;
  if (params.ss) spayd += `*X-SS:${params.ss}`;
  if (params.message) spayd += `*MSG:${params.message.substring(0, 60)}`;
  return spayd;
}

// QR kód generovat klientsky pomocí npm 'qrcode' nebo 'qrcode.react'
```

### 8.6 Email service (`lib/email.ts`)

```typescript
// Pro free tier: Resend (100 emails/den free) nebo Supabase Auth emails
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTeamInvitation(to: string, teamName: string, inviteUrl: string) {
  await resend.emails.send({
    from: 'Sport Kalendář <noreply@sportkalendar.cz>',
    to,
    subject: `Pozvánka do týmu ${teamName}`,
    html: `<p>Byli jste pozváni do týmu <strong>${teamName}</strong>.</p>
           <p><a href="${inviteUrl}">Přijmout pozvánku</a></p>`,
  });
}

export async function sendEventReminder(to: string, eventName: string, eventDate: string) {
  await resend.emails.send({
    from: 'Sport Kalendář <noreply@sportkalendar.cz>',
    to,
    subject: `Připomínka: ${eventName}`,
    html: `<p>Připomínáme událost <strong>${eventName}</strong> dne ${eventDate}.</p>`,
  });
}

export async function sendChatNotification(to: string, senderName: string, eventName: string, message: string) {
  await resend.emails.send({
    from: 'Sport Kalendář <noreply@sportkalendar.cz>',
    to,
    subject: `💬 ${senderName} v ${eventName}`,
    html: `<p><strong>${senderName}</strong> napsal(a) v chatu události ${eventName}:</p>
           <blockquote>${message.substring(0, 200)}</blockquote>`,
  });
}
```

---

## 9. PWA, Push notifikace, Service Worker

### PWA konfigurace

```json
// public/manifest.json — zachovat stávající:
{
  "name": "Sport Kalendář",
  "short_name": "SportKal",
  "description": "Správa sportovních týmů, událostí a plateb",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#181E36",
  "theme_color": "#0f3460",
  "icons": [
    { "src": "/icons/icon-128x128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-256x256.png", "sizes": "256x256", "type": "image/png" },
    { "src": "/icons/icon-384x384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker strategie
- **Network-first** s cache fallback (zachovat strategii)
- Cacheovat: statické assety, HTML stránky, Bootstrap CDN
- API cache: nepoužívat (Supabase realtime nahradí)
- Offline fallback: `/offline.html`
- Doporučení: použít `next-pwa` balík nebo `@serwist/next`

### Push Notifications komponent

```typescript
// src/components/PushNotifications.tsx
'use client';

import { createClient } from '@/lib/supabase/client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisuallyPushed: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const json = subscription.toJSON();
  await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent,
    is_active: true,
  }, { onConflict: 'user_id,endpoint' });

  return true;
}
```

---

## 10. Krok za krokem — TODO checklist

### Fáze 0: Příprava prostředí
- [ ] **0.1** Vytvořit Supabase projekt (free tier) — zaznamenat URL + anon key + service role key
- [ ] **0.2** Vytvořit Vercel projekt (free tier) — propojit s Git repo
- [ ] **0.3** Inicializovat Next.js projekt: `npx create-next-app@latest sportbook-next --typescript --app --tailwind=no --src-dir --import-alias "@/*"`
- [ ] **0.4** Nainstalovat závislosti: `npm install @supabase/supabase-js @supabase/ssr web-push qrcode resend`
- [ ] **0.5** Nastavit `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  NEXT_PUBLIC_VAPID_PUBLIC_KEY=BBVwv9fmc8OHCqJakj0Cs2qdmhNE9PSOgyWGjDKwXJKW2CvlgABrsq3wxpGA2EqMLaBn8mCcUYOBl8tsb12AzO4
  VAPID_PRIVATE_KEY=<z původního .env>
  RESEND_API_KEY=re_xxx
  CRON_SECRET=<náhodný string>
  ```
- [ ] **0.6** Přenést ikony: zkopírovat `/public/assets/icons/` → `/public/icons/`
- [ ] **0.7** Přenést a přizpůsobit manifest.json

### Fáze 1: Databáze a Auth
- [ ] **1.1** Spustit SQL migrace v Supabase SQL Editoru — vytvořit všechny tabulky z kapitoly 4
- [ ] **1.2** Vytvořit RLS politiky z kapitoly 4 (Row Level Security)
- [ ] **1.3** Vytvořit trigger `handle_new_user` pro auto-vytvoření profilu
- [ ] **1.4** Vytvořit trigger `update_updated_at` pro automatické timestampy
- [ ] **1.5** Nastavit Supabase Auth — zapnout Email provider
- [ ] **1.6** Nastavit Supabase Auth — zapnout Google OAuth provider (client ID + secret z Google Cloud Console)
- [ ] **1.7** Seed data: naplnit `conf_attributes` tabulku (přenést z `seed_conf_attributes.sql`)
- [ ] **1.8** Vytvořit Supabase Storage bucket `avatars` (public)
- [ ] **1.9** Vytvořit Supabase Storage bucket `qr-codes` (public)
- [ ] **1.10** Otestovat registraci a přihlášení přes Supabase Dashboard

### Fáze 2: Základní struktura Next.js
- [ ] **2.1** Vytvořit `src/lib/supabase/client.ts` — browser klient
- [ ] **2.2** Vytvořit `src/lib/supabase/server.ts` — server-side klient
- [ ] **2.3** Vytvořit `middleware.ts` — auth middleware (přesměrování)
- [ ] **2.4** Přenést CSS: zkopírovat `style.css` → `src/styles/globals.css`, přidat Bootstrap CDN do root layout
- [ ] **2.5** Přenést CSS: zkopírovat `event-chat.css` → `src/styles/event-chat.css`
- [ ] **2.6** Vytvořit root `layout.tsx` — Bootstrap CDN v `<head>`, metadata (title: Sport Kalendář), theme color
- [ ] **2.7** Vytvořit `src/types/index.ts` — TypeScript typy pro všechny entity (Profile, Team, Event, Payment, atd.)

### Fáze 3: Autentizace
- [ ] **3.1** Vytvořit `/login/page.tsx` — email+heslo + Google OAuth + zapomenuté heslo modal
- [ ] **3.2** Vytvořit `/register/page.tsx` — lokální registrace + Google + email check + invitation pre-fill
- [ ] **3.3** Implementovat `useAuth` hook — getUser, signOut, isAuthenticated
- [ ] **3.4** Otestovat kompletní auth flow (registrace → login → protected pages → logout)
- [ ] **3.5** Otestovat Google OAuth flow

### Fáze 4: Layout a navigace
- [ ] **4.1** Vytvořit `Navbar.tsx` komponentu — logo, odkazy (Teams|Events|Payments|Surveys), user dropdown, badge counters
- [ ] **4.2** Implementovat badge aktualizace (nepřečtené notifikace, nezaplacené platby)
- [ ] **4.3** Implementovat PWA detection (standalone mode)
- [ ] **4.4** Vytvořit `PwaInstallBanner.tsx` — install prompt bottom banner

### Fáze 5: Dashboard
- [ ] **5.1** Vytvořit `/dashboard/page.tsx` — notifikace + upcoming events + past events + team invitations
- [ ] **5.2** Implementovat Supabase Realtime subscription na notifikace
- [ ] **5.3** Implementovat accept/decline invitation functionality
- [ ] **5.4** Stats: počty týmů, eventů, nepřečtených plateb

### Fáze 6: Týmy
- [ ] **6.1** Vytvořit `/teams/page.tsx` — card grid s 3 sekcemi (pozvánky, regulérní, dočasné)
- [ ] **6.2** Implementovat Create team modal
- [ ] **6.3** Vytvořit `/teams/[id]/page.tsx` — detail s breadcrumb + info cards + tabs
- [ ] **6.4** Tab Hráči: tabulka hráčů, jersey selector, status management
- [ ] **6.5** Tab Události: seznam eventů týmu
- [ ] **6.6** Jersey management modal (CRUD na enum_team_jersey)
- [ ] **6.7** Add player modal + invitation flow
- [ ] **6.8** Manager akce: edit team, delete, block/remove player

### Fáze 7: Události
- [ ] **7.1** Vytvořit `/events/page.tsx` — filtrovatelný seznam + create modal s recurrence
- [ ] **7.2** Vytvořit `/events/[id]/page.tsx` — header s počty + 3 tabs
- [ ] **7.3** Tab Registrace: 4 skupiny (JDU/NEVÍM/NEJDU/VE FRONTĚ) s status přepínáním
- [ ] **7.4** Implementovat kapacitní management (waitlist, auto-promote)
- [ ] **7.5** Tab Platby: QR kód zobrazení, payment status, manager operace
- [ ] **7.6** Tab Chat: `EventChat.tsx` komponenta s Supabase Realtime
- [ ] **7.7** Chat reakce (emoji: smile, sad, laugh, thumbs_up, facepalm)
- [ ] **7.8** Chat edit/delete (vlastník nebo manažer)
- [ ] **7.9** Unread tracking (chat_read_status tabulka)
- [ ] **7.10** Manager: Add participant modal (z hráčů týmu nebo host)
- [ ] **7.11** Manager: Event cancel functionality

### Fáze 8: Platby a FIO integrace
- [ ] **8.1** Vytvořit `lib/fio.ts` — FIO Bank API klient
- [ ] **8.2** Vytvořit `lib/payment-matching.ts` — dvou-průchodový algoritmus párování
- [ ] **8.3** Vytvořit `lib/qr.ts` — SPAYD generátor + IBAN konverze
- [ ] **8.4** Vytvořit API route `api/fio/sync` — sync + auto-match
- [ ] **8.5** Vytvořit API route `api/payments/match` — manuální match
- [ ] **8.6** Vytvořit API route `api/payments/allocate` — manuální alokace
- [ ] **8.7** Vytvořit API route `api/payments/unassign` — odebrání přiřazení
- [ ] **8.8** Vytvořit API route `api/payments/reset` — reset přiřazení
- [ ] **8.9** Vytvořit API route `api/payments/create-pending` — vytvoření pending plateb
- [ ] **8.10** Vytvořit `/payments/page.tsx` — 3 stat karty + 3 taby + manager/hráč pohled
- [ ] **8.11** QR kód klientská strana — `qrcode` npm nebo `qrcode.react`

### Fáze 9: Push notifikace a email
- [ ] **9.1** Vytvořit `lib/push.ts` — web-push server-side odesílání
- [ ] **9.2** Vytvořit API route `api/push/send` — odesílání push notifikací
- [ ] **9.3** Vytvořit `PushNotifications.tsx` — klientská subscribe/unsubscribe logika
- [ ] **9.4** Vytvořit Service Worker (`public/service-worker.js`) — push event handler + cache strategie
- [ ] **9.5** Zapojit push notifikace do chat (nová zpráva → push ostatním)
- [ ] **9.6** Vytvořit `lib/email.ts` — Resend SDK wrapper
- [ ] **9.7** Vytvořit API route `api/email/invitation` — pozvánka do týmu
- [ ] **9.8** Vytvořit API route `api/email/activation` — aktivační email
- [ ] **9.9** Zapojit email do reminder flow

### Fáze 10: Notifikace
- [ ] **10.1** Vytvořit `/notifications/page.tsx` (nebo jako součást dashboard)
- [ ] **10.2** Implementovat mark as read / mark all as read
- [ ] **10.3** Supabase Realtime na nové notifikace (badge update)
- [ ] **10.4** Notifikační types: chat, event_reminder, team_invitation, waitlist_promoted, event_cancelled, registration_change

### Fáze 11: Ankety (Surveys)
- [ ] **11.1** Vytvořit `/surveys/page.tsx` — dual-panel layout
- [ ] **11.2** Manager: CRUD anket + otázek + možností
- [ ] **11.3** Hráč: odpovídání na ankety
- [ ] **11.4** Výsledky: progress bary + statistiky
- [ ] **11.5** CSV export výsledků

### Fáze 12: Profil a nastavení
- [ ] **12.1** Vytvořit `/profile/page.tsx` — avatar upload (Supabase Storage) + formulář
- [ ] **12.2** Vytvořit `/settings/page.tsx` — změna hesla + push toggle + cache mgmt
- [ ] **12.3** Jersey preference per tým

### Fáze 13: Import a onboarding
- [ ] **13.1** Vytvořit API route `api/import/users` — import uživatelů
- [ ] **13.2** Vytvořit API route `api/import/csv` — CSV import
- [ ] **13.3** Vytvořit `/accept-invitation/page.tsx` — veřejná stránka pro přijetí pozvánky
- [ ] **13.4** Onboarding flow: aktivace migrovaných uživatelů

### Fáze 14: Cron joby
- [ ] **14.1** Vytvořit API route `api/cron/reminders` — endpoint pro Vercel Cron
- [ ] **14.2** Nakonfigurovat `vercel.json` — cron schedule pro připomínky
- [ ] **14.3** Otestovat reminder flow end-to-end

### Fáze 15: PWA a offline podpora
- [ ] **15.1** Nakonfigurovat Service Worker — cache strategie, offline fallback
- [ ] **15.2** Nastavit next.config.js pro PWA header (manifest, theme-color)
- [ ] **15.3** Vytvořit `/offline.html` — offline fallback stránka
- [ ] **15.4** Otestovat PWA install na mobilu (iOS + Android)

### Fáze 16: Error logging
- [ ] **16.1** Vytvořit API route `api/log` — error logging endpoint
- [ ] **16.2** Implementovat klientský error handler (window.onerror → API)
- [ ] **16.3** Admin: prohlížení logů

### Fáze 17: Finální testování a deploy
- [ ] **17.1** End-to-end test: registrace → login → vytvoření týmu → přidání hráčů → vytvoření eventu → registrace → chat → platby → FIO sync
- [ ] **17.2** Test PWA: install, offline mode, push notifications
- [ ] **17.3** Test Google OAuth na Vercel doméně
- [ ] **17.4** Performance audit (Lighthouse)
- [ ] **17.5** Deploy na Vercel production
- [ ] **17.6** Nastavení custom domény (volitelné)
- [ ] **17.7** Migrace dat z původní MySQL databáze (volitelné)

---

## Příloha A: Vizuální identita — zachovat

### Barvy
| Účel | Hodnota | Použití |
|------|---------|---------|
| Primary | `#667eea` | Odkazy, tlačítka, badge |
| Success | `#198754` | JDU tlačítko, zaplaceno |
| Warning | `#ffc107` | NEVÍM tlačítko, pending |
| Danger | `#dc3545` | NEJDU tlačítko, nezaplaceno |
| Info | `#0dcaf0` | VE FRONTĚ tlačítko |
| PWA theme | `#0f3460` | Status bar, install banner |
| Login gradient | `#667eea → #764ba2` | Login/register pozadí |
| Dark background | `#181E36` | PWA background |

### CSS třídy k přenesení
- `.dashboard-card` — karty s shadow + hover lift
- `.event-status-btn` — velké attendance buttons (1.1rem)
- `.login-container` — gradient pozadí
- `.profile-picture-*` — avatar circle + initials fallback
- `.jersey-*` — jersey color selector
- `.chat-wrapper` — 600px fixed height
- `.chat-message` — max 75% width, animations
- `.chat-avatar` — 32px circles
- `.reaction-btn` — emoji buttons

### Responsive breakpoints
- Mobile (< 576px): Logo 48×60px, skrytý text navbar
- Tablet (576-991px): Logo 60×76px
- Desktop (≥ 992px): Plná šířka navbar

---

## Příloha B: Environment variables (kompletní)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BBVwv9fmc8OHCqJakj0Cs2qdmhNE9PSOgyWGjDKwXJKW2CvlgABrsq3wxpGA2EqMLaBn8mCcUYOBl8tsb12AzO4
VAPID_PRIVATE_KEY=<z původního .env>

# Email (Resend)
RESEND_API_KEY=re_xxx

# Vercel Cron
CRON_SECRET=<náhodný 32+ char string>

# Google OAuth (nastavuje se v Supabase Dashboard, ne v env)
# GOOGLE_CLIENT_ID — vložit do Supabase Auth Settings
# GOOGLE_CLIENT_SECRET — vložit do Supabase Auth Settings
```

---

## Příloha C: NPM závislosti

```json
{
  "dependencies": {
    "next": "^14.2",
    "react": "^18.3",
    "react-dom": "^18.3",
    "@supabase/supabase-js": "^2.45",
    "@supabase/ssr": "^0.5",
    "web-push": "^3.6",
    "qrcode": "^1.5",
    "qrcode.react": "^3.1",
    "resend": "^4.0"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/web-push": "^3.6"
  }
}
```

---

## Příloha D: Limity free plánů

### Supabase Free Tier
| Limit | Hodnota |
|-------|---------|
| Databáze | 500 MB |
| Storage | 1 GB |
| Bandwidth | 5 GB |
| MAU (Auth) | 50 000 |
| Edge Function invocations | 500 000/měsíc |
| Realtime connections | 200 concurrent |
| Projekty | 2 |

### Vercel Free Tier
| Limit | Hodnota |
|-------|---------|
| Bandwidth | 100 GB |
| Serverless Function execution | 100 GB-h |
| Builds | 6000 min/měsíc |
| Cron Jobs | 1 cron per day (free), nebo Edge Functions |

### Resend Free Tier
| Limit | Hodnota |
|-------|---------|
| Emails | 100/den, 3000/měsíc |
| Domains | 1 |

### Doporučení pro free tier
- FIO sync provádět on-demand (tlačítkem), ne cronem — šetří Edge Function invocations
- Push subscriptions pravidelně čistit neaktivní záznamy
- Obrázky profilů komprimovat před uploadem (max 200KB)
- Supabase Realtime používat jen pro chat a notifikace (ne pro polling všech dat)

---

## Příloha E: Supabase vs. původní CI4 — mapování operací

### CRUD operace (přes Supabase client, ne API route)

```typescript
// Původně: GET /api/v1/teams/my (TeamController::myTeams)
// Nyní: přímo ze client componenty
const { data } = await supabase
  .from('team_players')
  .select('team_id, status, teams(*, profiles!teams_manager_id_fkey(first_name, last_name))')
  .eq('player_id', user.id)
  .in('status', ['active', 'invited']);

// Původně: POST /api/v1/events (EventController::create)
// Nyní: přímo ze client componenty (RLS ověří manažera)
const { data, error } = await supabase
  .from('events')
  .insert({
    team_id: teamId,
    name: 'Trénink',
    start_datetime: '2026-04-01T18:00:00',
    end_datetime: '2026-04-01T20:00:00',
    max_participants: 20,
    amount_per_participant: 200,
    bank_account_number: '123456/0800',
  })
  .select()
  .single();

// Původně: POST /api/v1/events/:id/register (RegistrationController::register)
// Nyní: přes API route (kvůli kapacitní logice)
const res = await fetch(`/api/events/${eventId}/register`, {
  method: 'POST',
  body: JSON.stringify({ status: 'going' }),
});
```

### Operace vyžadující API routes (server-side logic)

| Operace | Důvod |
|---------|-------|
| FIO sync | Secret FIO token nesmí na klienta |
| Payment matching | Složitá business logika + přístup přes service_role |
| Push sending | VAPID private key nesmí na klienta |
| Email sending | Resend API key nesmí na klienta |
| Cron reminders | Server-side scheduled job |
| Registration with capacity | Transakční logika (waitlist + auto-promote) |
| Import users | Bulk operace s validací |

---

*Dokument vytvořen: 28. března 2026*
*Zdrojový projekt: Sport Kalendář (CodeIgniter 4.4 / MySQL / Vanilla JS)*
*Cílový projekt: Sport Kalendář (Next.js 14 / Supabase / Vercel)*
