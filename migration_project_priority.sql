-- Run this in Supabase → SQL Editor.
--
-- Adds a "priority" flag to projects. Managers toggle it on a project's page; artists
-- see a priority indicator on their project cards. Defaults to false. Safe to re-run.

alter table public.projects add column if not exists priority boolean not null default false;
