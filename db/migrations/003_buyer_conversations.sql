create table if not exists buyer_conversations (
  conversation_id text primary key,
  branch_id text not null default 'pen',
  enquiry_id text not null default '',
  buyer text not null default '',
  phone text not null default '',
  email text not null default '',
  property text not null default '',
  source text not null default '',
  agent text not null default '',
  temperature text not null default 'New' check (temperature in ('Hot','Warm','New')),
  buyer_type text not null default '',
  finance_status text not null default '',
  needs_to_sell_first text not null default '',
  timeframe text not null default '',
  inspection text not null default 'not_discussed',
  wants_contract boolean not null default false,
  consent text not null default '',
  ready_for_agent boolean not null default false,
  why_ready text not null default '',
  handoff_status text not null default 'none' check (handoff_status in ('none','pending','done')),
  sla_due_at timestamptz,
  after_hours boolean not null default false,
  blocked text not null default '',
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);

create index if not exists buyer_conversations_branch_last on buyer_conversations (branch_id, last_at desc);

create table if not exists buyer_turns (
  conversation_id text not null references buyer_conversations(conversation_id) on delete cascade,
  turn int not null,
  buyer_message text not null default '',
  assistant_reply text not null default '',
  buyer_at timestamptz not null,
  reply_at timestamptz,
  primary key (conversation_id, turn)
);

-- One row per inbound message n8n is about to answer. A second claim for the same
-- conversation and message text inside the window is a duplicate trigger.
create table if not exists buyer_claims (
  id bigserial primary key,
  conversation_id text not null,
  msg_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists buyer_claims_lookup on buyer_claims (conversation_id, msg_hash, created_at desc);
