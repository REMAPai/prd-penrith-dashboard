-- One-off correction, requested in chat on 2026-10-16: this real enquiry was saved before the workflow fix, with no agent
-- and not marked ready for an agent. Assign it to Thomas Latty (the pilot agent) and hand it over. Idempotent.
update buyer_conversations
set agent = 'thomas latty',
    agent_email = 'thomas.latty@prd.net.au',
    ready_for_agent = true,
    why_ready = 'Portal enquiry passed to agent',
    handoff_status = case when handoff_status = 'done' then 'done' else 'pending' end
where conversation_id = 'vault_72647125';
