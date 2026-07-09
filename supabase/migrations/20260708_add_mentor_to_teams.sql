-- Migration: add mentor fields to teams
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/eqoxnsohafswoxvqnyjj/sql
--
-- Adds two nullable columns to the teams table:
--   mentor_name             – display name shown in the team card
--   mentor_discord_username – Discord handle used to build a DM link
--
-- Both default to NULL so existing rows are unaffected.
-- Organizers assign a mentor by updating these columns from the dashboard.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS mentor_name             text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mentor_discord_username text DEFAULT NULL;

-- Optional: add a comment to each column for clarity in the Supabase UI
COMMENT ON COLUMN public.teams.mentor_name IS
  'Display name of the mentor assigned to this team by an organizer.';

COMMENT ON COLUMN public.teams.mentor_discord_username IS
  'Discord username of the assigned mentor (e.g. "jane#1234" or "jane" for new usernames). Used to generate a Discord DM link for team members.';
