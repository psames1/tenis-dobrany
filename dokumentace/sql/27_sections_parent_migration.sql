-- =============================================================================
-- 27_sections_parent_migration.sql
-- Bezpečně přidá menu_parent_id, pokud ještě neexistuje.
-- Sloupec je součástí základního schématu (01_schema.sql), tato migrace
-- zajišťuje kompatibilitu u instancí vytvořených bez něj.
-- =============================================================================

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS menu_parent_id UUID
    REFERENCES public.sections(id) ON DELETE SET NULL;
