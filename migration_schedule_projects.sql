-- Run this in Supabase → SQL Editor.
--
-- The scheduler now schedules whole PROJECTS rather than individual tasks, so a schedule
-- entry no longer needs a task. This drops the NOT NULL on schedule_entries.task and relaxes
-- its check constraint to allow null. Existing entries keep whatever task they had; new
-- project-level entries simply leave it null. Safe to re-run.
--
-- (time_logs.task is unchanged — logging time is still per-task.)

alter table public.schedule_entries alter column task drop not null;

alter table public.schedule_entries drop constraint if exists schedule_entries_task_check;
alter table public.schedule_entries add constraint schedule_entries_task_check
  check (task is null or task in ('Storyboarding','Blockout Premiere','Production','Internal Review','Client Review'));
