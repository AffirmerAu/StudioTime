-- Run this in Supabase → SQL Editor.
--
-- Adds the client name to the project directory so the scheduler's Project Library
-- can show each project's client above its name. Labels only (no other client data).
-- Safe to re-run.

drop view if exists public.project_directory;
create view public.project_directory as
  select p.id, p.name, p.color, p.archived, c.name as client_name
  from public.projects p
  left join public.clients c on c.id = p.client_id;

grant select on public.project_directory to authenticated;
