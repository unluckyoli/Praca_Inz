import prisma from "../config/database.js";
import { getUserId } from "../utils/auth.utils.js";
import { openaiService } from "../services/openai.service.js";
import * as googleService from "../services/google.service.js";

const calculateWorkoutDuration = (intervals, targetDistance, targetPace) => {
  if (!intervals) return null;
  
  try {
    const intervalsData = typeof intervals === 'string' ? JSON.parse(intervals) : intervals;
    let totalMinutes = 0;
    
    const parsePace = (paceStr) => {
      if (!paceStr) return null;
      const match = paceStr.match(/(\d+):(\d+)/);
      if (!match) return null;
      return parseInt(match[1]) + parseInt(match[2]) / 60;
    };
    
    const parseDistance = (distStr) => {
      if (!distStr) return 0;
      const kmMatch = distStr.match(/(\d+(?:\.\d+)?)\s*km/i);
      if (kmMatch) return parseFloat(kmMatch[1]);
      const mMatch = distStr.match(/(\d+)\s*m/i);
      if (mMatch) return parseFloat(mMatch[1]) / 1000;
      return 0;
    };
    
    const basePace = parsePace(targetPace) || 6; 
    
    if (intervalsData.warmup) {
      const distance = parseDistance(intervalsData.warmup);
      const paceMatch = intervalsData.warmup.match(/@\s*([\d:]+)/);
      const pace = paceMatch ? parsePace(paceMatch[1]) : basePace * 1.15; 
      totalMinutes += distance * pace;
    }
    
    if (intervalsData.main) {
      const intervalMatch = intervalsData.main.match(/(\d+)x(\d+)\s*m/);
      if (intervalMatch) {
        const reps = parseInt(intervalMatch[1]);
        const distanceKm = parseInt(intervalMatch[2]) / 1000;
        const paceMatch = intervalsData.main.match(/@\s*([\d:]+)/);
        const pace = paceMatch ? parsePace(paceMatch[1]) : basePace * 0.85;
        const intervalTime = reps * distanceKm * pace;
        
        const recoveryMatch = intervalsData.main.match(/w\/\s*(\d+)\s*m/);
        if (recoveryMatch) {
          const recoveryKm = parseInt(recoveryMatch[1]) / 1000;
          const recoveryPace = basePace * 1.5; 
          const recoveryTime = (reps - 1) * recoveryKm * recoveryPace; 
          totalMinutes += intervalTime + recoveryTime;
        } else {
          const recoveryTime = (reps - 1) * 1.5; 
          totalMinutes += intervalTime + recoveryTime;
        }
      } else {
        const segments = intervalsData.main.split('+').map(s => s.trim());
        
        for (const segment of segments) {
          const distance = parseDistance(segment);
          const paceMatch = segment.match(/@\s*([\d:]+)/);
          const pace = paceMatch ? parsePace(paceMatch[1]) : basePace;
          totalMinutes += distance * pace;
        }
      }
    }
    
    if (intervalsData.intervals) {
      const repsMatch = intervalsData.intervals.match(/(\d+)x/);
      const distanceMatch = intervalsData.intervals.match(/(\d+)\s*m/);
      const paceMatch = intervalsData.intervals.match(/@\s*([\d:]+)/);
      
      if (repsMatch && distanceMatch) {
        const reps = parseInt(repsMatch[1]);
        const distanceKm = parseInt(distanceMatch[1]) / 1000;
        const pace = paceMatch ? parsePace(paceMatch[1]) : basePace * 0.85;
        const intervalTime = reps * distanceKm * pace;
        
        const recoveryTime = (reps - 1) * 1.5;
        totalMinutes += intervalTime + recoveryTime;
      }
    }
    
    if (intervalsData.recovery) {
      const distance = parseDistance(intervalsData.recovery);
      const paceMatch = intervalsData.recovery.match(/@\s*([\d:]+)/);
      const pace = paceMatch ? parsePace(paceMatch[1]) : basePace * 1.2; 
      totalMinutes += distance * pace;
    }
    
    if (intervalsData.cooldown) {
      const distance = parseDistance(intervalsData.cooldown);
      const paceMatch = intervalsData.cooldown.match(/@\s*([\d:]+)/);
      const pace = paceMatch ? parsePace(paceMatch[1]) : basePace * 1.15; 
      totalMinutes += distance * pace;
    }
    
    return totalMinutes > 0 ? Math.round(totalMinutes) : null;
  } catch (e) {
    console.error('[Duration Calc] Error:', e);
    return null;
  }
};

const calculateTotalDistance = (intervals) => {
  if (!intervals) return null;
  
  try {
    const intervalsData = typeof intervals === 'string' ? JSON.parse(intervals) : intervals;
    let totalKm = 0;
    
    const parseDistance = (distStr) => {
      if (!distStr) return 0;
      const kmMatch = distStr.match(/(\d+(?:\.\d+)?)\s*km/i);
      if (kmMatch) return parseFloat(kmMatch[1]);
      const mMatch = distStr.match(/(\d+)\s*m/i);
      if (mMatch) return parseFloat(mMatch[1]) / 1000;
      return 0;
    };
    
    if (intervalsData.warmup) {
      totalKm += parseDistance(intervalsData.warmup);
    }
    
    
    if (intervalsData.main) {
      const intervalMatch = intervalsData.main.match(/(\d+)x(\d+)\s*m/);
      if (intervalMatch) {
        const reps = parseInt(intervalMatch[1]);
        const distanceKm = parseInt(intervalMatch[2]) / 1000;
        totalKm += reps * distanceKm;
        
        const recoveryMatch = intervalsData.main.match(/w\/\s*(\d+)\s*m/);
        if (recoveryMatch) {
          const recoveryKm = parseInt(recoveryMatch[1]) / 1000;
          totalKm += (reps - 1) * recoveryKm; 
        }
      } else {
        const segments = intervalsData.main.split('+').map(s => s.trim());
        
        for (const segment of segments) {
          totalKm += parseDistance(segment);
        }
      }
    }
    
    if (intervalsData.intervals) {
      const repsMatch = intervalsData.intervals.match(/(\d+)x/);
      const distanceMatch = intervalsData.intervals.match(/(\d+)\s*m/);
      
      if (repsMatch && distanceMatch) {
        const reps = parseInt(repsMatch[1]);
        const distanceKm = parseInt(distanceMatch[1]) / 1000;
        totalKm += reps * distanceKm;
      }
    }
    
    if (intervalsData.recovery) {
      totalKm += parseDistance(intervalsData.recovery);
    }
    
    if (intervalsData.cooldown) {
      totalKm += parseDistance(intervalsData.cooldown);
    }
    
    return totalKm > 0 ? totalKm : null;
  } catch (e) {
    console.error('[Distance Calc] Error:', e);
    return null;
  }
};

