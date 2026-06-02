-- Run this in Supabase → SQL Editor to let artists use the scheduler.
--
-- Before: schedule_entries was manager-only.
-- After: everyone signed in can READ all entries (so the whole studio sees the board),
-- but artists can INSERT/UPDATE/DELETE only their OWN row (user_id = themselves) and only
-- on projects they're assigned to. Managers keep full write access over everyone — including
-- placing blocks on an artist's row, which that artist may then move or delete (their row, their time).
-- Safe to re-run.

drop policy if exists schedule_all on public.schedule_entries;

drop policy if exists schedule_select on public.schedule_entries;
create policy schedule_select on public.schedule_entries for select to authenticated
  using (true);

drop policy if exists schedule_insert on public.schedule_entries;
create policy schedule_insert on public.schedule_entries for insert to authenticated
  with check (
    public.is_manager()
    or (user_id = auth.uid() and public.is_assigned(project_id))
  );

drop policy if exists schedule_update on public.schedule_entries;
create policy schedule_update on public.schedule_entries for update to authenticated
  using (public.is_manager() or user_id = auth.uid())
  with check (
    public.is_manager()
    or (user_id = auth.uid() and public.is_assigned(project_id))
  );

drop policy if exists schedule_delete on public.schedule_entries;
create policy schedule_delete on public.schedule_entries for delete to authenticated
  using (public.is_manager() or user_id = auth.uid());
