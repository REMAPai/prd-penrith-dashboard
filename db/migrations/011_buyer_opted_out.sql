alter table buyer_conversations add column if not exists opted_out boolean not null default false;
