-- Remove test-chat conversations (n8n Buyer Test Chat uses ids testchat_<session> and source 'Test chat'). Turns cascade.
delete from buyer_conversations where conversation_id like 'testchat\_%' escape '\' or source = 'Test chat';
