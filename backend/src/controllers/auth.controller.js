import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { stravaService } from "../services/strava.service.js";
import { jwtService } from "../services/jwt.service.js";


export const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters long" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        userStats: { create: {} }
      },
    });

    res.status(201).json({
      message: "Registration successful. You can now log in.",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userStats: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const accessToken = jwtService.generateAccessToken(user.id);
    const refreshToken = await jwtService.generateRefreshToken(user.id);

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hasStravaData: !!user.stravaId,
        hasGarminData: !!user.garminId,
        stats: user.userStats,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};


export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const decoded = await jwtService.verifyRefreshToken(refreshToken);

    const newAccessToken = jwtService.generateAccessToken(decoded.userId);

    res.json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
};


export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await jwtService.revokeRefreshToken(refreshToken);
    }

    if (req.session) {
      req.session.destroy();
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};





export const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        userStats: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isStravaEmail = user.email && user.email.includes('@strava.local');
    const displayEmail = isStravaEmail ? null : user.email;

    let isStravaConnected = false;
    if (user.stravaId && user.stravaAccessToken) {
      const now = new Date();
      const expiresAt = user.stravaTokenExpiresAt;
      
      isStravaConnected = !expiresAt || now < expiresAt;
    }

    res.json({
      user: {
        id: user.id,
        email: displayEmail,
        isStravaEmail: isStravaEmail,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        hasStravaData: isStravaConnected,
        hasGarminData: !!user.garminId,
        stats: user.userStats,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user data" });
  }
};


export const stravaAuth = (req, res) => {
  const mode = req.query.mode === "connect" ? "connect" : "login";
  const tokenFromQuery = req.query.token;

  let userId = null;

  if (tokenFromQuery) {
    try {
      const decoded = jwtService.verifyAccessToken(tokenFromQuery);
      userId = decoded.userId;
    } catch (error) {
      console.error("Invalid token in query:", error);
    }
  }

  if (!userId && mode === "connect" && req.user?.userId) {
    userId = req.user.userId;
  }

  const stateData = JSON.stringify({ mode, userId });

  const url =
    "https://www.strava.com/oauth/authorize?" +
    new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID,
      response_type: "code",
      redirect_uri: process.env.STRAVA_CALLBACK_URL,
      scope: "activity:read_all,profile:read_all", 
      state: stateData,
    });

  return res.redirect(url);
};


export const stravaCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    const { access_token, refresh_token, expires_at } =
      await stravaService.exchangeToken(code);

    const athlete = await stravaService.getAthleteProfile(access_token);

    const stateData = JSON.parse(state);
    const mode = stateData.mode || "login";


    const stravaId = athlete.id.toString();
    const emailSafe = athlete.email || `strava_${stravaId}@strava.local`;



    if (mode === "connect") {
      const userId = stateData.userId;

      if (!userId) {
        return res.redirect(
          `${process.env.CLIENT_URL}/account?error=not_logged_in`
        );
      }

      const existingStravaUser = await prisma.user.findUnique({
        where: { stravaId },
      });

      if (existingStravaUser && existingStravaUser.id !== userId) {
        return res.redirect(
          `${process.env.CLIENT_URL}/account?error=strava_already_linked`
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          stravaId,
          stravaAccessToken: access_token,
          stravaRefreshToken: refresh_token,
          stravaTokenExpiresAt: new Date(expires_at * 1000),
        },
      });

      try {
        console.log(`Starting automatic sync for user ${userId} after Strava connection...`);
        await syncStravaActivities(userId, access_token);
        console.log(`Automatic sync completed for user ${userId}`);
      } catch (syncError) {
        console.error('Auto-sync error:', syncError);
      }

      return res.redirect(`${process.env.CLIENT_URL}/account?strava=linked`);
    }



    let user = await prisma.user.findUnique({
      where: { stravaId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: emailSafe,
          password: "STRAVA_OAUTH",
          stravaId,
          firstName: athlete.firstname || null,
          lastName: athlete.lastname || null,
          isEmailVerified: true,
          stravaAccessToken: access_token,
          stravaRefreshToken: refresh_token,
          stravaTokenExpiresAt: new Date(expires_at * 1000),
          userStats: { create: {} },
        },
      });
      
      try {
        console.log(`Starting automatic sync for new user ${user.id}...`);
        await syncStravaActivities(user.id, access_token);
        console.log(`Automatic sync completed for new user ${user.id}`);
      } catch (syncError) {
        console.error('Auto-sync error for new user:', syncError);
      }
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: user.firstName || athlete.firstname || null,
          lastName: user.lastName || athlete.lastname || null,
          stravaAccessToken: access_token,
          stravaRefreshToken: refresh_token,
          stravaTokenExpiresAt: new Date(expires_at * 1000),
        },
      });
    }



    req.session = null;

    const jwtAccess = jwtService.generateAccessToken(user.id);
    const jwtRefresh = await jwtService.generateRefreshToken(user.id);

    return res.redirect(
      `${process.env.CLIENT_URL}/dashboard?auth=success&access=${jwtAccess}&refresh=${jwtRefresh}`
    );

  } catch (err) {
    console.error("Strava callback error:", err);
    return res.redirect(`${process.env.CLIENT_URL}/account?error=strava_failed`);
  }
};




export const unlinkStrava = async (req, res) => {
  try {
    const userId = req.user.userId;

    await prisma.user.update({
      where: { id: userId },
      data: {
        stravaId: null,
        stravaAccessToken: null,
        stravaRefreshToken: null,
        stravaTokenExpiresAt: null,
      },
    });

    res.json({
      message: "Strava account unlinked successfully",
      success: true,
    });
  } catch (error) {
    console.error("Unlink Strava error:", error);
    res.status(500).json({ error: "Failed to unlink Strava account" });
  }
};

async function syncStravaActivities(userId, accessToken) {
  try {
    console.log(`Fetching activities from Strava for user ${userId}...`);
    
    let allStravaActivities = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`Fetching page ${page}...`);
      const pageActivities = await stravaService.getActivities(accessToken, page, 200);
      
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
    
    console.log(`Fetched ${allStravaActivities.length} total activities from Strava`);

    let newCount = 0;
    let existingCount = 0;

    for (const activity of allStravaActivities) {
      const existing = await prisma.activity.findUnique({
        where: {
          externalId_source: {
            externalId: activity.id.toString(),
            source: "STRAVA",
          },
        },
      });

      if (!existing) {
        await prisma.activity.create({
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
        newCount++;
        
        if (newCount % 50 === 0) {
          console.log(`Saved ${newCount} activities...`);
        }
      } else {
        existingCount++;
      }
    }

    console.log(`Initial sync completed: ${newCount} new, ${existingCount} existing activities`);

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
      lastSyncDate: new Date(),
    };

    await prisma.userStats.upsert({
      where: { userId },
      update: stats,
      create: {
        userId,
        ...stats,
      },
    });

    console.log(`Sync completed: ${newCount} new, ${existingCount} existing activities`);
    console.log(`Total: ${stats.totalActivities} activities, ${(stats.totalDistance / 1000).toFixed(1)} km`);
  } catch (error) {
    console.error('Error in syncStravaActivities:', error);
    throw error;
  }
}
