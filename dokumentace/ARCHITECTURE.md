# Architektura — Tenis Dobřany (Next.js + Supabase)

> Vygenerováno na základě source dokumentace (CONTEXT, SCHEMA, FEATURES, MIGRATION, DESIGN).
> Verze: 1.0 | Datum: 2026-03-15

---

## 1. Finální PostgreSQL schéma pro Supabase

### 1.0 Vlastní typy

```sql
-- Vytvoř jako první — ostatní tabulky na ně odkazují
CREATE TYPE public.app_role AS ENUM ('member', 'manager', 'admin');
CREATE TYPE public.content_type AS ENUM ('article', 'html', 'markdown');
```

### 1.1 `sections` — Sekce webu + navigace

```sql
CREATE TABLE public.sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,           -- 'aktuality', 'turnaje', 'o-klubu'
  title           TEXT NOT NULL,
  description     TEXT,                           -- popis sekce (volitelný)
  menu_title      TEXT,                           -- vlastní název v menu (null = použije title)
  menu_url        TEXT,                           -- explicitní URL (null = /slug)
  menu_order      INT NOT NULL DEFAULT 0,
  menu_parent_id  UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  show_in_menu    BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sections_menu ON public.sections (show_in_menu, menu_order)
  WHERE is_active = true;
```

### 1.2 `pages` — Stránky a články

```sql
CREATE TABLE public.pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id      UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  excerpt         TEXT,                           -- perex / krátký popis
  content         TEXT,                           -- HTML nebo Markdown tělo
  content_type    public.content_type NOT NULL DEFAULT 'html',
  image_url       TEXT,                           -- náhledový obrázek
  meta            JSONB DEFAULT '{}',             -- SEO title, description, og:image
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_members_only BOOLEAN NOT NULL DEFAULT false, -- viditelné jen pro přihlášené členy
  sort_order      INT NOT NULL DEFAULT 0,
  published_at    TIMESTAMPTZ DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id, slug)
);

CREATE INDEX idx_pages_section ON public.pages (section_id, sort_order)
  WHERE is_active = true;
CREATE INDEX idx_pages_published ON public.pages (published_at DESC)
  WHERE is_active = true;
```

### 1.3 `page_components` — PageBuilder komponenty

```sql
CREATE TABLE public.page_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key        TEXT NOT NULL DEFAULT 'home',   -- 'home' nebo slug stránky
  component       TEXT NOT NULL,                  -- 'hero','text_image','section_cards',
                                                  -- 'latest_articles','parallax','cta_buttons'
  title           TEXT,
  subtitle        TEXT,
  content         TEXT,
  data            JSONB DEFAULT '{}',             -- slides[], buttons[], konfigurace
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_components_page ON public.page_components (page_key, sort_order)
  WHERE is_active = true;
```

### 1.4 `footer_content` — Zápatí webu

```sql
CREATE TABLE public.footer_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key      TEXT NOT NULL
                  CHECK (column_key IN ('contact', 'links', 'social', 'about')),
  item_type       TEXT NOT NULL,                  -- 'heading','address','links_list',
                                                  -- 'social_links','text','phone','email'
  label           TEXT,                           -- viditelný popisek
  content         TEXT,                           -- textový obsah
  data            JSONB DEFAULT '{}',             -- strukturovaná data (ikony, URL, adresy)
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_footer_column ON public.footer_content (column_key, sort_order)
  WHERE is_active = true;
```

### 1.5 `user_profiles` — Rozšíření Supabase Auth

```sql
CREATE TABLE public.user_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  phone           TEXT,
  role            public.app_role NOT NULL DEFAULT 'member',
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.6 `media` — Katalog médií (soubory v Supabase Storage)

```sql
CREATE TABLE public.media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket          TEXT NOT NULL DEFAULT 'images',
  path            TEXT NOT NULL,                  -- cesta v Supabase Storage
  filename        TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      INT,
  alt_text        TEXT,
  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_bucket ON public.media (bucket, created_at DESC);
```

### 1.7 `documents` — Dokumenty pro členy (zápisy, soubory)

```sql
CREATE TABLE public.documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  file_url        TEXT NOT NULL,                  -- signed URL nebo Storage path
  category        TEXT NOT NULL DEFAULT 'general',-- 'minutes','rules','other'
  is_active       BOOLEAN NOT NULL DEFAULT true,
  published_at    TIMESTAMPTZ DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_category ON public.documents (category, published_at DESC)
  WHERE is_active = true;
