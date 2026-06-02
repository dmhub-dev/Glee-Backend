-- Drop legacy ticket check-in ledger after check-in state moved onto event_tickets.
DROP TABLE IF EXISTS "ticket_check_ins";

-- Drop unused chat/blocking tables.
DROP TABLE IF EXISTS "user_blocks";
DROP TABLE IF EXISTS "chats";

-- Drop chat-only user state now that chat tables are removed.
ALTER TABLE "User" DROP COLUMN IF EXISTS "isAllChatRead";
