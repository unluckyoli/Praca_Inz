import prisma from "../config/database.js";
import { getUserId } from "../utils/auth.utils.js";

export const getActivityDistribution = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { type } = req.query;

    const where = { userId };
    if (type) {
      where.type = type;
    }

    const activities = await prisma.activity.findMany({
      where,
      select: {
        type: true,
        distance: true,
        duration: true,
      },
    });

    const typeMap = new Map();
    activities.forEach((activity) => {
      if (!typeMap.has(activity.type)) {
        typeMap.set(activity.type, {
          type: activity.type,
          count: 0,
          total_distance: 0,
          total_duration: 0,
        });
      }

      const stats = typeMap.get(activity.type);
      stats.count++;
      stats.total_distance += activity.distance || 0;
      stats.total_duration += activity.duration || 0;
    });

    const distribution = Array.from(typeMap.values()).sort(
      (a, b) => b.count - a.count,
    );

    res.json({ distribution });
  } catch (error) {
    console.error("Get distribution error:", error);
    res.status(500).json({ error: "Failed to fetch activity distribution" });
  }
};

export const getWeeklyStats = async (req, res) => {
  try {
    const userId = getUserId(req);
    const weeks = parseInt(req.query.weeks) || 12;
    const { type } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - weeks * 7);

    const where = {
      userId,
      startDate: { gte: cutoffDate },
    };

    if (type) {
      where.type = type;
    }

    const activities = await prisma.activity.findMany({
      where,
      select: {
        startDate: true,
        distance: true,
        duration: true,
        averageHeartRate: true,
        elevationGain: true,
      },
    });

    const weeklyMap = new Map();
    activities.forEach((activity) => {
      const weekStart = new Date(activity.startDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];

      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          week: weekStart,
          activities_count: 0,
          total_distance: 0,
          total_duration: 0,
          total_heart_rate: 0,
          heart_rate_count: 0,
          total_elevation: 0,
        });
      }

      const stats = weeklyMap.get(weekKey);
      stats.activities_count++;
      stats.total_distance += activity.distance || 0;
      stats.total_duration += activity.duration || 0;
      if (activity.averageHeartRate) {
        stats.total_heart_rate += activity.averageHeartRate;
        stats.heart_rate_count++;
      }
      stats.total_elevation += activity.elevationGain || 0;
    });

    const weeklyStats = Array.from(weeklyMap.values())
      .map((stats) => ({
        week: stats.week,
        activities_count: stats.activities_count,
        total_distance: stats.total_distance,
        total_duration: stats.total_duration,
        avg_heart_rate:
          stats.heart_rate_count > 0
            ? stats.total_heart_rate / stats.heart_rate_count
            : null,
        total_elevation: stats.total_elevation,
      }))
      .sort((a, b) => b.week - a.week);

    res.json({ weeklyStats });
  } catch (error) {
    console.error("Get weekly stats error:", error);
    res.status(500).json({ error: "Failed to fetch weekly stats" });
  }
};

export const getMonthlyTrends = async (req, res) => {
  try {
    const userId = getUserId(req);
    const months = parseInt(req.query.months) || 6;
    const { type } = req.query;

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    const where = {
      userId,
      startDate: { gte: cutoffDate },
    };

    if (type) {
      where.type = type;
    }

    const activities = await prisma.activity.findMany({
      where,
      select: {
        startDate: true,
        distance: true,
        duration: true,
        averageHeartRate: true,
      },
    });

    const monthlyMap = new Map();
    activities.forEach((activity) => {
      const monthKey = new Date(activity.startDate)
        .toISOString()
        .substring(0, 7);

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: new Date(
            activity.startDate.getFullYear(),
            activity.startDate.getMonth(),
            1,
          ),
          activities_count: 0,
          total_distance: 0,
          total_duration: 0,
          total_heart_rate: 0,
          heart_rate_count: 0,
        });
      }

      const stats = monthlyMap.get(monthKey);
      stats.activities_count++;
      stats.total_distance += activity.distance || 0;
      stats.total_duration += activity.duration || 0;
      if (activity.averageHeartRate) {
        stats.total_heart_rate += activity.averageHeartRate;
        stats.heart_rate_count++;
      }
    });

    const monthlyTrends = Array.from(monthlyMap.values())
      .map((stats) => ({
        month: stats.month,
        activities_count: stats.activities_count,
        total_distance: stats.total_distance,
        total_duration: stats.total_duration,
        avg_distance:
          stats.activities_count > 0
            ? stats.total_distance / stats.activities_count
            : 0,
        avg_duration:
          stats.activities_count > 0
            ? stats.total_duration / stats.activities_count
            : 0,
        avg_heart_rate:
          stats.heart_rate_count > 0
            ? stats.total_heart_rate / stats.heart_rate_count
            : null,
      }))
      .sort((a, b) => a.month - b.month);

    res.json({ monthlyTrends });
  } catch (error) {
    console.error("Get monthly trends error:", error);
    res.status(500).json({ error: "Failed to fetch monthly trends" });
  }
};

