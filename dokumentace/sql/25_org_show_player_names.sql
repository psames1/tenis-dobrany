-- =============================================================================
-- 25_org_show_player_names.sql
-- Nastavení viditelnosti jmen hráčů v rezervačním systému
-- Využívá existující sloupec settings JSONB v app_organizations
-- =============================================================================

-- Výchozí hodnota: jména jsou viditelná (show_player_names = true)
-- Admin a manažer vidí jména vždy, nastavení platí pro běžné členy.

UPDATE public.app_organizations
SET settings = settings || '{"show_player_names": true}'::jsonb
WHERE NOT (settings ? 'show_player_names');
