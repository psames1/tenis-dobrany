-- ============================================================
-- 09_oauth_guard.sql
-- ---------------------------------------------------------------
-- Oprava triggeru handle_new_user:
--   • Nový uživatel přihlášený přes Google (OAuth cold-signup)
--     dostane is_active = FALSE → callback ho zablokuje.
--   • Nový uživatel vzniklý pozváním (provider = 'email')
--     dostane is_active = TRUE → může ihned pokračovat.
--   • Stávající záznamy v user_profiles se NEMĚNÍ.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider  text;
  v_is_active boolean;
BEGIN
  -- Zjistíme, kterým způsobem byl účet vytvořen.
  -- 'email'  → pozvánka odeslaná přes admin.auth.admin.inviteUserByEmail()
  -- 'google' → přihlášení přes Google OAuth bez předchozí pozvánky
  v_provider  := NEW.raw_app_meta_data ->> 'provider';
  v_is_active := (v_provider = 'email');

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    is_active,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'member',
    v_is_active,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    -- Při re-signupu zachováme existující aktivní stav a roli.
    SET
      email      = EXCLUDED.email,
      avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
      full_name  = COALESCE(EXCLUDED.full_name,  user_profiles.full_name);

  RETURN NEW;
END;
$$;

-- Trigger by měl existovat již ze souboru 01_schema.sql.
-- Pokud z nějakého důvodu chybí, vytvoříme ho znovu.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;
