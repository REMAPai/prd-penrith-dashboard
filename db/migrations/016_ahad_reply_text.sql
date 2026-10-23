-- Changes the assistant reply shown on one dashboard conversation (Ahad Nawaz, 9 Dobell Circuit, St Clair, 23 Oct 2026).
-- The enquiry was a sales pitch sent through the portal, not a buyer. The reply below was never sent to anyone.
-- Idempotent: only the old text is replaced, and nothing else on the conversation changes.

update buyer_turns t
   set assistant_reply = $$Hi Ahad, thanks for your message. I'm the virtual assistant for PRD Penrith, and I'm here to help. If you're looking for a property, tell me and I can help with that.$$
  from buyer_conversations c
 where c.conversation_id = t.conversation_id
   and c.buyer ilike '%Ahad%Nawaz%'
   and c.property ilike '%9 Dobell Circuit%'
   and t.turn = 1
   and t.assistant_reply = 'Hi Ahad, thanks for your message.';
