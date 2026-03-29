Kontext a cíl projektu
Cílem je vytvořit jednotnou platformu app.sportkalendar.cz (vývojová doména, finálně sportkalendar.cz) která spojí tři oblasti do jednoho Next.js + Supabase projektu:

CMS a web oddílu – stávající řešení pro tenis-dobrany.sportkalendar.cz, zachovat beze změny
Rezervační systém – nová prioritní implementace pro tenisové kurty a hřiště
Správa týmů a sportovních událostí – převod stávající PHP/JS aplikace SportKalendář

Důvodem spojení je sdílená databázová struktura – uživatelé, týmy, oddíly, notifikace, platby jsou společné pro všechny moduly. Stávající aplikace SportKalendář (sportkalendar.cz na vlastním serveru) bude během vývoje nadále běžet paralelně. Přechod proběhne až po dokončení a otestování nové platformy.
Priorita implementace:

Rezervační systém (potřebný na jaro pro TK Dobřany)
CMS integrace a multi-tenant základ
Správa týmů a událostí (převod SportKalendáře)


Technická architektura

Framework: Next.js 14 (App Router, TypeScript)
Backend / Auth / DB: Supabase (jeden sdílený projekt pro všechny moduly)
Hosting: Vercel s wildcard doménou *.sportkalendar.cz
Auth: Supabase Auth – email+heslo i Google OAuth souběžně
Mobilní zobrazení: priorita, hráči používají primárně mobil

Adresářová struktura
/app                    → Next.js App Router stránky
/modules
  /cms                  → CMS a web oddílu
  /reservations         → Rezervační systém
  /teams                → Správa týmů a událostí
/components             → Sdílené komponenty
/lib
  /supabase             → Supabase klient a utility
  /notifications        → Sdílená notifikační logika
Multi-tenant a domény
Každý oddíl má záznam v tabulce organizations. Next.js middleware čte hostname každého requestu a podle subdomény identifikuje organizaci a načte její konfiguraci a aktivní moduly.
Wildcard DNS záznam *.sportkalendar.cz směruje vše na stejnou Vercel aplikaci. Po registraci nového oddílu se jeho subdoména nazev-oddilu.sportkalendar.cz zpřístupní automaticky bez manuální konfigurace. Vlastní doména (např. tenis-dobrany.cz) je prémiová funkce řešená přes CNAME + přidání do Vercel dashboardu.

Databázové schéma
Stávající tabulky (CMS – bez změny názvů a struktury)
Stávající tabulky CMS webu TK Dobřany zůstávají beze změny. Nové moduly na ně nekladou žádné závislosti.
Sdílené tabulky (převzaté ze SportKalendáře, prefix app_)
Následující tabulky tvoří sdílené jádro platformy. Vychází ze stávající struktury SportKalendáře – při implementaci prostuduj přiložený detailní popis a maximálně využij stávající schéma, případně ho rozšiř o potřebné sloupce:
app_users                       (dříve users)
app_user_sessions               (dříve user_sessions)
app_organizations               (nová – oddíly/kluby, multi-tenant základ)
app_teams                       (dříve teams, nově s vazbou na organizations)
app_team_players                (dříve team_players)
app_events                      (dříve events)
app_event_registrations         (dříve event_registrations)
app_registration_history        (dříve registration_history)
app_payments                    (dříve payments)
app_bank_transactions_originals (dříve bank_transactions_originals)
app_bank_payments_rel           (dříve bank_payments_rel)
app_fio_allocations             (dříve fio_allocations)
app_users_bank_accounts         (dříve users_bank_accounts)
app_notifications               (dříve notifications)
app_push_subscriptions          (dříve push_subscriptions)
app_push_notification_log       (dříve push_notification_log)
app_surveys                     (dříve surveys)
app_survey_questions            (dříve survey_questions)
app_survey_options              (dříve survey_options)
app_survey_answers              (dříve survey_answers)
app_event_chat                  (dříve event_chat)
app_event_chat_reactions        (dříve event_chat_reactions)
app_chat_read_status            (dříve chat_read_status)
app_conf_attributes             (dříve conf_attributes)
app_enum_team_jersey            (dříve enum_team_jersey)
app_audit_logs                  (dříve audit_logs)
app_error_logs                  (dříve error_logs)
Každá tabulka musí mít sloupec organization_id s vazbou na app_organizations pro multi-tenant izolaci.
Nové tabulky – Rezervační systém
app_courts
- id, organization_id, name, description
- surface_type (volitelně – antuka, tvrdý, tráva...)
- sport_type (tenis, squash, badminton...)
- is_active, display_order
- created_at, updated_at

app_court_reservations
- id, court_id, organization_id
- player_id (hlavní hráč, povinný)
- co_players[] (spoluhráči, volitelní – pro notifikace a kalendář)
- date, time_from, time_to
- status (confirmed / cancelled / pending_payment)
- note, created_at, updated_at

