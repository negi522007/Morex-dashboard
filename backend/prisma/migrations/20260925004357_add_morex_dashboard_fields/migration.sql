-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarConfig" JSONB,
ADD COLUMN     "avatarPhotoPath" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'galaxy',
ADD COLUMN     "widgetSkin" TEXT NOT NULL DEFAULT 'glass';

-- AlterTable
ALTER TABLE "WidgetInstance" ADD COLUMN     "decoration" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mood" TEXT NOT NULL,
    "textEncrypted" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
