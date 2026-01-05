-- AlterTable
ALTER TABLE "TrainingPlan"
ADD COLUMN     "syncedToGoogleTasks" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleTasksSyncDate" TIMESTAMP(3),
ADD COLUMN     "googleTaskListId" TEXT;

-- AlterTable
ALTER TABLE "PlanWorkout"
ADD COLUMN     "googleTaskId" TEXT;




