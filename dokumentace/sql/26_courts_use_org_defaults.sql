-- =============================================================================
-- 26_courts_use_org_defaults.sql
-- Přidá příznak use_org_defaults ke kurtům.
-- Pokud je true, kurt používá výchozí pravidla oddílu (uložená v org.settings).
-- Pokud je false, kurt má vlastní nastavení v app_court_reservation_rules.
-- =============================================================================

ALTER TABLE public.app_courts
  ADD COLUMN IF NOT EXISTS use_org_defaults boolean NOT NULL DEFAULT true;