const validateAndFixWorkout = (workout) => {
  console.log('[Validate] BEFORE:', {
    name: workout.name,
    targetDistance: workout.targetDistance,
    targetDuration: workout.targetDuration,
    targetPace: workout.targetPace
  });
  
  const fixed = { ...workout };

  if (fixed.workoutType === 'REST') {
    fixed.targetDistance = 0;
    fixed.targetDuration = 0;
    console.log('[Validate] REST day detected, setting to 0');
    return fixed;
  }

  let paceMinPerKm = null;
  if (fixed.targetPace) {
    const paceMatch = fixed.targetPace.match(/(\d+):(\d+)/);
    if (paceMatch) {
      paceMinPerKm = parseInt(paceMatch[1]) + parseInt(paceMatch[2]) / 60;
    }
  }

  const hasValidDistance = fixed.targetDistance && fixed.targetDistance > 0;
  const hasValidDuration = fixed.targetDuration && fixed.targetDuration > 1;
  const hasValidPace = paceMinPerKm && paceMinPerKm > 0;

  if (!hasValidDistance) {
    if (hasValidDuration && hasValidPace) {
      fixed.targetDistance = fixed.targetDuration / paceMinPerKm;
    } else {
      switch (fixed.workoutType) {
        case 'EASY_RUN':
        case 'RECOVERY':
          fixed.targetDistance = 8.0;
          break;
        case 'LONG_RUN':
          fixed.targetDistance = 15.0;
          break;
        case 'TEMPO_RUN':
        case 'RACE_PACE':
          fixed.targetDistance = 10.0;
          break;
        case 'INTERVALS':
        case 'FARTLEK':
          fixed.targetDistance = 10.0;
          break;
        default:
          fixed.targetDistance = 8.0;
      }
    }
  }

  if (!hasValidDuration) {
    if (hasValidDistance && hasValidPace) {
      fixed.targetDuration = Math.round(fixed.targetDistance * paceMinPerKm);
    } else {
      switch (fixed.workoutType) {
        case 'EASY_RUN':
        case 'RECOVERY':
          fixed.targetDuration = 45;
          break;
        case 'LONG_RUN':
          fixed.targetDuration = 90;
          break;
        case 'TEMPO_RUN':
        case 'RACE_PACE':
          fixed.targetDuration = 60;
          break;
        case 'INTERVALS':
        case 'FARTLEK':
          fixed.targetDuration = 60;
          break;
        default:
          fixed.targetDuration = 45;
      }
    }
  }

  if (!hasValidPace && fixed.targetDistance > 0 && fixed.targetDuration > 0) {
    const calculatedPace = fixed.targetDuration / fixed.targetDistance;
    const minutes = Math.floor(calculatedPace);
    const seconds = Math.round((calculatedPace - minutes) * 60);
    fixed.targetPace = `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
    paceMinPerKm = calculatedPace;
  }

  if (fixed.targetDistance > 0 && fixed.targetDuration > 0 && paceMinPerKm > 0) {
    const expectedDuration = Math.round(fixed.targetDistance * paceMinPerKm);
    const diff = Math.abs(expectedDuration - fixed.targetDuration);
    
    if (diff > 2) {
      console.log(`[Validate] Inconsistency detected: ${fixed.targetDistance}km × ${paceMinPerKm.toFixed(2)}min/km = ${expectedDuration}min, but duration was ${fixed.targetDuration}min`);
      fixed.targetDuration = expectedDuration;
      console.log(`[Validate] Corrected duration to ${expectedDuration}min`);
    }
  }

  if (fixed.intervals && fixed.workoutType !== 'REST') {
    const calculatedDistance = calculateTotalDistance(fixed.intervals);
    if (calculatedDistance && calculatedDistance > 0) {
      fixed.targetDistance = calculatedDistance;
      console.log(`[Validate] Calculated distance from intervals: ${calculatedDistance}km`);
    }
    
    const calculatedDuration = calculateWorkoutDuration(fixed.intervals, fixed.targetDistance, fixed.targetPace);
    if (calculatedDuration && calculatedDuration > 0) {
      fixed.targetDuration = calculatedDuration;
      console.log(`[Validate] Calculated duration from intervals: ${calculatedDuration}min`);
    }
  }
  
  if (fixed.workoutType !== 'REST') {
    let baseName = fixed.name.replace(/\s*\d+(?:\.\d+)?km/, '').replace(/\s*\(\d+min\)\s*$/, '').trim();
    
    if (fixed.targetDistance > 0) {
      const distanceKm = Math.round(fixed.targetDistance * 10) / 10; 
      baseName = `${baseName} ${distanceKm}km`;
    }
    if (fixed.targetDuration > 0) {
      baseName = `${baseName} (${fixed.targetDuration}min)`;
    }
    
    fixed.name = baseName;
  }

  console.log('[Validate] AFTER:', {
    name: fixed.name,
    targetDistance: fixed.targetDistance,
    targetDuration: fixed.targetDuration,
    targetPace: fixed.targetPace
  });

  return fixed;
};

export const analyzeUserTraining = async (req, res) => {
  try {
    const userId = getUserId(req);

    console.log(`[Training Plan] ============================================`);
    console.log(`[Training Plan] Analyzing for user: ${userId}`);
    console.log(`[Training Plan] req.user:`, req.user);
    console.log(`[Training Plan] req.session:`, req.session);

    const totalActivitiesCount = await prisma.activity.count({
      where: { userId }
    });
    
    console.log(`[Training Plan] Total activities in database for this user: ${totalActivitiesCount}`);

    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    console.log(`[Training Plan] Looking for activities since: ${twelveWeeksAgo.toISOString()}`);

    const allActivities = await prisma.activity.findMany({
      where: {
        userId,
      },
      orderBy: {
        startDate: "desc",
      },
      take: 5,
    });

    console.log(`[Training Plan] Recent activities (any type): ${allActivities.length}`);
    if (allActivities.length > 0) {
      console.log('[Training Plan] Sample activities:', allActivities.map(a => ({
        type: a.type,
        date: a.startDate,
        distance: a.distance ? `${(a.distance / 1000).toFixed(2)} km` : 'N/A'
      })));
    } else {
      console.log('[Training Plan] ⚠️  NO ACTIVITIES FOUND FOR THIS USER!');
      const anyActivities = await prisma.activity.findMany({ take: 5 });
      console.log('[Training Plan] Sample activities from database (any user):', anyActivities.map(a => ({
        userId: a.userId,
        type: a.type,
        date: a.startDate
      })));
    }

    const activities = await prisma.activity.findMany({
      where: {
        userId,
        OR: [
          { type: "Run" },
          { type: "VirtualRun" },
          { type: { contains: "run", mode: "insensitive" } },
        ],
        startDate: {
          gte: twelveWeeksAgo,
        },
      },
      orderBy: {
        startDate: "desc",
      },
    });

    console.log(`[Training Plan] Found ${activities.length} running activities in last 12 weeks`);

    console.log(`[Training Plan] Looking for best efforts from ALL user activities...`);
    
    const allRunActivities = await prisma.activity.findMany({
      where: {
        userId,
        OR: [
          { type: "Run" },
          { type: "VirtualRun" },
          { type: { contains: "run", mode: "insensitive" } },
        ],
      },
      orderBy: {
        startDate: "desc",
      },
    });

    console.log(`[Training Plan] Found ${allRunActivities.length} total running activities for best efforts`);
    console.log(`[Training Plan] ============================================`);

    if (activities.length === 0) {
      return res.status(400).json({
        error: "Brak danych treningowych",
        message:
          "Musisz mieć przynajmniej kilka treningów w systemie, aby wygenerować plan treningowy.",
      });
    }

    console.log(`[Training Plan] Found ${activities.length} running activities`);
    
    if (activities[0]?.bestEfforts) {
      console.log('[Training Plan] Sample bestEfforts:', JSON.stringify(activities[0].bestEfforts, null, 2));
    }

    const totalDistance = activities.reduce(
      (sum, act) => sum + (act.distance || 0),
      0
    );
    const totalDuration = activities.reduce(
      (sum, act) => sum + (act.duration || 0),
      0
    );

    const weeksCount = 12;
    const avgWeeklyDistance = totalDistance > 0 ? totalDistance / 1000 / weeksCount : 0;
    const avgPace = totalDistance > 0 ? (totalDuration / totalDistance) * 1000 : 0;

    const best5k = findBestEffort(allRunActivities, "5k");
    const best10k = findBestEffort(allRunActivities, "10k");
    const bestHalfMarathon = findBestEffort(allRunActivities, "Half-Marathon");
    const best400m = findBestEffort(allRunActivities, "400m");
    const best1km = findBestEffort(allRunActivities, "1k");

    console.log('[Training Plan] Best efforts found (from all activities):', { 
      best400m, 
      best1km, 
      best5k, 
      best10k, 
      bestHalfMarathon 
    });

    const analysis = {
      totalActivities: activities.length,
      avgWeeklyDistance: Math.round(avgWeeklyDistance * 10) / 10,
      avgPace: avgPace > 0 ? Math.round(avgPace) : 0,
      bestEfforts: {
        best400m: best400m,
        best1km: best1km,
        best5k: best5k,
        best10k: best10k,
        bestHalfMarathon: bestHalfMarathon,
      },
      recentWeeksCount: weeksCount,
      lastActivityDate: activities[0]?.startDate,
    };

    res.json(analysis);
  } catch (error) {
    console.error("Analyze training error:", error);
    res.status(500).json({ error: "Failed to analyze training data" });
  }
};

export const generateTrainingPlanSSE = async (req, res) => {
  try {
    console.log('[Generate Plan SSE] ============================================');
    console.log('[Generate Plan SSE] Starting plan generation with progress updates...');
    
    const userId = getUserId(req);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendProgress = (progress, message) => {
      res.write(`data: ${JSON.stringify({ progress, message })}\n\n`);
    };

    const sendError = (error) => {
      res.write(`data: ${JSON.stringify({ error })}\n\n`);
      res.end();
    };

    const sendComplete = (plan) => {
      res.write(`data: ${JSON.stringify({ complete: true, plan })}\n\n`);
      res.end();
    };

    sendProgress(5, 'Rozpoczynanie generowania planu...');

    const {
      goal,
      targetRaceDate,
      weeksCount,
      sessionsPerWeek,
      trainingDays,
      currentFitnessLevel,
      targetRaceDistance,
      targetRaceTime,
      userBestEfforts,
    } = req.body;

    if (!goal || !weeksCount || !sessionsPerWeek || !trainingDays) {
      sendError('Brak wymaganych pól');
      return;
    }

    sendProgress(10, 'Analizowanie danych treningowych...');

    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const activities = await prisma.activity.findMany({
      where: {
        userId,
        OR: [
          { type: "Run" },
          { type: "VirtualRun" },
          { type: { contains: "run", mode: "insensitive" } },
        ],
        startDate: { gte: twelveWeeksAgo },
      },
      orderBy: { startDate: "desc" },
    });

    sendProgress(20, 'Obliczanie statystyk...');

    const totalDistance = activities.reduce(
      (sum, act) => sum + (act.distance || 0),
      0
    );
    const totalDuration = activities.reduce(
      (sum, act) => sum + (act.duration || 0),
      0
    );

    const avgWeeklyDistance = totalDistance / 1000 / 12;
    const avgPace = totalDistance > 0 ? (totalDuration / totalDistance) * 1000 : null;

    sendProgress(30, 'Wyszukiwanie najlepszych czasów...');

    const best5kTime = userBestEfforts?.best5k || findBestEffort(activities, "5k");
    const best10kTime = userBestEfforts?.best10k || findBestEffort(activities, "10k");
    const bestHalfMarathonTime = userBestEfforts?.bestHalfMarathon || findBestEffort(activities, "Half-Marathon");
    const best1kmTime = userBestEfforts?.best1km || findBestEffort(activities, "1k");
    const best400mTime = userBestEfforts?.best400m || findBestEffort(activities, "400m");

    const userAnalysis = {
      totalActivities: activities.length,
      avgWeeklyDistance,
      avgPace: avgPace ? formatPace(avgPace) : null,
      best400mTime,
      best1kmTime,
      best5kTime,
      best10kTime,
      bestHalfMarathonTime,
      recentWeeksCount: 12,
    };

    const preferences = {
      goal,
      targetRaceDate,
      weeksCount,
      sessionsPerWeek,
      trainingDays,
      currentFitnessLevel,
      targetRaceDistance,
      targetRaceTime,
    };

    sendProgress(40, 'Generowanie planu przez AI (może potrwać kilka minut)...');

    const generatedPlan = await openaiService.generateTrainingPlan(
      userAnalysis,
      preferences
    );

    sendProgress(90, 'Walidacja i optymalizacja planu...');

    const validatedWeeks = generatedPlan.weeks.map((week) => ({
      ...week,
      workouts: week.workouts.map(validateAndFixWorkout),
    }));

    sendProgress(95, 'Zapisywanie planu do bazy danych...');

    const trainingPlan = await prisma.trainingPlan.create({
      data: {
        userId,
        name: generatedPlan.planName || goal,
        goal,
        targetRaceDate: targetRaceDate ? new Date(targetRaceDate) : null,
        weeksCount,
        sessionsPerWeek,
        trainingDays,
        analysisData: userAnalysis,
        weeks: {
          create: validatedWeeks.map((week) => ({
            weekNumber: week.weekNumber,
            weekGoal: week.weekGoal,
            totalDistance: week.totalDistance,
            totalDuration: week.totalDuration,
            workouts: {
              create: week.workouts.map((workout) => ({
                dayOfWeek: workout.dayOfWeek,
                workoutType: workout.workoutType,
                name: workout.name,
                description: workout.description,
                targetDistance: workout.targetDistance,
                targetDuration: workout.targetDuration,
                targetPace: workout.targetPace,
                intensity: workout.intensity,
                intervals: workout.intervals || null,
              })),
            },
          })),
        },
      },
      include: {
        weeks: {
          include: {
            workouts: true,
          },
          orderBy: {
            weekNumber: "asc",
          },
        },
      },
    });

    sendProgress(100, 'Plan treningowy został utworzony!');
    sendComplete({ id: trainingPlan.id });

  } catch (error) {
    console.error('[Generate Plan SSE] Error:', error);
    const errorMessage = error.message || 'Wystąpił błąd podczas generowania planu';
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
};

export const generateTrainingPlan = async (req, res) => {
  try {
    console.log('[Generate Plan] ============================================');
    console.log('[Generate Plan] Starting plan generation...');
    
    const userId = getUserId(req);
    console.log('[Generate Plan] User ID:', userId);
    
    const {
      goal,
      targetRaceDate,
      weeksCount,
      sessionsPerWeek,
      trainingDays,
      currentFitnessLevel,
      targetRaceDistance,
      targetRaceTime,
      userBestEfforts, 
    } = req.body;

    console.log('[Generate Plan] Request body:', {
      goal,
      targetRaceDate,
      weeksCount,
      sessionsPerWeek,
      trainingDays,
      currentFitnessLevel,
      targetRaceDistance,
      targetRaceTime,
      userBestEfforts,
    });

    if (!goal || !weeksCount || !sessionsPerWeek || !trainingDays) {
      return res.status(400).json({
        error: "Missing required fields",
        required: [
          "goal",
          "weeksCount",
          "sessionsPerWeek",
          "trainingDays",
        ],
      });
    }

    if (!Array.isArray(trainingDays) || trainingDays.length === 0) {
      return res.status(400).json({
        error: "trainingDays must be a non-empty array",
      });
    }

    if (sessionsPerWeek > trainingDays.length) {
      return res.status(400).json({
        error:
          "sessionsPerWeek cannot be greater than the number of training days",
      });
    }

    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const activities = await prisma.activity.findMany({
      where: {
        userId,
        OR: [
          { type: "Run" },
          { type: "VirtualRun" },
          { type: { contains: "Run", mode: "insensitive" } },
        ],
        startDate: {
          gte: twelveWeeksAgo,
        },
      },
      orderBy: {
        startDate: "desc",
      },
    });

    const totalDistance = activities.reduce(
      (sum, act) => sum + (act.distance || 0),
      0
    );
    const totalDuration = activities.reduce(
      (sum, act) => sum + (act.duration || 0),
      0
    );

    const avgWeeklyDistance = totalDistance / 1000 / 12;
    const avgPace = totalDistance > 0 ? (totalDuration / totalDistance) * 1000 : null;

    const best5kTime = userBestEfforts?.best5k || findBestEffort(activities, "5k");
    const best10kTime = userBestEfforts?.best10k || findBestEffort(activities, "10k");
    const bestHalfMarathonTime = userBestEfforts?.bestHalfMarathon || findBestEffort(activities, "Half-Marathon");
    const best1kmTime = userBestEfforts?.best1km || findBestEffort(activities, "1k");
    const best400mTime = userBestEfforts?.best400m || findBestEffort(activities, "400m");

    const userAnalysis = {
      totalActivities: activities.length,
      avgWeeklyDistance,
      avgPace: avgPace ? formatPace(avgPace) : null,
      best400mTime,
      best1kmTime,
      best5kTime,
      best10kTime,
      bestHalfMarathonTime,
      recentWeeksCount: 12,
    };

    console.log('[Generate Plan] User analysis (with user-provided times):', userAnalysis);

    const preferences = {
      goal,
      targetRaceDate,
      weeksCount,
      sessionsPerWeek,
      trainingDays,
      currentFitnessLevel: currentFitnessLevel || "INTERMEDIATE",
      targetRaceDistance: targetRaceDistance || "Half Marathon",
      targetRaceTime,
    };

    console.log('[Generate Plan] Preferences:', preferences);

    console.log('[Generate Plan] Calling Ollama to generate plan...');
    const generatedPlan = await openaiService.generateTrainingPlan(
      userAnalysis,
      preferences
    );

    console.log('[Generate Plan] Plan generated successfully, validating data...');
    console.log('[Generate Plan] Generated plan structure:', {
      planName: generatedPlan.planName,
      planDescription: generatedPlan.planDescription,
      weeksCount: generatedPlan.weeks?.length,
      firstWeek: generatedPlan.weeks?.[0] ? {
        weekNumber: generatedPlan.weeks[0].weekNumber,
        weekGoal: generatedPlan.weeks[0].weekGoal,
        workoutsCount: generatedPlan.weeks[0].workouts?.length
      } : null,
      lastWeek: generatedPlan.weeks?.[generatedPlan.weeks.length - 1] ? {
        weekNumber: generatedPlan.weeks[generatedPlan.weeks.length - 1].weekNumber,
        weekGoal: generatedPlan.weeks[generatedPlan.weeks.length - 1].weekGoal,
        workoutsCount: generatedPlan.weeks[generatedPlan.weeks.length - 1].workouts?.length
      } : null
    });

    const validatedWeeks = generatedPlan.weeks.map((week) => ({
      ...week,
      workouts: week.workouts.map(validateAndFixWorkout),
    }));

    console.log('[Generate Plan] Data validated, saving to database...');

    const trainingPlan = await prisma.trainingPlan.create({
      data: {
        userId,
        name: generatedPlan.planName || goal,
        goal,
        targetRaceDate: targetRaceDate ? new Date(targetRaceDate) : null,
        weeksCount,
        sessionsPerWeek,
        trainingDays,
        analysisData: userAnalysis,
        weeks: {
          create: validatedWeeks.map((week) => ({
            weekNumber: week.weekNumber,
            weekGoal: week.weekGoal,
            totalDistance: week.totalDistance,
            totalDuration: week.totalDuration,
            workouts: {
              create: week.workouts.map((workout) => ({
                dayOfWeek: workout.dayOfWeek,
                workoutType: workout.workoutType,
                name: workout.name,
                description: workout.description,
                targetDistance: workout.targetDistance,
                targetDuration: workout.targetDuration,
                targetPace: workout.targetPace,
                intensity: workout.intensity,
                intervals: workout.intervals || null,
              })),
            },
          })),
        },
      },
      include: {
        weeks: {
          include: {
            workouts: true,
          },
          orderBy: {
            weekNumber: "asc",
          },
        },
      },
    });

    res.json({
      message: "Training plan generated successfully",
      plan: trainingPlan,
      planDescription: generatedPlan.planDescription,
    });
    
    console.log('[Generate Plan] ============================================');
  } catch (error) {
    console.error("[Generate Plan] ============================================");
    console.error("[Generate Plan] ERROR:", error.message);
    console.error("[Generate Plan] Stack:", error.stack);
    console.error("[Generate Plan] ============================================");
    
    res.status(500).json({
      error: "Failed to generate training plan",
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

export const getUserTrainingPlans = async (req, res) => {
  try {
    const userId = getUserId(req);

    const plans = await prisma.trainingPlan.findMany({
      where: { userId },
      include: {
        weeks: {
          include: {
            workouts: true,
          },
          orderBy: {
            weekNumber: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ plans });
  } catch (error) {
    console.error("Get training plans error:", error);
    res.status(500).json({ error: "Failed to fetch training plans" });
  }
};

export const getTrainingPlanById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { planId } = req.params;

    const plan = await prisma.trainingPlan.findFirst({
      where: {
        id: planId,
        userId,
      },
      include: {
        weeks: {
          include: {
            workouts: {
              orderBy: {
                dayOfWeek: "asc",
              },
            },
          },
          orderBy: {
            weekNumber: "asc",
          },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({ error: "Training plan not found" });
    }

    res.json({ plan });
  } catch (error) {
    console.error("Get training plan error:", error);
    res.status(500).json({ error: "Failed to fetch training plan" });
  }
};

export const completeWorkout = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { workoutId } = req.params;
    const { actualDistance, actualDuration, notes } = req.body;

    const workout = await prisma.planWorkout.findFirst({
      where: {
        id: workoutId,
      },
      include: {
        planWeek: {
          include: {
            trainingPlan: true,
          },
        },
      },
    });

    if (!workout || workout.planWeek.trainingPlan.userId !== userId) {
      return res.status(404).json({ error: "Workout not found" });
    }

    const updatedWorkout = await prisma.planWorkout.update({
      where: { id: workoutId },
      data: {
        completed: true,
        completedAt: new Date(),
        actualDistance,
        actualDuration,
        notes,
      },
    });

    res.json({
      message: "Workout marked as completed",
      workout: updatedWorkout,
    });
  } catch (error) {
    console.error("Complete workout error:", error);
    res.status(500).json({ error: "Failed to complete workout" });
  }
};

export const updatePlanStatus = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { planId } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "COMPLETED", "ARCHIVED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const plan = await prisma.trainingPlan.findFirst({
      where: {
        id: planId,
        userId,
      },
    });

    if (!plan) {
      return res.status(404).json({ error: "Training plan not found" });
    }

    const updatedPlan = await prisma.trainingPlan.update({
      where: { id: planId },
      data: { status },
    });

    res.json({
      message: "Plan status updated",
      plan: updatedPlan,
    });
  } catch (error) {
    console.error("Update plan status error:", error);
    res.status(500).json({ error: "Failed to update plan status" });
  }
};

export const deleteTrainingPlan = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { planId } = req.params;

    const plan = await prisma.trainingPlan.findFirst({
      where: {
        id: planId,
        userId,
      },
      include: {
        weeks: {
          include: {
            workouts: true,
          },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({ error: "Training plan not found" });
    }

    if (plan.syncedToCalendar) {
      console.log(`[Delete Plan] Plan was synced to calendar, removing events...`);
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { googleRefreshToken: true },
      });

      if (user?.googleRefreshToken) {
        let deletedCount = 0;
        let failedCount = 0;

        const allWorkouts = plan.weeks.flatMap(week => week.workouts);
        const workoutsWithEvents = allWorkouts.filter(w => w.googleEventId);

        const estimatedTime = Math.ceil(workoutsWithEvents.length * 0.15);
        console.log(`[Delete Plan] Found ${workoutsWithEvents.length} workouts with calendar events (estimated ${estimatedTime}s)...`);

        for (let i = 0; i < workoutsWithEvents.length; i++) {
          const workout = workoutsWithEvents[i];
          try {
            await googleService.deleteCalendarEvent(userId, workout.googleEventId);
            deletedCount++;
            
            if ((i + 1) % 10 === 0 || i === workoutsWithEvents.length - 1) {
              console.log(`[Delete Plan] Progress: ${i + 1}/${workoutsWithEvents.length} events deleted`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 150));
          } catch (error) {
            failedCount++;
            console.error(`[Delete Plan] Failed to delete event for ${workout.name}:`, error.message);
            
            if (error.message.includes('Rate Limit') || error.code === 429 || error.response?.status === 429) {
              console.log(`[Delete Plan] Rate limit hit, waiting 2 seconds before continuing...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        console.log(`[Delete Plan] Calendar cleanup: ${deletedCount} deleted, ${failedCount} failed`);
      } else {
        console.log(`[Delete Plan] User doesn't have Google Calendar connected, skipping event deletion`);
      }
    }

    await prisma.trainingPlan.delete({
      where: { id: planId },
    });

    res.json({ 
      message: "Training plan deleted successfully",
      calendarEventsDeleted: plan.syncedToCalendar,
    });
  } catch (error) {
    console.error("Delete training plan error:", error);
    res.status(500).json({ error: "Failed to delete training plan" });
  }
};

