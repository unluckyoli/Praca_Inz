import prisma from "../config/database.js";
import { getUserId } from "../utils/auth.utils.js";
import { closeExpiredGoalIfNeeded, computeGoalProgress, createNewGoal } from "../services/goals.service.js";

export const getCurrentGoal = async (req, res) => {
  try {
    const userId = getUserId(req);

    let goal = await prisma.goal.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!goal) {
      return res.json({ goal: null, progress: null });
    }

    goal = await closeExpiredGoalIfNeeded(userId, goal);


    if (!goal.isActive) {
      return res.json({ goal: null, progress: null });
    }

    const progress = await computeGoalProgress(userId, goal);
    res.json({ goal, progress });
  } catch (e) {
    console.error("getCurrentGoal error:", e);
    res.status(500).json({ error: "Failed to fetch current goal" });
  }
};

export const createGoal = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { type, period, target } = req.body;

    const allowedTypes = ["DISTANCE_KM", "DURATION_MIN", "ACTIVITIES_COUNT", "ELEVATION_M"];
    const allowedPeriods = ["WEEK", "MONTH"];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid goal type" });
    }
    if (!allowedPeriods.includes(period)) {
      return res.status(400).json({ error: "Invalid goal period" });
    }

    const targetNum = Number(target);
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      return res.status(400).json({ error: "Target must be a positive number" });
    }

    const goal = await createNewGoal(userId, { type, period, target: targetNum });
    const progress = await computeGoalProgress(userId, goal);

    res.status(201).json({ goal, progress });
  } catch (e) {
    console.error("createGoal error:", e);
    res.status(500).json({ error: "Failed to create goal" });
  }
};

export const listGoalsHistory = async (req, res) => {
  try {
    const userId = getUserId(req);


    const active = await prisma.goal.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (active) {
      await closeExpiredGoalIfNeeded(userId, active);
    }

    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ goals });
  } catch (e) {
    console.error("listGoalsHistory error:", e);
    res.status(500).json({ error: "Failed to fetch goals history" });
  }
};
