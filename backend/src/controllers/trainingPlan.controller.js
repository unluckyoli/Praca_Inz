import prisma from '../config/database.js';

export const getRecommendedPlan = async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const userStats = await prisma.userStats.findUnique({
      where: { userId }
    });
    
    if (!userStats || userStats.totalActivities === 0) {
      return res.status(404).json({ 
        error: 'Insufficient data',
        message: 'Please sync your activities first to get a personalized recommendation'
      });
    }
    
    const recentActivities = await prisma.activity.findMany({
      where: { userId },
      orderBy: { startDate: 'desc' },
      take: 30
    });
    
    const avgWeeklyHours = (userStats.totalDuration / 3600) / 
      (Math.ceil((Date.now() - new Date(recentActivities[recentActivities.length - 1]?.startDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 7)));
    
    const activitiesPerWeek = recentActivities.length / 
      Math.max(1, Math.ceil((Date.now() - new Date(recentActivities[recentActivities.length - 1]?.startDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24 * 7)));
    
    const avgDistance = userStats.totalDistance / userStats.totalActivities;
    
    let level = 'BEGINNER';
    if (avgWeeklyHours > 8 && activitiesPerWeek > 5) {
      level = 'ELITE';
    } else if (avgWeeklyHours > 5 && activitiesPerWeek > 4) {
      level = 'ADVANCED';
    } else if (avgWeeklyHours > 3 && activitiesPerWeek > 2) {
      level = 'INTERMEDIATE';
    }
    
    const highIntensityCount = await prisma.activity.count({
      where: {
        userId,
        averageHeartRate: { gte: 150 }
      }
    });
    
    let focusType = 'ENDURANCE';
    if (highIntensityCount / userStats.totalActivities > 0.4) {
      focusType = 'SPEED';
    } else if (avgDistance > 15000) {
      focusType = 'ENDURANCE';
    } else {
      focusType = 'MIXED';
    }
    
    // Get all templates and score them in JavaScript for safety
    const allTemplates = await prisma.trainingPlanTemplate.findMany({
      include: {
        weeks: {
          include: {
            sessions: true
          },
          orderBy: { weekNumber: 'asc' }
        }
      }
    });
    
    // Score templates based on user profile
    const scoredTemplates = allTemplates.map(template => {
      let score = 0;
      
      // Level match (100 points for exact, 80 for adjacent, 50 for others)
      if (template.level === level) {
        score += 100;
      } else if (
        (template.level === 'INTERMEDIATE' && level === 'ADVANCED') ||
        (template.level === 'BEGINNER' && level === 'INTERMEDIATE') ||
        (template.level === 'ADVANCED' && level === 'ELITE')
      ) {
        score += 80;
      } else {
        score += 50;
      }
      
      // Focus type match
      if (template.focusType === focusType) {
        score += 100;
      } else if (template.focusType === 'MIXED') {
        score += 70;
      } else {
        score += 30;
      }
      
      // Weekly hours match
      const hoursDiff = Math.abs(template.weeklyHours - Math.round(avgWeeklyHours));
      if (hoursDiff <= 1) {
        score += 100;
      } else if (hoursDiff <= 2) {
        score += 70;
      } else {
        score += 40;
      }
      
      return { ...template, matchScore: score };
    });
    
    // Sort by score and get top 3
    const recommendedPlans = scoredTemplates
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
    
    const topPlan = recommendedPlans[0];
    
    if (topPlan) {
      res.json({
        recommendedPlan: topPlan,
        userProfile: {
          level,
          focusType,
          avgWeeklyHours: avgWeeklyHours.toFixed(1),
          activitiesPerWeek: activitiesPerWeek.toFixed(1)
        },
        alternativePlans: recommendedPlans.slice(1)
      });
    } else {
      res.status(404).json({ error: 'No suitable plan found' });
    }
  } catch (error) {
    console.error('Get recommended plan error:', error);
    res.status(500).json({ error: 'Failed to fetch recommended plan' });
  }
};

export const getPlanTemplates = async (req, res) => {
  try {
    const { level, focusType } = req.query;
    
    const where = {
      ...(level && { level }),
      ...(focusType && { focusType })
    };
    
    const templates = await prisma.trainingPlanTemplate.findMany({
      where,
      include: {
        weeks: {
          include: {
            sessions: true
          },
          orderBy: { weekNumber: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    res.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch plan templates' });
  }
};

export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const plan = await prisma.trainingPlanTemplate.findUnique({
      where: { id },
      include: {
        weeks: {
          include: {
            sessions: {
              orderBy: { dayOfWeek: 'asc' }
            }
          },
          orderBy: { weekNumber: 'asc' }
        }
      }
    });
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json({ plan });
  } catch (error) {
    console.error('Get plan by id error:', error);
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
};

export const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await prisma.trainingSession.findUnique({
      where: { id }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Parse intervals if they exist in description
    let intervals = null;
    if (session.sessionType === 'INTERVAL' && session.description) {
      // Try to extract interval information from description
      const intervalMatch = session.description.match(/(\d+)x(\d+)/i);
      if (intervalMatch) {
        intervals = {
          sets: parseInt(intervalMatch[1]),
          duration: parseInt(intervalMatch[2])
        };
      }
    }
    
    res.json({ 
      session,
      intervals
    });
  } catch (error) {
    console.error('Get session by id error:', error);
    res.status(500).json({ error: 'Failed to fetch session details' });
  }
};
