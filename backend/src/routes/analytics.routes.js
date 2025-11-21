import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  getActivityDistribution,
  getWeeklyStats,
  getMonthlyTrends,
  getIntensityDistribution,
  getProgressOverTime,
  compareActivities,
} from "../controllers/analytics.controller.js";

const router = express.Router();

router.get("/distribution", authenticate, getActivityDistribution);
router.get("/weekly-stats", authenticate, getWeeklyStats);
router.get("/monthly-trends", authenticate, getMonthlyTrends);
router.get("/intensity-distribution", authenticate, getIntensityDistribution);
router.get("/progress", authenticate, getProgressOverTime);
router.get("/compare", authenticate, compareActivities);

export default router;
