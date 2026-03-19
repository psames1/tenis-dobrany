-- =============================================================================
-- 07_trigger_oauth_profile.sql — Rozšíření triggeru o avatar_url z OAuth
-- Supabase / PostgreSQL
--
-- JAK SPUSTIT:
--   Supabase Dashboard → SQL Editor → vlož a spusť
--   CREATE OR REPLACE je idempotentní — bezpečné opakované spuštění.
--
-- CO DĚLÁ:
--   Aktualizuje trigger handle_new_user() tak, aby při prvním přihlášení přes
--   Google OAuth automaticky uložil do user_profiles:
--     - full_name  (z raw_user_meta_data ->> 'full_name' nebo 'name')
--     - avatar_url (profilový obrázek z Google účtu)
--
--   Telefon Google OAuth neposkytuje — uživatel ho musí zadat ručně v profilu.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      NULL
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger je již registrován z 01_schema.sql — není potřeba znovu vytvářet.
-- Stačí nahradit funkci přes CREATE OR REPLACE výše.