function findBestEffort(activities, effortType) {
  let bestTime = null;
  let foundNames = new Set();

  const normalizedType = effortType.toLowerCase();
  const typeMapping = {
    '5k': '5K',
    '10k': '10K', 
    '1k': '1K',
    '400m': '400m',
    'half-marathon': 'Half-Marathon',
    'halfmarathon': 'Half-Marathon',
    'marathon': 'Marathon'
  };
  
  const searchType = typeMapping[normalizedType] || effortType;

  for (const activity of activities) {
    if (activity.bestEfforts && Array.isArray(activity.bestEfforts)) {
      activity.bestEfforts.forEach(e => foundNames.add(e.name));
      
      const effort = activity.bestEfforts.find((e) => 
        e.name.toLowerCase() === searchType.toLowerCase()
      );
      
      if (effort && effort.elapsed_time) {
        if (!bestTime || effort.elapsed_time < bestTime) {
          bestTime = effort.elapsed_time;
        }
      }
    }
  }

  if (bestTime === null && foundNames.size > 0) {
    console.log(`[findBestEffort] Looking for "${effortType}" (normalized: "${searchType}"), available names:`, Array.from(foundNames));
  }

  return bestTime;
}

function formatPace(paceSecondsPerKm) {
  const mins = Math.floor(paceSecondsPerKm / 60);
  const secs = Math.floor(paceSecondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}

export const getRecommendedPlan = async (req, res) => {
  try {
    const userId = getUserId(req);
    console.log(`[Training Plan] User ID: ${userId}`);

    const userStats = await prisma.userStats.findUnique({
      where: { userId },
    });

    console.log(`[Training Plan] User stats:`, userStats);

    if (!userStats || userStats.totalActivities === 0) {
      console.log(`[Training Plan] Insufficient data for user ${userId}`);
      return res.status(404).json({
        error: "Insufficient data",
        message:
          "Please sync your activities first to get a personalized recommendation",
      });
    }

    const recentActivities = await prisma.activity.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
      take: 30,
    });

    const avgWeeklyHours =
      userStats.totalDuration /
      3600 /
      Math.ceil(
        (Date.now() -
          new Date(
            recentActivities[recentActivities.length - 1]?.startDate ||
              Date.now(),
          ).getTime()) /
          (1000 * 60 * 60 * 24 * 7),
      );

    const activitiesPerWeek =
      recentActivities.length /
      Math.max(
        1,
        Math.ceil(
          (Date.now() -
            new Date(
              recentActivities[recentActivities.length - 1]?.startDate ||
                Date.now(),
            ).getTime()) /
            (1000 * 60 * 60 * 24 * 7),
        ),
      );

    const avgDistance = userStats.totalDistance / userStats.totalActivities;

    let level = "BEGINNER";
    if (avgWeeklyHours > 8 && activitiesPerWeek > 5) {
      level = "ELITE";
    } else if (avgWeeklyHours > 5 && activitiesPerWeek > 4) {
      level = "ADVANCED";
    } else if (avgWeeklyHours > 3 && activitiesPerWeek > 2) {
      level = "INTERMEDIATE";
    }

    const highIntensityCount = await prisma.activity.count({
      where: {
        userId,
        averageHeartRate: { gte: 150 },
      },
    });

    let focusType = "ENDURANCE";
    if (highIntensityCount / userStats.totalActivities > 0.4) {
      focusType = "SPEED";
    } else if (avgDistance > 15000) {
      focusType = "ENDURANCE";
    } else {
      focusType = "MIXED";
    }

    const allTemplates = await prisma.trainingPlanTemplate.findMany({
      include: {
        weeks: {
          include: {
            sessions: true,
          },
          orderBy: { weekNumber: "asc" },
        },
      },
    });

    const scoredTemplates = allTemplates.map((template) => {
      let score = 0;

      if (template.level === level) {
        score += 100;
      } else if (
        (template.level === "INTERMEDIATE" && level === "ADVANCED") ||
        (template.level === "BEGINNER" && level === "INTERMEDIATE") ||
        (template.level === "ADVANCED" && level === "ELITE")
      ) {
        score += 80;
      } else {
        score += 50;
      }

      if (template.focusType === focusType) {
        score += 100;
      } else if (template.focusType === "MIXED") {
        score += 70;
      } else {
        score += 30;
      }

      const hoursDiff = Math.abs(
        template.weeklyHours - Math.round(avgWeeklyHours),
      );
      if (hoursDiff <= 1) {
        score += 100;
      } else if (hoursDiff <= 2) {
        score += 70;
      } else {
        score += 40;
      }

      return { ...template, matchScore: score };
    });

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
          activitiesPerWeek: activitiesPerWeek.toFixed(1),
        },
        alternativePlans: recommendedPlans.slice(1),
      });
    } else {
      res.status(404).json({ error: "No suitable plan found" });
    }
  } catch (error) {
    console.error("Get recommended plan error:", error);
    res.status(500).json({ error: "Failed to fetch recommended plan" });
  }
};

