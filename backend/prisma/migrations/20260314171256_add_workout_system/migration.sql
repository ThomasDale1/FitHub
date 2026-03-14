/*
  Warnings:

  - You are about to drop the column `exercise` on the `workout_sets` table. All the data in the column will be lost.
  - You are about to drop the column `sets` on the `workout_sets` table. All the data in the column will be lost.
  - Added the required column `exerciseId` to the `workout_sets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order` to the `workout_sets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `setNumber` to the `workout_sets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `workouts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('NORMAL', 'WARMUP', 'DROPSET', 'SUPERSET', 'FAILURE', 'AMRAP');

-- AlterTable
ALTER TABLE "workout_sets" DROP COLUMN "exercise",
DROP COLUMN "sets",
ADD COLUMN     "distance" DOUBLE PRECISION,
ADD COLUMN     "exerciseId" TEXT NOT NULL,
ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPR" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "order" INTEGER NOT NULL,
ADD COLUMN     "restSeconds" INTEGER,
ADD COLUMN     "rpe" DOUBLE PRECISION,
ADD COLUMN     "setNumber" INTEGER NOT NULL,
ADD COLUMN     "setType" "SetType" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "endTime" TIMESTAMP(3),
ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muscleStimulus" JSONB,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "instructions" TEXT[],
    "secondaryMuscles" TEXT[],
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_exercises" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "notes" TEXT,
    "secondaryMuscles" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muscle_activations" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "muscleName" TEXT NOT NULL,
    "activationPct" DOUBLE PRECISION NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "muscle_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_sets" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "targetSets" INTEGER NOT NULL,
    "targetReps" INTEGER,
    "targetWeight" DOUBLE PRECISION,
    "restSeconds" INTEGER NOT NULL DEFAULT 90,
    "notes" TEXT,

    CONSTRAINT "template_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "reps" INTEGER,
    "volume" DOUBLE PRECISION,
    "oneRepMax" DOUBLE PRECISION,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_externalId_key" ON "exercises"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "personal_records_userId_exerciseId_key" ON "personal_records"("userId", "exerciseId");

-- AddForeignKey
ALTER TABLE "custom_exercises" ADD CONSTRAINT "custom_exercises_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muscle_activations" ADD CONSTRAINT "muscle_activations_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_sets" ADD CONSTRAINT "template_sets_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workout_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_sets" ADD CONSTRAINT "template_sets_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workout_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
