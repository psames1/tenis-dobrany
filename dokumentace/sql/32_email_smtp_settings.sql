-- =============================================================================
-- 32_email_smtp_settings.sql
--
-- Rozšiřuje app_organizations o SMTP konfiguraci pro per-tenant emaily.
-- Heslo se ukládá šifrovaně (AES-256) v aplikační vrstvě.
--
-- Globální (výchozí) SMTP zůstává v ENV proměnných.
-- Pokud organizace má smtp_enabled = true, použije se její konfigurace,
-- jinak se fallbackuje na globální ENV.
--
-- Idempotentní — bezpečné opakované spuštění.
-- =============================================================================

ALTER TABLE public.app_organizations
  ADD COLUMN IF NOT EXISTS smtp_host       TEXT,
  ADD COLUMN IF NOT EXISTS smtp_port       INTEGER DEFAULT 465,
  ADD COLUMN IF NOT EXISTS smtp_user       TEXT,
  ADD COLUMN IF NOT EXISTS smtp_password   TEXT,
  ADD COLUMN IF NOT EXISTS smtp_from_name  TEXT,
  ADD COLUMN IF NOT EXISTS smtp_from_email TEXT,
  ADD COLUMN IF NOT EXISTS smtp_enabled    BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.app_organizations.smtp_host       IS 'Vlastní SMTP server organizace';
COMMENT ON COLUMN public.app_organizations.smtp_port       IS 'SMTP port (465 = SSL, 587 = STARTTLS)';
COMMENT ON COLUMN public.app_organizations.smtp_user       IS 'SMTP přihlašovací jméno';
COMMENT ON COLUMN public.app_organizations.smtp_password   IS 'SMTP heslo — šifrované AES-256-CBC v aplikační vrstvě';
COMMENT ON COLUMN public.app_organizations.smtp_from_name  IS 'Jméno odesílatele (From header)';
COMMENT ON COLUMN public.app_organizations.smtp_from_email IS 'Email odesílatele (From header)';
COMMENT ON COLUMN public.app_organizations.smtp_enabled    IS 'Používat vlastní SMTP místo výchozího';