app_court_reservation_rules
- id, organization_id
- slot_duration_minutes (30 nebo 60)
- max_active_reservations_per_player
- max_reservations_per_player_per_day
- max_reservations_per_player_per_week
- max_days_in_advance (jak daleko dopředu lze rezervovat)
- min_cancel_hours_before (minimální čas pro zrušení)
- members_only (boolean – příprava pro platby nečlenů)
- created_at, updated_at
Nová tabulka – Organizace
app_organizations
- id, name, slug (pro subdoménu)
- sport_types[] (tenis, hokej, fotbal... – pole)
- active_modules[] (cms, reservations, teams)
- custom_domain (volitelně – prémiová funkce)
- settings (JSONB – flexibilní konfigurace)
- created_at, updated_at
Row Level Security
Veškerá izolace dat mezi oddíly je zajištěna Supabase RLS politikami – nikdy nespoléhat pouze na aplikační vrstvu. Každá tabulka s organization_id musí mít RLS politiku která zajistí že uživatel vidí pouze data své organizace. Role v rámci organizace: admin, manager, player.

Implementace – Modul 1: Rezervační systém (priorita)
Flow rezervace

Uživatel vybere sport / oddíl
Vybere kurt ze seznamu aktivních kurtů oddílu
Vybere datum a zobrazí se dostupné časové sloty (granularita dle pravidel oddílu)
Obsazené sloty jsou zobrazeny s iniciálami hráče, volné jsou klikatelné
Volitelně přidá spoluhráče (výběr z členů oddílu)
Potvrdí rezervaci – systém ověří všechna pravidla oddílu
Při porušení pravidla zobrazí srozumitelnou chybovou hlášku s důvodem zamítnutí
Po úspěšné rezervaci odešle notifikace (email + push) hlavnímu hráči i spoluhráčům

Dashboard obsazenosti

Tabulkový přehled: řádky = časové sloty, sloupce = kurty
Buňky zobrazují iniciály hráče nebo jsou prázdné (volné)
Listování po dnech, výběr datumu přes datepicker
Klik na název kurtu → týdenní přehled obsazenosti tohoto kurtu
Zapnutí/vypnutí tohoto pohledu v nastavení profilu oddílu

Správa rezervací

Hráč: přehled svých nadcházejících rezervací, možnost zrušení do limitu
Správce oddílu: přehled všech rezervací, editace, rušení bez omezení
Osobní dashboard: nadcházející rezervace i týmové události dohromady, filtr podle sportu

Notifikace
Využívá sdílený notifikační systém (tabulky app_notifications, app_push_subscriptions):

Potvrzení rezervace ihned po vytvoření (email + push)
Připomínka před rezervací – konfigurovatelný čas v nastavení oddílu (výchozí 60 minut)
Notifikace spoluhráčům při přidání do rezervace
Notifikace všem účastníkům při zrušení rezervace

Budoucí rozšíření (architektura to musí umožnit, nyní neimplementovat)

Rezervace nečleny s povinnou QR platbou předem
Rezervace platná až po potvrzení platby přes Fio API
Automatické uvolnění nezaplacené rezervace po X minutách


Implementace – Modul 2: Správa týmů a událostí
Tento modul je převod stávající PHP/JS aplikace SportKalendář. Detailní popis funkcionality, databázové struktury a business logiky je přiložen v samostatném dokumentu. Při implementaci:

Maximálně využij stávající databázové schéma, pouze přidej prefix app_ a sloupec organization_id
Zachovej veškerou stávající funkcionalitu
Klíčové oblasti: správa hráčů a rolí, sportovní události, docházka, potvrzování účasti, QR platby přes Fio API, notifikace, chat k událostem, ankety
Multi-tenant: správce vidí pouze své týmy a události, hráč pouze týmy ve kterých je členem

[PŘILOŽEN DETAILNÍ POPIS SPORTKALENDÁŘE]

Implementace – Modul 3: CMS a web oddílu
Stávající Next.js + Supabase řešení pro tenis-dobrany.sportkalendar.cz zůstává funkčně beze změny. Integrace do platformy znamená pouze:

Napojení na sdílenou app_organizations tabulku
Sdílená auth – uživatel přihlášený v CMS je automaticky přihlášený v rezervačním systému a naopak
V profilu uživatele zobrazit rozšířené atributy z týmového modulu pokud je aktivní


Postup implementace
Implementuj striktně v tomto pořadí a před každým krokem počkej na potvrzení:

Datové schéma – navrhnout a odsouhlasit všechny tabulky, RLS politiky, migrace
Next.js middleware – rozpoznání organizace podle hostname, wildcard subdomény
Sdílená auth – přihlášení fungující napříč subdoménami, role v organizaci
Rezervační systém – kompletní implementace včetně dashboardu a notifikací
CMS integrace – napojení stávajícího CMS na sdílenou auth a organizations
Správa týmů a událostí – převod SportKalendáře dle přiloženého popisu