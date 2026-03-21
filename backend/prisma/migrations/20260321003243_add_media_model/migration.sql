-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterEnum
ALTER TYPE "PostType" ADD VALUE 'VIDEO';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarPublicId" TEXT;

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "duration" DOUBLE PRECISION,
    "thumbnailUrl" TEXT,
    "postId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_publicId_key" ON "media"("publicId");

-- CreateIndex
CREATE INDEX "media_userId_idx" ON "media"("userId");

-- CreateIndex
CREATE INDEX "media_postId_idx" ON "media"("postId");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
