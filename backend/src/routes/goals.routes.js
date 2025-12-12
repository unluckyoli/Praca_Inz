import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { getCurrentGoal, createGoal, listGoalsHistory } from "../controllers/goals.controller.js";

const router = express.Router();

router.get("/current", authenticate, getCurrentGoal);
router.post("/", authenticate, createGoal);
router.get("/history", authenticate, listGoalsHistory);

export default router;
