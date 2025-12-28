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

  const delta = secondAvg - firstAvg; 
  const deltaSec = toSeconds(delta);

  const thresholdMin = 0.05; 
  let splitType = "even";
  if (delta <= -thresholdMin) splitType = "negative";
  else if (delta >= thresholdMin) splitType = "positive";

  return {
    meanPace: round(mean),
    stdDevPace: round(stdDev),
    stdDevSeconds: stdDev != null ? Math.round(toSeconds(stdDev)) : null,
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


export const getFitnessMetrics = async (req, res) => {
  try {
    const userId = getUserId(req);
    const days = parseInt(req.query.days) || 90; // np. ostatnie 90 dni

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const metrics = await prisma.fitnessMetrics.findMany({
      where: {
        userId,
        date: { gte: cutoffDate },
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        ctl: true,
        atl: true,
        tsb: true,
      },
    });

    res.json({ metrics });
  } catch (error) {
    console.error("Get fitness metrics error:", error);
    res.status(500).json({ error: "Failed to fetch fitness metrics" });
  }
};




const computeTrainingLoad = (activity) => {
  if (activity.trainingLoad != null) return activity.trainingLoad;

  const distance = activity.distance ?? 0;       // metry
  const duration = activity.duration ?? 0;       // sekundy
  const elevationGain = activity.elevationGain ?? 0; // metry

  if (distance <= 0 && duration <= 0) return null;

  const distanceKm = distance > 0 ? distance / 1000 : 0;
  const durationMin = duration > 0 ? duration / 60 : 0;

  let load = 0;

  if (distanceKm > 0 && durationMin > 0) {
    const pace = durationMin / distanceKm;
    //(6:00 min/km = 1.0)
    let intensity = 6 / pace;
    if (!Number.isFinite(intensity) || intensity <= 0) intensity = 1;
    intensity = Math.min(Math.max(intensity, 0.5), 2.0); // clamp 0.5–2

    load = distanceKm * intensity * 10; // baza to: 10 pkt za każdy km
  } else if (durationMin > 0) {
    // jak nie ma dystansu to tyulko czas
    load = durationMin * 5;
  }


  if (elevationGain > 0) {
    load += elevationGain * 1.1; // 1.1 pkt za 1 m pod górę
  }

  return Math.round(load);
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
        trainingLoad: computeTrainingLoad(a),
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
        paceStats: computePaceStats(pacePerKm),
        paceZones: computePaceZones(pacePerKm),
        climbMetrics: computeClimbMetrics(a),
      };
    };



    res.json({
      first: formatActivity(first),
      second: formatActivity(second),
    });

    console.log("COMPARE first pacePerKm length:", first.pacePerKm?.length);
    console.log("COMPARE second pacePerKm length:", second.pacePerKm?.length);

  } catch (error) {
    console.error("Compare activities error:", error);
    res.status(500).json({ error: "Failed to compare activities" });
  }
};

// -----------------------------
// New analytics endpoints (Stage 3)
// -----------------------------

const parseDateParam = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isoDayKeyUTC = (date) => {
  const d = new Date(date);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
};

// ISO week starts Monday (UTC)
const isoWeekStartUTC = (date) => {
  const d = new Date(date);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay(); // 0..6 (Sun..Sat)
  const diff = day === 0 ? -6 : 1 - day; // move to Monday
  utc.setUTCDate(utc.getUTCDate() + diff);
  utc.setUTCHours(0, 0, 0, 0);
  return utc;
};