export const getPlanTemplates = async (req, res) => {
  try {
    const { level, focusType } = req.query;

    const where = {
      ...(level && { level }),
      ...(focusType && { focusType }),
    };

    const templates = await prisma.trainingPlanTemplate.findMany({
      where,
      include: {
        weeks: {
          include: {
            sessions: true,
          },
          orderBy: { weekNumber: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({ templates });
  } catch (error) {
    console.error("Get templates error:", error);
    res.status(500).json({ error: "Failed to fetch plan templates" });
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
              orderBy: { dayOfWeek: "asc" },
            },
          },
          orderBy: { weekNumber: "asc" },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    res.json({ plan });
  } catch (error) {
    console.error("Get plan by id error:", error);
    res.status(500).json({ error: "Failed to fetch plan" });
  }
};

export const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.trainingSession.findUnique({
      where: { id },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    let intervals = null;
    if (session.sessionType === "INTERVAL" && session.description) {
      const intervalMatch = session.description.match(/(\d+)x(\d+)/i);
      if (intervalMatch) {
        intervals = {
          sets: parseInt(intervalMatch[1]),
          duration: parseInt(intervalMatch[2]),
        };
      }
    }

    res.json({
      session,
      intervals,
    });
  } catch (error) {
    console.error("Get session by id error:", error);
    res.status(500).json({ error: "Failed to fetch session details" });
  }
};


export const syncPlanToCalendar = async (req, res) => {
  try {
    const { id: planId } = req.params;
    const userId = getUserId(req);
    
    console.log(`[Sync Calendar] Starting sync for plan ${planId}...`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true },
    });

    if (!user?.googleRefreshToken) {
      return res.status(400).json({ 
        error: 'Google Calendar not connected',
        requiresGoogleAuth: true,
      });
    }

    const plan = await prisma.trainingPlan.findFirst({
      where: { id: planId, userId },
      include: {
        weeks: {
          include: {
            workouts: true,
          },
          orderBy: { weekNumber: 'asc' },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Training plan not found' });
    }

    let eventsCreated = 0;
    let eventsUpdated = 0;
    const errors = [];
    
    const totalWorkouts = plan.weeks.flatMap(w => w.workouts).filter(w => w.workoutType !== 'REST').length;
    const estimatedTime = Math.ceil(totalWorkouts * 0.15); // 150ms per workout
    console.log(`[Sync Calendar] Syncing ${totalWorkouts} workouts (estimated ${estimatedTime}s)...`);

    let startDate;
    if (plan.targetRaceDate) {
      startDate = new Date(plan.targetRaceDate);
      startDate.setDate(startDate.getDate() - (plan.weeksCount * 7));
    } else {
      startDate = new Date();
      const dayOfWeek = startDate.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
      startDate.setDate(startDate.getDate() + daysUntilMonday);
    }

    for (const week of plan.weeks) {
      for (const workout of week.workouts) {
        if (workout.workoutType === 'REST') {
          continue; 
        }

        try {
          const workoutDate = new Date(startDate);
          workoutDate.setDate(workoutDate.getDate() + ((week.weekNumber - 1) * 7) + (workout.dayOfWeek - 1));

          workoutDate.setHours(8, 0, 0, 0);

          const durationHours = workout.targetDuration ? workout.targetDuration / 60 : 1;
          const endDate = new Date(workoutDate);
          endDate.setHours(endDate.getHours() + durationHours);

          let description = workout.description || '';
          
          if (workout.targetDistance) {
            description += `\n\n📏 Dystans: ${workout.targetDistance.toFixed(1)} km`;
          }
          if (workout.targetDuration) {
            description += `\n⏱️ Czas: ${workout.targetDuration} min`;
          }
          if (workout.targetPace) {
            description += `\n🎯 Tempo: ${workout.targetPace}`;
          }
          if (workout.intensity) {
            description += `\n💪 Intensywność: ${workout.intensity}`;
          }

          if (workout.intervals) {
            try {
              const intervals = typeof workout.intervals === 'string' 
                ? JSON.parse(workout.intervals) 
                : workout.intervals;
              
              description += '\n\n📊 Struktura treningu:';
              if (intervals.warmup) description += `\n• Rozgrzewka: ${intervals.warmup}`;
              if (intervals.main) description += `\n• Część główna: ${intervals.main}`;
              if (intervals.intervals) description += `\n• Interwały: ${intervals.intervals}`;
              if (intervals.recovery) description += `\n• Odzyskiwanie: ${intervals.recovery}`;
              if (intervals.cooldown) description += `\n• Wyciszenie: ${intervals.cooldown}`;
            } catch (e) {
              console.error('Error parsing intervals:', e);
            }
          }

          const eventData = {
            summary: `🏃 ${workout.name}`,
            description: description.trim(),
            startTime: workoutDate.toISOString(),
            endTime: endDate.toISOString(),
          };

          if (workout.googleEventId) {
            try {
              await googleService.updateCalendarEvent(userId, workout.googleEventId, eventData);
              eventsUpdated++;
            } catch (updateError) {
              const event = await googleService.createCalendarEvent(userId, eventData);
              await prisma.planWorkout.update({
                where: { id: workout.id },
                data: { googleEventId: event.id },
              });
              eventsCreated++;
            }
          } else {
            const event = await googleService.createCalendarEvent(userId, eventData);
            await prisma.planWorkout.update({
              where: { id: workout.id },
              data: { googleEventId: event.id },
            });
            eventsCreated++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 150));
        } catch (error) {
          console.error(`Error syncing workout ${workout.id} (${workout.name}):`, error);
          console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
          });
          
          if (error.response?.status === 429 || error.message?.includes('Rate Limit')) {
            console.log(`[Sync Calendar] Rate limit hit, waiting 2 seconds before continuing...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          errors.push({
            workoutId: workout.id,
            workoutName: workout.name,
            error: error.message,
            details: error.response?.data || error.stack,
          });
        }
      }
    }

    await prisma.trainingPlan.update({
      where: { id: planId },
      data: {
        syncedToCalendar: true,
        calendarSyncDate: new Date(),
      },
    });

    res.json({
      message: 'Training plan synced to Google Calendar',
      eventsCreated,
      eventsUpdated,
      totalEvents: eventsCreated + eventsUpdated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error syncing plan to calendar:', error);
    res.status(500).json({ error: 'Failed to sync training plan to calendar' });
  }
};

export const updateWorkout = async (req, res) => {
  try {
    const { workoutId } = req.params;
    const userId = getUserId(req);
    const {
      name,
      description,
      targetDistance,
      targetDuration,
      targetPace,
      intensity,
      intervals,
      dayOfWeek,
      workoutType,
      order,
    } = req.body;

    const workout = await prisma.planWorkout.findUnique({
      where: { id: workoutId },
      include: {
        planWeek: {
          include: {
            trainingPlan: true,
          },
        },
      },
    });

    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    if (workout.planWeek.trainingPlan.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Aktualizuj workout
    const updatedWorkout = await prisma.planWorkout.update({
      where: { id: workoutId },
      data: {
        name,
        description,
        targetDistance,
        targetDuration,
        targetPace,
        intensity,
        intervals,
        dayOfWeek,
        workoutType,
        order,
      },
    });

    // Przelicz sumy dla tygodnia
    const weekWorkouts = await prisma.planWorkout.findMany({
      where: { planWeekId: workout.planWeekId },
    });

    const weekTotalDistance = weekWorkouts.reduce((sum, w) => sum + (w.targetDistance || 0), 0);
    const weekTotalDuration = weekWorkouts.reduce((sum, w) => sum + (w.targetDuration || 0), 0);

    await prisma.planWeek.update({
      where: { id: workout.planWeekId },
      data: {
        totalDistance: weekTotalDistance,
        totalDuration: weekTotalDuration,
      },
    });

    res.json(updatedWorkout);
  } catch (error) {
    console.error('Error updating workout:', error);
    res.status(500).json({ error: 'Failed to update workout' });
  }
};

// Dodaj nowy trening do planu
export const addWorkoutToPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = getUserId(req);
    const {
      weekNumber,
      dayOfWeek,
      name,
      description,
      targetDistance,
      targetDuration,
      targetPace,
      intensity,
      intervals,
      workoutType,
    } = req.body;

    // Sprawdź czy plan należy do użytkownika
    const plan = await prisma.trainingPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Training plan not found' });
    }

    if (plan.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Znajdź lub utwórz tydzień
    let planWeek = await prisma.planWeek.findFirst({
      where: {
        trainingPlanId: planId,
        weekNumber,
      },
    });

    if (!planWeek) {
      planWeek = await prisma.planWeek.create({
        data: {
          trainingPlanId: planId,
          weekNumber,
          startDate: new Date(plan.startDate.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Utwórz workout
    const workout = await prisma.planWorkout.create({
      data: {
        planWeekId: planWeek.id,
        dayOfWeek,
        name,
        description,
        targetDistance,
        targetDuration,
        targetPace,
        intensity,
        intervals,
        workoutType: workoutType || 'EASY_RUN',
      },
    });

    // Przelicz sumy dla tygodnia
    const weekWorkouts = await prisma.planWorkout.findMany({
      where: { planWeekId: planWeek.id },
    });

    const weekTotalDistance = weekWorkouts.reduce((sum, w) => sum + (w.targetDistance || 0), 0);
    const weekTotalDuration = weekWorkouts.reduce((sum, w) => sum + (w.targetDuration || 0), 0);

    await prisma.planWeek.update({
      where: { id: planWeek.id },
      data: {
        totalDistance: weekTotalDistance,
        totalDuration: weekTotalDuration,
      },
    });

    res.status(201).json(workout);
  } catch (error) {
    console.error('Error adding workout to plan:', error);
    res.status(500).json({ error: 'Failed to add workout to plan' });
  }
};

export const deleteWorkout = async (req, res) => {
  try {
    const { workoutId } = req.params;
    const userId = getUserId(req);

    const workout = await prisma.planWorkout.findUnique({
      where: { id: workoutId },
      include: {
        planWeek: {
          include: {
            trainingPlan: true,
          },
        },
      },
    });

    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    if (workout.planWeek.trainingPlan.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (workout.googleEventId) {
      try {
        await googleService.deleteCalendarEvent(userId, workout.googleEventId);
      } catch (error) {
        console.error('Error deleting calendar event:', error);
      }
    }

    const planWeekId = workout.planWeekId;
    
    await prisma.planWorkout.delete({
      where: { id: workoutId },
    });

    const weekWorkouts = await prisma.planWorkout.findMany({
      where: { planWeekId },
    });

    const weekTotalDistance = weekWorkouts.reduce((sum, w) => sum + (w.targetDistance || 0), 0);
    const weekTotalDuration = weekWorkouts.reduce((sum, w) => sum + (w.targetDuration || 0), 0);

    await prisma.planWeek.update({
      where: { id: planWeekId },
      data: {
        totalDistance: weekTotalDistance,
        totalDuration: weekTotalDuration,
      },
    });

    res.json({ message: 'Workout deleted successfully' });
  } catch (error) {
    console.error('Error deleting workout:', error);
    res.status(500).json({ error: 'Failed to delete workout' });
  }
};
