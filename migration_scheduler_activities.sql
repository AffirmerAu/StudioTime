-- Run this in Supabase → SQL Editor.
--
-- Adds non-project scheduler items (Sick Leave, Annual Leave, Technical Support) that can be
-- dropped onto someone's schedule with no project or assignment. A schedule entry is now
-- EITHER a project (project_id) OR an activity (activity). Safe to re-run.

-- project_id becomes optional (activity rows have none)
alter table public.schedule_entries alter column project_id drop not null;

-- the activity column + allowed values
alter table public.schedule_entries add column if not exists activity text;
alter table public.schedule_entries drop constraint if exists schedule_entries_activity_check;
alter table public.schedule_entries add constraint schedule_entries_activity_check
  check (activity is null or activity in ('Sick Leave','Annual Leave','Technical Support'));

-- every row must be one or the other
alter table public.schedule_entries drop constraint if exists schedule_entries_project_or_activity;
alter table public.schedule_entries add constraint schedule_entries_project_or_activity
  check (project_id is not null or activity is not null);
