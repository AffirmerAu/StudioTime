-- ============================================================================
-- StudioTime — Supabase schema, security, and triggers
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: it drops and recreates policies/triggers it owns.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. Reference values (kept as CHECK constraints to mirror the original spec)
-- ----------------------------------------------------------------------------
-- Task names are the 5 fixed tasks every project has.
-- Statuses: Upcoming / In Production / With Client / Closed.

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

-- Profiles: one row per auth user (created automatically by trigger below).
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  role        text not null default 'artist' check (role in ('manager','artist')),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  contact_person  text,
  email           text,
  phone           text,
  notes           text,
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  client_id           uuid references public.clients(id) on delete set null,
  status              text not null default 'Upcoming'
                        check (status in ('Upcoming','In Production','With Client','Closed')),
  estimated_hours     numeric not null default 0,
  start_date          date,
  client_review_date  date,            -- optional; added later in the lifecycle
  closed_date         date,
  video_minutes       numeric,
  color               text,            -- UI accent colour chosen on create
  archived            boolean not null default false,
  created_at          timestamptz not null default now()
);

-- Many-to-many: which artists are on which project.
create table if not exists public.project_users (
  project_id  uuid references public.projects(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  primary key (project_id, user_id)
);

-- One row per (project × fixed task). Seeded automatically on project insert.
create table if not exists public.project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null
                check (name in ('Storyboarding','Blockout Premiere','Production','Internal Review','Client Review')),
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (project_id, name)
);

-- Managers assign fixed tasks to project members.
create table if not exists public.task_assignees (
  project_task_id  uuid references public.project_tasks(id) on delete cascade,
  user_id          uuid references public.profiles(id) on delete cascade,
  primary key (project_task_id, user_id)
);

-- Artists (or managers) can add sub-tasks under a fixed task and assign them.
create table if not exists public.subtasks (
  id               uuid primary key default gen_random_uuid(),
  project_task_id  uuid not null references public.project_tasks(id) on delete cascade,
  title            text not null,
  assignee_id      uuid references public.profiles(id) on delete set null,
  done             boolean not null default false,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create table if not exists public.time_logs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  task        text not null
                check (task in ('Storyboarding','Blockout Premiere','Production','Internal Review','Client Review')),
  hours       numeric not null check (hours > 0 and hours <= 24),
  log_date    date not null,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Scheduler bars span a date range and carry an hours value (Gantt-style).
create table if not exists public.schedule_entries (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects(id) on delete cascade,
  activity    text check (activity is null or activity in ('Sick Leave','Annual Leave','Technical Support')),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  task        text
                check (task is null or task in ('Storyboarding','Blockout Premiere','Production','Internal Review','Client Review')),
  start_date  date not null,
  end_date    date not null,
  hours       numeric not null default 0,
  notes       text,
  created_at  timestamptz not null default now(),
  check (project_id is not null or activity is not null),
  check (end_date >= start_date)
);

-- Helpful indexes
create index if not exists idx_projects_client     on public.projects(client_id);
create index if not exists idx_project_users_user  on public.project_users(user_id);
create index if not exists idx_time_logs_project   on public.time_logs(project_id);
create index if not exists idx_time_logs_user      on public.time_logs(user_id);
create index if not exists idx_sched_user          on public.schedule_entries(user_id);
create index if not exists idx_project_tasks_proj  on public.project_tasks(project_id);
create index if not exists idx_subtasks_task       on public.subtasks(project_task_id);

-- ----------------------------------------------------------------------------
-- 3. Helper functions (SECURITY DEFINER avoids recursive RLS on profiles)
-- ----------------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

-- A user is "assigned" to a project if they are a project member OR they have a
-- sub-task assigned to them within that project. This gates project/task/subtask/
-- time-log visibility, so a sub-task assignment alone surfaces the project for them.
create or replace function public.is_assigned(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_users where project_id = p and user_id = auth.uid())
      or exists (
        select 1 from public.subtasks s
        join public.project_tasks pt on pt.id = s.project_task_id
        where pt.project_id = p and s.assignee_id = auth.uid()
      );
$$;

-- Change ONLY a project's status. Managers may change any project; artists may change
-- projects they're assigned to. Used so artists can update status without granting them
-- write access to other project columns (RLS can't restrict columns; this RPC can).
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

-- ----------------------------------------------------------------------------
-- 4. Triggers: auto-create profile on signup; seed 5 tasks on project create
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'artist')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.seed_project_tasks()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_tasks (project_id, name)
  select new.id, t
  from unnest(array['Storyboarding','Blockout Premiere','Production','Internal Review','Client Review']) as t
  on conflict (project_id, name) do nothing;
  return new;
end; $$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.seed_project_tasks();

-- ----------------------------------------------------------------------------
-- 5. Enable Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.projects          enable row level security;
alter table public.project_users     enable row level security;
alter table public.project_tasks     enable row level security;
alter table public.task_assignees    enable row level security;
alter table public.subtasks          enable row level security;
alter table public.time_logs         enable row level security;
alter table public.schedule_entries  enable row level security;

-- ----------------------------------------------------------------------------
-- 6. Policies
--    Managers (is_manager()) get full access everywhere.
--    Artists get scoped access to projects they are assigned to.
-- ----------------------------------------------------------------------------

-- profiles: everyone signed in can read profiles (names/avatars); self-update; managers update anyone
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_manager())
  with check (id = auth.uid() or public.is_manager());

