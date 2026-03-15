-- =============================================================================
-- 05_contributors.sql — Spoluautoři článků
-- Supabase / PostgreSQL
--
-- JAK SPUSTIT:
--   Supabase Dashboard → SQL Editor → vlož a spusť
--   (idempotentní — bezpečné opakované spuštění)
--
-- POTŘEBUJE:
--   .env.local: SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
--   (Supabase Dashboard → Settings → API → service_role JWT)
-- =============================================================================


-- Tabulka spoluautorů
CREATE TABLE IF NOT EXISTS public.article_contributors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID        NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES public.user_profiles(id) ON DELETE CASCADE,  -- NULL = čeká na registraci
  email       TEXT        NOT NULL,
  invited_by  UUID        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (page_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contributors_page  ON public.article_contributors (page_id);
CREATE INDEX IF NOT EXISTS idx_contributors_user  ON public.article_contributors (user_id);
CREATE INDEX IF NOT EXISTS idx_contributors_email ON public.article_contributors (email);

COMMENT ON TABLE  public.article_contributors          IS 'Spoluautoři přiřazení k jednotlivým článkům';
COMMENT ON COLUMN public.article_contributors.user_id  IS 'NULL = pozvaný, ale zatím neregistrovaný';


-- RLS
ALTER TABLE public.article_contributors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='article_contributors' AND policyname='contributors: self and managers read') THEN
    CREATE POLICY "contributors: self and managers read"
      ON public.article_contributors FOR SELECT
      USING (
        user_id = auth.uid()
        OR public.is_manager_or_above()
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='article_contributors' AND policyname='contributors: managers write') THEN
    CREATE POLICY "contributors: managers write"
      ON public.article_contributors FOR ALL
      USING (public.is_manager_or_above())
      WITH CHECK (public.is_manager_or_above());
  END IF;
END $$;

-- Contributor může UPDATE obsahu článku (pages) ke kterému byl přiřazen
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pages' AND policyname='pages: contributor update') THEN
    CREATE POLICY "pages: contributor update"
      ON public.pages FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.article_contributors
          WHERE page_id = pages.id AND user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.article_contributors
          WHERE page_id = pages.id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Contributor může INSERT/DELETE v page_gallery pro své články
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='page_gallery' AND policyname='Gallery contributor write') THEN
    CREATE POLICY "Gallery contributor write"
      ON public.page_gallery FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.article_contributors
          WHERE page_id = page_gallery.page_id AND user_id = auth.uid()
        )
        OR public.is_manager_or_above()
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.article_contributors
          WHERE page_id = page_gallery.page_id AND user_id = auth.uid()
        )
        OR public.is_manager_or_above()
      );
  END IF;
END $$;


-- Storage: přihlášení přispěvatelé mohou nahrávat do galleries/
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'storage images: contributor upload'
  ) THEN
    CREATE POLICY "storage images: contributor upload"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'images'
        AND (storage.foldername(name))[1] = 'galleries'
      );
  END IF;
END $$;


-- Trigger: propojí nově registrovaného uživatele čekající pozvánky
CREATE OR REPLACE FUNCTION public.handle_new_contributor_link()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.article_contributors
  SET user_id = NEW.id
  WHERE email = NEW.email
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_profile_created_link_contributors ON public.user_profiles;
CREATE TRIGGER on_user_profile_created_link_contributors
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_contributor_link();
