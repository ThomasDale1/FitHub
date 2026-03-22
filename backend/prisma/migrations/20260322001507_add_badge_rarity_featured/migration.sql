-- CreateEnum
CREATE TYPE "BadgeRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BadgeCategory" ADD VALUE 'VOLUME';
ALTER TYPE "BadgeCategory" ADD VALUE 'STEPS';
ALTER TYPE "BadgeCategory" ADD VALUE 'PR';
ALTER TYPE "BadgeCategory" ADD VALUE 'SECRET';

-- AlterTable
ALTER TABLE "badges" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isSecret" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rarity" "BadgeRarity" NOT NULL DEFAULT 'COMMON',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user_badges" ADD COLUMN     "isSeen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "featuredBadgeId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_featuredBadgeId_fkey" FOREIGN KEY ("featuredBadgeId") REFERENCES "badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
