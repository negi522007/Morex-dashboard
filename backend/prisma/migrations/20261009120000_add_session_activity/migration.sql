-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- Existing sessions: best known activity is when they were opened
UPDATE "Session" SET "lastSeenAt" = "createdAt";
UPDATE "User" u SET "lastLoginAt" = s.latest, "lastSeenAt" = s.latest
FROM (SELECT "userId", MAX("createdAt") AS latest FROM "Session" GROUP BY "userId") s
WHERE s."userId" = u."id";
