-- Add shareable public ticket links without exposing ticket references in URLs.
ALTER TABLE "event_tickets" ADD COLUMN "publicAccessToken" TEXT;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "event_tickets"
SET "publicAccessToken" = encode(gen_random_bytes(32), 'hex')
WHERE "publicAccessToken" IS NULL;

CREATE UNIQUE INDEX "event_tickets_publicAccessToken_key" ON "event_tickets"("publicAccessToken");
