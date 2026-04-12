Pracuji na Next.js projektu pro tenisový klub (tenis-dobrany).
Jde o základ budoucí multi-tenant platformy SportKalendář.

Přikládám kontext: [vlož CONTEXT.md a ARCHITECTURE.md]

ÚKOL: Implementuj email systém se dvěma vrstvami SMTP
a testovací rozhraní v admin panelu.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ČÁST 1 – Instalace a základní infrastruktura
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nainstaluj:
npm install nodemailer
npm install --save-dev @types/nodemailer

Přidej do .env.local:
SMTP_ENCRYPTION_KEY=  (vygeneruj náhodný 32-znakový string)
DEFAULT_SMTP_HOST=smtp.gmail.com
DEFAULT_SMTP_PORT=465
DEFAULT_SMTP_USER=sportkalendar.cz@gmail.com
DEFAULT_SMTP_PASSWORD=  (aplikační heslo - zatím prázdné)
DEFAULT_SMTP_FROM_NAME=SportKalendář
DEFAULT_SMTP_FROM_EMAIL=sportkalendar.cz@gmail.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ČÁST 2 – Databáze
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vytvoř dokumentace/sql/04_email_settings.sql:

-- Globální SMTP nastavení (fallback pro celou platformu)
-- Ukládáme do site_settings tyto klíče:
-- default_smtp_host, default_smtp_port
-- default_smtp_user, default_smtp_password (šifrované)
-- default_smtp_from_name, default_smtp_from_email

-- Klubová SMTP konfigurace (volitelná vlastní)
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 465,
  smtp_user TEXT,
  smtp_password TEXT,  -- šifrované AES-256
  smtp_from_name TEXT,
  smtp_from_email TEXT,
  smtp_enabled BOOLEAN DEFAULT false;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ČÁST 3 – Email služba
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vytvoř lib/email/encryption.ts:
- funkce encrypt(text: string): string
- funkce decrypt(text: string): string
- Použij AES-256-CBC
- Klíč z env SMTP_ENCRYPTION_KEY

Vytvoř lib/email/mailer.ts:
- funkce getMailConfig(clubId?: string)
  * Pokud clubId → načti klub z DB
  * Pokud klub má smtp_enabled = true → použij jeho SMTP
  * Jinak → fallback na DEFAULT_SMTP_* z env
  * Vrať { transporter, from }

- funkce sendEmail({
    to: string,
    subject: string,
    html: string,
    clubId?: string
  })
  * Zavolá getMailConfig(clubId)
  * Odešle email
  * Vrať { success: boolean, error?: string }

Vytvoř lib/email/templates.ts:
- Základní HTML šablona s logem a patičkou
- template pro pozvánku do klubu
- template pro potvrzení rezervace (zatím placeholder)
- template pro testovací email

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ČÁST 4 – Admin stránka nastavení emailu
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vytvoř app/admin/nastaveni/email/page.tsx
(Server Component která načte aktuální konfiguraci)

Vytvoř components/admin/email/EmailSettingsForm.tsx
(Client Component "use client")

Stránka má 3 sekce:

SEKCE A – Globální nastavení (jen pro Admin roli)
- Zobrazí aktuální DEFAULT smtp konfiguraci z env
- Info: "Toto nastavení platí pro celou platformu
  SportKalendář jako výchozí"
- Tlačítko "Odeslat testovací email"
  → input pro cílový email
  → odešle přes DEFAULT SMTP
  → zobrazí success/error výsledek

SEKCE B – Vlastní SMTP klubu (pro Manager a Admin)
- Přepínač "Použít vlastní email pro tento klub"
- Pokud vypnuto → info "Emaily se odesílají 
  z výchozí adresy SportKalendář"
- Pokud zapnuto → formulář:
  * SMTP Host (input, placeholder: smtp.gmail.com)
  * SMTP Port (input, default: 465)
  * SMTP Username (input)
  * SMTP Password (input type=password)
    - Nikdy nepředvyplňovat z DB!
    - Placeholder: "Zadej pro změnu hesla"
  * Jméno odesílatele (input)
  * Email odesílatele (input)
  * Tlačítko "Uložit nastavení"
    → Ukládej přes Server Action
    → Heslo šifruj před uložením do DB

SEKCE C – Test odeslání (pro Manager a Admin)
- Input: Testovací email adresa
  (předvyplň emailem přihlášeného uživatele)
- Radio: "Použít výchozí SMTP" / "Použít klubový SMTP"
- Tlačítko "Odeslat test"
- Výsledek testu:
  * Zelený box: "Email odeslán na test@email.cz ✅"
  * Červený box: "Chyba: [přesná chybová hláška] ❌"
  * Zobrazit i: "Odesláno z: jméno <email>"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ČÁST 5 – Server Actions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vytvoř lib/actions/email.actions.ts:

- saveClubSmtpSettings(clubId, formData)
  * Ověř že user má roli manager nebo admin
  * Šifruj heslo před uložením
  * Ulož do clubs tabulky
  * Vrať { success, error }

- sendTestEmail(to, useClubSmtp, clubId?)
  * Odešle testovací email přes správný SMTP
  * Vrať { success, error, sentFrom }

- sendClubInvitation(to, clubId, inviterName)
  * Použije klubový SMTP pokud nastaven
  * Jinak fallback na výchozí
  * Použije template z email/templates.ts
  * Vrať { success, error }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ČÁST 6 – Napojení pozvánky na email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Najdi existující místo kde se posílají pozvánky
do klubu a napoj sendClubInvitation():

- Pokud pozvánka jde přes Supabase Auth invite →
  ponech jak je (Supabase řeší přes vlastní SMTP)
- Pokud máme vlastní invite flow →
  nahraď přímé volání Supabase za sendClubInvitation()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECHNICKÉ POŽADAVKY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- TypeScript vždy
- Shadcn/ui komponenty
- Server Actions pro mutace (ne fetch API)
- Hesla nikdy do klienta
- Všechny env proměnné přidat do .env.local
  i do dokumentace/ENV.md
- Po dokončení aktualizuj dokumentace/STATUS.md
