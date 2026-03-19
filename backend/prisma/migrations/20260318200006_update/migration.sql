/*
  Warnings:

  - The values [SPECIFIC_PR] on the enum `ChallengeType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `exerciseName` on the `challenges` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `challenges` table. All the data in the column will be lost.
  - You are about to drop the column `targetUnit` on the `challenges` table. All the data in the column will be lost.
  - You are about to drop the column `targetValue` on the `challenges` table. All the data in the column will be lost.
  - Added the required column `goal` to the `challenges` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unit` to the `challenges` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ChallengeType_new" AS ENUM ('VOLUME', 'FREQUENCY', 'STREAK', 'PR', 'DISTANCE', 'CUSTOM');
ALTER TABLE "challenges" ALTER COLUMN "type" TYPE "ChallengeType_new" USING ("type"::text::"ChallengeType_new");
ALTER TYPE "ChallengeType" RENAME TO "ChallengeType_old";
ALTER TYPE "ChallengeType_new" RENAME TO "ChallengeType";
DROP TYPE "public"."ChallengeType_old";
COMMIT;

-- AlterTable
ALTER TABLE "challenges" DROP COLUMN "exerciseName",
DROP COLUMN "externalId",
DROP COLUMN "targetUnit",
DROP COLUMN "targetValue",
ADD COLUMN     "goal" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "unit" TEXT NOT NULL;
