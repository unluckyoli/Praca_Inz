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
    let bestEffortsUpdated = 0;

    if (source === "STRAVA") {
      console.log(`Starting incremental sync for user ${userId}...`);

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

      const afterTimestamp = lastActivity 
        ? Math.floor(lastActivity.startDate.getTime() / 1000)
        : undefined;

      if (afterTimestamp) {
        console.log(`Fetching activities after ${lastActivity.startDate.toISOString()}...`);
      } else {
        console.log(`No previous activities found - this shouldn't happen. Activities should be synced during Strava connection.`);
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

      console.log(`Fetched ${allStravaActivities.length} new activities from Strava`);

      for (const activity of allStravaActivities) {
        const existing = await prisma.activity.findFirst({
        where: {
          userId,
            externalId: activity.id.toString(),
            source: "STRAVA",
        },
        include: {
          paceDistance: true,
        },
      });


        if (!existing) {
          console.log(`Fetching details for activity ${activity.id}...`);
          
          try {
            await new Promise(resolve => setTimeout(resolve, 250));
            
            const detailedActivity = await stravaService.getActivity(
              accessToken,
              activity.id,
            );

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
              bestEfforts: detailedActivity.best_efforts || null,
              laps: detailedActivity.laps || null,
            },
          });

          if (detailedActivity.map?.summary_polyline) {
            await saveGpsPoints(
              created.id,
              detailedActivity.map.summary_polyline,
            );
          }

          if (activity.average_watts && activity.average_watts > 0) {
            await calculatePowerCurve(created.id, accessToken, activity.id);
          }



          const rawType = activity.type?.toLowerCase() || "";

          console.log("TYPE RAW:", rawType, "DIST:", activity.distance); 

          const isDistanceBased =
            rawType.includes("run") ||       
            rawType.includes("jog") ||
            rawType.includes("ride") ||       
            rawType.includes("hike") ||       
            rawType.includes("walk") ||       
            rawType.includes("virtualrun") ||       
            rawType.includes("virtualride") ||       
            rawType.includes("workout");     

          if (isDistanceBased && activity.distance > 300) {  
            await calculatePaceDistances(created.id, userId, accessToken, activity.id);
          }


          newActivities.push(created);
          console.log(`Saved activity: ${activity.name}`);
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
        } else {
          updatedActivities++;


          if (!existing.pacePerKm) {
           try {
             await calculatePaceDistances(existing.id, userId, accessToken, activity.id);
             console.log(`Recalculated pace data for existing activity ${existing.name}`);
           } catch (err) {
             console.error("Error recalculating pace for existing activity:", err.message);
           }
         }

        }
      }

      await updateUserStats(userId);
      await calculateFitnessMetrics(userId);

      console.log(
        `Sync complete: ${newActivities.length} new, ${updatedActivities} existing`,
      );
      
      // Sync best efforts and laps for recent activities without them
      console.log('Checking for activities without best efforts or laps...');
      const activitiesNeedingSync = await prisma.activity.findMany({
        where: {
          userId,
          source: "STRAVA",
          OR: [
            { bestEfforts: { equals: Prisma.JsonNull } },
            { laps: { equals: Prisma.JsonNull } },
          ],
        },
        orderBy: { startDate: "desc" },
        take: 50,
      });
      
      if (activitiesNeedingSync.length > 0) {
        console.log(`Found ${activitiesNeedingSync.length} activities needing sync. Updating...`);
        
        for (const activity of activitiesNeedingSync) {
          try {
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const detailedActivity = await stravaService.getActivity(
              accessToken,
              activity.externalId,
            );

            const updateData = {};
            if (detailedActivity.best_efforts && detailedActivity.best_efforts.length > 0) {
              updateData.bestEfforts = detailedActivity.best_efforts;
              bestEffortsUpdated++;
            }
            if (detailedActivity.laps && detailedActivity.laps.length > 0) {
              updateData.laps = detailedActivity.laps;
            }
            
            if (Object.keys(updateData).length > 0) {
              await prisma.activity.update({
                where: { id: activity.id },
                data: updateData,
              });
            }
          } catch (error) {
            if (error.response?.status === 429) {
              console.log(`⚠️  Rate limit hit during best efforts sync.`);
              break;
            }
            console.error(`Error syncing best efforts for ${activity.name}:`, error.message);
          }
        }
        
        console.log(`Best efforts updated for ${bestEffortsUpdated} activities`);
      }
    }

    res.json({
      message: "Activities synced successfully",
      newActivitiesCount: newActivities.length,
      existingActivitiesCount: updatedActivities,
      bestEffortsUpdated: bestEffortsUpdated,
      activities: newActivities,
    });
  } catch (error) {
    console.error("=== SYNC ACTIVITIES ERROR ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    
    // Obsługa Rate Limit Exceeded z Strava API
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

async function calculatePowerCurve(activityId, accessToken, stravaActivityId) {
  try {
    const streams = await stravaService.getActivityStreams(
      accessToken,
      stravaActivityId,
      ["watts"],
    );

    if (streams?.watts?.data && streams.watts.data.length > 0) {
      const powerData = streams.watts.data;
      const durations = [5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600];

      for (const duration of durations) {
        if (duration <= powerData.length) {
          let maxAvgPower = 0;

          for (let i = 0; i <= powerData.length - duration; i++) {
            const slice = powerData.slice(i, i + duration);
            const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
            maxAvgPower = Math.max(maxAvgPower, avg);
          }

          await prisma.powerCurve.create({
            data: {
              activityId,
              duration,
              power: Math.round(maxAvgPower),
            },
          });
        }
      }

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
                const pace = (time / 60) / (dist / 1000); // min/km

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
        await prisma.paceDistance.create({
          data: {
            activityId,
            userId,
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
          await prisma.paceDistance.create({
            data: {
              activityId,
              userId,
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
