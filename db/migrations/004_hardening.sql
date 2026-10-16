-- 004 hardening: one vote per user, company-scoped progress items, DB-backed login limiter, append-only audit log.

create table if not exists feedback_votes (
  feedback_id int not null references feedback(id) on delete cascade,
  voter_email text not null,
  created_at timestamptz not null default now(),
  primary key (feedback_id, voter_email)
);

alter table progress_items add column if not exists company_id text references companies(id);
update progress_items set company_id = 'prd' where company_id is null and exists (select 1 from companies where id = 'prd');
-- Default applies to new rows only (the seed script inserts without a company).
alter table progress_items alter column company_id set default 'prd';

create table if not exists login_attempts (
  id bigserial primary key,
  email text not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_email_at on login_attempts (email, at);

-- Limit: this blocks row-level UPDATE and DELETE only. TRUNCATE and a superuser who disables the trigger can still change audit_log; restrict those at the role level.
create or replace function audit_log_block_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only: % is not allowed', tg_op;
end;
$$;

drop trigger if exists audit_log_append_only on audit_log;
create trigger audit_log_append_only before update or delete on audit_log for each row execute function audit_log_block_mutation();