const clampInt = (v, min, max, fallback) => {
  const n = parseInt(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const clampStrEnum = (v, allowed, fallback) => {
  if (!v) return fallback;
  return allowed.includes(v) ? v : fallback;
};

export const getCalendarHeatmap = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { type } = req.query;

    const end = parseDateParam(req.query.endDate) || new Date();
    const start =
      parseDateParam(req.query.startDate) ||
      (() => {
        const d = new Date(end);
        d.setDate(d.getDate() - 365);
        return d;
      })();

    const where = {
      userId,
      startDate: { gte: start, lte: end },
    };
    if (type) where.type = type;

    const activities = await prisma.activity.findMany({
      where,
      select: {
        startDate: true,
        duration: true,
        distance: true,
        elevationGain: true,
        trainingLoad: true,
        type: true,
      },
      orderBy: { startDate: "asc" },
      take: 50000,
    });

    const byDay = new Map();
    for (const a of activities) {
      const key = isoDayKeyUTC(a.startDate);
      if (!byDay.has(key)) {
        byDay.set(key, {
          date: key,
          count: 0,
          totalDuration: 0,
          totalDistance: 0,
          totalLoad: 0,
        });
      }
      const row = byDay.get(key);
      row.count += 1;
      row.totalDuration += a.duration || 0;
      row.totalDistance += a.distance || 0;
      const load = computeTrainingLoad(a);
      row.totalLoad += load || 0;
    }

    const days = Array.from(byDay.values());
    res.json({
      startDate: isoDayKeyUTC(start),
      endDate: isoDayKeyUTC(end),
      days,
    });
  } catch (error) {
    console.error("Get calendar heatmap error:", error);
    res.status(500).json({ error: "Failed to fetch calendar heatmap" });
  }
};

export const getRampRate = async (req, res) => {
  try {
    const userId = getUserId(req);
    const weeks = clampInt(req.query.weeks, 4, 104, 26);
    const { type } = req.query;

    const end = parseDateParam(req.query.endDate) || new Date();
    const start = (() => {
      const d = new Date(end);
      d.setDate(d.getDate() - weeks * 7);
      return d;
    })();

    const where = {
      userId,
      startDate: { gte: start, lte: end },
    };
    if (type) where.type = type;

    const activities = await prisma.activity.findMany({
      where,
      select: {
        startDate: true,
        duration: true,
        distance: true,
        elevationGain: true,
        trainingLoad: true,
      },
      orderBy: { startDate: "asc" },
      take: 50000,
    });

    const byWeek = new Map();
    for (const a of activities) {
      const ws = isoWeekStartUTC(a.startDate);
      const key = ws.toISOString().slice(0, 10);
      if (!byWeek.has(key)) {
        byWeek.set(key, {
          weekStart: ws,
          weekKey: key,
          activitiesCount: 0,
          totalLoad: 0,
          totalDuration: 0,
          totalDistance: 0,
        });
      }
      const row = byWeek.get(key);
      row.activitiesCount += 1;
      row.totalDuration += a.duration || 0;
      row.totalDistance += a.distance || 0;
      row.totalLoad += computeTrainingLoad(a) || 0;
    }

    const weeksArr = Array.from(byWeek.values())
      .sort((a, b) => a.weekStart - b.weekStart)
      .map((w) => ({
        weekStart: w.weekStart,
        weekKey: w.weekKey,
        activitiesCount: w.activitiesCount,
        totalLoad: Math.round(w.totalLoad),
        totalDuration: w.totalDuration,
        totalDistance: w.totalDistance,
      }));

    const enriched = weeksArr.map((w, idx) => {
      const prev = idx > 0 ? weeksArr[idx - 1] : null;
      const rampRatePct =
        prev && prev.totalLoad > 0
          ? round(((w.totalLoad - prev.totalLoad) / prev.totalLoad) * 100, 1)
          : null;
      return { ...w, rampRatePct };
    });

    res.json({ weeks: enriched });
  } catch (error) {
    console.error("Get ramp rate error:", error);
    res.status(500).json({ error: "Failed to fetch ramp rate" });
  }
};

