-- Run this in Supabase → SQL Editor.
--
-- Fixes client names showing as "—" for artists. The clients table is manager-only, so
-- artists couldn't read it. This adds a small read-only view exposing only client id + name
-- (no contact person, email, phone, or notes — those stay manager-only). Safe to re-run.

drop view if exists public.client_directory;
create view public.client_directory as
  select id, name from public.clients;

grant select on public.client_directory to authenticated;
