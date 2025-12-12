import prisma from "../config/database.js";
import { getWindow } from "../utils/goalWindow.js";

function round1(x) {
  return Math.round(x * 10) / 10;
}

export async function computeGoalProgress(userId, goal) {
  const activities = await prisma.activity.findMany({
    where: {
      userId,
      startDate: {
        gte: goal.windowStart,
        lt: goal.windowEnd,
      },
    },
    select: {
      distance: true,
      duration: true,
      elevationGain: true,
      type: true,
    },
  });

  const totalDistanceKm = activities.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
  const totalDurationMin = activities.reduce((s, a) => s + (a.duration || 0), 0) / 60;
  const totalElevationM = activities.reduce((s, a) => s + (a.elevationGain || 0), 0);
  const totalActivities = activities.length;

  let current = 0;
  let unit = "";

  switch (goal.type) {
    case "DISTANCE_KM":
      current = totalDistanceKm;
      unit = "km";
      break;
    case "DURATION_MIN":
      current = totalDurationMin;
      unit = "min";
      break;
    case "ELEVATION_M":
      current = totalElevationM;
      unit = "m";
      break;
    case "ACTIVITIES_COUNT":
      current = totalActivities;
      unit = "treningów";
      break;
    default:
      current = 0;
      unit = "";
  }

  const target = goal.target;
  const percent = target > 0 ? Math.min(100, Math.floor((current / target) * 100)) : 0;

  return {
    current: round1(current),
    target: round1(target),
    unit,
    percent,
    windowStart: goal.windowStart,
    windowEnd: goal.windowEnd,
    totals: {
      totalDistanceKm: round1(totalDistanceKm),
      totalDurationMin: round1(totalDurationMin),
      totalElevationM: round1(totalElevationM),
      totalActivities,
    },
  };
}

export async function closeExpiredGoalIfNeeded(userId, goal) {
  const now = new Date();
  if (!goal.isActive) return goal;

  if (now >= goal.windowEnd) {
    const progress = await computeGoalProgress(userId, goal);

    const isCompleted = progress.current >= progress.target;

    return prisma.goal.update({
      where: { id: goal.id },
      data: {
        isActive: false,
        isCompleted,
        completedAt: new Date(),
      },
    });
  }

  return goal;
}

export async function createNewGoal(userId, { type, period, target }) {
  const now = new Date();
  const { windowStart, windowEnd } = getWindow(period, now);

  await prisma.goal.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  });

  const goal = await prisma.goal.create({
    data: {
      userId,
      type,
      period,
      target,
      isActive: true,
      windowStart,
      windowEnd,
      isCompleted: null,
      completedAt: null,
    },
  });

  return goal;
}
