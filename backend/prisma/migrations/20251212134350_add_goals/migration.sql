/*
  Warnings:

  - A unique constraint covering the columns `[userId,externalId,source]` on the table `Activity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('DISTANCE_KM', 'DURATION_MIN', 'ACTIVITIES_COUNT', 'ELEVATION_M');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('WEEK', 'MONTH');

-- DropIndex
DROP INDEX "Activity_externalId_source_key";

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GoalType" NOT NULL,
    "period" "GoalPeriod" NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Goal_userId_isActive_idx" ON "Goal"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Goal_userId_windowStart_windowEnd_idx" ON "Goal"("userId", "windowStart", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_externalId_source_key" ON "Activity"("userId", "externalId", "source");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
