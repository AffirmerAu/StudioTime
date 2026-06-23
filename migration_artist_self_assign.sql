-- Run this in Supabase → SQL Editor.
--
-- Lets artists assign themselves to (and leave) any project — "open self-assign".
-- They can only ever add or remove THEIR OWN membership row, never anyone else's.
-- Managers keep full control as before. Browsing the list of projects uses the existing
-- project_directory view (labels only). Safe to re-run.

drop policy if exists project_users_self on public.project_users;
create policy project_users_self on public.project_users for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