-- clients: managers only (artists have no access at all)
drop policy if exists clients_all on public.clients;
create policy clients_all on public.clients for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- projects: managers full; artists can read projects they're on
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (public.is_manager() or public.is_assigned(id));

drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- project_users: managers manage; artists can see their own membership rows
drop policy if exists project_users_select on public.project_users;
create policy project_users_select on public.project_users for select to authenticated
  using (public.is_manager() or user_id = auth.uid());

drop policy if exists project_users_write on public.project_users;
create policy project_users_write on public.project_users for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- project_tasks: read if manager or assigned; artists may UPDATE (tick done);
-- insert/delete reserved for managers (the 5 tasks are fixed/seeded)
drop policy if exists project_tasks_select on public.project_tasks;
create policy project_tasks_select on public.project_tasks for select to authenticated
  using (public.is_manager() or public.is_assigned(project_id));

drop policy if exists project_tasks_update on public.project_tasks;
create policy project_tasks_update on public.project_tasks for update to authenticated
  using (public.is_manager() or public.is_assigned(project_id))
  with check (public.is_manager() or public.is_assigned(project_id));

drop policy if exists project_tasks_insert on public.project_tasks;
create policy project_tasks_insert on public.project_tasks for insert to authenticated
  with check (public.is_manager());

drop policy if exists project_tasks_delete on public.project_tasks;
create policy project_tasks_delete on public.project_tasks for delete to authenticated
  using (public.is_manager());

-- task_assignees: managers, OR artists assigned to the project, may read & manage
-- (so an artist can assign themselves or teammates to a project's main tasks).
drop policy if exists task_assignees_select on public.task_assignees;
create policy task_assignees_select on public.task_assignees for select to authenticated
  using (
    public.is_manager()
    or exists (select 1 from public.project_tasks pt
               where pt.id = project_task_id and public.is_assigned(pt.project_id))
  );

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

-- subtasks: managers and assigned artists may read & manage (add/assign/tick/remove)
drop policy if exists subtasks_all on public.subtasks;
create policy subtasks_all on public.subtasks for all to authenticated
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

-- time_logs: managers see all; artists see every log on projects they're assigned to
-- (so a project's TOTAL logged hours is visible to its team, not just their own).
drop policy if exists time_logs_select on public.time_logs;
create policy time_logs_select on public.time_logs for select to authenticated
  using (public.is_manager() or user_id = auth.uid() or public.is_assigned(project_id));

drop policy if exists time_logs_insert on public.time_logs;
create policy time_logs_insert on public.time_logs for insert to authenticated
  with check (
    (user_id = auth.uid() and public.is_assigned(project_id))
    or public.is_manager()
  );

drop policy if exists time_logs_modify on public.time_logs;
create policy time_logs_modify on public.time_logs for update to authenticated
  using (user_id = auth.uid() or public.is_manager())
  with check (user_id = auth.uid() or public.is_manager());

drop policy if exists time_logs_delete on public.time_logs;
create policy time_logs_delete on public.time_logs for delete to authenticated
  using (user_id = auth.uid() or public.is_manager());

-- schedule_entries: everyone signed in can READ all entries (shared studio board);
-- artists may write (insert/update/delete) only their OWN row on projects they're
-- assigned to; managers have full write over everyone.
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

-- ----------------------------------------------------------------------------
-- 6b. Project directory (labels only) for the shared scheduler board.
--    Lets ANY signed-in user resolve a project's name + colour, even for projects
--    they're not assigned to, so the studio-wide scheduler can label every bar.
--    Exposes only non-sensitive labels — no hours, clients, dates, or status.
--    A security_invoker view would re-apply projects' RLS (hiding rows), so this
--    is intentionally a plain view that reads names for everyone.
-- ----------------------------------------------------------------------------
drop view if exists public.project_directory;
create view public.project_directory as
  select p.id, p.name, p.color, p.archived, c.name as client_name
  from public.projects p
  left join public.clients c on c.id = p.client_id;

grant select on public.project_directory to authenticated;

-- Client directory (labels only): lets any signed-in user resolve a client's NAME,
-- so artists can see the client on projects they're assigned to. Exposes only id + name —
-- no contact person, email, phone, or notes (those stay manager-only via clients' RLS).
drop view if exists public.client_directory;
create view public.client_directory as
  select id, name from public.clients;

grant select on public.client_directory to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Grants for the Data API (PostgREST)
--    Required for projects created after 2026-05-30. RLS still governs ROWS;
--    these grants govern TABLE access for the signed-in (authenticated) role.
-- ----------------------------------------------------------------------------
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ============================================================================
-- Done. Next: create your first user, then in the SQL editor run
--   update public.profiles set role = 'manager' where id = '<your-user-id>';
-- to make yourself a manager. Find the id under Authentication → Users.
-- ============================================================================
