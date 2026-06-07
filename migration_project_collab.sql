-- Run this in Supabase → SQL Editor.
--
-- Adds project NOTES and ATTACHMENTS (images, documents, links).
--   * Notes + attachment records live in the database.
--   * Uploaded files live in a private Storage bucket "project-files".
-- Visible to managers and artists assigned to the project; either can add. A person can
-- delete their own; managers can delete any. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------
create table if not exists public.project_notes (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);
alter table public.project_notes enable row level security;

drop policy if exists project_notes_select on public.project_notes;
create policy project_notes_select on public.project_notes for select to authenticated
  using (public.is_manager() or public.is_assigned(project_id));

drop policy if exists project_notes_insert on public.project_notes;
create policy project_notes_insert on public.project_notes for insert to authenticated
  with check (author_id = auth.uid() and (public.is_manager() or public.is_assigned(project_id)));

drop policy if exists project_notes_modify on public.project_notes;
create policy project_notes_modify on public.project_notes for delete to authenticated
  using (public.is_manager() or author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Attachments (file records + links)
-- ---------------------------------------------------------------------------
create table if not exists public.project_attachments (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  kind         text not null check (kind in ('file','link')),
  name         text not null,
  path         text,                -- storage path (files only)
  url          text,                -- external URL (links only)
  mime         text,
  size         bigint,
  created_at   timestamptz not null default now(),
  check ((kind = 'file' and path is not null) or (kind = 'link' and url is not null))
);
alter table public.project_attachments enable row level security;

drop policy if exists project_attachments_select on public.project_attachments;
create policy project_attachments_select on public.project_attachments for select to authenticated
  using (public.is_manager() or public.is_assigned(project_id));

drop policy if exists project_attachments_insert on public.project_attachments;
create policy project_attachments_insert on public.project_attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and (public.is_manager() or public.is_assigned(project_id)));

drop policy if exists project_attachments_modify on public.project_attachments;
create policy project_attachments_modify on public.project_attachments for delete to authenticated
  using (public.is_manager() or uploaded_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded files (private). Files are keyed by project id:
--   project-files/<project_id>/<uuid>-<filename>
-- so the policies can check assignment from the first path segment.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('project-files', 'project-files', false)
  on conflict (id) do nothing;

drop policy if exists "project_files_read" on storage.objects;
create policy "project_files_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'project-files'
    and (public.is_manager() or public.is_assigned(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists "project_files_insert" on storage.objects;
create policy "project_files_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and (public.is_manager() or public.is_assigned(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists "project_files_delete" on storage.objects;
create policy "project_files_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-files'
    and (public.is_manager() or owner = auth.uid())
  );
