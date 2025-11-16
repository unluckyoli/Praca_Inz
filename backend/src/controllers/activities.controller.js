import prisma from '../config/database.js';
import { stravaService } from '../services/strava.service.js';

export const getActivities = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    
    const where = {
      userId: req.session.userId,
      ...(type && { type }),
      ...(startDate && endDate && {
        startDate: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      })
    };
    
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.activity.count({ where })
    ]);
    
    res.json({
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
};

export const syncActivities = async (req, res) => {
  try {
    const userId = req.session.userId;
    const accessToken = req.session.accessToken;
    const source = req.session.source;
    
    if (!accessToken) {
      return res.status(401).json({ error: 'Not authenticated with external service' });
    }
    
    let newActivities = [];
    
    if (source === 'STRAVA') {
      const stravaActivities = await stravaService.getActivities(accessToken);
      
      for (const activity of stravaActivities) {
        const existing = await prisma.activity.findUnique({
          where: {
            externalId_source: {
              externalId: activity.id.toString(),
              source: 'STRAVA'
            }
          }
        });
        
        if (!existing) {
          const created = await prisma.activity.create({
            data: {
              userId,
              externalId: activity.id.toString(),
              source: 'STRAVA',
              name: activity.name,
              type: activity.type,
              startDate: new Date(activity.start_date),
              duration: activity.moving_time,
              distance: activity.distance,
              averageHeartRate: activity.average_heartrate,
              maxHeartRate: activity.max_heartrate,
              averageSpeed: activity.average_speed,
              maxSpeed: activity.max_speed,
              elevationGain: activity.total_elevation_gain,
              calories: activity.calories,
              averagePower: activity.average_watts,
              maxPower: activity.max_watts,
              trainingLoad: activity.suffer_score
            }
          });
          newActivities.push(created);
        }
      }
      
      await updateUserStats(userId);
    }
    
    res.json({
      message: 'Activities synced successfully',
      newActivitiesCount: newActivities.length,
      activities: newActivities
    });
  } catch (error) {
    console.error('Sync activities error:', error);
    res.status(500).json({ error: 'Failed to sync activities' });
  }
};

export const getActivityById = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    
    const activity = await prisma.activity.findFirst({
      where: {
        id,
        userId
      }
    });
    
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    res.json({ activity });
  } catch (error) {
    console.error('Get activity by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch activity details' });
  }
};

export const getActivityTypes = async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const types = await prisma.activity.findMany({
      where: { userId },
      select: { type: true },
      distinct: ['type']
    });
    
    const typeList = types.map(t => t.type).filter(Boolean);
    
    res.json({ types: typeList });
  } catch (error) {
    console.error('Get activity types error:', error);
    res.status(500).json({ error: 'Failed to fetch activity types' });
  }
};

async function updateUserStats(userId) {
  const stats = await prisma.activity.aggregate({
    where: { userId },
    _count: { id: true },
    _sum: {
      distance: true,
      duration: true,
      elevationGain: true
    }
  });
  
  const longestActivity = await prisma.activity.findFirst({
    where: { userId },
    orderBy: { distance: 'desc' }
  });
  
  await prisma.userStats.upsert({
    where: { userId },
    update: {
      totalActivities: stats._count.id,
      totalDistance: stats._sum.distance || 0,
      totalDuration: stats._sum.duration || 0,
      totalElevationGain: stats._sum.elevationGain || 0,
      longestActivityId: longestActivity?.id,
      lastSyncDate: new Date()
    },
    create: {
      userId,
      totalActivities: stats._count.id,
      totalDistance: stats._sum.distance || 0,
      totalDuration: stats._sum.duration || 0,
      totalElevationGain: stats._sum.elevationGain || 0,
      longestActivityId: longestActivity?.id,
      lastSyncDate: new Date()
    }
  });
}
