# MIGRATION.md — Plán přechodu na Next.js + Supabase + Vercel

## Přehled strategie

**Přístup:** Greenfield (nový projekt) s migrací dat z MySQL do Supabase.  
**Stávající web** zůstane v provozu do doby, než je nový web plně funkční.

---

## Fáze 0 — Příprava a audit dat (před vším ostatním)

### 0.1 Záloha MySQL databáze

```bash
mysqldump -u root -p tenisdobrany > backup_tenisdobrany_$(date +%Y%m%d).sql
```

### 0.2 Audit tabulky `content` — nutné provést ručně

Spusť tyto dotazy nad stávající DB a zkontroluj výsledky:

```sql
-- Kolik záznamů celkem
SELECT COUNT(*) FROM content;

-- Jaké sekce existují a kolik záznamů mají
SELECT section, content_type, COUNT(*) as count
FROM content
GROUP BY section, content_type
ORDER BY section, count DESC;

-- Duplicity v (section, key)
SELECT section, `key`, COUNT(*) as cnt
FROM content
GROUP BY section, `key`
HAVING cnt > 1;

-- Záznamy s parent_id nebo menu_parent_id
SELECT id, section, `key`, parent_id, menu_parent_id
FROM content
WHERE parent_id IS NOT NULL OR menu_parent_id IS NOT NULL;

-- Záznamy v tabulce news (legacy)
SELECT COUNT(*) FROM news;
SELECT * FROM news LIMIT 10;
```

### 0.3 Rozhodnutí před migrací

- [ ] Jsou data v tabulce `news` duplicitní s tabulkou `content` (sekce `aktuality`)? Pokud ano, ignoruj tabulku `news`.
- [ ] Jsou obrázky na produkčním serveru dostupné ke stažení?
- [ ] Jaké sekce (section) existují v DB a mají reálný obsah?
- [ ] Jsou v menu_parent_id references na reálné záznamy, nebo null?

---

## Fáze 1 — Supabase projekt a schéma

### 1.1 Vytvoření Supabase projektu

1. Přihlas se na [supabase.com](https://supabase.com)
2. Vytvoř nový projekt — region EU (Frankfurt pro rychlost z ČR)
3. Zaznamenej:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (jen pro admin/migraci)
   - `DATABASE_URL` (pro přímé PostgreSQL připojení)

### 1.2 Vytvoření schématu v Supabase

Spusť v SQL editoru Supabase (postupně, v tomto pořadí):

```sql
-- 1. Sekce (musí být první — ostatní tabulky mohou FK na sections)
CREATE TABLE sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  menu_title      TEXT,
  menu_url        TEXT,
  menu_order      INT NOT NULL DEFAULT 0,
  menu_parent_id  UUID REFERENCES sections(id) ON DELETE SET NULL,
  show_in_menu    BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Stránky a články
CREATE TABLE pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id      UUID REFERENCES sections(id) ON DELETE SET NULL,
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  excerpt         TEXT,
  content         TEXT,
  content_data    JSONB,
  meta            JSONB,
  content_type    TEXT NOT NULL DEFAULT 'article'
                  CHECK (content_type IN ('article', 'html', 'markdown')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  published_at    TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, slug)
);

-- 3. Homepage komponenty
CREATE TABLE page_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key        TEXT NOT NULL DEFAULT 'home',
  component       TEXT NOT NULL,
                  -- hero | text_image | section_cards | latest_articles
                  -- | parallax | cta_buttons | text_block
  title           TEXT,
  excerpt         TEXT,
  content         TEXT,
  data            JSONB,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Zápatí
CREATE TABLE footer_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key      TEXT NOT NULL CHECK (column_key IN ('contact','links','social','about')),
  item_type       TEXT NOT NULL,
  content         TEXT,
  data            JSONB,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Uživatelské profily (rozšíření Supabase Auth)
CREATE TABLE user_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  role            TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin', 'member')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Media (volitelné — Supabase Storage postačí i bez tabulky)
CREATE TABLE media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket          TEXT NOT NULL DEFAULT 'images',
  path            TEXT NOT NULL,
  filename        TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      INT,
  alt_text        TEXT,
  uploaded_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.3 Row Level Security (RLS)

```sql
-- pages: veřejné čtení aktivních stránek, zápis jen admin
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON pages FOR SELECT USING (is_active = true);
CREATE POLICY "admin write" ON pages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- sections: veřejné čtení
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON sections FOR SELECT USING (true);
CREATE POLICY "admin write" ON sections FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- page_components: veřejné čtení
ALTER TABLE page_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON page_components FOR SELECT USING (is_active = true);
CREATE POLICY "admin write" ON page_components FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- footer_content: veřejné čtení
ALTER TABLE footer_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON footer_content FOR SELECT USING (is_active = true);
CREATE POLICY "admin write" ON footer_content FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- user_profiles: vlastní profil + admin vše
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "admin all" ON user_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));
```

---

## Fáze 2 — Next.js projekt

### 2.1 Inicializace projektu

```bash
npx create-next-app@latest tenisdobrany --typescript --tailwind --eslint --app
cd tenisdobrany

