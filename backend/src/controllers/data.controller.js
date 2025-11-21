import prisma from "../config/database.js";
import { Prisma } from "@prisma/client";
import { getUserId } from "../utils/auth.utils.js";

export const getUserStats = async (req, res) => {
  try {
    const userId = getUserId(req);

    const stats = await prisma.userStats.findUnique({
      where: { userId },
      include: {
        user: {
          include: {
            activities: {
              take: 5,
              orderBy: { startDate: "desc" },
            },
          },
        },
      },
    });

    if (!stats) {
      return res.status(404).json({ error: "Stats not found" });
    }

    res.json({ stats });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
};

export const getLongestActivity = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { metric = "distance", type, startDate, endDate } = req.query;

    const validMetrics = ["distance", "duration", "elevationGain"];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({ error: "Invalid metric" });
    }

    // Build WHERE conditions for Prisma
    const where = {
      userId,
      [metric]: {
        not: null,
      },
    };

    if (type && type !== "all") {
      where.type = type;
    }

    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) {
        where.startDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.startDate.lte = new Date(endDate);
      }
    }

    const longestActivity = await prisma.activity.findFirst({
      where,
      orderBy: {
        [metric]: "desc",
      },
    });

    res.json({
      activity: longestActivity || null,
      metric,
    });
  } catch (error) {
    console.error("Get longest activity error:", error);
    res.status(500).json({ error: "Failed to fetch longest activity" });
  }
};

export const getHardestActivity = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { type, startDate, endDate } = req.query;

    // Build WHERE conditions with parameterized values
    let query = `
      SELECT *,
        (COALESCE("trainingLoad", 0) * 0.4 + 
         COALESCE("averageHeartRate", 0) * 0.3 + 
         COALESCE("elevationGain", 0) / 10 * 0.3) as difficulty_score
      FROM "Activity"
      WHERE "userId" = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (type && type !== "all") {
      query += ` AND "type" = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND "startDate" >= $${paramIndex}`;
      params.push(new Date(startDate));
      paramIndex++;
    }

    if (endDate) {
      query += ` AND "startDate" <= $${paramIndex}`;
      params.push(new Date(endDate));
      paramIndex++;
    }

    query += `
      ORDER BY difficulty_score DESC
      LIMIT 1
    `;

    const hardestActivity = await prisma.$queryRawUnsafe(query, ...params);

    res.json({
      activity: hardestActivity[0] || null,
    });
  } catch (error) {
    console.error("Get hardest activity error:", error);
    res.status(500).json({ error: "Failed to fetch hardest activity" });
  }
};

export const getActivityRecords = async (req, res) => {
  try {
    const userId = getUserId(req);

    const records = await prisma.$queryRaw`
 WITH ranked_activities AS (
 SELECT 
 *,
 ROW_NUMBER() OVER (PARTITION BY type ORDER BY distance DESC) as distance_rank,
 ROW_NUMBER() OVER (PARTITION BY type ORDER BY duration DESC) as duration_rank,
 ROW_NUMBER() OVER (PARTITION BY type ORDER BY "averageSpeed" DESC) as speed_rank,
 ROW_NUMBER() OVER (PARTITION BY type ORDER BY "elevationGain" DESC) as elevation_rank
 FROM "Activity"
 WHERE "userId" = ${userId}
 )
 SELECT 
 type,
 MAX(CASE WHEN distance_rank = 1 THEN distance END) as max_distance,
 MAX(CASE WHEN duration_rank = 1 THEN duration END) as max_duration,
 MAX(CASE WHEN speed_rank = 1 THEN "averageSpeed" END) as max_speed,
 MAX(CASE WHEN elevation_rank = 1 THEN "elevationGain" END) as max_elevation
 FROM ranked_activities
 GROUP BY type
 ORDER BY type
 `;

    res.json({ records });
  } catch (error) {
    console.error("Get records error:", error);
    res.status(500).json({ error: "Failed to fetch activity records" });
  }
};

export const getAverageMetrics = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { groupBy = "type" } = req.query;

    const validGroupBy = ["type", "month", "dayOfWeek"];
    if (!validGroupBy.includes(groupBy)) {
      return res.status(400).json({ error: "Invalid groupBy parameter" });
    }

    let averages;

    if (groupBy === "type") {
      averages = await prisma.$queryRaw`
 SELECT 
 type,
 COUNT(*) as activity_count,
 AVG(distance) as avg_distance,
 AVG(duration) as avg_duration,
 AVG("averageSpeed") as avg_speed,
 AVG("averageHeartRate") as avg_heart_rate,
 AVG("elevationGain") as avg_elevation,
 AVG(calories) as avg_calories
 FROM "Activity"
 WHERE "userId" = ${userId}
 GROUP BY type
 ORDER BY activity_count DESC
 `;
    } else if (groupBy === "month") {
      averages = await prisma.$queryRaw`
 SELECT 
 EXTRACT(MONTH FROM "startDate") as month,
 COUNT(*) as activity_count,
 AVG(distance) as avg_distance,
 AVG(duration) as avg_duration,
 AVG("averageSpeed") as avg_speed,
 AVG("averageHeartRate") as avg_heart_rate
 FROM "Activity"
 WHERE "userId" = ${userId}
 GROUP BY EXTRACT(MONTH FROM "startDate")
 ORDER BY month
 `;
    } else if (groupBy === "dayOfWeek") {
      averages = await prisma.$queryRaw`
 SELECT 
 EXTRACT(DOW FROM "startDate") as day_of_week,
 COUNT(*) as activity_count,
 AVG(distance) as avg_distance,
 AVG(duration) as avg_duration,
 AVG("averageSpeed") as avg_speed
 FROM "Activity"
 WHERE "userId" = ${userId}
 GROUP BY EXTRACT(DOW FROM "startDate")
 ORDER BY day_of_week
 `;
    }

    res.json({ averages, groupBy });
  } catch (error) {
    console.error("Get averages error:", error);
    res.status(500).json({ error: "Failed to fetch average metrics" });
  }
};
