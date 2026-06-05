-- ============================================================================
-- Bulk-add projects (and their clients) to StudioTime.
-- Run in Supabase → SQL Editor.
--
-- Safe to re-run: clients and projects already present (matched by name) are
-- skipped, so you won't create duplicates.
-- (Start dates are left blank — set them later in the app if needed.)
-- ============================================================================

-- 1) Ensure the five clients exist (insert any that are missing).
insert into public.clients (name)
select n from (values
  ('Parratech'), ('Inditex'), ('Teva'), ('CHEP'), ('Lendlease')
) as v(n)
where not exists (select 1 from public.clients c where c.name = v.n);

-- 2) Insert the projects, linking each to its client by name.
--    The 5 standard tasks are created automatically for every new project.
insert into public.projects (name, client_id, status, estimated_hours, video_minutes, color)
select v.name, c.id, 'Upcoming', v.est, v.vid, v.color
from (values
  ('LOTO',                 'Parratech', 100,  10, '#e8795a'),
  ('Psychosocial Hazards', 'Parratech', 100,  10, '#5e9cea'),
  ('Hot Work',             'Parratech', 100,  10, '#6ed0b8'),
  ('MH1',                  'Inditex',    60,   2, '#d6a44f'),
  ('MH2',                  'Inditex',    60,   2, '#b48be8'),
  ('MH3',                  'Inditex',    60,   2, '#e87fa6'),
  ('MH4',                  'Inditex',    60,   2, '#7cc36b'),
  ('MH5',                  'Inditex',    60,   2, '#5fb9c9'),
  ('Cryogenic Equipment',  'Teva',       60,  10, '#d98559'),
  ('Refresher Modules',    'CHEP',      200, 200, '#9b8df0'),
  ('Scenario 1',           'Lendlease',  80,   3, '#e8795a'),
  ('Scenario 2',           'Lendlease',  80,   3, '#5e9cea'),
  ('Scenario 3',           'Lendlease',  80,   3, '#6ed0b8')
) as v(name, client, est, vid, color)
join public.clients c on c.name = v.client
where not exists (select 1 from public.projects p where p.name = v.name);

-- 3) (Optional) Check what landed:
-- select p.name, c.name as client, p.estimated_hours, p.video_minutes
-- from public.projects p left join public.clients c on c.id = p.client_id
-- order by p.created_at desc;
