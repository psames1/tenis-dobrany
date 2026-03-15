-- =============================================================================
-- 04_gallery.sql — Fotogalerie k článkům (page_gallery)
-- Supabase / PostgreSQL
--
-- JAK SPUSTIT:
--   Supabase Dashboard → SQL Editor → vlož a spusť tento soubor
--   (je idempotentní — bezpečné opakované spuštění)
-- =============================================================================


-- Tabulka fotogalerie
CREATE TABLE IF NOT EXISTS public.page_gallery (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id      UUID        NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  public_url   TEXT        NOT NULL,   -- veřejná URL ze Supabase Storage (bucket images)
  alt_text     TEXT,                   -- popis pro <img alt="">
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_gallery_page
  ON public.page_gallery (page_id, sort_order);

COMMENT ON TABLE  public.page_gallery             IS 'Fotogalerie přiřazené k článkům (pages)';
COMMENT ON COLUMN public.page_gallery.public_url  IS 'Veřejná URL obrázku v Supabase Storage (bucket images)';
COMMENT ON COLUMN public.page_gallery.sort_order  IS 'Pořadí fotek — odpovídá pořadí nahrání';


-- RLS
ALTER TABLE public.page_gallery ENABLE ROW LEVEL SECURITY;

-- SELECT: vidí všichni (galerie je veřejná)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'page_gallery' AND policyname = 'Gallery visible to everyone'
  ) THEN
    CREATE POLICY "Gallery visible to everyone"
      ON public.page_gallery FOR SELECT
      USING (true);
  END IF;
END $$;

-- INSERT / UPDATE / DELETE: pouze manager a admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'page_gallery' AND policyname = 'Gallery managed by managers'
  ) THEN
    CREATE POLICY "Gallery managed by managers"
      ON public.page_gallery FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid()
            AND role IN ('manager', 'admin')
            AND is_active = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid()
            AND role IN ('manager', 'admin')
            AND is_active = true
        )
      );
  END IF;
END $$;
