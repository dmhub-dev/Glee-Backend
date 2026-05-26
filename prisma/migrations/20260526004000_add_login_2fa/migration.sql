-- Email two-factor authentication for all roles

ALTER TABLE "User"
  ADD COLUMN "twoFactorCode" INTEGER,
  ADD COLUMN "twoFactorExpiresAt" TIMESTAMP(3),
  ADD COLUMN "twoFactorVerifiedAt" TIMESTAMP(3);
