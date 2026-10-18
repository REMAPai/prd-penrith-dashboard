-- Corrects ten conversations on the dashboard so they match the corrected Google Sheet (18 Oct 2026).
-- None of the replies below was ever sent to a buyer. Idempotent. A buyer already marked contacted stays contacted.

-- 1. Corrected replies (first turn of each conversation)
with fix (conversation_id, reply) as (
  values
    ('vault_72647125', $$Hi Sid, thanks for your enquiry on 12 Lucas Street, Emu Plains. It's a 4 bedroom, 2 bathroom home with a 618 sqm land size. I've passed your enquiry to our sales agent Thomas Latty, who will be in touch to confirm more details. If you need any help or have questions, just let me know.$$),
    ('vault_72653115', $$Hi Richard, thanks for your enquiry on 7/26-32 Princess Mary Street, St Marys. It’s a 2 bedroom, 2 bathroom apartment. I’ve passed your enquiry to our sales agent Thomas Latty, who will be in touch to confirm details. If you need any help or have questions, just let me know.$$),
    ('vault_72655992', $$Hi Mitchell, G04/4B Retreat Drive, Penrith is no longer available. I've passed your enquiry to Thomas Latty, who can talk you through similar properties. You can reply STOP anytime to opt out.$$),
    ('vault_72659036', $$Hi Nassar, a price guide for 38 & 38A College Street, Cambridge Park hasn't been published yet. Thomas Latty can talk you through pricing. If you'd like a private inspection, I'll pass that to Thomas Latty.$$),
    ('vault_72668017', $$Hi Nicole, 5/58 Castlereagh Street, Penrith is no longer available. I've passed your enquiry to Thomas Latty, who can talk you through similar properties. You can reply STOP anytime to opt out.$$),
    ('vault_72672504', $$Hi Samantha, a price guide has not been published yet for 12 Lucas Street, Emu Plains. Thomas Latty can talk you through the pricing. If you'd like a private inspection, I'll pass that to Thomas Latty.$$),
    ('vault_72682911', $$Hi Aaron, 21/21-25 Orth Street, Kingswood is no longer available. I've passed your enquiry to Thomas Latty, who can talk you through similar properties. You can reply STOP anytime to opt out.$$),
    ('vault_72683940', $$Hi Shreya, G04/4B Retreat Drive, Penrith is no longer available. I've passed your enquiry to Thomas Latty, who can talk you through similar properties. You can reply STOP anytime to opt out.$$)
)
update buyer_turns t set assistant_reply = f.reply
  from fix f where t.conversation_id = f.conversation_id and t.turn = 1;

-- 2. A garbled dash in one buyer's message (UTF-8 read as Windows-1252)
update buyer_turns
   set buyer_message = replace(buyer_message, 'â€“', '–')
 where conversation_id = 'vault_72682911' and buyer_message like '%â€“%';

-- 3. Hand-over status: buyers the reply promised an agent for are with Thomas Latty, with the right reason
with fix (conversation_id, why_ready, set_agent) as (
  values
    ('vault_72621635', 'Portal enquiry passed to agent', false),
    ('vault_72628935', 'Portal enquiry passed to agent', false),
    ('vault_72647125', 'Portal enquiry passed to agent', true),
    ('vault_72659036', 'Assistant told the buyer the agent will follow up', true),
    ('vault_72672504', 'Assistant told the buyer the agent will follow up', true),
    ('vault_72682911', 'Assistant told the buyer the agent will follow up', true),
    ('vault_72683940', 'Assistant told the buyer the agent will follow up', true)
)
update buyer_conversations c
   set why_ready = f.why_ready,
       ready_for_agent = true,
       agent = case when f.set_agent then 'thomas latty' else c.agent end,
       agent_email = case when f.set_agent then 'thomas.latty@prd.net.au' else c.agent_email end,
       handoff_status = case when c.handoff_status = 'done' then 'done' else 'pending' end
  from fix f
 where c.conversation_id = f.conversation_id;