export const getAerobicEfficiency = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { type } = req.query;
    const mode = clampStrEnum(req.query.mode, ["all", "easy"], "all");
    const maxHr = clampInt(req.query.maxHr, 90, 200, 150);

    const end = parseDateParam(req.query.endDate) || new Date();
    const start =
      parseDateParam(req.query.startDate) ||
      (() => {
        const d = new Date(end);
        d.setDate(d.getDate() - 180);
        return d;
      })();

    const where = {
      userId,
      startDate: { gte: start, lte: end },
      averageSpeed: { not: null },
      averageHeartRate: { not: null },
    };
    if (type) where.type = type;

    const activities = await prisma.activity.findMany({
      where,
      select: {
        startDate: true,
        type: true,
        distance: true,
        duration: true,
        averageSpeed: true,
        averageHeartRate: true,
        elevationGain: true,
        trainingLoad: true,
      },
      orderBy: { startDate: "asc" },
      take: 5000,
    });

    const points = [];
    for (const a of activities) {
      const hr = a.averageHeartRate;
      const speed = a.averageSpeed; // m/s
      if (!hr || !speed || hr <= 0 || speed <= 0) continue;
      if (mode === "easy" && hr > maxHr) continue;
      const speedKmh = speed * 3.6;
      const ef = speedKmh / hr;
      if (!Number.isFinite(ef) || ef <= 0) continue;
      points.push({
        date: a.startDate,
        ef: round(ef, 4),
        avgSpeedKmh: round(speedKmh, 2),
        avgHr: hr,
        type: a.type,
        distance: a.distance,
        duration: a.duration,
        load: computeTrainingLoad(a),
      });
    }

    res.json({
      startDate: isoDayKeyUTC(start),
      endDate: isoDayKeyUTC(end),
      mode,
      maxHr,
      points,
    });
  } catch (error) {
    console.error("Get aerobic efficiency error:", error);
    res.status(500).json({ error: "Failed to fetch aerobic efficiency" });
  }
};

export const getTimePatterns = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { type } = req.query;
    const metric = clampStrEnum(req.query.metric, ["count", "speed", "ef", "load"], "count");
    // JS getTimezoneOffset() gives minutes behind UTC (e.g. CET winter is -60? actually +60 => -60?),
    // but we only need a consistent shift from client; frontend passes its getTimezoneOffset().
    const tzOffsetMinutes = Number.isFinite(Number(req.query.tzOffsetMinutes))
      ? Number(req.query.tzOffsetMinutes)
      : 0;

    const end = parseDateParam(req.query.endDate) || new Date();
    const start =
      parseDateParam(req.query.startDate) ||
      (() => {
        const d = new Date(end);
        d.setDate(d.getDate() - 180);
        return d;
      })();

    const where = {
      userId,
      startDate: { gte: start, lte: end },
    };
    if (type) where.type = type;

    const activities = await prisma.activity.findMany({
      where,
      select: {
        startDate: true,
        averageSpeed: true,
        averageHeartRate: true,
        trainingLoad: true,
        distance: true,
        duration: true,
        elevationGain: true,
      },
      orderBy: { startDate: "asc" },
      take: 50000,
    });

    const byHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      total: 0,
      samples: 0,
    }));

    // dayOfWeek: 0..6 (Mon..Sun) for UX
    const heatmap = Array.from({ length: 7 }, (_, dow) => ({
      dow,
      hours: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    }));

    const dowMap = (utcDay) => (utcDay === 0 ? 6 : utcDay - 1); // Sun->6, Mon->0 ...

    for (const a of activities) {
      // Convert to client-local time using tzOffsetMinutes (same semantics as Date.getTimezoneOffset()).
      // local = utc - offsetMinutes
      const shifted = new Date(a.startDate.getTime() - tzOffsetMinutes * 60 * 1000);
      const hour = shifted.getUTCHours();
      const dow = dowMap(shifted.getUTCDay());
      byHour[hour].count += 1;
      heatmap[dow].hours[hour].count += 1;

      if (metric === "speed") {
        const speed = a.averageSpeed;
        if (speed && speed > 0) {
          byHour[hour].total += speed * 3.6;
          byHour[hour].samples += 1;
        }
      } else if (metric === "ef") {
        const speed = a.averageSpeed;
        const hr = a.averageHeartRate;
        if (speed && hr && speed > 0 && hr > 0) {
          byHour[hour].total += (speed * 3.6) / hr;
          byHour[hour].samples += 1;
        }
      } else if (metric === "load") {
        const load = computeTrainingLoad(a);
        if (load != null) {
          byHour[hour].total += load;
          byHour[hour].samples += 1;
        }
      }
    }

    const byHourOut = byHour.map((h) => ({
      hour: h.hour,
      count: h.count,
      samples: h.samples,
      value:
        metric === "count"
          ? h.count
          : h.samples > 0
            ? round(h.total / h.samples, metric === "ef" ? 4 : 2)
            : null,
    }));

    res.json({
      startDate: isoDayKeyUTC(start),
      endDate: isoDayKeyUTC(end),
      metric,
      timezoneNote:
        tzOffsetMinutes !== 0
          ? `Godziny przeliczone na lokalny czas klienta (offset: ${tzOffsetMinutes} min)`
          : "UTC (start_date); brak start_date_local w bazie",
      byHour: byHourOut,
      heatmap,
    });
  } catch (error) {
    console.error("Get time patterns error:", error);
    res.status(500).json({ error: "Failed to fetch time patterns" });
  }
};

