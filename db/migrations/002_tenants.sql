create table if not exists tenants (
  tid text primary key,
  name text not null,
  kind text not null check (kind in ('platform','company')),
  company_id text references companies(id),
  domains text[] not null default '{}'
);

alter table users add column if not exists entra_oid text unique;

-- Public Entra tenant IDs (from each domain's OpenID discovery document).
insert into tenants (tid, name, kind, company_id, domains) values
  ('7b712bf0-a681-4071-adb1-fd3b7cdd4238', 'REMAP.ai', 'platform', null, '{remap.ai}')
on conflict (tid) do nothing;

insert into tenants (tid, name, kind, company_id, domains)
select '00a7a54b-524b-4504-a195-6a5301ed9cb1', 'PRD Group', 'company', 'prd', '{prd.net.au}'
where exists (select 1 from companies where id = 'prd')
on conflict (tid) do nothing;
