-- AlterTable
ALTER TABLE "PlanWorkout" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "PlanWorkout_planWeekId_dayOfWeek_order_idx" ON "PlanWorkout"("planWeekId", "dayOfWeek", "order");
