-- CreateEnum
CREATE TYPE "ChallengeMode" AS ENUM ('MILESTONE', 'TIMED');

-- AlterTable
ALTER TABLE "challenges" ADD COLUMN     "mode" "ChallengeMode" NOT NULL DEFAULT 'MILESTONE';
