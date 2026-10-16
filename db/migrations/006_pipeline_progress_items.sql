insert into progress_items (project, kind, text, owner, due, company_id)
select v.project, v.kind, v.text, v.owner, v.due, 'prd'
from (values
  ('Development Pipeline', 'ask', 'Name who runs the Monday playbook at PRD', 'Darren', 'Next week'),
  ('Development Pipeline', 'ask', 'Agree the ownership hold-period rule', 'Darren', 'Next week'),
  ('Development Pipeline', 'shipped', 'Pipeline board, table and weekly snapshot with zoning confirmation', null, null),
  ('Development Pipeline', 'shipped', 'Fields we are building towards shown as data under testing', null, null),
  ('Development Pipeline', 'blocker', 'RP Data and Cordell access and cost not confirmed', 'Darren with Cotality', 'Open'),
  ('Development Pipeline', 'milestone', 'Weekly feed from the NSW Planning Portal', null, 'next'),
  ('Development Pipeline', 'milestone', 'Owner and director trace recorded on each site', null, 'next'),
  ('Development Pipeline', 'milestone', 'Monday report run by a PRD team member', null, 'next')
) as v(project, kind, text, owner, due)
where exists (select 1 from companies where id = 'prd')
  and exists (select 1 from progress_items)
  and not exists (select 1 from progress_items p where p.project = v.project and p.text = v.text)
on conflict do nothing;
