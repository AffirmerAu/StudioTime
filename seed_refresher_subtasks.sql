-- ============================================================================
-- Add 25 sub-tasks under the "Production" task of the "Refresher Modules" project.
-- Run in Supabase → SQL Editor. Safe to re-run: existing sub-tasks (same title on
-- the same task) are skipped, so you won't get duplicates.
--
-- They are added unassigned and not-done; assign people / tick them off in the app.
-- ============================================================================

insert into public.subtasks (project_task_id, title)
select pt.id, v.title
from (values
  ('4 Step Risk Management Refresher'),
  ('Design Control Refresher'),
  ('Emergency Preparedness Refresher'),
  ('Environmental Management Refresher'),
  ('Equipment Isolation Refresher'),
  ('Fatigue Management Refresher'),
  ('Forklift Operations Refresher'),
  ('Hazardous Chemicals Contaminated Equipment Refresher'),
  ('HSR and HSC Member Consultation and Communication Refresher'),
  ('Incident Reporting Refresher'),
  ('Injury Management Refresher'),
  ('JSA Refresher'),
  ('Managing Contractors & Purchasing Accountability Refresher'),
  ('Permit to Work Refresher'),
  ('Plant Maintenance and Safe Training Refresher'),
  ('Safe Driving Refresher'),
  ('Spill Response Refresher'),
  ('Traffic Management Refresher'),
  ('WHS Management Refresher'),
  ('Working Alone or in Isolation Refresher'),
  ('Workplace Ergonomics Refresher'),
  ('Workplace Manual Handling Refresher'),
  ('PPE & Hearing Conservation Refresher'),
  ('Asbestos Refresher'),
  ('Alcohol & other Drugs Refresher')
) as v(title)
join public.project_tasks pt on pt.name = 'Production'
join public.projects p on p.id = pt.project_id and p.name = 'Refresher Modules'
where not exists (
  select 1 from public.subtasks s where s.project_task_id = pt.id and s.title = v.title
);

-- (Optional) confirm what landed:
-- select s.title, s.done
-- from public.subtasks s
-- join public.project_tasks pt on pt.id = s.project_task_id
-- join public.projects p on p.id = pt.project_id
-- where p.name = 'Refresher Modules' and pt.name = 'Production'
-- order by s.created_at;
