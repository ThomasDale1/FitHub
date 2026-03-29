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
    "gifUrl" TEXT,
    "difficulty" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_externalId_key" ON "exercises"("externalId");

-- CreateIndex
CREATE INDEX "exercises_bodyPart_idx" ON "exercises"("bodyPart");

-- CreateIndex
CREATE INDEX "exercises_equipment_idx" ON "exercises"("equipment");

-- CreateIndex
CREATE INDEX "exercises_bodyPart_equipment_idx" ON "exercises"("bodyPart", "equipment");

-- CreateIndex
CREATE INDEX "exercises_name_idx" ON "exercises"("name");
