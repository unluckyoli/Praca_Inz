import prisma from "../config/database.js";
import { getUserId } from "../utils/auth.utils.js";



const toSeconds = (minutes) =>
  typeof minutes === "number" ? minutes * 60 : null;

const round = (value, decimals = 2) => {
  if (value == null || Number.isNaN(value)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

const computePaceStats = (pacePerKmRaw) => {
  const pacePerKm = Array.isArray(pacePerKmRaw)
    ? pacePerKmRaw.filter((v) => typeof v === "number" && v > 0)
    : [];

  if (pacePerKm.length === 0) return null;

  const n = pacePerKm.length;
  const mean =
    pacePerKm.reduce((sum, v) => sum + v, 0) / n;

  let variance =
    pacePerKm.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / n;
  const stdDev = Math.sqrt(variance);

  const cv = mean > 0 ? stdDev / mean : null;

  if (n === 1) {
    const sec = toSeconds(stdDev);
    return {
      meanPace: round(mean),
      stdDevPace: round(stdDev),
      stdDevSeconds: sec != null ? Math.round(sec) : null,
      cvPace: cv != null ? round(cv, 4) : null,
      firstHalfPace: round(mean),
      secondHalfPace: round(mean),
      splitDeltaMinutes: 0,
      splitDeltaSeconds: 0,
      splitType: "even",
    };
  }

  const mid = Math.floor(n / 2);
  const firstHalf = pacePerKm.slice(0, mid);
  const secondHalf = pacePerKm.slice(mid);

  const avg = (arr) =>
    arr.reduce((s, v) => s + v, 0) / arr.length;

  const firstAvg = avg(firstHalf);
  const secondAvg = avg(secondHalf);

  const delta = secondAvg - firstAvg; // min/km (dodatni = wolniej na końcu)
  const deltaSec = toSeconds(delta);

  const thresholdMin = 0.05; // ~3 s/km
  let splitType = "even";
  if (delta <= -thresholdMin) splitType = "negative";
  else if (delta >= thresholdMin) splitType = "positive";

  return {
    meanPace: round(mean),
    stdDevPace: round(stdDev),
    stdDevSeconds: stdDev != null ? Math.round(toSeconds(stdDev)) : null,
    //stdDevSeconds: deltaSec != null ? Math.round(toSeconds(stdDev)) : null,
    cvPace: cv != null ? round(cv, 4) : null,
    firstHalfPace: round(firstAvg),
    secondHalfPace: round(secondAvg),
    splitDeltaMinutes: round(delta, 3),
    splitDeltaSeconds: deltaSec != null ? Math.round(deltaSec) : null,
    splitType,
  };
};



const computePaceZones = (pacePerKmRaw) => {
  const pacePerKm = Array.isArray(pacePerKmRaw)
    ? pacePerKmRaw.filter((v) => typeof v === "number" && v > 0)
    : [];

  if (pacePerKm.length === 0) return null;

  // strefy tempa
  // easy:   >= 6:00 min/km
  // steady: 5:00–5:59
  // tempo:  4:30–4:59 (4.5–5.0)
  // fast:   < 4:30
  const zones = {
    easy: { key: "łatwo", label: "≥ 6:00 min/km", km: 0, percent: 0 },
    steady: { key: "umiarkowanie", label: "5:00–5:59 min/km", km: 0, percent: 0 },
    tempo: { key: "tempo", label: "4:30–4:59 min/km", km: 0, percent: 0 },
    fast: { key: "szybko", label: "< 4:30 min/km", km: 0, percent: 0 },
  };

  pacePerKm.forEach((pace) => {
    if (pace >= 6.0) zones.easy.km += 1;
    else if (pace >= 5.0) zones.steady.km += 1;
    else if (pace >= 4.5) zones.tempo.km += 1;
    else zones.fast.km += 1;
  });

  const totalKm = pacePerKm.length;
  Object.values(zones).forEach((z) => {
    z.percent = totalKm > 0 ? round((z.km / totalKm) * 100, 1) : 0;
  });

  return {
    totalKm,
    zones,
  };
};



const computeClimbMetrics = (activity) => {
  const { elevationGain, distance, duration } = activity;

  if (
    elevationGain == null ||
    distance == null ||
    duration == null ||
    distance <= 0 ||
    duration <= 0
  ) {
    return null;
  }

  const distanceKm = distance / 1000;
  const hours = duration / 3600;

  const elevPerKm =
    distanceKm > 0 ? elevationGain / distanceKm : null; // m/km
  const verticalSpeed =
    hours > 0 ? elevationGain / hours : null; // m/h
  const avgGradientPercent =
    distance > 0 ? (elevationGain / distance) * 100 : null;

  return {
    elevPerKm: elevPerKm != null ? round(elevPerKm, 1) : null,
    verticalSpeed:
      verticalSpeed != null ? Math.round(verticalSpeed) : null,
    avgGradientPercent:
      avgGradientPercent != null ? round(avgGradientPercent, 2) : null,
  };
};





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

    const formatActivity = (a) => {
      const pacePerKm = Array.isArray(a.pacePerKm) ? a.pacePerKm : null;

      return {
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
        pacePerKm,
        //
        paceStats: computePaceStats(pacePerKm),
        paceZones: computePaceZones(pacePerKm),
        climbMetrics: computeClimbMetrics(a),
      };
    };



    res.json({
      first: formatActivity(first),
      second: formatActivity(second),
    });
  } catch (error) {
    console.error("Compare activities error:", error);
    res.status(500).json({ error: "Failed to compare activities" });
  }
};