# Supabase client
npm install @supabase/supabase-js @supabase/ssr

# Editor (WYSIWYG)
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit

# Formuláře
npm install react-hook-form zod @hookform/resolvers

# Drag & drop (pro menu + komponenty)
npm install @dnd-kit/core @dnd-kit/sortable
```

### 2.2 Konfigurace `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # jen pro server, nikdy do klienta!

# Email
RESEND_API_KEY=re_...              # pro kontaktní formulář
CONTACT_EMAIL=info@tenisdobrany.cz
```

### 2.3 Struktura souborů (doporučená)

```
app/
├── layout.tsx                  # Root layout + nav + footer
├── page.tsx                    # Homepage
├── [section]/
│   ├── page.tsx                # Výpis sekce (generateStaticParams)
│   └── [slug]/
│       └── page.tsx            # Detail článku
├── kontakt/page.tsx
├── auth/
│   ├── prihlaseni/page.tsx
│   └── registrace/page.tsx
├── clenove/
│   └── page.tsx                # Protected
├── admin/
│   ├── layout.tsx              # Auth check
│   ├── page.tsx                # Dashboard
│   ├── stranky/page.tsx
│   ├── sekce/page.tsx
│   ├── homepage/page.tsx
│   ├── zápati/page.tsx
│   └── media/page.tsx
└── api/
    └── contact/route.ts        # Server action pro formulář

components/
├── layout/
│   ├── Navigation.tsx          # Async Server Component
│   └── Footer.tsx              # Async Server Component
├── home/
│   ├── HeroSection.tsx
│   ├── AboutSection.tsx
│   ├── SectionCards.tsx
│   ├── LatestArticles.tsx
│   └── CTASection.tsx
├── admin/
│   ├── PageEditor.tsx
│   ├── SectionManager.tsx
│   ├── FooterEditor.tsx
│   └── MediaUpload.tsx
└── ui/                         # Sdílené UI komponenty

lib/
├── supabase/
│   ├── server.ts               # createServerClient()
│   ├── client.ts               # createBrowserClient()
│   └── middleware.ts           # refreshSession
├── actions/
│   ├── content.ts
│   ├── sections.ts
│   └── auth.ts
└── types/
    └── database.ts             # Generované Supabase typy
```

---

## Fáze 3 — Migrace dat

### 3.1 Migrační skript (Node.js)

Vytvoř soubor `scripts/migrate.ts` a spusť ho jednou lokálně:

```typescript
// scripts/migrate.ts
import mysql from 'mysql2/promise';
import { createClient } from '@supabase/supabase-js';

