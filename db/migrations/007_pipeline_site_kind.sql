alter table pipeline_sites add column if not exists site_kind text not null default 'da' check (site_kind in ('da','listing'));
alter table pipeline_sites add column if not exists price_guide text;
alter table pipeline_sites add column if not exists recency_label text;

insert into progress_items (project, kind, text, owner, due, company_id)
select v.project, v.kind, v.text, v.owner, v.due, 'prd'
from (values
  ('Development Pipeline', 'shipped', 'Real planning activity and land listings from the 7 Oct run loaded into the pipeline', null, null)
) as v(project, kind, text, owner, due)
where exists (select 1 from companies where id = 'prd')
  and exists (select 1 from progress_items)
  and not exists (select 1 from progress_items p where p.project = v.project and p.text = v.text)
on conflict do nothing;
