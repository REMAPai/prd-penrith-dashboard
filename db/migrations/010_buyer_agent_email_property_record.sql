alter table buyer_conversations add column if not exists agent_email text not null default '';
alter table buyer_conversations add column if not exists had_property_record text not null default '' check (had_property_record in ('', 'yes', 'no'));
