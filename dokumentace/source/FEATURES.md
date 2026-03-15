# FEATURES.md — Přehled funkcí a návrh zjednodušení

## Stávající funkce v PHP / CodeIgniter 4

---

### 1. Veřejný web (frontend)

#### 1.1 Homepage (PageBuilder systém)
- **Jak funguje:** `Home::index()` načte z DB komponenty sekce `home` a PageBuilder je renderuje v pořadí `sort_order`.
- **Komponenty:**
  | `subsection`      | Popis | Konfigurace (JSON) |
  |-------------------|-------|-------------------|
  | `hero`            | Hero banner s pozadím (slideshow), nadpisem, perexem a CTA tlačítky | slides[], buttons[] |
  | `text_image`      | Sekce "O klubu" — text vlevo/vpravo + obrázek nebo ikona | icon, image_position |
  | `section_cards`   | Dynamické karty sekcí generované z menu | — (čte z DB) |
  | `latest_articles` | Blok s nejnovějšími články ze sekce | source_section, limit, columns |
  | `parallax`        | Parallax proužek (dekorativní) | — |
  | `cta_buttons`     | Blok s výzvou k akci + tlačítka | buttons[] |

#### 1.2 Navigace
- Menu se sestavuje dynamicky z DB (`getMenuStructure()`).
- Podporuje **dvouúrovňové podmenu** (dropdown).
- Každá sekce může mít vlastní `menu_title`, `menu_url`, `menu_order`, `menu_parent_id`.
- Přepínač přihlášen/odhlášen pro členskou sekci.

#### 1.3 Zápatí
- 4 sloupce editovatelné z administrace.
- Column 1: Kontakt (adresa, telefon, email)
- Column 2: Rychlé odkazy (list URL)
- Column 3: Sociální sítě (ikony + URL)
- Column 4: O klubu (krátký text)
- Fallback na statické hodnoty, pokud DB vrátí prázdné výsledky.

#### 1.4 Výpis sekcí / článků
- URL `/{identifier}` → `Page::show($identifier)` — detekuje, zda jde o sekci nebo konkrétní stránku.
- URL `/{sekce}/{clanek}` → `Page::showArticle($section, $articleKey)`.
- Výpis zobrazuje karty článků se stručným popisem.

#### 1.5 Detail článku / stránky
- Zobrazení libovolného záznamu z tabulky `content`.
- Renderer respektuje `content_type` (HTML se renderuje přímo, text se escapuje).
- Chlebíčková navigace (breadcrumb).

#### 1.6 Kontaktní formulář
- Pole: jméno, email, předmět, zpráva.
- Validace na serveru.
- Odesílání emailu přes CodeIgniter Email service.

#### 1.7 RSS Feed
- Route `/rss` → `Feed::rss()` (controller existuje v routách, ale soubor nebyl nalezen — možná plánováno).

#### 1.8 Sitemap
- Route `/sitemap.xml` → `Sitemap::index()` (taktéž plánováno).

---

### 2. CMS Administrace

#### 2.1 Dashboard
- Přehled sekcí s počtem záznamů.
- Přímé linky na správu jednotlivých sekcí.
- **Bez autentizace (vývojový stav)!**

#### 2.2 Správa obsahu (Content Management)
- Seznam záznamů filtrovaný dle sekce.
- Editace záznamu: `title`, `content` (WYSIWYG), `content_json`, `meta_data`, `content_type`, `is_active`, `sort_order`.
- Editace menu polí: `show_in_menu`, `menu_order`, `menu_parent_id`, `menu_url`.
- Validace JSON při uložení.
- Vytvoření nového záznamu.
- Smazání záznamu.

#### 2.3 Správa sekcí
- Formulář pro vytvoření nové sekce (`section_create.php`).
- Validace unikátnosti sekce.

