-- 008 Development Playbook: weekly feed from the n8n workflow, mirroring the Developer_playbook sheet.
-- Additive and idempotent. The page and project were renamed from "Development Pipeline" to "Development Playbook".

-- Columns the sheet has and the app did not.
alter table pipeline_sites add column if not exists action_taken text;
alter table pipeline_sites add column if not exists zone_code text;
alter table pipeline_sites add column if not exists zone_name text;

-- The sheet has no priority column, so a row may have none. Keep the H/M/L check for rows that do.
alter table pipeline_sites alter column priority drop not null;
alter table pipeline_sites alter column priority drop default;

-- One row per application per council (branch). The weekly feed upserts on this key.
create unique index if not exists pipeline_sites_application
  on pipeline_sites (branch_id, da_type, da_number)
  where da_number is not null and da_type is not null;

-- One row per branch per week (Monday start) that the workflow ran.
create table if not exists playbook_weeks (
  branch_id text not null references branches(id),
  week_start date not null,
  run_at timestamptz not null default now(),
  rows_total int not null default 0,
  primary key (branch_id, week_start)
);

-- The applications the run flagged that week (new or changed), with the status they had then.
create table if not exists playbook_week_items (
  branch_id text not null,
  week_start date not null,
  site_id int not null references pipeline_sites(id) on delete cascade,
  flag text not null default '',
  status_at_week text not null default '',
  primary key (branch_id, week_start, site_id),
  foreign key (branch_id, week_start) references playbook_weeks(branch_id, week_start) on delete cascade
);
create index if not exists playbook_week_items_site on playbook_week_items (site_id);

-- Mirrors the Director & Company Lookup tab. Only what the sheet holds; nothing is filled in by the app.
create table if not exists playbook_companies (
  id serial primary key,
  company_id text not null default 'prd',
  name text not null,
  linked_address text not null default '',
  acn_abn text not null default '',
  asic_done text not null default '',
  directors text not null default '',
  role text not null default '',
  contact_details text not null default '',
  source_used text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

-- Keep the asks, blockers and milestones on Delivery Progress under the new name.
update progress_items set project = 'Development Playbook' where project = 'Development Pipeline';
