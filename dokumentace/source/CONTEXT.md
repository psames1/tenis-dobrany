# CONTEXT.md — Tenisový oddíl TJ Dobřany

## Účel projektu

Web tenisového oddílu **TJ Dobřany, z.s.** — spolkový web lokálního sportovního klubu se sídlem v Dobřanech u Plzně. Klub byl founded v roce 1964, provozuje areál „Džungle". Web slouží jako informační portál pro veřejnost a budoucí členy + jako platforma pro správu obsahu (CMS) administrátorem.

---

## Technologie (současná)

| Vrstva       | Technologie                    |
|--------------|-------------------------------|
| Backend      | PHP 8.x, CodeIgniter 4        |
| Databáze     | MySQL (InnoDB)                |
| Frontend     | PHP Views (Blade-like), CSS, Font Awesome 6 |
| Editor       | WYSIWYG (vlastní, složka Wysivig_editor/) |
| Hosting      | Laragon (dev), produkce nezjištěna |
| Verzování    | Git                           |
| Testy        | PHPUnit                       |

## Nová cílová technologie

| Vrstva       | Technologie                    |
|--------------|-------------------------------|
| Frontend     | Next.js 14+ (App Router)      |
| Backend/API  | Next.js API Routes + Server Actions |
| Databáze     | Supabase (PostgreSQL)         |
| Auth         | Supabase Auth                 |
| Media storage| Supabase Storage              |
| Hosting      | Vercel                        |
| CMS Admin    | Vlastní Next.js admin / nebo Supabase Studio jako základ |

---

## Uživatelské role

### Aktuální stav v PHP projektu

| Role        | Stav implementace | Popis |
|-------------|-------------------|-------|
| **Visitor** | ✅ Hotovo         | Čte veřejný obsah webu |
| **Admin**   | ⚠️ Bez auth       | Přistupuje na `/admin`, edituje veškerý obsah. **Pozor: v kódu chybí autentizace na admin routách!** |
| **Member**  | 🚧 Stub           | Členská sekce (`/clenove`) — controller existuje, funkce nejsou implementovány |

### Plánované role pro nový web

| Role        | Oprávnění |
|-------------|-----------|
| **Visitor** | Čtení veškerého veřejného obsahu |
| **Admin**   | Plná správa obsahu, sekcí, menu, zápatí, obrázků |
| **Member**  | Přihlášení, zobrazení zápisů ze schůzí, dokumentů pro členy |

---

## Struktura webu (veřejná část)

```
/                          → Homepage (hero, o klubu, sekce, novinky, CTA)
/kontakt                   → Kontaktní formulář
/{sekce}                   → Výpis článků v sekci (novinky, turnaje, ...)
/{sekce}/{clanek}          → Detail článku
/clenove                   → Členská sekce (vyžaduje přihlášení)
/auth/prihlaseni           → Přihlášení
/auth/registrace           → Registrace
/rss                       → RSS feed
/sitemap.xml               → Sitemap
```

## Admin část

```
/admin                     → Dashboard (přehled sekcí a počtů záznamů)
/admin/content/{sekce}     → Seznam záznamů v sekci
/admin/edit/{id}           → Editace záznamu
/admin/create              → Vytvoření nového záznamu
/admin/create-section      → Vytvoření nové sekce
/admin/menu                → Správa navigačního menu
/admin/components/{sekce}  → Správa komponent (PageBuilder)
/admin/edit-component/{id} → Editace komponenty
/admin/upload-image        → Upload obrázku
```

---

## Klíčové charakteristiky projektu

1. **Vše v jedné tabulce** — celý obsah webu (stránky, novinky, zápatí, menu, homepage komponenty) je uložen v tabulce `content`. Toto je největší architektonická zvláštnost projektu.

2. **PageBuilder** — systém skládání stránek z komponent. Každá komponenta má typ (`subsection`) a svoji rendering metodu v PHP. Na homepage je 6 komponent (hero, text+obrázek, karty sekcí, novinky, parallax, CTA).

3. **Dynamické menu** — menu se sestavuje za běhu z DB dotazu (`getMenuStructure()`), podporuje podmenu (parent/child záznamy).

4. **Editovatelné zápatí** — zápatí má 4 sloupce (kontakt, odkazy, sociální sítě, o klubu), vše editovatelné přes admin.

5. **Univerzální routing** — `(/(:any))` fallback zachycuje všechny URL a předává je `Page::show()`, který rozhoduje, zda jde o stránku nebo sekci.

6. **Dvojí model pro novinky** — existuje jak `NewsModel` (tabulka `news`), tak novinky ukládané do tabulky `content` (sekce `aktuality`). **Jde o nedokončenou migraci.**

7. **Chybějící autentizace** — `Auth` a `Members` controllery jsou prázdné stuby. Admin je přístupný bez hesla.

8. **Uživatelské role (cílový stav)**

| Role | Popis | Přístup |
|---|---|---|
| Visitor | Nepřihlášený návštěvník | Veřejné stránky, aktuality |
| Member | Přihlášený člen klubu | + Členská sekce, rezervace kurtů |
| Manager | Správce obsahu | + CMS, články, galerie, správa rezervací |
| Admin | Správce systému | + Správa uživatelů, rolí, nastavení webu |

**Poznámky k architektuře**
- Stávající struktura a design se nemusí úplně dodržet
- Cíl: zjednodušit a standardizovat, admin část je teď až moc komplikovaná
- Supabase Auth: Google OAuth + email/heslo
- RLS politiky pro každou roli v Supabase

9. **Rezervační systém** - na zarezervování kurtu hráčem na určitý den, hodinu a výběr kurtu z 1-n kurtů - využít přihlášení na stránky, ale jinak oddělit jako samostatný univerzálně použitelný rezervační systém i pro jiné oddíly - trochu obecnější definice. To necháme až na konec.


## Cílový tech stack
- Frontend + API: Next.js 14 (App Router, TypeScript)
- Databáze: Supabase (PostgreSQL)
- Auth: Supabase Auth (Google OAuth + email/heslo)
- Hosting: Vercel
- Správa domény: Cloudflare DNS
- Styling: Tailwind CSS + Shadcn/ui

## Uživatelské role (cílový stav)
| Role | Popis | Přístup |
|---|---|---|
| Visitor | Nepřihlášený návštěvník | Veřejné stránky, aktuality |
| Member | Přihlášený člen klubu | + Členská sekce, rezervace kurtů |
| Manager | Správce obsahu | + CMS, články, galerie, rezervace |
| Admin | Správce systému | + Správa uživatelů, rolí, nastavení |

## Důležité poznámky
- Stávající PHP strukturu nemusíme dodržovat
- Cíl: zjednodušit a standardizovat oproti stávajícímu řešení
- Projekt běží na: https://tenis-dobrany.vercel.app
- GitHub repo: github.com/[tvůj účet]/tenis-dobrany
- Supabase projekt: West EU (Frankfurt)

## Aktuální stav projektu
- Next.js projekt vytvořen a nasazen na Vercel ✅
- Supabase projekt vytvořen ✅
- Supabase klient nainstalován ✅
- Databázové schéma: zatím prázdné, čeká na návrh ✅
- Autentizace: zatím nenastavena ✅