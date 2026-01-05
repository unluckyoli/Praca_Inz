import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  analyzeUserTraining,
  generateTrainingPlan,
  generateTrainingPlanSSE,
  getUserTrainingPlans,
  getTrainingPlanById,
  completeWorkout,
  updatePlanStatus,
  updatePlanName,
  deleteTrainingPlan,
  getRecommendedPlan,
  getPlanTemplates,
  getPlanById,
  getSessionById,
  syncPlanToCalendar,
  syncPlanToGoogleTasks,
  updateWorkout,
  addWorkoutToPlan,
  deleteWorkout,
  recomputePlanWorkouts,
} from "../controllers/trainingPlan.controller.js";

const router = express.Router();

router.get("/analyze", authenticate, analyzeUserTraining);
router.post("/generate", authenticate, generateTrainingPlan);
router.post("/generate-sse", authenticate, generateTrainingPlanSSE); 
router.get("/my-plans", authenticate, getUserTrainingPlans);
router.get("/my-plans/:planId", authenticate, getTrainingPlanById);
router.patch("/workout/:workoutId/complete", authenticate, completeWorkout);
router.patch("/workout/:workoutId", authenticate, updateWorkout);
router.post("/my-plans/:planId/recompute-workouts", authenticate, recomputePlanWorkouts);
router.delete("/workout/:workoutId", authenticate, deleteWorkout);
router.post("/my-plans/:planId/workout", authenticate, addWorkoutToPlan);
router.patch("/my-plans/:planId/status", authenticate, updatePlanStatus);
router.patch("/my-plans/:planId/name", authenticate, updatePlanName);
router.delete("/my-plans/:planId", authenticate, deleteTrainingPlan);
router.post("/my-plans/:id/sync-to-calendar", authenticate, syncPlanToCalendar);
router.post("/my-plans/:id/sync-to-tasks", authenticate, syncPlanToGoogleTasks);

router.get("/recommend", authenticate, getRecommendedPlan);
router.get("/templates", authenticate, getPlanTemplates);
router.get("/session/:id", authenticate, getSessionById);
router.get("/:id", authenticate, getPlanById);

export default router;
