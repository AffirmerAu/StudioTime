-- Run this in Supabase → SQL Editor.
--
-- Lets users log Annual Leave / Sick Leave / Technical Support on their timesheet
-- (to fill out their week), not just on the scheduler. A time log is now EITHER a
-- project log (project_id + task) OR an activity log (activity). Safe to re-run.

-- project_id and task become optional (activity rows have neither)
alter table public.time_logs alter column project_id drop not null;
alter table public.time_logs alter column task drop not null;

-- task check must allow null now
alter table public.time_logs drop constraint if exists time_logs_task_check;
alter table public.time_logs add constraint time_logs_task_check
  check (task is null or task in ('Storyboarding','Blockout Premiere','Production','Internal Review','Client Review'));

-- the activity column + allowed values
alter table public.time_logs add column if not exists activity text;
alter table public.time_logs drop constraint if exists time_logs_activity_check;
alter table public.time_logs add constraint time_logs_activity_check
  check (activity is null or activity in ('Sick Leave','Annual Leave','Technical Support'));

-- every row must be a project log or an activity log
alter table public.time_logs drop constraint if exists time_logs_project_or_activity;
alter table public.time_logs add constraint time_logs_project_or_activity
  check (project_id is not null or activity is not null);

-- allow artists to insert their own activity logs (which have no project)
drop policy if exists time_logs_insert on public.time_logs;
create policy time_logs_insert on public.time_logs for insert to authenticated
  with check (
    (user_id = auth.uid() and (activity is not null or public.is_assigned(project_id)))
    or public.is_manager()
  );