const mysql_conn = await mysql.createConnection({
  host: 'localhost', user: 'root', password: '', database: 'tenisdobrany'
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role pro bypass RLS
);

// Krok 1: Migruj sekce
const [sectionRows] = await mysql_conn.execute(`
  SELECT DISTINCT section, title, show_section_in_menu, menu_order, menu_url, menu_title
  FROM content
  WHERE content_type = 'section' AND is_active = 1
`);

for (const row of sectionRows as any[]) {
  await supabase.from('sections').upsert({
    slug: row.section,
    title: row.title,
    menu_title: row.menu_title || null,
    menu_url: row.menu_url || null,
    menu_order: row.menu_order || 0,
    show_in_menu: Boolean(row.show_section_in_menu),
    is_active: true
  }, { onConflict: 'slug' });
}

// Krok 2: Migruj homepage komponenty
const [components] = await mysql_conn.execute(`
  SELECT * FROM content
  WHERE section = 'home' AND content_type != 'section'
  ORDER BY sort_order ASC
`);

for (const c of components as any[]) {
  await supabase.from('page_components').insert({
    page_key: 'home',
    component: c.subsection || 'text_block',
    title: c.title,
    excerpt: c.short_text,
    content: c.content,
    data: c.content_json ? JSON.parse(c.content_json) : null,
    is_active: Boolean(c.is_active),
    sort_order: c.sort_order
  });
}

// Krok 3: Migruj footer
const [footerRows] = await mysql_conn.execute(`
  SELECT * FROM content WHERE section = 'footer' AND is_active = 1
`);

for (const f of footerRows as any[]) {
  const columnMap: Record<string, string> = {
    column1: 'contact', contact: 'contact',
    column2: 'links', links: 'links',
    column3: 'social', social: 'social',
    column4: 'about', about: 'about'
  };
  const column = columnMap[f.subsection] || 'about';

  await supabase.from('footer_content').insert({
    column_key: column,
    item_type: f.template || f.content_type,
    content: f.content,
    data: f.content_json ? JSON.parse(f.content_json) : null,
    sort_order: f.sort_order
  });
}

// Krok 4: Migruj stránky a články
const [articles] = await mysql_conn.execute(`
  SELECT c.*, s.id as section_uuid
  FROM content c
  WHERE c.content_type NOT IN ('section')
    AND c.section NOT IN ('home', 'footer')
    AND c.is_active = 1
  ORDER BY c.section, c.sort_order ASC
`);

for (const a of articles as any[]) {
  // Najdi section_id z Supabase
  const { data: sec } = await supabase
    .from('sections')
    .select('id')
    .eq('slug', a.section)
    .single();

  await supabase.from('pages').insert({
    section_id: sec?.id ?? null,
    slug: a.key,
    title: a.title || 'Bez názvu',
    excerpt: a.short_text,
    content: a.content,
    content_data: a.content_json ? JSON.parse(a.content_json) : null,
    content_type: 'html',
    is_active: Boolean(a.is_active),
    sort_order: a.sort_order,
    published_at: a.created_at
  });
}

console.log('Migrace dokončena.');
```

### 3.2 Migrace obrázků

```bash
# Stáhni všechny obrázky z produkce
rsync -avz user@server:/var/www/tenisdobrany/public/assets/images/ ./migration-images/

# Nebo nahrání přes Supabase CLI
supabase storage cp ./migration-images/* supabase://images/
```

---

## Fáze 4 — Nastavení Vercel

### 4.1 Nasazení

```bash
npm install -g vercel
vercel login
vercel                      # první deploy
vercel --prod               # produkční deploy
```

### 4.2 Environment variables ve Vercel

V dashboardu Vercel → Settings → Environment Variables přidej:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `CONTACT_EMAIL`

### 4.3 Custom doména

V Vercel → Domains přidej `tenisdobrany.cz` a aktualizuj DNS záznamy:

```
A     @    76.76.21.21
CNAME www  cname.vercel-dns.com
```

---

## Fáze 5 — SEO a přechod

### 5.1 Redirecty starých URL

Vytvoř `vercel.json` pro přesměrování legacy URL:

```json
{
  "redirects": [
    { "source": "/aktuality.php", "destination": "/aktuality", "permanent": true },
    { "source": "/kontakt.php", "destination": "/kontakt", "permanent": true },
    { "source": "/index.php", "destination": "/", "permanent": true },
    { "source": "/novinky/:path*", "destination": "/aktuality/:path*", "permanent": true }
  ]
}
```

### 5.2 SEO meta data

- Každá stránka generuje `<title>` a `<meta description>` z databáze (Supabase `pages.meta`).
- Použij Next.js `generateMetadata()` pro dynamické stránky.
- Sitemap generovat automaticky (`next-sitemap` nebo `app/sitemap.ts`).

---

## Upozornění a rizika

### ⚠️ Bezpečnostní rizika (stávající systém)

| Riziko | Závažnost | Doporučení |
|--------|-----------|------------|
| Admin bez autentizace (`/admin` přístupný komukoli!) | **KRITICKÉ** | Před jakoukoli migrací — nasadit alespoň HTTP Basic Auth nebo přidat auth filter v CI4 |
| Debug routes v produkci (`/admin/create-test-sections`) | Vysoká | Odstranit nebo chránit |
| `SUPABASE_SERVICE_ROLE_KEY` nesmí do klienta | Kritické | Používat jen na serveru (Server Actions, API routes) |
| HTML obsah z DB renderován bez sanitizace v PageBuilderu | Střední | V Next.js použít `dangerouslySetInnerHTML` jen pro admin-zadaný obsah, zvážit sanitizaci |

### ⚠️ Datová rizika

| Riziko | Popis |
|--------|-------|
| Duplicity v `(section, key)` | Může způsobit problémy při migraci — zkontrolovat dotazem |
| Tabulka `news` vs. `content` | Mohou existovat duplicitní novinky — konsolidovat před migrací |
| JSON bez validace | `content_json` a `meta_data` mohou obsahovat nevalidní JSON — zkontrolovat |
| `template` pole | Logika renderování závisí na hodnotě `template` — mapovat na React komponenty |

### ⚠️ Funkční rizika

| Riziko | Popis |
|--------|-------|
| RSS a Sitemap nicotrollery | Nejsou implementovány v PHP — v Next.js implementovat nově |
| Kontaktní formulář | Email service v CodeIgniter 4 — v Next.js nahradit Resend nebo Nodemailer |
| Turnaje (`/turnaje`) | Routy existují, controller chybí — v Next.js implementovat nebo vynechat |

---

## Checklist přechodu

### Příprava
- [ ] Záloha MySQL databáze
- [ ] Audit dat (duplicity, prázdné záznamy, nevalidní JSON)
- [ ] Stažení všech obrázků z produkce
- [ ] Zajistit přihlašovací údaje k produkčnímu serveru

### Supabase
- [ ] Vytvořen Supabase projekt
- [ ] Schéma tabulek aplikováno
- [ ] RLS politiky aplikovány
- [ ] Migrační skript otestován lokálně
- [ ] Data úspěšně migrována
- [ ] Obrázky nahrány do Storage
- [ ] Admin uživatel vytvořen v Supabase Auth

### Next.js
- [ ] Projekt inicializován (`create-next-app`)
- [ ] Supabase client konfigurován
- [ ] Autentizace funkční (login, logout, admin check)
- [ ] Veřejný web funkční (homepage, sekce, detail)
- [ ] Admin panel funkční (CRUD obsahu, menu, zápatí)
- [ ] Kontaktní formulář funkční
- [ ] Sitemap + RSS implementovány
- [ ] Metadata (title, description) pro všechny stránky

### Vercel + DNS
- [ ] Projekt nasazen na Vercel
- [ ] Environment variables nastaveny
- [ ] Custom doména přidána a ověřena
- [ ] SSL certifikát aktivní
- [ ] Staré PHP URL přesměrovány

### QA
- [ ] Všechny stránky procházeny a vizuálně zkontrolovány
- [ ] Formuláře testovány
- [ ] Mobile view zkontrolován
- [ ] Core Web Vitals v zeleném pásmu (Vercel Analytics)
- [ ] Google Search Console aktualizována s novou sitemapou
