-- Migration 33: Allow authenticated members to read other users' profiles
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: user_profiles RLS only allowed own-profile read + admin-all.
-- When a regular member loads a page with comments/votes, the Supabase join
-- for other users' profiles returned NULL, causing "Anonym" display names.
--
-- Fix: add a SELECT policy so any authenticated member can read any profile.
-- UPDATE and INSERT remain restricted to own profile (or admin).

DROP POLICY IF EXISTS "profiles: members read others" ON public.user_profiles;

CREATE POLICY "profiles: members read others"
  ON public.user_profiles
  FOR SELECT
  USING (public.is_authenticated_member());
