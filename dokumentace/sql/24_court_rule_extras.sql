-- =============================================================================
-- 24_court_rule_extras.sql
-- Přidání nových polí do app_court_reservation_rules:
--   max_duration_minutes  — maximální délka jedné rezervace
--   min_gap_minutes       — minimální odstup rezervací téhož uživatele
--   max_per_week          — max rezervací za týden (NULL = bez limitu)
--   require_partner       — zda je spoluhráč povinný
--
-- BEZPEČNÉ na opakované spuštění (ADD COLUMN IF NOT EXISTS)
-- =============================================================================

ALTER TABLE public.app_court_reservation_rules
  ADD COLUMN IF NOT EXISTS max_duration_minutes INT NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS min_gap_minutes       INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_per_week          INT NULL,
  ADD COLUMN IF NOT EXISTS require_partner       BOOLEAN NOT NULL DEFAULT false;

-- Komentáře
COMMENT ON COLUMN public.app_court_reservation_rules.max_duration_minutes
  IS 'Maximální délka jedné rezervace v minutách (default 120 = 2 hodiny)';
COMMENT ON COLUMN public.app_court_reservation_rules.min_gap_minutes
  IS 'Minimální odstup mezi rezervacemi téhož uživatele v minutách';
COMMENT ON COLUMN public.app_court_reservation_rules.max_per_week
  IS 'Max. počet rezervací za týden (Po–Ne). NULL = bez limitu.';
COMMENT ON COLUMN public.app_court_reservation_rules.require_partner
  IS 'Pokud true, hráč musí při rezervaci zadat jméno spoluhráče';

-- Ověření
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_court_reservation_rules'
ORDER BY ordinal_position;