export const getIntensityDistribution = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { type } = req.query;

    const where = {
      userId,
      averageHeartRate: { not: null },
    };

    if (type) {
      where.type = type;
    }

    const activities = await prisma.activity.findMany({
      where,
      select: {
        averageHeartRate: true,
        duration: true,
        distance: true,
      },
    });

    const intensityMap = {
      LOW: { count: 0, total_duration: 0, total_distance: 0 },
      MEDIUM: { count: 0, total_duration: 0, total_distance: 0 },
      HIGH: { count: 0, total_duration: 0, total_distance: 0 },
    };

    activities.forEach((activity) => {
      let intensity;
      if (activity.averageHeartRate < 120) {
        intensity = "LOW";
      } else if (activity.averageHeartRate < 150) {
        intensity = "MEDIUM";
      } else {
        intensity = "HIGH";
      }

      intensityMap[intensity].count++;
      intensityMap[intensity].total_duration += activity.duration || 0;
      intensityMap[intensity].total_distance += activity.distance || 0;
    });

    const intensityDistribution = Object.entries(intensityMap)
      .map(([intensity, stats]) => ({
        intensity,
        count: stats.count,
        avg_duration: stats.count > 0 ? stats.total_duration / stats.count : 0,
        avg_distance: stats.count > 0 ? stats.total_distance / stats.count : 0,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => {
        const order = { LOW: 1, MEDIUM: 2, HIGH: 3 };
        return order[a.intensity] - order[b.intensity];
      });

    res.json({ intensityDistribution });
  } catch (error) {
    console.error("Get intensity distribution error:", error);
    res.status(500).json({ error: "Failed to fetch intensity distribution" });
  }
};

export const getProgressOverTime = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { metric = "distance", period = "week" } = req.query;

    const validMetrics = [
      "distance",
      "duration",
      "averageSpeed",
      "averageHeartRate",
    ];
    const validPeriods = ["day", "week", "month"];

    if (!validMetrics.includes(metric) || !validPeriods.includes(period)) {
      return res.status(400).json({ error: "Invalid metric or period" });
    }

    const progress = await prisma.$queryRaw`
 SELECT 
 DATE_TRUNC(${prisma.Prisma.raw(`'${period}'`)}, "startDate") as period,
 AVG(${prisma.Prisma.raw(`"${metric}"`)}) as avg_value,
 MAX(${prisma.Prisma.raw(`"${metric}"`)}) as max_value,
 MIN(${prisma.Prisma.raw(`"${metric}"`)}) as min_value,
 COUNT(*) as activity_count
 FROM "Activity"
 WHERE "userId" = ${userId}
 AND ${prisma.Prisma.raw(`"${metric}"`)} IS NOT NULL
 GROUP BY DATE_TRUNC(${prisma.Prisma.raw(`'${period}'`)}, "startDate")
 ORDER BY period ASC
 LIMIT 50
 `;

    res.json({ progress, metric, period });
  } catch (error) {
    console.error("Get progress error:", error);
    res.status(500).json({ error: "Failed to fetch progress data" });
  }
};

export const compareActivities = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { firstId, secondId } = req.query;

    if (!firstId || !secondId) {
      return res
        .status(400)
        .json({ error: "Both firstId and secondId are required" });
    }

    const activities = await prisma.activity.findMany({
      where: {
        userId,
        id: { in: [firstId, secondId] },
      },
      include: {
        paceDistance: true,
      },
    });

    if (activities.length !== 2) {
      return res
        .status(404)
        .json({ error: "One or both activities not found" });
    }

    const mapById = Object.fromEntries(
      activities.map((a) => [a.id, a]),
    );

    const first = mapById[firstId];
    const second = mapById[secondId];

    const formatActivity = (a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      startDate: a.startDate,
      duration: a.duration,
      distance: a.distance,
      averageHeartRate: a.averageHeartRate,
      maxHeartRate: a.maxHeartRate,
      averageSpeed: a.averageSpeed,
      maxSpeed: a.maxSpeed,
      elevationGain: a.elevationGain,
      calories: a.calories,
      paceDistance: a.paceDistance
        ? {
            km1: a.paceDistance.km1,
            km5: a.paceDistance.km5,
            km10: a.paceDistance.km10,
            km21: a.paceDistance.km21,
            km42: a.paceDistance.km42,
          }
        : null,
      pacePerKm: Array.isArray(a.pacePerKm) ? a.pacePerKm : null,
    });


    res.json({
      first: formatActivity(first),
      second: formatActivity(second),
    });
  } catch (error) {
    console.error("Compare activities error:", error);
    res.status(500).json({ error: "Failed to compare activities" });
  }
};
