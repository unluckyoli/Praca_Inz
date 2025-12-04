/*
  Warnings:

  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "intensityFactor" DOUBLE PRECISION,
ADD COLUMN     "normalizedPower" INTEGER,
ADD COLUMN     "pacePerKm" JSONB,
ADD COLUMN     "tss" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT,
ADD COLUMN     "stravaAccessToken" TEXT,
ADD COLUMN     "stravaRefreshToken" TEXT,
ADD COLUMN     "stravaTokenExpiresAt" TIMESTAMP(3),
ALTER COLUMN "email" SET NOT NULL;

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GpsPoint" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitude" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "speed" DOUBLE PRECISION,
    "heartRate" INTEGER,
    "power" INTEGER,
    "cadence" INTEGER,

    CONSTRAINT "GpsPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PowerCurve" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sec5" DOUBLE PRECISION,
    "sec30" DOUBLE PRECISION,
    "min1" DOUBLE PRECISION,
    "min2" DOUBLE PRECISION,
    "min5" DOUBLE PRECISION,
    "min10" DOUBLE PRECISION,
    "min20" DOUBLE PRECISION,
    "min60" DOUBLE PRECISION,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PowerCurve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitnessMetrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ctl" DOUBLE PRECISION NOT NULL,
    "atl" DOUBLE PRECISION NOT NULL,
    "tsb" DOUBLE PRECISION NOT NULL,
    "rampRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FitnessMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityCluster" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "cluster" INTEGER NOT NULL,
    "pca1" DOUBLE PRECISION NOT NULL,
    "pca2" DOUBLE PRECISION NOT NULL,
    "features" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "avgGrade" DOUBLE PRECISION,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentEffort" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "elapsedTime" INTEGER NOT NULL,
    "movingTime" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "avgPower" INTEGER,
    "avgHr" INTEGER,
    "isPr" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentEffort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "earned" BOOLEAN NOT NULL DEFAULT false,
    "earnedDate" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "GpsPoint_activityId_idx" ON "GpsPoint"("activityId");

-- CreateIndex
CREATE INDEX "GpsPoint_timestamp_idx" ON "GpsPoint"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PowerCurve_activityId_key" ON "PowerCurve"("activityId");

-- CreateIndex
CREATE INDEX "PowerCurve_userId_idx" ON "PowerCurve"("userId");

-- CreateIndex
CREATE INDEX "PowerCurve_createdAt_idx" ON "PowerCurve"("createdAt");

-- CreateIndex
CREATE INDEX "FitnessMetrics_userId_idx" ON "FitnessMetrics"("userId");

-- CreateIndex
CREATE INDEX "FitnessMetrics_date_idx" ON "FitnessMetrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessMetrics_userId_date_key" ON "FitnessMetrics"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCluster_activityId_key" ON "ActivityCluster"("activityId");

-- CreateIndex
CREATE INDEX "ActivityCluster_userId_idx" ON "ActivityCluster"("userId");

-- CreateIndex
CREATE INDEX "ActivityCluster_cluster_idx" ON "ActivityCluster"("cluster");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_externalId_key" ON "Segment"("externalId");

-- CreateIndex
CREATE INDEX "SegmentEffort_userId_idx" ON "SegmentEffort"("userId");

-- CreateIndex
CREATE INDEX "SegmentEffort_segmentId_idx" ON "SegmentEffort"("segmentId");

-- CreateIndex
CREATE INDEX "SegmentEffort_startDate_idx" ON "SegmentEffort"("startDate");

-- CreateIndex
CREATE INDEX "Achievement_userId_idx" ON "Achievement"("userId");

-- CreateIndex
CREATE INDEX "Achievement_earned_idx" ON "Achievement"("earned");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GpsPoint" ADD CONSTRAINT "GpsPoint_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PowerCurve" ADD CONSTRAINT "PowerCurve_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessMetrics" ADD CONSTRAINT "FitnessMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCluster" ADD CONSTRAINT "ActivityCluster_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentEffort" ADD CONSTRAINT "SegmentEffort_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentEffort" ADD CONSTRAINT "SegmentEffort_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
