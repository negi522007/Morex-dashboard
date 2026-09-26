-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthDate" DATE;

-- CreateTable
CREATE TABLE "BlockedEmail" (
    "email" TEXT NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedEmail_pkey" PRIMARY KEY ("email")
);
