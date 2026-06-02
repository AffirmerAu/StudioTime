-- Run this in Supabase → SQL Editor.
--
-- Enables two artist-side abilities on projects they're assigned to:
--   1. Change a project's STATUS (via a function that only ever touches the status column).
--   2. Assign people (themselves or teammates) to a project's main tasks.
-- Managers keep full control as before. Safe to re-run.

-- 1. set_project_status: change only the status column, for managers or assigned artists.
create or replace function public.set_project_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_manager() or public.is_assigned(p_id)) then
    raise exception 'not authorized to change this project''s status';
  end if;
  if p_status not in ('Upcoming','In Production','With Client','Closed') then
    raise exception 'invalid status: %', p_status;
  end if;
  update public.projects set status = p_status where id = p_id;
end;
$$;
grant execute on function public.set_project_status(uuid, text) to authenticated;

-- 2. task_assignees: allow assigned artists (not just managers) to manage assignees
-- on the main tasks of projects they're assigned to.
drop policy if exists task_assignees_write on public.task_assignees;
create policy task_assignees_write on public.task_assignees for all to authenticated
  using (
    public.is_manager()
    or exists (select 1 from public.project_tasks pt
               where pt.id = project_task_id and public.is_assigned(pt.project_id))
  )
  with check (
    public.is_manager()
    or exists (select 1 from public.project_tasks pt
               where pt.id = project_task_id and public.is_assigned(pt.project_id))
  );
