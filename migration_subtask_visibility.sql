-- Run this in Supabase → SQL Editor to enable: "a sub-task assignment makes the
-- project (and that sub-task) appear for the artist, even if they aren't a project member."
--
-- It redefines the is_assigned() helper to also return true when the user has a
-- sub-task assigned within the project. Because is_assigned() gates project,
-- project_tasks, subtasks and time_logs visibility (and time-log insert), this single
-- change lets a sub-task-only assignee see the project in My Projects, see and tick the
-- sub-task, and log time to it. Re-running it is safe (create or replace).

create or replace function public.is_assigned(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_users where project_id = p and user_id = auth.uid())
      or exists (
        select 1 from public.subtasks s
        join public.project_tasks pt on pt.id = s.project_task_id
        where pt.project_id = p and s.assignee_id = auth.uid()
      );
$$;
