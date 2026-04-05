-- =============================================================================
-- 29_poll.sql
--
-- Přidá anketu ke článkům:
--   1. Sloupce allow_poll, poll_question, poll_allow_multiple v tabulce pages
--   2. page_poll_options — možnosti ankety
--   3. page_poll_votes   — hlasy uživatelů
--   4. RLS politiky
--
-- Idempotentní — bezpečné opakované spuštění.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Sloupce ankety v tabulce pages
-- -----------------------------------------------------------------------------
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS allow_poll          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poll_question       TEXT,
  ADD COLUMN IF NOT EXISTS poll_allow_multiple BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pages.allow_poll          IS 'Zobrazit anketu pod článkem';
COMMENT ON COLUMN public.pages.poll_question       IS 'Otázka ankety';
COMMENT ON COLUMN public.pages.poll_allow_multiple IS 'Povolena volba více možností najednou';

-- -----------------------------------------------------------------------------
-- 2. Možnosti ankety
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.page_poll_options (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id    UUID        NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  label      TEXT        NOT NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poll_options_page ON public.page_poll_options (page_id, sort_order);

COMMENT ON TABLE public.page_poll_options IS 'Možnosti volby v anketě článku';

-- -----------------------------------------------------------------------------
-- 3. Hlasy uživatelů
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.page_poll_votes (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID        NOT NULL REFERENCES public.page_poll_options(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES auth.users(id)               ON DELETE CASCADE,
  voted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (option_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON public.page_poll_votes (option_id);

COMMENT ON TABLE public.page_poll_votes IS 'Hlasy uživatelů v anketě článku';

-- -----------------------------------------------------------------------------
-- 4. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.page_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_poll_votes   ENABLE ROW LEVEL SECURITY;

-- Možnosti ankety čtou všichni (viditelnost je řízena viditelností samotného článku)
DROP POLICY IF EXISTS "poll_options: public read"  ON public.page_poll_options;
DROP POLICY IF EXISTS "poll_options: admin write"  ON public.page_poll_options;

CREATE POLICY "poll_options: public read"
  ON public.page_poll_options FOR SELECT
  USING (true);

CREATE POLICY "poll_options: admin write"
  ON public.page_poll_options FOR ALL
  USING    (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());

-- Hlasy: číst mohou přihlášení členové; vkládat/mazat vlastní hlas člen sám
DROP POLICY IF EXISTS "poll_votes: member read"       ON public.page_poll_votes;
DROP POLICY IF EXISTS "poll_votes: member insert"     ON public.page_poll_votes;
DROP POLICY IF EXISTS "poll_votes: member delete own" ON public.page_poll_votes;
DROP POLICY IF EXISTS "poll_votes: admin delete"      ON public.page_poll_votes;

CREATE POLICY "poll_votes: member read"
  ON public.page_poll_votes FOR SELECT
  USING (public.is_authenticated_member());

CREATE POLICY "poll_votes: member insert"
  ON public.page_poll_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_authenticated_member()
  );

CREATE POLICY "poll_votes: member delete own"
  ON public.page_poll_votes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "poll_votes: admin delete"
  ON public.page_poll_votes FOR DELETE
  USING (public.is_manager_or_above());
