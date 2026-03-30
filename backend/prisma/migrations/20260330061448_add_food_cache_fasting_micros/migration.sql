-- AlterEnum
ALTER TYPE "FoodSource" ADD VALUE 'AI_TEXT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fastingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fastingHours" INTEGER,
ADD COLUMN     "fastingProtocol" TEXT,
ADD COLUMN     "fastingStartHour" INTEGER,
ADD COLUMN     "fiberGoal" DOUBLE PRECISION,
ADD COLUMN     "sodiumGoal" DOUBLE PRECISION,
ADD COLUMN     "sugarGoal" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "food_cache" (
    "id" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "servingSize" DOUBLE PRECISION NOT NULL,
    "servingUnit" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sugar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sodium" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "rawData" JSONB,
    "searchHits" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "food_cache_barcode_key" ON "food_cache"("barcode");

-- CreateIndex
CREATE INDEX "food_cache_name_idx" ON "food_cache"("name");