export const getYearOverYear = async (req, res) => {
  try {
    const userId = getUserId(req);
    const metric = clampStrEnum(req.query.metric, ["distance", "duration", "load"], "distance");
    const year = clampInt(req.query.year, 2010, 2100, new Date().getUTCFullYear());
    const compareTo = clampInt(req.query.compareTo, 2010, 2100, year - 1);
    const { type } = req.query;

    const buildYearRange = (y) => ({
      start: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
    });

    const loadYear = async (y) => {
      const { start, end } = buildYearRange(y);
      const where = {
        userId,
        startDate: { gte: start, lte: end },
      };
      if (type) where.type = type;

      const acts = await prisma.activity.findMany({
        where,
        select: {
          startDate: true,
          distance: true,
          duration: true,
          elevationGain: true,
          trainingLoad: true,
        },
        orderBy: { startDate: "asc" },
        take: 50000,
      });

      const months = Array.from({ length: 12 }, (_, m) => ({
        month: m + 1,
        value: 0,
      }));

      for (const a of acts) {
        const m = a.startDate.getUTCMonth(); // 0..11
        if (metric === "distance") months[m].value += (a.distance || 0) / 1000;
        else if (metric === "duration") months[m].value += (a.duration || 0) / 3600;
        else months[m].value += computeTrainingLoad(a) || 0;
      }

      return months.map((x) => ({
        ...x,
        value: round(x.value, metric === "load" ? 0 : 2),
      }));
    };

    const [current, previous] = await Promise.all([loadYear(year), loadYear(compareTo)]);

    const combined = current.map((c, idx) => {
      const p = previous[idx];
      const deltaPct =
        p.value && p.value > 0 ? round(((c.value - p.value) / p.value) * 100, 1) : null;
      return {
        month: c.month,
        current: c.value,
        previous: p.value,
        deltaPct,
      };
    });

    res.json({ metric, year, compareTo, months: combined });
  } catch (error) {
    console.error("Get year over year error:", error);
    res.status(500).json({ error: "Failed to fetch year-over-year" });
  }
};