```

### 1.8 `site_settings` — Globální nastavení webu

```sql
CREATE TABLE public.site_settings (
  key             TEXT PRIMARY KEY,               -- 'site_name','contact_email','ga_id'
  value           TEXT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.9 Auto-update `updated_at` trigger

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplikuj na všechny tabulky s updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.page_components
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### 1.10 Auto-create `user_profiles` po registraci

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### ER diagram (zjednodušený)

```
auth.users
    │ 1:1
    ▼
user_profiles (role: member|manager|admin)
    │
    │ created_by (FK)
    ▼
┌─────────┐    ┌──────────────────┐    ┌─────────────────┐
│ sections │◄───│ pages            │    │ page_components  │
│          │    │ (is_members_only)│    │ (page_key=home)  │
└─────────┘    └──────────────────┘    └─────────────────┘

┌─────────────────┐    ┌───────┐    ┌───────────────┐
│ footer_content   │    │ media │    │ documents     │
└─────────────────┘    └───────┘    │ (members only)│
                                    └───────────────┘
┌───────────────┐
│ site_settings │
└───────────────┘
```

---

## 2. RLS politiky (4 role)

### Matice oprávnění

| Tabulka            | Visitor (anon) | Member            | Manager           | Admin             |
|--------------------|----------------|-------------------|-------------------|-------------------|
| `sections`         | SELECT active  | SELECT active     | SELECT/INSERT/UPDATE | ALL            |
| `pages`            | SELECT public  | SELECT + members  | SELECT/INSERT/UPDATE/DELETE | ALL     |
| `page_components`  | SELECT active  | SELECT active     | SELECT/INSERT/UPDATE/DELETE | ALL     |
| `footer_content`   | SELECT active  | SELECT active     | SELECT/INSERT/UPDATE | ALL            |
| `user_profiles`    | —              | SELECT own        | SELECT own        | ALL               |
| `media`            | SELECT         | SELECT            | SELECT/INSERT/DELETE | ALL            |
| `documents`        | —              | SELECT active     | SELECT/INSERT/UPDATE/DELETE | ALL     |
| `site_settings`    | SELECT         | SELECT            | SELECT/UPDATE     | ALL               |

### Helper funkce pro role

```sql
-- Vrací roli aktuálního uživatele (nebo NULL pro anonymního)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role AS $$
  SELECT role FROM public.user_profiles
  WHERE id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Zkratky pro kontrolu rolí (kaskádové — admin má vždy práva managera atd.)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN AS $$
  SELECT public.current_user_role() IN ('manager', 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_authenticated_member()
RETURNS BOOLEAN AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_active = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### 2.1 `sections`

```sql
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Visitor + Member: čtení aktivních
CREATE POLICY "sections: public read"
  ON public.sections FOR SELECT
  USING (is_active = true);

-- Manager: plná správa
CREATE POLICY "sections: manager write"
  ON public.sections FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());
```

### 2.2 `pages`

```sql
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- Visitor: pouze veřejné aktivní stránky
CREATE POLICY "pages: public read"
  ON public.pages FOR SELECT
  USING (
    is_active = true
    AND is_members_only = false
  );

-- Member: veřejné + members-only
CREATE POLICY "pages: member read"
  ON public.pages FOR SELECT
  USING (
    is_active = true
    AND public.is_authenticated_member()
  );

-- Manager: plný CRUD
CREATE POLICY "pages: manager write"
  ON public.pages FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());
```

### 2.3 `page_components`

```sql
ALTER TABLE public.page_components ENABLE ROW LEVEL SECURITY;

-- Visitor + Member: čtení aktivních
CREATE POLICY "components: public read"
  ON public.page_components FOR SELECT
  USING (is_active = true);

-- Manager: plná správa
CREATE POLICY "components: manager write"
  ON public.page_components FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());
```

### 2.4 `footer_content`

```sql
ALTER TABLE public.footer_content ENABLE ROW LEVEL SECURITY;

-- Visitor + Member: čtení
CREATE POLICY "footer: public read"
  ON public.footer_content FOR SELECT
  USING (is_active = true);

-- Manager: správa
CREATE POLICY "footer: manager write"
  ON public.footer_content FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());
