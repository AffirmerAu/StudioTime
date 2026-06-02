-- Run this in Supabase → SQL Editor.
--
-- Lets the shared scheduler show EVERY scheduled project's name to all signed-in users,
-- including projects an artist isn't assigned to (so "see what everyone's working on" works).
--
-- It adds a small read-only view exposing only project labels (id, name, colour, archived) —
-- no hours, clients, dates or status. Full project data stays protected by existing RLS;
-- this view is intentionally a plain (non-security_invoker) view so the labels are readable
-- by everyone. Safe to re-run.

drop view if exists public.project_directory;
create view public.project_directory as
  select id, name, color, archived from public.projects;

grant select on public.project_directory to authenticated;
