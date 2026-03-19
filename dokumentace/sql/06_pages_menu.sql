-- =============================================================================
-- 06_pages_menu.sql — Přidání sloupce show_in_menu do pages
-- Supabase / PostgreSQL
--
-- JAK SPUSTIT:
--   Supabase Dashboard → SQL Editor → vlož a spusť
--   Idempotentní (IF NOT EXISTS) — bezpečné opakované spuštění.
-- =============================================================================

-- Přidat show_in_menu do pages
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS show_in_menu BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pages.show_in_menu
  IS 'TRUE = zobrazit jako položku podmenu v hlavní navigaci pod svou sekcí';

-- Index pro efektivní dotaz v navigaci
CREATE INDEX IF NOT EXISTS idx_pages_show_in_menu
  ON public.pages (section_id, sort_order DESC)
  WHERE is_active = true AND show_in_menu = true;