```

### 2.5 `user_profiles`

```sql
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Member: čtení vlastního profilu
CREATE POLICY "profiles: own read"
  ON public.user_profiles FOR SELECT
  USING (id = auth.uid());

-- Member: úprava vlastního profilu (kromě role!)
CREATE POLICY "profiles: own update"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid()));

-- Admin: plný přístup ke všem profilům
CREATE POLICY "profiles: admin all"
  ON public.user_profiles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
```

### 2.6 `media`

```sql
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Všichni: čtení (obrázky jsou veřejné)
CREATE POLICY "media: public read"
  ON public.media FOR SELECT
  USING (true);

-- Manager: upload a mazání
CREATE POLICY "media: manager write"
  ON public.media FOR INSERT
  WITH CHECK (public.is_manager_or_above());

CREATE POLICY "media: manager delete"
  ON public.media FOR DELETE
  USING (public.is_manager_or_above());
```

### 2.7 `documents`

```sql
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Member: čtení aktivních dokumentů
CREATE POLICY "documents: member read"
  ON public.documents FOR SELECT
  USING (is_active = true AND public.is_authenticated_member());

-- Manager: plná správa
CREATE POLICY "documents: manager write"
  ON public.documents FOR ALL
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());
```

### 2.8 `site_settings`

```sql
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Všichni: čtení
CREATE POLICY "settings: public read"
  ON public.site_settings FOR SELECT
  USING (true);

-- Manager: úprava hodnot
CREATE POLICY "settings: manager update"
  ON public.site_settings FOR UPDATE
  USING (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());

-- Admin: vkládání nových klíčů a mazání
CREATE POLICY "settings: admin insert"
  ON public.site_settings FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "settings: admin delete"
  ON public.site_settings FOR DELETE
  USING (public.is_admin());
```

### 2.9 Supabase Storage politiky

```sql
-- Bucket: images (veřejný)
-- V Supabase Dashboard → Storage → images → Policies

-- SELECT: veřejné
CREATE POLICY "images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');

-- INSERT: manager+
CREATE POLICY "images: manager upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'images' AND public.is_manager_or_above());

-- DELETE: manager+
CREATE POLICY "images: manager delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'images' AND public.is_manager_or_above());

-- Bucket: documents (privátní — jen pro členy)
CREATE POLICY "docs: member read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND public.is_authenticated_member());

