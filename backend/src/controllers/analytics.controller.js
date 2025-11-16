import prisma from '../config/database.js';

export const getActivityDistribution = async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const distribution = await prisma.$queryRaw`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(distance) as total_distance,
        SUM(duration) as total_duration
      FROM "Activity"
      WHERE "userId" = ${userId}
      GROUP BY type
      ORDER BY count DESC
    `;
    
    res.json({ distribution });
  } catch (error) {
    console.error('Get distribution error:', error);
    res.status(500).json({ error: 'Failed to fetch activity distribution' });
  }
};

export const getWeeklyStats = async (req, res) => {
  try {
    const userId = req.session.userId;
    const weeks = parseInt(req.query.weeks) || 12;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (weeks * 7));
    
    const weeklyStats = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('week', "startDate") as week,
        COUNT(*) as activities_count,
        SUM(distance) as total_distance,
        SUM(duration) as total_duration,
        AVG("averageHeartRate") as avg_heart_rate,
        SUM("elevationGain") as total_elevation
      FROM "Activity"
      WHERE "userId" = ${userId}
        AND "startDate" >= ${cutoffDate}
      GROUP BY DATE_TRUNC('week', "startDate")
      ORDER BY week DESC
    `;
    
    res.json({ weeklyStats });
  } catch (error) {
    console.error('Get weekly stats error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly stats' });
  }
};

export const getMonthlyTrends = async (req, res) => {
  try {
    const userId = req.session.userId;
    const months = parseInt(req.query.months) || 6;
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    
    const monthlyTrends = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "startDate") as month,
        COUNT(*) as activities_count,
        SUM(distance) as total_distance,
        SUM(duration) as total_duration,
        AVG(distance) as avg_distance,
        AVG(duration) as avg_duration,
        AVG("averageHeartRate") as avg_heart_rate
      FROM "Activity"
      WHERE "userId" = ${userId}
        AND "startDate" >= ${cutoffDate}
      GROUP BY DATE_TRUNC('month', "startDate")
      ORDER BY month ASC
    `;
    
    res.json({ monthlyTrends });
  } catch (error) {
    console.error('Get monthly trends error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly trends' });
  }
};

export const getIntensityDistribution = async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const intensityDistribution = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN "averageHeartRate" < 120 THEN 'LOW'
          WHEN "averageHeartRate" >= 120 AND "averageHeartRate" < 150 THEN 'MEDIUM'
          WHEN "averageHeartRate" >= 150 THEN 'HIGH'
          ELSE 'UNKNOWN'
        END as intensity,
        COUNT(*) as count,
        AVG(duration) as avg_duration,
        AVG(distance) as avg_distance
      FROM "Activity"
      WHERE "userId" = ${userId}
        AND "averageHeartRate" IS NOT NULL
      GROUP BY 
        CASE 
          WHEN "averageHeartRate" < 120 THEN 'LOW'
          WHEN "averageHeartRate" >= 120 AND "averageHeartRate" < 150 THEN 'MEDIUM'
          WHEN "averageHeartRate" >= 150 THEN 'HIGH'
          ELSE 'UNKNOWN'
        END
      ORDER BY 
        CASE 
          WHEN CASE 
            WHEN "averageHeartRate" < 120 THEN 'LOW'
            WHEN "averageHeartRate" >= 120 AND "averageHeartRate" < 150 THEN 'MEDIUM'
            WHEN "averageHeartRate" >= 150 THEN 'HIGH'
            ELSE 'UNKNOWN'
          END = 'LOW' THEN 1
          WHEN CASE 
            WHEN "averageHeartRate" < 120 THEN 'LOW'
            WHEN "averageHeartRate" >= 120 AND "averageHeartRate" < 150 THEN 'MEDIUM'
            WHEN "averageHeartRate" >= 150 THEN 'HIGH'
            ELSE 'UNKNOWN'
          END = 'MEDIUM' THEN 2
          WHEN CASE 
            WHEN "averageHeartRate" < 120 THEN 'LOW'
            WHEN "averageHeartRate" >= 120 AND "averageHeartRate" < 150 THEN 'MEDIUM'
            WHEN "averageHeartRate" >= 150 THEN 'HIGH'
            ELSE 'UNKNOWN'
          END = 'HIGH' THEN 3
          ELSE 4
        END
    `;
    
    res.json({ intensityDistribution });
  } catch (error) {
    console.error('Get intensity distribution error:', error);
    res.status(500).json({ error: 'Failed to fetch intensity distribution' });
  }
};

export const getProgressOverTime = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { metric = 'distance', period = 'week' } = req.query;
    
    const validMetrics = ['distance', 'duration', 'averageSpeed', 'averageHeartRate'];
    const validPeriods = ['day', 'week', 'month'];
    
    if (!validMetrics.includes(metric) || !validPeriods.includes(period)) {
      return res.status(400).json({ error: 'Invalid metric or period' });
    }
    
    // Use Prisma.sql to safely construct the query
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
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress data' });
  }
};
