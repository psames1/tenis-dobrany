-- =============================================================================
-- 31_group_view_permission.sql
--
-- Rozšíří skupinová oprávnění o can_view — skupina může dostat právo
-- zobrazit sekci (a články v ní) i bez systémové role editor/admin.
-- Umožňuje tak omezit viditelnost obsahu na konkrétní uživatelsky definované
-- skupiny namísto jen globálních rolí.
--
-- Idempotentní — bezpečné opakované spuštění.
-- =============================================================================

ALTER TABLE public.section_group_permissions
  ADD COLUMN IF NOT EXISTS can_view BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.section_group_permissions.can_view
  IS 'Skupina vidí sekci (a její member/editor/admin články) i bez odpovídající role';

-- Zaktualizujeme helper funkci aby zohledňoval can_view
CREATE OR REPLACE FUNCTION public.has_section_permission(
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
             (p_permission = 'view'                AND sgp.can_view)
          OR (p_permission = 'create_articles'     AND sgp.can_create_articles)
          OR (p_permission = 'edit_articles'       AND sgp.can_edit_articles)
          OR (p_permission = 'delete_articles'     AND sgp.can_delete_articles)
          OR (p_permission = 'create_subsections'  AND sgp.can_create_subsections)
      )
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