CREATE POLICY "docs: manager upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND public.is_manager_or_above());
```

---

## 3. Doporučení CMS

### Verdikt: Vlastní admin panel v Next.js

| Řešení | Pro | Proti | Vhodnost |
|--------|-----|-------|----------|
| **Vlastní admin (doporučeno)** | Plná kontrola, žádná závislost, přesně na míru, jednoduchý deploy na Vercel | Více práce na začátku | ★★★★★ |
| Payload CMS | Hotový CMS, vizuální editor | Vlastní server (Node.js), nelze na Vercel serverless, složitá integrace se Supabase Auth | ★★☆☆☆ |
| Sanity / Contentful | Hostované, hot-reload preview | Vendor lock-in, data mimo Supabase, platba za usage, duplicitní zdroj pravdy | ★★☆☆☆ |
| Supabase Studio | Už existuje, zero effort | Nepoužitelné pro netechnické uživatele, žádné formuláře | ★☆☆☆☆ |

### Proč vlastní admin:

1. **Data jsou už v Supabase** — nepotřebujete druhý backend
2. **Shadcn/ui** poskytuje hotové formulářové komponenty (input, select, textarea, dialog, table)
3. **TipTap editor** je moderní WYSIWYG s React integrací, podporuje obrázky, formátování, tabulky
4. **Server Actions** v Next.js eliminují potřebu psát API routes — formulář → `action` → Supabase
5. **Admin layout** s navigation guardem je 20 řádků kódu díky Supabase middleware
6. **Přenositelnost** — admin komponenty (PageEditor, MediaUpload, SortableList) jsou znovupoužitelné pro další weby

### Doporučený stack pro admin:

| Účel | Balíček |
|------|---------|
| UI komponenty | `shadcn/ui` (už v projektu) |
| Formuláře | `react-hook-form` + `zod` |
| WYSIWYG editor | `@tiptap/react` + `@tiptap/starter-kit` |
| Drag & drop řazení | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Upload obrázků | Server Action → Supabase Storage |
| Tabulky s filtrací | `@tanstack/react-table` (volitelné) |

---

## 4. Struktura Next.js projektu

```
tenis-dobrany/
├── app/
│   ├── layout.tsx                          # Root layout: <html>, fonty, nav, footer
│   ├── page.tsx                            # Homepage (čte page_components)
│   ├── not-found.tsx                       # 404 stránka
│   ├── error.tsx                           # Error boundary
│   │
│   ├── (web)/                              # Route group — veřejný web
│   │   ├── [section]/
│   │   │   ├── page.tsx                    # Výpis článků sekce
│   │   │   └── [slug]/
│   │   │       └── page.tsx                # Detail článku
│   │   └── kontakt/
│   │       └── page.tsx                    # Kontaktní formulář
│   │
│   ├── (auth)/                             # Route group — autentizace
│   │   ├── prihlaseni/
│   │   │   └── page.tsx                    # Login (email + Google OAuth)
│   │   ├── registrace/
│   │   │   └── page.tsx                    # Registrace
│   │   ├── zapomenute-heslo/
│   │   │   └── page.tsx                    # Reset hesla
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts                # OAuth callback handler
│   │
│   ├── (members)/                          # Route group — členská sekce
│   │   ├── layout.tsx                      # Auth guard: jen přihlášení
│   │   └── clenove/
│   │       ├── page.tsx                    # Členský dashboard
│   │       ├── profil/
│   │       │   └── page.tsx                # Editace profilu
│   │       └── dokumenty/
│   │           └── page.tsx                # Dokumenty ke stažení
│   │
│   ├── admin/                              # Admin panel
│   │   ├── layout.tsx                      # Auth guard: role manager|admin
│   │   ├── page.tsx                        # Dashboard (přehled sekcí, počty)
│   │   ├── stranky/
│   │   │   ├── page.tsx                    # Seznam stránek/článků
│   │   │   ├── novy/
│   │   │   │   └── page.tsx                # Nový článek
│   │   │   └── [id]/
│   │   │       └── page.tsx                # Editace článku
│   │   ├── sekce/
│   │   │   └── page.tsx                    # Správa sekcí + menu pořadí
│   │   ├── homepage/
│   │   │   └── page.tsx                    # Správa homepage komponent
│   │   ├── zapati/
│   │   │   └── page.tsx                    # Editace zápatí
│   │   ├── media/
│   │   │   └── page.tsx                    # Galerie médií (upload, mazání)
│   │   ├── dokumenty/
│   │   │   └── page.tsx                    # Správa členských dokumentů
│   │   ├── uzivatele/                      # Jen admin role
│   │   │   └── page.tsx                    # Správa uživatelů a rolí
│   │   └── nastaveni/                      # Jen admin role
│   │       └── page.tsx                    # site_settings editor
│   │
│   ├── sitemap.ts                          # Dynamická sitemap (Next.js built-in)
│   └── robots.ts                           # robots.txt (Next.js built-in)
│
├── components/
│   ├── layout/
│   │   ├── Navigation.tsx                  # Hlavní navigace (Server Component)
│   │   ├── MobileMenu.tsx                  # Mobilní hamburger menu (Client)
│   │   └── Footer.tsx                      # Zápatí (Server Component)
│   │
│   ├── home/                               # Homepage sekce
│   │   ├── HeroSection.tsx
│   │   ├── TextImageSection.tsx
│   │   ├── SectionCards.tsx
│   │   ├── LatestArticles.tsx
│   │   ├── ParallaxSection.tsx
│   │   └── CTASection.tsx
│   │
│   ├── content/                            # Sdílené obsahové komponenty
│   │   ├── ArticleCard.tsx                 # Karta článku ve výpisu
│   │   ├── ArticleDetail.tsx               # Šablona detailu článku
│   │   ├── Breadcrumb.tsx
│   │   └── RichContent.tsx                 # Bezpečné renderování HTML/MD
│   │
│   ├── admin/                              # Admin komponenty
│   │   ├── AdminSidebar.tsx
│   │   ├── PageEditor.tsx                  # Formulář + TipTap editor
│   │   ├── ComponentEditor.tsx             # Editace homepage komponent
│   │   ├── SectionManager.tsx              # Drag-and-drop sekce
│   │   ├── FooterEditor.tsx
│   │   ├── MediaUploader.tsx               # Upload do Supabase Storage
│   │   ├── MediaGallery.tsx                # Grid obrázků s výběrem
│   │   └── UserManager.tsx                 # Tabulka uživatelů + change role
│   │
│   ├── auth/                               # Auth formuláře
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   └── ResetPasswordForm.tsx
│   │
│   └── ui/                                 # shadcn/ui komponenty
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       └── ...
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                       # createBrowserClient (Client Components)
│   │   └── server.ts                       # createServerClient (Server Components)
│   │
│   ├── actions/                            # Next.js Server Actions
│   │   ├── pages.ts                        # CRUD stránky/články
│   │   ├── sections.ts                     # CRUD sekce
│   │   ├── components.ts                   # CRUD homepage komponenty
│   │   ├── footer.ts                       # CRUD zápatí
│   │   ├── media.ts                        # Upload/delete média
│   │   ├── auth.ts                         # Login, register, logout
│   │   └── contact.ts                      # Odeslání kontaktního formuláře
│   │
│   ├── queries/                            # Supabase dotazy (read-only, pro Server Components)
│   │   ├── sections.ts                     # getSections(), getMenuStructure()
│   │   ├── pages.ts                        # getPagesBySection(), getPageBySlug()
│   │   ├── components.ts                   # getHomeComponents()
│   │   ├── footer.ts                       # getFooterContent()
│   │   └── documents.ts                    # getDocuments()
│   │
│   ├── types/
│   │   └── database.ts                     # Supabase generated types (npx supabase gen types)
│   │
│   └── utils/
│       ├── cn.ts                           # className merge helper (tailwind-merge + clsx)
│       └── constants.ts                    # Mapování komponent, konfigurační konstanty
│
├── middleware.ts                            # Supabase session refresh + route protection
│
├── public/
│   ├── images/                             # Statické obrázky (logo, ikony)
│   └── fonts/
│
├── dokumentace/                            # Projektová dokumentace
│   ├── source/                             # Zdrojová dokumentace (PHP audit)
│   └── ARCHITECTURE.md                     # ← tento soubor
│
├── .env.local                              # Environment variables
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Klíčová rozhodnutí ve struktuře:

