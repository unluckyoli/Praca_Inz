import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  getActivityDistribution,
  getWeeklyStats,
  getMonthlyTrends,
  getIntensityDistribution,
  getProgressOverTime,
  compareActivities,
  getFitnessMetrics,
  getCalendarHeatmap,
  getRampRate,
  getAerobicEfficiency,
  getTimePatterns,
  getYearOverYear,
  getPerformanceCurve,
} from "../controllers/analytics.controller.js";

const router = express.Router();

router.get("/distribution", authenticate, getActivityDistribution);
router.get("/weekly-stats", authenticate, getWeeklyStats);
router.get("/monthly-trends", authenticate, getMonthlyTrends);
router.get("/intensity-distribution", authenticate, getIntensityDistribution);
router.get("/progress", authenticate, getProgressOverTime);
router.get("/compare", authenticate, compareActivities);
router.get("/fitness-metrics", authenticate, getFitnessMetrics);

// Stage 3 analytics
router.get("/calendar-heatmap", authenticate, getCalendarHeatmap);
router.get("/ramp-rate", authenticate, getRampRate);
router.get("/aerobic-efficiency", authenticate, getAerobicEfficiency);
router.get("/time-patterns", authenticate, getTimePatterns);
router.get("/year-over-year", authenticate, getYearOverYear);
router.get("/performance-curve", authenticate, getPerformanceCurve);

export default router;
