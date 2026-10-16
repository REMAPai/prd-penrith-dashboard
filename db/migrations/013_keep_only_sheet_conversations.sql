-- Production data cleanup, requested in chat by the project owner on 2026-10-16: the dashboard shows only the real
-- enquiries that are in the Conversations sheet (the three below, 15 and 16 Oct). Everything older (1, 5 and 7 Oct) goes.
-- Rows that arrive after this migration was written (last_at after the cut-off) are never touched. Turns cascade.
delete from buyer_conversations
where conversation_id not in ('vault_72621635', 'vault_72628935', 'vault_72647125')
  and last_at <= '2026-10-16T12:30:00Z';
