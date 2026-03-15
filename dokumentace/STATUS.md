# Stav projektu tenis-dobrany

## Hotovo ✅
- Next.js projekt vytvořen a nasazen na Vercel
- Supabase projekt vytvořen
- Dokumentace PHP projektu (CONTEXT, SCHEMA, FEATURES, MIGRATION)
- Architektonický návrh od Opuse (ARCHITECTURE.md)

## Fáze 1 – Základ ✅ (dokončeno)
- [x] SQL schéma v Supabase (8 tabulek) → `dokumentace/sql/01_schema.sql` ✅ 2026-03-15
- [x] RLS politiky (4 role) → `dokumentace/sql/02_rls_policies.sql` ✅ 2026-03-15
- [x] Spustit SQL v Supabase SQL Editoru (01 → 02) ✅ 2026-03-15
- [x] Supabase Auth – Google OAuth ✅ 2026-03-15
- [x] Supabase Auth – email/heslo ✅ 2026-03-15
- [x] Subdoména tenis-dobrany.sportkalendar.cz ✅ 2026-03-15
- [x] Supabase klienti: `lib/supabase/client.ts` + `lib/supabase/server.ts` ✅ 2026-03-15
- [x] `middleware.ts` – session refresh + ochrana `/clenove/*` a `/admin/*` ✅ 2026-03-15
- [x] Přihlašovací stránka: `app/(auth)/login/page.tsx` (Google + email/heslo) ✅ 2026-03-15
- [x] OAuth callback: `app/(auth)/callback/route.ts` ✅ 2026-03-15
- [x] Logout: `app/(auth)/logout/route.ts` (POST) ✅ 2026-03-15
- [x] `lib/utils.ts` – `cn()` helper ✅ 2026-03-15
- [x] **TODO**: V Supabase Dashboard nastavit Redirect URL na `/callback`
- [x] **TODO**: Vytvořit prvního admin uživatele (registrace + SQL: `UPDATE user_profiles SET role = 'admin' WHERE id = '<uuid>'`)

## Fáze 2 – Veřejný web 🔄 (probíhá)

### SQL (spustit v Supabase SQL Editoru)
- [x] `dokumentace/sql/01_schema.sql` — přidán sloupec `email` + trigger `on_auth_user_email_updated` ✅
  - ⚠️ **Nutno spustit**: bezpečně spustit `ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;` (pokud DB bez dat), NEBO znovu celý reset soubor
- [x] `dokumentace/sql/03_seed_data.sql` — výchozí data (sekce, zápatí, homepage bloky) ✅
  - ⚠️ **Nutno spustit** v Supabase SQL Editoru

### Komponenty
- [x] `components/layout/Navigation.tsx` — Server Component, načítá `sections` + `auth.getUser()` ✅
- [x] `components/layout/MobileMenu.tsx` — Client Component, hamburger menu ✅
- [x] `components/layout/Footer.tsx` — Server Component, načítá `footer_content` ✅
- [x] `app/layout.tsx` — přidán Navigation + Footer, `lang="cs"`, flex layout ✅

### Zbývá
- [x] Homepage: `app/page.tsx` — dynamické render bloků z `page_components` ✅
- [x] `components/blocks/HeroBlock.tsx` — hero sekce s gradientem ✅
- [x] `components/blocks/TextImageBlock.tsx` — text + ikona, 2 sloupce ✅
- [x] `components/blocks/SectionCardsBlock.tsx` — karty sekcí ✅
- [x] `components/blocks/LatestArticlesBlock.tsx` — poslední články ✅
- [x] `components/blocks/CtaButtonsBlock.tsx` — CTA volání k akci ✅
- [x] Výpis sekcí: `app/[section]/page.tsx` — seznam článků, breadcrumb, is_members_only badge ✅
- [x] Detail článku: `app/[section]/[slug]/page.tsx` — HTML obsah, redirect pro členy ✅
- [x] Kontaktní stránka: `app/kontakt/page.tsx` — statická, placeholder pro mapu ✅
- [x] Opraven bug: `sections.excerpt` → `sections.description` ✅

**Fáze 2 dokončena ✅**

## Fáze 3 – Admin CMS ✅ (dokončeno)
- [x] `app/admin/layout.tsx` — Server Component, ověření role admin/manager, sidebar ✅
- [x] `app/admin/AdminSidebar.tsx` — Client Component, navigace, aktivní stav ✅
- [x] `app/admin/page.tsx` — přehledový dashboard (statistiky + rychlé akce) ✅
- [x] `app/admin/actions.ts` — Server Actions: saveArticle, deleteArticle, saveSection ✅
- [x] `app/admin/clanky/page.tsx` — seznam článků, filtr dle sekce, mazání ✅
- [x] `app/admin/clanky/ArticleForm.tsx` — sdílený formulář pro nový/edit článek ✅
- [x] `app/admin/clanky/novy/page.tsx` — formulář nového článku ✅
- [x] `app/admin/clanky/[id]/upravit/page.tsx` — editace existujícího článku ✅
- [x] `app/admin/sekce/page.tsx` — správa sekcí (accordion, inline editace) ✅

## Fáze 4 – Členská sekce ⏳
- [ ] Profil člena
- [ ] Dokumenty ke stažení

## Fáze 5 – Migrace dat ⏳
- [ ] Import dat z MySQL
- [ ] Obrázky do Supabase Storage
- [ ] DNS přepnutí na produkční doménu

## Fáze 6 – Rezervační systém ⏳
- [ ] Návrh rezervačního modulu
- [ ] Implementace