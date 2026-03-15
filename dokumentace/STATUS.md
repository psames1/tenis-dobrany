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
- [ ] **TODO**: V Supabase Dashboard nastavit Redirect URL na `/callback`
- [ ] **TODO**: Vytvořit prvního admin uživatele (registrace + SQL: `UPDATE user_profiles SET role = 'admin' WHERE id = '<uuid>'`)

## Fáze 2 – Veřejný web ⏳
- [ ] Layout a navigace
- [ ] Footer
- [ ] Homepage
- [ ] Výpis sekcí a článků
- [ ] Detail článku

## Fáze 3 – Admin CMS ⏳
- [ ] Editor článků (TipTap)
- [ ] Správa sekcí a menu
- [ ] Správa homepage bloků
- [ ] Správa zápatí
- [ ] Správa médií

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