export const getPerformanceCurve = async (req, res) => {
  try {
    const userId = getUserId(req);
    const mode = clampStrEnum(req.query.mode, ["power", "pace"], "pace");
    const { type } = req.query;

    const end = parseDateParam(req.query.endDate) || new Date();
    const start =
      parseDateParam(req.query.startDate) ||
      (() => {
        const d = new Date(end);
        d.setDate(d.getDate() - 365);
        return d;
      })();

    if (mode === "power") {
      const where = {
        userId,
        activity: { startDate: { gte: start, lte: end } },
      };
      if (type) where.activity.type = type;

      const rows = await prisma.powerCurve.findMany({
        where,
        select: {
          sec5: true,
          sec30: true,
          min1: true,
          min2: true,
          min5: true,
          min10: true,
          min20: true,
          min60: true,
        },
        take: 5000,
      });

      const buckets = [
        ["5s", "sec5"],
        ["30s", "sec30"],
        ["1min", "min1"],
        ["2min", "min2"],
        ["5min", "min5"],
        ["10min", "min10"],
        ["20min", "min20"],
        ["60min", "min60"],
      ];

      const points = buckets.map(([label, key]) => {
        let best = null;
        for (const r of rows) {
          const v = r[key];
          if (typeof v === "number" && v > 0) best = best == null ? v : Math.max(best, v);
        }
        return { label, value: best != null ? Math.round(best) : null };
      });

      return res.json({
        mode,
        unit: "W",
        startDate: isoDayKeyUTC(start),
        endDate: isoDayKeyUTC(end),
        points,
      });
    }

    // pace mode
    const where = {
      userId,
      activity: { startDate: { gte: start, lte: end } },
    };
    if (type) where.activity.type = type;

    const rows = await prisma.paceDistance.findMany({
      where,
      select: {
        km1: true,
        km5: true,
        km10: true,
        km21: true,
        km42: true,
      },
      take: 50000,
    });

    const buckets = [
      ["1 km", "km1"],
      ["5 km", "km5"],
      ["10 km", "km10"],
      ["21.1 km", "km21"],
      ["42.2 km", "km42"],
    ];

    const bestFromPaceDistance = (key) => {
      let best = null;
      for (const r of rows) {
        const v = r[key];
        if (typeof v === "number" && v > 0) best = best == null ? v : Math.min(best, v);
      }
      return best != null ? round(best, 2) : null;
    };

    // Fallback: if PaceDistance is missing (user didn't fetch details), use Strava bestEfforts JSON if present.
    // bestEfforts contains objects with { distance, elapsed_time } (seconds) for best segments inside an activity.
    const bestFromBestEfforts = async (targetMeters) => {
      const acts = await prisma.activity.findMany({
        where: {
          userId,
          startDate: { gte: start, lte: end },
          ...(type ? { type } : {}),
          bestEfforts: { not: null },
        },
        select: { bestEfforts: true },
        take: 5000,
      });

      let bestPaceMinPerKm = null;
      for (const a of acts) {
        const arr = Array.isArray(a.bestEfforts) ? a.bestEfforts : null;
        if (!arr) continue;
        for (const e of arr) {
          const dist = Number(e?.distance);
          const t = Number(e?.elapsed_time);
          if (!Number.isFinite(dist) || !Number.isFinite(t) || dist <= 0 || t <= 0) continue;
          // accept within 2% tolerance
          if (Math.abs(dist - targetMeters) / targetMeters > 0.02) continue;
          const pace = (t / 60) / (dist / 1000);
          if (!Number.isFinite(pace) || pace <= 0 || pace > 20) continue;
          bestPaceMinPerKm = bestPaceMinPerKm == null ? pace : Math.min(bestPaceMinPerKm, pace);
        }
      }
      return bestPaceMinPerKm != null ? round(bestPaceMinPerKm, 2) : null;
    };

    const points = [];
    for (const [label, key] of buckets) {
      let value = bestFromPaceDistance(key);
      if (value == null) {
        const meters =
          key === "km1" ? 1000 : key === "km5" ? 5000 : key === "km10" ? 10000 : key === "km21" ? 21097.5 : 42195;
        value = await bestFromBestEfforts(meters);
      }
      points.push({ label, value });
    }

    res.json({
      mode,
      unit: "min/km",
      startDate: isoDayKeyUTC(start),
      endDate: isoDayKeyUTC(end),
      points,
    });
  } catch (error) {
    console.error("Get performance curve error:", error);
    res.status(500).json({ error: "Failed to fetch performance curve" });
  }
};
