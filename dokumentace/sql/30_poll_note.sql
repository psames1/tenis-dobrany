-- =============================================================================
-- 30_poll_note.sql
--
-- Přidá volitelnou poznámku/komentář k hlasu v anketě.
--
-- Idempotentní — bezpečné opakované spuštění.
-- =============================================================================

ALTER TABLE public.page_poll_votes
  ADD COLUMN IF NOT EXISTS note TEXT;

COMMENT ON COLUMN public.page_poll_votes.note IS 'Volitelná poznámka/komentář hlasujícího';
