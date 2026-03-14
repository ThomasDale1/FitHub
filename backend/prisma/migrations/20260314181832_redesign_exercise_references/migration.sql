/*
  Warnings:

  - You are about to drop the column `exerciseId` on the `personal_records` table. All the data in the column will be lost.
  - You are about to drop the column `exerciseId` on the `template_sets` table. All the data in the column will be lost.
  - You are about to drop the column `exerciseId` on the `workout_sets` table. All the data in the column will be lost.
  - You are about to drop the `exercises` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `muscle_activations` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,externalId]` on the table `personal_records` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,customExerciseId]` on the table `personal_records` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `custom_exercises` table without a default value. This is not possible if the table is not empty.
  - Added the required column `exerciseName` to the `personal_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `exerciseName` to the `template_sets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `exerciseName` to the `workout_sets` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "muscle_activations" DROP CONSTRAINT "muscle_activations_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "personal_records" DROP CONSTRAINT "personal_records_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "template_sets" DROP CONSTRAINT "template_sets_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "workout_sets" DROP CONSTRAINT "workout_sets_exerciseId_fkey";

-- DropIndex
DROP INDEX "personal_records_userId_exerciseId_key";

-- AlterTable
ALTER TABLE "custom_exercises" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "personal_records" DROP COLUMN "exerciseId",
ADD COLUMN     "customExerciseId" TEXT,
ADD COLUMN     "exerciseName" TEXT NOT NULL,
ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "template_sets" DROP COLUMN "exerciseId",
ADD COLUMN     "customExerciseId" TEXT,
ADD COLUMN     "exerciseName" TEXT NOT NULL,
ADD COLUMN     "externalId" TEXT,
ALTER COLUMN "targetSets" SET DEFAULT 3;

-- AlterTable
ALTER TABLE "workout_sets" DROP COLUMN "exerciseId",
ADD COLUMN     "customExerciseId" TEXT,
ADD COLUMN     "exerciseName" TEXT NOT NULL,
ADD COLUMN     "externalId" TEXT;

-- DropTable
DROP TABLE "exercises";

-- DropTable
DROP TABLE "muscle_activations";

-- CreateIndex
CREATE UNIQUE INDEX "personal_records_userId_externalId_key" ON "personal_records"("userId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "personal_records_userId_customExerciseId_key" ON "personal_records"("userId", "customExerciseId");

-- AddForeignKey
ALTER TABLE "template_sets" ADD CONSTRAINT "template_sets_customExerciseId_fkey" FOREIGN KEY ("customExerciseId") REFERENCES "custom_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_customExerciseId_fkey" FOREIGN KEY ("customExerciseId") REFERENCES "custom_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_customExerciseId_fkey" FOREIGN KEY ("customExerciseId") REFERENCES "custom_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
