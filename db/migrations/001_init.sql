create table if not exists companies (
  id text primary key,
  name text not null,
  entra_enabled boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  suburbs text[] not null default '{}'
);

create table if not exists users (
  id serial primary key,
  email text not null unique,
  name text not null,
  role text not null check (role in ('platform_admin','company_admin','branch_admin','marketing','agent','viewer')),
  company_id text references companies(id),
  branch_id text references branches(id),
  password_hash text,
  status text not null default 'active',
  last_login timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_email text,
  action text not null,
  detail text,
  company_id text,
  branch_id text
);
create index if not exists audit_log_at on audit_log (at desc);

create table if not exists pipeline_sites (
  id serial primary key,
  branch_id text not null references branches(id),
  address text not null,
  suburb text not null,
  zoning text not null default 'TBC',
  zoning_confirmed boolean not null default false,
  lot_size text,
  stage int not null default 0 check (stage between 0 and 9),
  priority text not null default 'M' check (priority in ('H','M','L')),
  signal text,
  da_number text,
  da_type text,
  da_status text,
  source text,
  assignee text,
  next_step text,
  notes text,
  lat double precision,
  lng double precision,
  is_sample boolean not null default false,
  identified_on date not null default current_date,
  stage_changed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pipeline_events (
  id bigserial primary key,
  site_id int not null references pipeline_sites(id) on delete cascade,
  at timestamptz not null default now(),
  actor_email text,
  kind text not null,
  detail text
);

create table if not exists tasks (
  id serial primary key,
  branch_id text references branches(id),
  text text not null,
  assignee text,
  due text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists feedback (
  id serial primary key,
  branch_id text references branches(id),
  page text,
  rating text,
  body text not null,
  status text not null default 'New',
  votes int not null default 0,
  author_email text,
  created_at timestamptz not null default now()
);

create table if not exists progress_items (
  id serial primary key,
  project text not null,
  kind text not null check (kind in ('ask','shipped','blocker','milestone')),
  text text not null,
  owner text,
  due text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists alert_acks (
  alert_key text primary key,
  acked_by text,
  acked_at timestamptz not null default now()
);
