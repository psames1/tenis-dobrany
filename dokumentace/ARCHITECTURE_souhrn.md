
Let me check for more content in the longer files.

Now I have full context. Let me create the comprehensive architecture document.

Kompletní architektonický návrh je v ARCHITECTURE.md. Shrnutí klíčových rozhodnutí:

1. PostgreSQL schéma — 8 tabulek místo jedné god-table
Tabulka	Účel
sections	Sekce webu + navigace (dvouúrovňové menu)
pages	Články a stránky (s is_members_only flagem)
page_components	Homepage PageBuilder bloky (hero, CTA, …)
footer_content	4 sloupce zápatí
user_profiles	Rozšíření auth.users — role jako ENUM (member, manager, admin)
media	Katalog médií (metadata, soubory v Supabase Storage)
documents	Dokumenty pro členy (zápisy, pravidla)
site_settings	Key-value globální nastavení
Plus triggery: auto-updated_at a auto-vytvoření profilu po registraci.

2. RLS — kaskádový model se 3 helper funkcemi
Visitor čte veřejný obsah přes anon klíč. Member vidí navíc is_members_only stránky a dokumenty. Manager má plný CRUD nad obsahem. Admin navíc spravuje uživatele, role a site_settings. Člen si nemůže změnit vlastní roli (ochrana v RLS).

3. CMS — vlastní admin panel
Doporučení: vlastní Next.js admin s shadcn/ui + TipTap editorem. Payload CMS vyžaduje vlastní server (neběží na Vercel serverless), Sanity/Contentful by vytvořily duplicitní zdroj pravdy mimo Supabase. Vlastní admin je jednoduchý, přenositelný a plně pod kontrolou.

4. Struktura projektu
Využívá route groups — (web) pro veřejný web, (auth) pro autentizaci, (members) pro členskou sekci. Odděluje lib/queries/ (read-only pro Server Components) od lib/actions/ (mutace přes Server Actions). Admin komponenty jsou v components/admin/ — mimo client bundle veřejného webu.

5. Pořadí implementace — 6 fází
Základ — SQL schéma + RLS + Auth stránky + první admin uživatel
Veřejný web — Layout, navigace, footer, homepage, výpis sekcí, detail článku
Admin CMS — Editor článků, správa sekcí, homepage, zápatí, média
Členská sekce — Profil, dokumenty ke stažení
Migrace + go-live — Data z MySQL, obrázky do Storage, DNS přepnutí
Rezervační systém — Samostatný modul (až nakonec)