| Rozhodnutí | Důvod |
|------------|-------|
| Route groups `(web)`, `(auth)`, `(members)` | Oddělené layouty a auth guards bez vlivu na URL |
| `lib/queries/` oddělené od `lib/actions/` | Queries = read-only pro RSC, Actions = mutace s `'use server'` |
| `components/admin/` | Admin UI je odděleno, nebude v client bundle veřejného webu |
| Homepage mimo route group | `/` stránka má vlastní layout, nepotřebuje `[section]` fallback |
| `middleware.ts` v root | Supabase session refresh na každém requestu |

---

## 5. Pořadí implementace

### Fáze 1 — Základ (auth + schéma)

> Cíl: Fungující přihlášení a prázdná databáze připravená na data.

| # | Úkol | Detail |
|---|------|--------|
| 1.1 | Spustit SQL schéma v Supabase | Všechny CREATE TABLE + typy + triggery z bodu 1 |
| 1.2 | Spustit RLS politiky | Všechny ALTER TABLE + CREATE POLICY z bodu 2 |
| 1.3 | Vytvořit Storage buckety | `images` (public), `documents` (private) |
| 1.4 | Nastavit Supabase Auth | Zapnout Email/Password + Google OAuth provider |
| 1.5 | Vygenerovat TypeScript typy | `npx supabase gen types typescript --project-id <id> > lib/types/database.ts` |
| 1.6 | Nastavit middleware.ts | Session refresh + route protection (hotovo ✅) |
| 1.7 | Auth stránky | Login + Register + Logout + OAuth callback |
| 1.8 | Vytvořit prvního admin uživatele | Registrace + manuální `UPDATE user_profiles SET role = 'admin'` |

### Fáze 2 — Veřejný web (read-only)

> Cíl: Návštěvník vidí homepage, sekce, články, navigaci, zápatí.

