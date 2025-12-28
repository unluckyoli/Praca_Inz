import prisma from "../config/database.js";
import { Prisma } from "@prisma/client";
import { stravaService } from "../services/strava.service.js";
import polyline from "@mapbox/polyline";
import { getUserId, getStravaToken } from "../utils/auth.utils.js";

export const getActivities = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    const userId = getUserId(req);

    const where = {
      userId,
      ...(type && { type }),
      ...(startDate &&
        endDate && {
          startDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { startDate: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.activity.count({ where }),
    ]);

    res.json({
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get activities error:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
};

export const syncActivities = async (req, res) => {
  try {
    console.log('=== SYNC ACTIVITIES START ===');
    console.log('req.user:', req.user);
    console.log('req.session:', req.session);
    
    const userId = getUserId(req);
    console.log(`User ID: ${userId}`);

    if (!userId) {
      console.error('No user ID found in request');
      return res.status(401).json({
        error: 'User not authenticated',
      });
    }

    const accessToken = await getStravaToken(req);
    console.log(`Access Token: ${accessToken ? "Present" : "Missing"}`);

    const source = req.session?.source || "STRAVA";

    if (!accessToken) {
      console.log("No access token - user needs to link Strava");
      return res.status(401).json({
        error:
          "Not authenticated with Strava. Please link your Strava account first.",
        requiresStravaLink: true,
      });
    }

    let newActivities = [];
    let updatedActivities = 0;

    if (source === "STRAVA") {
      console.log(`Starting sync for user ${userId}...`);

      const existingCount = await prisma.activity.count({
        where: {
          userId,
          source: "STRAVA",
        },
      });

      const lastActivity = await prisma.activity.findFirst({
        where: {
          userId,
          source: "STRAVA",
        },
        orderBy: {
          startDate: "desc",
        },
        select: {
          startDate: true,
        },
      });

      const afterTimestamp = (existingCount > 0 && lastActivity)
        ? Math.floor(lastActivity.startDate.getTime() / 1000)
        : undefined;

      if (afterTimestamp) {
        console.log(`Incremental sync: Fetching activities after ${lastActivity.startDate.toISOString()}...`);
      } else {
        console.log(`Full sync: Fetching all activities from Strava...`);
      }

      let allStravaActivities = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        console.log(`Fetching page ${page}...`);
        const pageActivities = await stravaService.getActivities(
          accessToken, 
          page, 
          200,
          afterTimestamp  
        );
        
        if (pageActivities.length === 0) {
          hasMore = false;
        } else {
          allStravaActivities = allStravaActivities.concat(pageActivities);
          console.log(`Page ${page}: ${pageActivities.length} activities (total: ${allStravaActivities.length})`);
          
          if (pageActivities.length < 200) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      console.log(`Fetched ${allStravaActivities.length} activities from Strava API`);

      const existingActivities = await prisma.activity.findMany({
        where: {
          userId,
          source: "STRAVA",
        },
        select: {
          externalId: true,
        },
      });

      const existingIds = new Set(existingActivities.map(a => a.externalId));
      const activitiesToSync = allStravaActivities.filter(
        activity => !existingIds.has(activity.id.toString())
      );

      console.log(`Found ${activitiesToSync.length} new activities to sync (${existingIds.size} already in database)`);

      for (const activity of activitiesToSync) {
          console.log(`Syncing activity ${activity.id} (basic data only)...`);
          
          try {
            await new Promise(resolve => setTimeout(resolve, 100));
            
          const created = await prisma.activity.create({
            data: {
              userId,
              externalId: activity.id.toString(),
              source: "STRAVA",
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
              trainingLoad: activity.suffer_score,
              bestEfforts: null,
              laps: null,
            },
          });

          newActivities.push(created);
          console.log(`Saved activity: ${activity.name} (ID: ${created.id})`);
          } catch (detailError) {
            if (detailError.response?.status === 429) {
              console.log(`⚠️  Rate limit hit. Zapisuję podstawowe dane aktywności bez szczegółów.`);
              const created = await prisma.activity.create({
                data: {
                  userId,
                  externalId: activity.id.toString(),
                  source: "STRAVA",
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
                  trainingLoad: activity.suffer_score,
                },
              });
              newActivities.push(created);
              console.log(`✓ Saved basic activity data: ${activity.name}`);
              
              console.log(`⏸  Pausing sync due to rate limit. ${newActivities.length} new activities saved.`);
              break;
            } else {
              console.error(`Error fetching details for ${activity.id}:`, detailError.message);
            }
          }
      }

      await updateUserStats(userId);
      await calculateFitnessMetrics(userId);

      console.log(
        `Sync complete: ${newActivities.length} new, ${updatedActivities} existing`,
      );
    }

    res.json({
      message: "Activities synced successfully",
      newActivitiesCount: newActivities.length,
      existingActivitiesCount: updatedActivities,
      activities: newActivities,
    });
  } catch (error) {
    console.error("=== SYNC ACTIVITIES ERROR ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    
    if (error.response?.status === 429) {
      const resetTime = error.response.headers?.['x-ratelimit-reset'];
      const resetDate = resetTime ? new Date(resetTime * 1000) : null;
      
      console.error("Strava Rate Limit Exceeded");
      if (resetDate) {
        console.error(`Rate limit resets at: ${resetDate.toLocaleString('pl-PL')}`);
      }
      
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Osiągnięto limit zapytań do Strava API. Spróbuj ponownie za kilka minut.",
        rateLimitReset: resetDate ? resetDate.toISOString() : null,
        details: "Strava API pozwala na 100 requestów na 15 minut i 1000 requestów dziennie."
      });
    }
    
    console.error("Error stack:", error.stack);
    if (error.response) {
      console.error("API Response status:", error.response.status);
      console.error("API Response data:", error.response.data);
    }
    
    res.status(500).json({
      error: "Failed to sync activities",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

export const getActivityById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const activity = await prisma.activity.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }

    res.json({ activity });
  } catch (error) {
    console.error("Get activity by ID error:", error);
    res.status(500).json({ error: "Failed to fetch activity details" });
  }
};

export const getActivityTypes = async (req, res) => {
  try {
    const userId = getUserId(req);

    const types = await prisma.activity.findMany({
      where: { userId },
      select: { type: true },
      distinct: ["type"],
    });

    const typeList = types.map((t) => t.type).filter(Boolean);

    res.json({ types: typeList });
  } catch (error) {
    console.error("Get activity types error:", error);
    res.status(500).json({ error: "Failed to fetch activity types" });
  }
};

export const recalculatePaceData = async (req, res) => {
  try {
    const userId = getUserId(req);
    const accessToken = await getStravaToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error: "Not authenticated with Strava. Please link your Strava account first.",
        requiresStravaLink: true,
      });
    }

    console.log(`Starting pace data recalculation for user ${userId}...`);

    const deleted = await prisma.paceDistance.deleteMany({
      where: {
        activity: {
          userId,
        },
      },
    });
    console.log(`Deleted ${deleted.count} old pace distance records`);

    const activities = await prisma.activity.findMany({
      where: {
        userId,
        type: { in: ["Run", "VirtualRun"] },
      },
      orderBy: { startDate: "desc" },
    });

    console.log(`Found ${activities.length} running activities`);

    let processed = 0;
    let withPaceData = 0;
    let errors = 0;

    for (const activity of activities) {
      processed++;

      try {
      await calculatePaceDistances(
        activity.id,
        userId,
        accessToken,
        activity.externalId,
      );

        withPaceData++;

        if (processed % 10 === 0) {
          console.log(`Progress: ${processed}/${activities.length}`);
        }
      } catch (error) {
        errors++;
        console.log(`Error for ${activity.name}: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `Recalculation complete: ${withPaceData} with data, ${errors} errors`,
    );

    res.json({
      message: "Pace data recalculated successfully",
      processed,
      withPaceData,
      errors,
    });
  } catch (error) {
    console.error("Recalculate pace data error:", error);
    res.status(500).json({
      error: "Failed to recalculate pace data",
      details: error.message,
    });
  }
};

export const syncBestEfforts = async (req, res) => {
  try {
    const userId = getUserId(req);
    const accessToken = await getStravaToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error: "Not authenticated with Strava",
        requiresStravaLink: true,
      });
    }

    console.log(`Syncing best efforts for user ${userId}...`);

    const activities = await prisma.activity.findMany({
      where: {
        userId,
        source: "STRAVA",
      },
      orderBy: { startDate: "desc" },
      take: 200,
    });

    console.log(`Found ${activities.length} activities to update`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let lapsUpdated = 0;

    for (const activity of activities) {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const detailedActivity = await stravaService.getActivity(
          accessToken,
          activity.externalId,
        );

        const updateData = {};
        let hasUpdate = false;
        
        if (detailedActivity.best_efforts && detailedActivity.best_efforts.length > 0) {
          updateData.bestEfforts = detailedActivity.best_efforts;
          hasUpdate = true;
        }
        
        if (detailedActivity.laps && detailedActivity.laps.length > 0) {
          updateData.laps = detailedActivity.laps;
          lapsUpdated++;
          hasUpdate = true;
        }
        
        if (hasUpdate) {
          await prisma.activity.update({
            where: { id: activity.id },
            data: updateData,
          });
          updated++;
          console.log(`✓ Updated ${activity.name} (BE: ${!!updateData.bestEfforts}, Laps: ${!!updateData.laps})`);
        } else {
          skipped++;
        }

        if (updated % 10 === 0 && updated > 0) {
          console.log(`Progress: ${updated} updated, ${skipped} skipped, ${lapsUpdated} with laps`);
        }
      } catch (error) {
        errors++;
        console.error(`Error updating ${activity.name}:`, error.message);
        
        if (error.response?.status === 429) {
          console.log(`⚠️  Rate limit hit. Updated ${updated} activities.`);
          break;
        }
      }
    }

    res.json({
      message: "Best efforts and laps sync completed",
      updated,
      skipped,
      lapsUpdated,
      total: activities.length,
      errors,
    });
  } catch (error) {
    console.error("Sync best efforts error:", error);
    res.status(500).json({
      error: "Failed to sync best efforts",
      details: error.message,
    });
  }
};


async function updateUserStats(userId) {
  try {
    console.log(`Updating user stats for ${userId}...`);

    const activities = await prisma.activity.findMany({
      where: { userId },
      select: {
        distance: true,
        duration: true,
        elevationGain: true,
      },
    });

    const stats = {
      totalActivities: activities.length,
      totalDistance: activities.reduce((sum, a) => sum + (a.distance || 0), 0),
      totalDuration: activities.reduce((sum, a) => sum + (a.duration || 0), 0),
      totalElevationGain: activities.reduce(
        (sum, a) => sum + (a.elevationGain || 0),
        0,
      ),
    };

    await prisma.userStats.upsert({
      where: { userId },
      update: stats,
      create: {
        userId,
        ...stats,
      },
    });

    console.log(
      `Updated stats: ${stats.totalActivities} activities, ${(stats.totalDistance / 1000).toFixed(1)} km`,
    );
  } catch (error) {
    console.error("Error updating user stats:", error.message);
  }
}

async function saveGpsPoints(activityId, encodedPolyline) {
  try {
    const coordinates = polyline.decode(encodedPolyline);
    const gpsPoints = coordinates.map(([lat, lng], index) => ({
      activityId,
      latitude: lat,
      longitude: lng,
      sequenceNumber: index,
    }));

    const batchSize = 500;
    for (let i = 0; i < gpsPoints.length; i += batchSize) {
      const batch = gpsPoints.slice(i, i + batchSize);
      await prisma.gpsPoint.createMany({ data: batch });
    }

    console.log(`Saved ${gpsPoints.length} GPS points`);
  } catch (error) {
    console.error("Error saving GPS points:", error.message);
  }
}

async function calculatePowerCurve(
  activityId,
  userId,
  activityType,
  accessToken,
  stravaActivityId,
) {
  try {
    const streams = await stravaService.getActivityStreams(
      accessToken,
      stravaActivityId,
      ["watts"],
    );

    if (streams?.watts?.data && streams.watts.data.length > 0) {
      const powerData = streams.watts.data;
      const maxAvg = (durationSec) => {
        if (durationSec > powerData.length) return null;
        let best = 0;
        for (let i = 0; i <= powerData.length - durationSec; i++) {
          const slice = powerData.slice(i, i + durationSec);
          const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
          if (avg > best) best = avg;
        }
        return best > 0 ? Math.round(best) : null;
      };

      const sec5 = maxAvg(5);
      const sec30 = maxAvg(30);
      const min1 = maxAvg(60);
      const min2 = maxAvg(120);
      const min5 = maxAvg(300);
      const min10 = maxAvg(600);
      const min20 = maxAvg(1200);
      const min60 = maxAvg(3600);

      await prisma.powerCurve.upsert({
        where: { activityId },
        create: {
          activityId,
          userId,
          type: activityType || "Ride",
          sec5,
          sec30,
          min1,
          min2,
          min5,
          min10,
          min20,
          min60,
        },
        update: {
          sec5,
          sec30,
          min1,
          min2,
          min5,
          min10,
          min20,
          min60,
        },
      });

      console.log(`Calculated power curve`);
    }
  } catch (error) {
    console.error("Error calculating power curve:", error.message);
  }
}

async function calculatePaceDistances(
  activityId,
  userId,
  accessToken,
  stravaActivityId,
) {
  try {
    const streams = await stravaService.getActivityStreams(
      accessToken,
      stravaActivityId,
      ["distance", "time"],
    );
    console.log("STREAMS KEYS:", streams ? Object.keys(streams) : "NO STREAMS");

    if (streams?.distance?.data && streams?.time?.data) {
      const distances = streams.distance.data; 
      const times = streams.time.data;      


      const targetDistances = {
        1000: "km1",
        5000: "km5",
        10000: "km10",
        21097.5: "km21",
        42195: "km42",
      };

      const paceData = {};

      for (const [targetDist, fieldName] of Object.entries(targetDistances)) {
        const targetMeters = parseFloat(targetDist);
        const maxDist = distances[distances.length - 1];

        if (targetMeters <= maxDist) {
          let bestPace = Infinity;

          for (let i = 0; i < distances.length; i++) {
            for (let j = i + 1; j < distances.length; j++) {
              const dist = distances[j] - distances[i];
              const time = times[j] - times[i];

              if (
                Math.abs(dist - targetMeters) / targetMeters < 0.02 &&
                time > 0
              ) {
                const pace = time / 60 / (dist / 1000); 

                if (pace < bestPace && pace > 0 && pace < 20) {
                  bestPace = pace;
                }
              }
            }
          }

          if (bestPace < Infinity) {
            paceData[fieldName] = Math.round(bestPace * 100) / 100;
          }
        }
      }


      const maxDist = distances[distances.length - 1];
      const kmCount = Math.floor(maxDist / 1000);
      const perKm = [];

      let lastIndex = 0;
      let lastDist = distances[0] || 0;
      let lastTime = times[0] || 0;

      for (let km = 1; km <= kmCount; km++) {
        const targetMeters = km * 1000;

        let j = lastIndex;
        while (j < distances.length && distances[j] < targetMeters) {
          j++;
        }
        if (j >= distances.length) break;

        const distSegment = distances[j] - lastDist;
        const timeSegment = times[j] - lastTime;

        if (distSegment > 0 && timeSegment > 0) {
          const pace = (timeSegment / 60) / (distSegment / 1000); 
          if (pace > 0 && pace < 20) {
            perKm.push(Math.round(pace * 100) / 100);
          }
        }

        lastIndex = j;
        lastDist = distances[j];
        lastTime = times[j];
      }

      if (Object.keys(paceData).length > 0) {
        await prisma.paceDistance.upsert({
          where: { activityId },
          create: {
            activityId,
            userId,
            ...paceData,
          },
          update: {
            ...paceData,
          },
        });
        console.log(`Calculated pace distances:`, paceData);
      }

      if (perKm.length > 0) {
        await prisma.activity.update({
          where: { id: activityId },
          data: { pacePerKm: perKm },
        });
        console.log(`Saved pacePerKm array (${perKm.length} km)`);
      }
    } else {

      console.log(
        `No streams available, using activity average pace as fallback`,
      );

      const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        select: { distance: true, duration: true },
      });

      if (activity && activity.distance > 0 && activity.duration > 0) {
        const avgPace =
          activity.duration / 60 / (activity.distance / 1000);
        const paceData = {};

        const targetDistances = {
          1000: "km1",
          5000: "km5",
          10000: "km10",
          21097.5: "km21",
          42195: "km42",
        };

        for (const [targetDist, fieldName] of Object.entries(targetDistances)) {
          if (parseFloat(targetDist) <= activity.distance) {
            paceData[fieldName] = Math.round(avgPace * 100) / 100;
          }
        }


        if (Object.keys(paceData).length > 0) {
          await prisma.paceDistance.upsert({
            where: { activityId },
            create: {
              activityId,
              userId,
              ...paceData,
            },
            update: {
              ...paceData,
            },
          });
          console.log(
            `Saved fallback pace data (avg: ${avgPace.toFixed(2)} min/km):`,
            paceData,
          );
        }

        const kmCount = Math.floor(activity.distance / 1000);
        if (kmCount > 0) {
          const perKm = Array(kmCount).fill(
            Math.round(avgPace * 100) / 100,
          );
          await prisma.activity.update({
            where: { id: activityId },
            data: { pacePerKm: perKm },
          });
          console.log(
            `Saved fallback pacePerKm array (${kmCount} km, avg ${avgPace.toFixed(
              2,
            )} min/km)`,
          );
        }
      }
    }
  } catch (error) {
    console.error("Error calculating pace distances:", error.message);
  }
}


async function calculateFitnessMetrics(userId) {
  try {
    const activities = await prisma.activity.findMany({
      where: { userId },
      orderBy: { startDate: "asc" },
      select: {
        startDate: true,
        trainingLoad: true,
      },
    });

    if (activities.length === 0) return;

    let ctl = 0;
    let atl = 0;
    const ctlDecay = 0.07;
    const atlDecay = 0.23;

    const metrics = [];

    for (const activity of activities) {
      const load = activity.trainingLoad || 0;

      ctl = ctl * (1 - ctlDecay) + load * ctlDecay;
      atl = atl * (1 - atlDecay) + load * atlDecay;
      const tsb = ctl - atl;

      metrics.push({
        userId,
        date: activity.startDate,
        ctl: Math.round(ctl * 10) / 10,
        atl: Math.round(atl * 10) / 10,
        tsb: Math.round(tsb * 10) / 10,
      });
    }

    await prisma.fitnessMetrics.deleteMany({
      where: { userId },
    });

    const batchSize = 100;
    for (let i = 0; i < metrics.length; i += batchSize) {
      const batch = metrics.slice(i, i + batchSize);
      await prisma.fitnessMetrics.createMany({ data: batch });
    }

    console.log(`Calculated ${metrics.length} fitness metrics`);
  } catch (error) {
    console.error("Error calculating fitness metrics:", error.message);
  }
}

export const fetchActivityDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const accessToken = await getStravaToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error: "Not authenticated with Strava",
      });
    }

    const activity = await prisma.activity.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!activity) {
      return res.status(404).json({ error: "Activity not found" });
    }

    if (!activity.externalId) {
      return res.status(400).json({ error: "Activity has no external ID" });
    }

    console.log(`Fetching detailed data for activity ${activity.externalId}...`);

    const detailedActivity = await stravaService.getActivity(
      accessToken,
      activity.externalId
    );

    const updated = await prisma.activity.update({
      where: { id },
      data: {
        bestEfforts: detailedActivity.best_efforts || null,
        laps: detailedActivity.laps || null,
      },
    });

    if (detailedActivity.map?.summary_polyline) {
      await saveGpsPoints(
        activity.id,
        detailedActivity.map.summary_polyline
      );
    }

    const rawType = activity.type?.toLowerCase() || "";
    const isRunning =
      rawType.includes("run") ||
      rawType.includes("jog") ||
      rawType.includes("workout");

    if (isRunning && activity.distance > 300) {
      await calculatePaceDistances(activity.id, userId, accessToken, activity.externalId);
    }

    if (activity.averagePower && activity.averagePower > 0) {
      await calculatePowerCurve(
        activity.id,
        userId,
        activity.type,
        accessToken,
        activity.externalId,
      );
    }

    console.log(`Activity ${activity.id} details fetched successfully`);

    res.json({
      message: "Activity details fetched successfully",
      activity: updated,
    });
  } catch (error) {
    console.error("Fetch activity details error:", error);
    res.status(500).json({ error: "Failed to fetch activity details" });
  }
};

export const batchFetchActivityDetails = async (req, res) => {
  try {
    const userId = getUserId(req);
    const accessToken = await getStravaToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error: "Not authenticated with Strava",
        requiresStravaLink: true,
      });
    }

    const limitRaw = req.body?.limit ?? req.query?.limit;
    const limit = Math.max(1, Math.min(parseInt(limitRaw || 50), 200));

    // fetch last N activities for user (most recent)
    const activities = await prisma.activity.findMany({
      where: { userId, source: "STRAVA" },
      orderBy: { startDate: "desc" },
      take: limit,
      select: {
        id: true,
        externalId: true,
        name: true,
        type: true,
        distance: true,
        duration: true,
        averagePower: true,
      },
    });

    let processed = 0;
    let updated = 0;
    let errors = 0;
    let rateLimited = false;

    for (const a of activities) {
      processed++;
      try {
        // small delay to reduce rate-limit risk
        await new Promise((r) => setTimeout(r, 250));

        const detailedActivity = await stravaService.getActivity(accessToken, a.externalId);

        await prisma.activity.update({
          where: { id: a.id },
          data: {
            bestEfforts: detailedActivity.best_efforts || null,
            laps: detailedActivity.laps || null,
          },
        });

        const rawType = a.type?.toLowerCase() || "";
        const isRunning =
          rawType.includes("run") || rawType.includes("jog") || rawType.includes("workout");

        // paceDistance + pacePerKm (requires streams)
        if (isRunning && a.distance > 300) {
          await calculatePaceDistances(a.id, userId, accessToken, a.externalId);
        }

        // power curve (requires watts stream)
        if (a.averagePower && a.averagePower > 0) {
          await calculatePowerCurve(a.id, userId, a.type, accessToken, a.externalId);
        }

        updated++;
      } catch (e) {
        errors++;
        if (e?.response?.status === 429) {
          rateLimited = true;
          break;
        }
      }
    }

    res.json({
      message: "Batch activity details fetch completed",
      requested: limit,
      processed,
      updated,
      errors,
      rateLimited,
      note:
        "Uzupełnianie rekordów pobiera szczegóły i streamy z Stravy — może trafić w limit API. Wtedy spróbuj ponownie później.",
    });
  } catch (error) {
    console.error("Batch fetch activity details error:", error);
    res.status(500).json({ error: "Failed to batch fetch activity details" });
  }
};

export const batchFetchActivityDetailsForRange = async (req, res) => {
  try {
    const userId = getUserId(req);
    const accessToken = await getStravaToken(req);

    if (!accessToken) {
      return res.status(401).json({
        error: "Not authenticated with Strava",
        requiresStravaLink: true,
      });
    }

    const startDateRaw = req.body?.startDate ?? req.query?.startDate;
    const endDateRaw = req.body?.endDate ?? req.query?.endDate;
    const type = req.body?.type ?? req.query?.type;

    const startDate = startDateRaw ? new Date(startDateRaw) : null;
    const endDate = endDateRaw ? new Date(endDateRaw) : null;

    if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const limitRaw = req.body?.limit ?? req.query?.limit;
    const limit = Math.max(1, Math.min(parseInt(limitRaw || 200), 300));

    const where = {
      userId,
      source: "STRAVA",
      startDate: { gte: startDate, lte: endDate },
    };
    if (type && type !== "all") where.type = type;

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { startDate: "desc" },
      take: limit,
      select: {
        id: true,
        externalId: true,
        name: true,
        type: true,
        distance: true,
        averagePower: true,
      },
    });

    let processed = 0;
    let updated = 0;
    let errors = 0;
    let rateLimited = false;

    for (const a of activities) {
      processed++;
      try {
        await new Promise((r) => setTimeout(r, 250));

        const detailedActivity = await stravaService.getActivity(accessToken, a.externalId);

        await prisma.activity.update({
          where: { id: a.id },
          data: {
            bestEfforts: detailedActivity.best_efforts || null,
            laps: detailedActivity.laps || null,
          },
        });

        const rawType = a.type?.toLowerCase() || "";
        const isRunning =
          rawType.includes("run") || rawType.includes("jog") || rawType.includes("workout");

        if (isRunning && a.distance > 300) {
          await calculatePaceDistances(a.id, userId, accessToken, a.externalId);
        }

        if (a.averagePower && a.averagePower > 0) {
          await calculatePowerCurve(a.id, userId, a.type, accessToken, a.externalId);
        }

        updated++;
      } catch (e) {
        errors++;
        if (e?.response?.status === 429) {
          rateLimited = true;
          break;
        }
      }
    }

    res.json({
      message: "Batch activity details fetch (range) completed",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      type: type || "all",
      requested: limit,
      found: activities.length,
      processed,
      updated,
      errors,
      rateLimited,
      note:
        "Pobieramy szczegóły i streamy z Stravy — możesz trafić w limit API. Wtedy spróbuj ponownie później.",
    });
  } catch (error) {
    console.error("Batch fetch activity details for range error:", error);
    res.status(500).json({ error: "Failed to batch fetch activity details for range" });
  }
};
