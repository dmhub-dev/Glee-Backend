CREATE TABLE "platform_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");

INSERT INTO "platform_settings" ("id", "key", "value", "updatedAt")
VALUES (
  'event_checkout',
  'event_checkout',
  '{"walletInstallmentDepositPercent":30,"walletInstallmentSecurityFeePercent":5}'::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."name" = 'settings:manage'
WHERE r."name" = 'ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