#### 2.4 Správa menu
- Vizuální přehled všech položek sekcí.
- Checkbox `show_in_menu` pro každou položku.
- Nastavení `menu_order` a `menu_parent_id` (výběr rodiče).

#### 2.5 PageBuilder komponenty
- CRUD operace nad komponentami (`page_components`).
- Upload obrázků (endopint `/admin/upload-image`).
- Správa komponent pro jednotlivé stránky.

#### 2.6 Debug / test nástroje (development only)
- `/admin/create-test-sections` — vytvoří testovací sekce.
- `/admin/init-sections` — inicializace výchozích sekcí.
- `/admin/debug-section/{sekce}` — výpis dat sekce.
- `/dev/phpinfo`, `/dev/clear-cache` atd.

---

### 3. Členská sekce (stub — neimplementováno)
- Route `/clenove` — ověří přihlášení, jinak redirect na login.
- Plánované funkce: profil, zápisy ze schůzí, dokumenty.

### 4. Autentizace (stub — neimplementováno)
- `Auth::login()`, `::register()`, `::logout()`, `::forgotPassword()`, `::resetPassword()`, `::activate()` — prázdné metody.
- Logout alespoň smaže session a přesměruje.

### 5. API (plánováno)
- `/api/v1/news` — výpis/detail novinek (GET).
- `/api/v1/news` — create/update/delete novinek (POST/PUT/DELETE).
- `/api/v1/members` — výpis členů.

---

## Návrh zjednodušení pro Next.js + Supabase

### Princip zjednodušení

> **Místo jedné super-tabulky `content` = specializované tabulky + Supabase jako přirozené CMS.**

---

### A. Veřejný web — Next.js App Router

| Stará funkce (PHP)       | Nová implementace (Next.js)           | Zjednodušení |
|--------------------------|--------------------------------------|--------------|
| PageBuilder PHP rendering| React komponenty (statické / RSC)    | Jednoduchý import komponent místo `renderHero()`, `renderTextImage()` atd. |
| PHP Views (layout main)  | `app/layout.tsx` + Next.js Layout    | Standardní Next.js konvence |
| Navigace z DB            | Server Component čte `sections` tabulku, memorizovaný dotaz | Stejná logika, čistší kód |
| Zápatí z DB              | Server Component čte `footer_content`| Stejné, ale oddělená tabulka |
| URL routing (fallback)   | Next.js `app/[section]/page.tsx` + `app/[section]/[slug]/page.tsx` | Nativní file-based routing |
| Kontaktní formulář       | Next.js Server Action + Resend/Nodemailer | Bez extra backendu |
| RSS / Sitemap            | `app/rss.xml/route.ts` + `next-sitemap` | Vestavěné Next.js řešení |
| Čeština v URL (novinky → news) | Middleware nebo jednoduchý mapping objekt | Jednodušší než PHP mapping |

---

### B. CMS Administrace — zjednodušení

Stávající admin je zbytečně komplexní, protože musí pracovat s jednou bohatou tabulkou a JSON polem pro konfiguraci každé komponenty.

#### Navrhovaný přístup: Specializované admin stránky

```
/admin                        → Dashboard
/admin/pages                  → Správa stránek a článků
/admin/pages/new              → Nový článek (výběr sekce)
/admin/pages/[id]/edit        → Editace článku
/admin/sections               → Správa sekcí + menu
/admin/homepage               → Vizuální správa homepage komponent (drag & drop sort)
/admin/footer                 → Editace zápatí (4 sloupce, formulář)
/admin/media                  → Galerie obrázků (Supabase Storage)
/admin/members                → Přehled členů
```

#### Co standardizovat / zjednodušit

