# SCHEMA.md — Databázové schéma

## Přehled tabulek

> **Důležitá poznámka:** Projekt používá extrémně minimalistické schéma — téměř vše je uloženo v jediné tabulce `content`. Tabulka `news` existuje v kódu (NewsModel), ale je pravděpodobně zbytková — novinky jsou primárně v tabulce `content`.

---

## Tabulka: `content`

**Účel:** Univerzální CMS tabulka pro veškerý obsah webu — stránky, novinky, zápatí, menu položky, homepage komponenty i definice sekcí.

### Sloupce

| Sloupec               | Typ                          | Nullable | Výchozí | Popis |
|-----------------------|------------------------------|----------|---------|-------|
| `id`                  | INT(11) UNSIGNED AUTO_INCREMENT | NOT NULL | —      | Primární klíč |
| `section`             | VARCHAR(50)                  | NOT NULL | —       | Logická skupina záznamu (home, footer, news, page, aktuality, …) |
| `subsection`          | VARCHAR(50)                  | NULL     | NULL    | Podskupina v rámci sekce (column1, hero, text_image, …) |
| `key`                 | VARCHAR(100)                 | NOT NULL | —       | Jedinečný klíč v rámci sekce (home-hero, address, about, …) |
| `title`               | VARCHAR(255)                 | NULL     | NULL    | Nadpis / název záznamu |
| `short_text`          | TEXT                         | NULL     | NULL    | Krátký popis / perex (přidán migrací 2025-10-26) |
| `content`             | TEXT                         | NULL     | NULL    | Hlavní obsah (prostý text nebo HTML z WYSIWYG) |
| `content_json`        | JSON                         | NULL     | NULL    | Strukturovaná data (tlačítka, slides, ikony, adresy, …) |
| `content_type`        | ENUM                         | NULL     | 'text'  | Typ obsahu — viz výčet níže |
| `template`            | VARCHAR(100)                 | NULL     | NULL    | Název šablony pro rendering (footer_section_title, footer_links, …) |
| `meta_data`           | JSON                         | NULL     | NULL    | Doplňková metadata (ikony, barvy, odkazy) |
| `is_active`           | TINYINT(1)                   | NOT NULL | 1       | Příznak aktivního záznamu |
| `sort_order`          | INT(11)                      | NOT NULL | 0       | Pořadí záznamu v sekci |
| `parent_id`           | INT(11) UNSIGNED             | NULL     | NULL    | Hierarchie — ID nadřazeného záznamu (samo-referenční FK) |
| `show_in_menu`        | BOOLEAN                      | NOT NULL | FALSE   | Zobrazit v navigaci |
| `show_section_in_menu`| TINYINT(1)                   | NOT NULL | 1       | Zobrazit sekci v hlavním menu |
| `menu_title`          | VARCHAR(255)                 | NULL     | NULL    | Vlastní název v menu (pokud se liší od title) |
| `menu_order`          | INT(11)                      | NOT NULL | 0       | Pořadí v menu |
| `menu_parent_id`      | INT(11)                      | NULL     | NULL    | ID rodiče v menu (pro dropdown podmenu) |
| `menu_url`            | VARCHAR(255)                 | NULL     | NULL    | Explicitní URL pro menu položku |
| `menu_type`           | VARCHAR(?)                   | NULL     | NULL    | Typ menu položky (section_list, article, …) |
| `created_at`          | DATETIME                     | NULL     | NULL    | Datum vytvoření (CodeIgniter timestamps) |
| `updated_at`          | DATETIME                     | NULL     | NULL    | Datum poslední změny |

### Hodnoty `content_type` (ENUM)

| Hodnota      | Použití |
|--------------|---------|
| `text`       | Prostý text |
| `html`       | HTML obsah (WYSIWYG editor) |
| `markdown`   | Markdown text |
| `json`       | Čistě JSON data (bez textového content) |
| `image`      | Obrázek |
| `link`       | Odkaz |
| `email`      | Emailová adresa |
| `phone`      | Telefonní číslo |
| `address`    | Adresa (strukturovaná v content_json) |
| `section`    | Definice sekce (meta-záznam o sekci) |
| `news_list`  | Výpis novinek |
| `page`       | Statická stránka |
| `article`    | Článek v sekci |

### Indexy

| Index                 | Sloupce                    |
|-----------------------|---------------------------|
| PRIMARY KEY           | `id`                      |
| idx_section_subsection| `section`, `subsection`   |
| idx_section_key       | `section`, `key`          |
| idx_sort_order        | `sort_order`              |
| idx_is_active         | `is_active`               |
| idx_menu_items        | `show_in_menu`, `menu_order` |

### Vztahy (samo-reference)

```
content.parent_id     → content.id  (hierarchická struktura stránek)
content.menu_parent_id → content.id (podmenu — parent/child v navigaci)
```

---

## Tabulka: `news` (zbytková / legacy)

**Účel:** Původní samostatná tabulka pro novinky — pravděpodobně nahrazena sekcí `aktuality` v tabulce `content`. Kód v `NewsModel` na ni stále odkazuje, ale v routingu je zakomentována.