| # | Úkol | Detail |
|---|------|--------|
| 2.1 | Root layout + globální styly | Tailwind setup, fonty, `<html lang="cs">` |
| 2.2 | Navigation component | Server Component čte `sections`, renderuje menu |
| 2.3 | Footer component | Server Component čte `footer_content` |
| 2.4 | Homepage | Čte `page_components`, renderuje dynamicky dle `component` typu |
| 2.5 | Homepage komponenty | HeroSection, TextImageSection, SectionCards, LatestArticles, CTASection |
| 2.6 | `[section]/page.tsx` | Výpis článků v sekci (karty, stránkování) |
| 2.7 | `[section]/[slug]/page.tsx` | Detail článku (breadcrumb, obsah, metadata) |
| 2.8 | Kontaktní formulář | Server Action → Resend/email |
| 2.9 | SEO | `generateMetadata()`, `sitemap.ts`, `robots.ts` |
| 2.10| 404 + Error page | `not-found.tsx`, `error.tsx` |

### Fáze 3 — Admin panel (CMS)

> Cíl: Manager může spravovat celý obsah webu.

| # | Úkol | Detail |
|---|------|--------|
| 3.1 | Admin layout + sidebar | Auth guard, navigace adminu |
| 3.2 | Admin dashboard | Přehled sekcí, počty článků, rychlé akce |
| 3.3 | Správa stránek/článků | Seznam + editor (TipTap WYSIWYG) + create/edit/delete |
| 3.4 | Správa sekcí | CRUD sekcí, drag-and-drop pořadí v menu |
| 3.5 | Správa homepage | Editor komponent, pořadí, konfigurace |
| 3.6 | Správa zápatí | Formuláře pro 4 sloupce |
| 3.7 | Galerie médií | Upload do Supabase Storage, výběr obrázku v editoru |
| 3.8 | Správa uživatelů (admin only) | Tabulka uživatelů, změna role, deaktivace |

### Fáze 4 — Členská sekce

> Cíl: Přihlášený člen vidí dokumenty, svůj profil.

| # | Úkol | Detail |
|---|------|--------|
| 4.1 | Members layout + guard | Redirect nepřihlášených na login |
| 4.2 | Členský dashboard | Přehled, novinky pro členy |
| 4.3 | Profil člena | Editace jména, telefonu, avataru |
| 4.4 | Dokumenty | Seznam + stahování (signed URLs) |
| 4.5 | Správa dokumentů v adminu | Upload PDF, nastavení kategorie |

### Fáze 5 — Migrace dat + go-live

> Cíl: Přenos dat ze stávajícího webu, nasazení.

| # | Úkol | Detail |
|---|------|--------|
| 5.1 | Audit MySQL dat | Duplicity, nevalidní JSON, prázdné záznamy |
| 5.2 | Migrační skript | Node.js skript: MySQL → Supabase (viz MIGRATION.md) |
| 5.3 | Migrace obrázků | Upload do Supabase Storage |
| 5.4 | Vercel production deploy | Environment variables, custom doména |
| 5.5 | DNS přepnutí | Cloudflare → Vercel |
| 5.6 | Redirecty starých URL | `vercel.json` nebo `next.config.ts` redirects |
| 5.7 | QA testování | Všechny stránky, formuláře, mobile, Core Web Vitals |

### Fáze 6 — Rezervační systém (budoucnost)

> Oddělený modul, univerzálně použitelný pro další oddíly.

| # | Úkol | Detail |
|---|------|--------|
| 6.1 | Schéma: `courts`, `reservations`, `time_slots` | Samostatné tabulky, FK na `user_profiles` |
| 6.2 | Kalendářový widget | Výběr dne → výběr kurtu → výběr hodiny |
| 6.3 | RLS pro rezervace | Člen: vlastní rezervace, Manager: všechny |
| 6.4 | Admin: správa kurtů a slotů | Konfigurace provozní doby, počtu kurtů |

---

## Shrnutí

| Oblast | Řešení |
|--------|--------|
| Databáze | 8 tabulek v Supabase PostgreSQL (místo 1 god-table) |
| Role | 4 úrovně: Visitor → Member → Manager → Admin (ENUM + RLS helper funkce) |
| RLS | Kaskádové — admin dědí práva managera, manager dědí práva membera |
| CMS | Vlastní admin v Next.js + shadcn/ui + TipTap (žádná externí závislost) |
| Auth | Supabase Auth (email/heslo + Google OAuth) |
| Storage | Supabase Storage: `images` (public), `documents` (private) |
| Hosting | Vercel (serverless, Edge middleware) |
| Priorita | Auth → Veřejný web → Admin CMS → Členská sekce → Migrace → Rezervace |