| Aktuální komplexita | Zjednodušení |
|---------------------|--------------|
| `content_type` ENUM s 13 hodnotami | Pouze 3 typy: `article` (text/HTML stránka), `component` (homepage blok), `config` (zápatí, nastavení) |
| JSON editor (`content_json`, `meta_data`) v textarei | Formulářová pole mapovaná na JSON — admin nikdy nevidí JSON |
| `section` + `subsection` + `key` + `template` = 4 pole pro adresaci záznamu | Jasné URL slug + tabulka sekce + typ záznamu |
| Menu editace přes checkboxy na záznamu | Sekce mají vlastní tabulku, menu se edituje v dedicated formuláři |
| Hero slide konfigurace přes JSON | Vizuální formulář: přidat slide, přidat tlačítko |
| Upload přes custom endpoint | Next.js Server Action → Supabase Storage |

#### Doporučený CMS stack

- **Jednoduché stránky a NovinKy**: Vlastní Next.js admin s WYSIWYG (TipTap nebo Quill) + Supabase Server Actions
- **Zápatí**: Statický formulář s fixními poli (nemusí být dynamicky přidávatelný)
- **Navigace/Menu**: Drag-and-drop pořadí (např. `@dnd-kit/sortable`) nad tabulkou `sections`
- **Obrázky**: Supabase Storage browser integrovaný do admin panelu

---

### C. Autentizace — Supabase Auth

| Aktuální (stub) | Supabase Auth |
|-----------------|---------------|
| Prázdné PHP metody | Hotová implementace přihlášení emailem/heslem |
| Session v PHP sessio | JWT tokeny + cookies (Next.js middleware) |
| Neimplementované obnovení hesla | Supabase posílá reset email automaticky |
| Aktivace účtu emailem | Supabase email confirmation |
| Role v session | Role v `user_profiles.role` + RLS politiky Supabase |

**Admin ochrana**: Next.js middleware ověří JWT + `user_profiles.role = 'admin'`, jinak redirect na login.

---

### D. Členská sekce

| Funkce | Implementace v Next.js |
|--------|------------------------|
| Přihlášení | Supabase Auth (email + heslo) |
| Profil člena | Formulář editující `user_profiles` |
| Zápisy ze schůzí | Tabulka `meeting_minutes` s PDF nebo obsah v textu |
| Dokumenty ke stažení | Supabase Storage (privátní bucket) + signed URL |

---

### E. Souhrnná architektura nového systému

```
Next.js App (Vercel)
│
├── app/                          # File-based routing
│   ├── layout.tsx                # Root layout (nav + footer z Supabase)
│   ├── page.tsx                  # Homepage (komponenty z page_components)
│   ├── [section]/
│   │   ├── page.tsx              # Výpis článků sekce
│   │   └── [slug]/page.tsx       # Detail článku
│   ├── kontakt/page.tsx          # Kontaktní formulář
│   ├── auth/
│   │   ├── prihlaseni/page.tsx
│   │   └── registrace/page.tsx
│   ├── clenove/                  # Protected route
│   │   └── page.tsx
│   ├── admin/                    # Protected admin route
│   │   ├── layout.tsx            # Admin layout + auth check
│   │   ├── page.tsx              # Dashboard
│   │   ├── pages/
│   │   ├── sections/
│   │   ├── homepage/
│   │   ├── footer/
│   │   └── media/
│   ├── api/
│   │   ├── rss.xml/route.ts
│   │   └── sitemap.xml/route.ts
│   └── not-found.tsx             # 404 stránka
│
├── components/
│   ├── layout/
│   │   ├── Navigation.tsx        # Čte sections z DB
│   │   └── Footer.tsx            # Čte footer_content z DB
│   └── home/
│       ├── HeroSection.tsx
│       ├── AboutSection.tsx
│       ├── SectionCards.tsx
│       ├── LatestArticles.tsx
│       └── CTASection.tsx
│
└── lib/
    ├── supabase/
    │   ├── server.ts             # Supabase server client
    │   └── client.ts             # Supabase browser client
    └── actions/
        ├── content.ts            # Server actions pro CRUD obsahu
        └── auth.ts               # Server actions pro auth
```