| Sloupec        | Typ          | Nullable | Popis |
|----------------|--------------|----------|-------|
| `id`           | INT UNSIGNED | NOT NULL | Primární klíč |
| `title`        | VARCHAR(255) | NOT NULL | Titulek novinky |
| `content`      | TEXT         | NOT NULL | Obsah novinky (HTML) |
| `image`        | VARCHAR(?)   | NULL     | Cesta k obrázku (`assets/images/news/...`) |
| `is_active`    | TINYINT(1)   | NOT NULL | Aktivní příznak |
| `published_at` | DATETIME     | NULL     | Datum publikace |
| `created_at`   | DATETIME     | NULL     | Datum vytvoření |
| `updated_at`   | DATETIME     | NULL     | Datum změny |
| `deleted_at`   | DATETIME     | NULL     | Soft delete |

---

## Vztahy mezi tabulkami

```
content (id) ←──── content (parent_id)        [hierarchie stránek]
content (id) ←──── content (menu_parent_id)   [podmenu v navigaci]
```

Tabulky `content` a `news` nejsou propojeny cizím klíčem — jsou paralelní systémy pro stejný typ dat.

---

## Jak se používají sekce v tabulce `content`

| `section`    | `content_type`  | Popis dat |
|--------------|-----------------|-----------|
| `home`       | html, json      | Homepage komponenty (hero, about, features, news, cta) — `subsection` určuje typ komponenty |
| `footer`     | text, address, link | Zápatí webu — `subsection` = column1–4, `template` určuje rendering |
| `aktuality`  | article, section | Novinky / aktuality klubu |
| `news`       | article, section | (legacy) Novinky |
| `page`       | article, html, section | Statické stránky |
| `tournaments`| article, section | (plánováno) Turnaje |
| `documents`  | article          | (plánováno) Dokumenty pro členy |

---

## Navrhované schéma pro PostgreSQL / Supabase

Místo jedné bohaté tabulky navrhujeme **denormalizaci do 6 specializovaných tabulek**, přičemž zachováme JSON flexibilitu pro metadata.

### `pages` — Statické stránky a články

```sql
CREATE TABLE pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section     TEXT NOT NULL,               -- 'news', 'about', 'tournaments', …
  slug        TEXT NOT NULL,               -- URL-friendly klíč (unikátní v sekci)
  title       TEXT NOT NULL,
  excerpt     TEXT,                        -- short_text / perex
  content     TEXT,                        -- HTML nebo Markdown
  content_data JSONB,                      -- strukturovaná data (náhrada content_json)
  meta        JSONB,                       -- metadata (náhrada meta_data)
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section, slug)
);
```

### `sections` — Definice sekcí (nav, menu, zobrazení)

```sql
CREATE TABLE sections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT UNIQUE NOT NULL,     -- internal name ('news', 'about', …)
  title               TEXT NOT NULL,
  menu_title          TEXT,
  menu_url            TEXT,
  menu_order          INT NOT NULL DEFAULT 0,
  menu_parent_id      UUID REFERENCES sections(id),
  show_in_menu        BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `page_components` — Homepage a dynamické stránky (PageBuilder)

```sql
CREATE TABLE page_components (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key     TEXT NOT NULL,            -- 'home', nebo slug stránky
  component    TEXT NOT NULL,            -- typ komponenty: 'hero', 'text_image', 'cta', …
  title        TEXT,
  excerpt      TEXT,
  content      TEXT,
  data         JSONB,                    -- tlačítka, slides, ikony, konfigurace
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `footer_content` — Zápatí webu

```sql
CREATE TABLE footer_content (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key   TEXT NOT NULL,            -- 'contact', 'links', 'social', 'about'
  item_type    TEXT NOT NULL,            -- 'heading', 'address', 'links_list', 'social_links', 'text'
  content      TEXT,
  data         JSONB,                    -- strukturovaná data (adresy, linky, ikony)
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `users` — Uživatelé (Supabase Auth)

```sql
-- Rozšíření auth.users z Supabase Auth
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'member',  -- 'admin', 'member'
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `media` — Obrázky a soubory (Supabase Storage)

```sql
CREATE TABLE media (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket       TEXT NOT NULL DEFAULT 'images',
  path         TEXT NOT NULL,           -- cesta v Supabase Storage
  filename     TEXT NOT NULL,
  mime_type    TEXT,
  size_bytes   INT,
  alt_text     TEXT,
  uploaded_by  UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Upozornění při migraci

1. **ENUM → TEXT + CHECK**: PostgreSQL nepodporuje ENUM stejně jako MySQL. Nahradit `ENUM` za `TEXT` + `CHECK` constraint nebo lookup tabulku.

2. **JSON → JSONB**: Použít PostgreSQL `JSONB` místo `JSON` — lepší výkon, indexovatelné.

3. **Samo-reference v menu**: Stávající `menu_parent_id` bude v novém schématu na tabulce `sections`, kde se jednoduše propojí.

4. **Data ze dvou systémů**: Novinky jsou jak v tabulce `news` (old), tak v `content` sekce `aktuality` (new). Před migrací je nutné konsolidovat a deduplikovat.

5. **`template` pole**: Logika výběru šablony je v PHP kódu. V Next.js bude nahrazena komponentami — `template` hodnota se mapuje na React komponentu.

6. **Obrázky**: Aktuálně jsou obrázky na disku serveru v `public/assets/images/`. V novém systému budou v Supabase Storage.

7. **`section` + `key` není UNIQUE**: V MySQL chybí unikátní constraint na `(section, key)` — může existovat více záznamů se stejným klíčem. Před migrací je nutná kontrola duplicit.

8. **`sort_order` a `menu_order` jsou oddělené**: Pořadí v sekci a pořadí v menu jsou různá čísla — v novém schématu zůstanou separátní.
