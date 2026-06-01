-- Run this in Supabase → SQL Editor IF you already ran schema.sql before this update.
-- It lets assigned artists see every time log on their projects (for total-hours display),
-- while still hiding logs on projects they aren't part of.

drop policy if exists time_logs_select on public.time_logs;
create policy time_logs_select on public.time_logs for select to authenticated
  using (public.is_manager() or user_id = auth.uid() or public.is_assigned(project_id));
