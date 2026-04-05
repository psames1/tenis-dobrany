-- =============================================================================
-- 28_groups_section_permissions.sql
--
-- Přidá:
--   1. visibility k sekcím (public / member / editor / admin)
--   2. user_groups — pojmenované skupiny = sekční editorské role
--   3. user_group_members — příslušnost uživatelů ke skupinám
--   4. section_group_permissions — oprávnění skupin na sekce
--   5. has_section_permission() helper funkci
--   6. Aktualizuje RLS na sections + pages
--
-- Idempotentní — bezpečné opakované spuštění.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Visibility pro sekce (stejné hodnoty jako u článků)
-- -----------------------------------------------------------------------------
ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'member', 'editor', 'admin'));

-- -----------------------------------------------------------------------------
-- 2. Uživatelské skupiny (pojmenované sekční editorrské role)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.user_groups             IS 'Pojmenované skupiny = sekční editorské role';
COMMENT ON COLUMN public.user_groups.name        IS 'Unikátní název skupiny, např. „Správci brigád"';

-- -----------------------------------------------------------------------------
-- 3. Členství ve skupinách
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_group_members (
  group_id  UUID NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 4. Oprávnění skupiny na sekci
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.section_group_permissions (
  id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id                UUID    NOT NULL REFERENCES public.user_groups(id)  ON DELETE CASCADE,
  section_id              UUID    NOT NULL REFERENCES public.sections(id)     ON DELETE CASCADE,
  can_create_articles     BOOLEAN NOT NULL DEFAULT false,
  can_edit_articles       BOOLEAN NOT NULL DEFAULT false,
  can_delete_articles     BOOLEAN NOT NULL DEFAULT false,
  can_create_subsections  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (group_id, section_id)
);

COMMENT ON TABLE public.section_group_permissions IS
  'Oprávnění skupiny na konkrétní sekci; NULL záznam = žádná oprávnění';

-- -----------------------------------------------------------------------------
-- 5. Helper funkce: má aktuální uživatel toto oprávnění na sekci?
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.has_section_permission(UUID, TEXT);

CREATE FUNCTION public.has_section_permission(
  p_section_id UUID,
  p_permission  TEXT
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.section_group_permissions sgp
    JOIN   public.user_group_members        ugm ON ugm.group_id = sgp.group_id
    WHERE  ugm.user_id   = auth.uid()
      AND  sgp.section_id = p_section_id
      AND  (
             (p_permission = 'create_articles'    AND sgp.can_create_articles)
          OR (p_permission = 'edit_articles'      AND sgp.can_edit_articles)
          OR (p_permission = 'delete_articles'    AND sgp.can_delete_articles)
          OR (p_permission = 'create_subsections' AND sgp.can_create_subsections)
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- -----------------------------------------------------------------------------
-- 6. Aktualizace RLS — sections: respektovat visibility
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "sections: public read"                    ON public.sections;
DROP POLICY IF EXISTS "sections: group editor read"              ON public.sections;
DROP POLICY IF EXISTS "sections: group editor insert subsection" ON public.sections;

-- Základní čtení dle visibility
CREATE POLICY "sections: public read"
  ON public.sections FOR SELECT
  USING (
    is_active = true
    AND (
      visibility = 'public'
      OR (visibility = 'member'              AND public.is_authenticated_member())
      OR (visibility IN ('editor', 'admin')  AND public.is_manager_or_above())
    )
  );

-- Skupinoví editoři vidí sekce, ke kterým mají přidělené oprávnění
CREATE POLICY "sections: group editor read"
  ON public.sections FOR SELECT
  USING (
    is_active = true
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM   public.section_group_permissions sgp
      JOIN   public.user_group_members        ugm ON ugm.group_id = sgp.group_id
      WHERE  ugm.user_id    = auth.uid()
        AND  sgp.section_id = public.sections.id
    )
  );

-- Skupinoví editoři mohou vkládat podsekce do svých sekcí
CREATE POLICY "sections: group editor insert subsection"
  ON public.sections FOR INSERT
  WITH CHECK (
    public.is_authenticated_member()
    AND menu_parent_id IS NOT NULL
    AND public.has_section_permission(menu_parent_id, 'create_subsections')
  );

-- -----------------------------------------------------------------------------
-- 7. Aktualizace RLS — pages: sekční editoré mohou spravovat články
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pages: manager write"          ON public.pages;
DROP POLICY IF EXISTS "pages: section editor insert"  ON public.pages;
DROP POLICY IF EXISTS "pages: section editor update"  ON public.pages;
DROP POLICY IF EXISTS "pages: section editor delete"  ON public.pages;

CREATE POLICY "pages: manager write"
  ON public.pages FOR ALL
  USING    (public.is_manager_or_above())
  WITH CHECK (public.is_manager_or_above());

CREATE POLICY "pages: section editor insert"
  ON public.pages FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.has_section_permission(section_id, 'create_articles')
  );

CREATE POLICY "pages: section editor update"
  ON public.pages FOR UPDATE
  USING    (auth.uid() IS NOT NULL AND public.has_section_permission(section_id, 'edit_articles'))
  WITH CHECK (auth.uid() IS NOT NULL AND public.has_section_permission(section_id, 'edit_articles'));

CREATE POLICY "pages: section editor delete"
  ON public.pages FOR DELETE
  USING (auth.uid() IS NOT NULL AND public.has_section_permission(section_id, 'delete_articles'));

-- -----------------------------------------------------------------------------
-- 8. RLS pro nové tabulky
-- -----------------------------------------------------------------------------

-- user_groups
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_groups: authenticated read"
  ON public.user_groups FOR SELECT
  USING (public.is_authenticated_member());

CREATE POLICY "user_groups: admin write"
  ON public.user_groups FOR ALL
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- user_group_members
ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members: read"
  ON public.user_group_members FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "group_members: admin write"
  ON public.user_group_members FOR ALL
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

-- section_group_permissions
ALTER TABLE public.section_group_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "section_perms: authenticated read"
  ON public.section_group_permissions FOR SELECT
  USING (public.is_authenticated_member());

CREATE POLICY "section_perms: admin write"
  ON public.section_group_permissions FOR ALL
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());
