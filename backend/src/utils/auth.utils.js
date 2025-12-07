export const getUserId = (req) => {
  if (req.user && req.user.userId) {
    return req.user.userId;
  }

  if (req.user && req.user.id) {
    return req.user.id;
  }

  if (req.session && req.session.userId) {
    return req.session.userId;
  }

  return null;
};

export const getStravaToken = async (req) => {
  if (req.session && req.session.accessToken) {
    return req.session.accessToken;
  }

  const userId = getUserId(req);
  if (userId) {
    const { default: prisma } = await import("../config/database.js");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stravaAccessToken: true,
        stravaTokenExpiresAt: true,
        stravaRefreshToken: true,
      },
    });

    if (user && user.stravaAccessToken) {
      const now = new Date();
      const expiresAt = user.stravaTokenExpiresAt;
      const bufferTime = 5 * 60 * 1000; 

      if (expiresAt && now.getTime() > (expiresAt.getTime() - bufferTime)) {
        if (user.stravaRefreshToken) {
          try {
            const { stravaService } = await import("../services/strava.service.js");
            const refreshData = await stravaService.refreshToken(user.stravaRefreshToken);
            
            await prisma.user.update({
              where: { id: userId },
              data: {
                stravaAccessToken: refreshData.access_token,
                stravaRefreshToken: refreshData.refresh_token,
                stravaTokenExpiresAt: new Date(refreshData.expires_at * 1000),
              },
            });

            return refreshData.access_token;
          } catch (error) {
            console.error("Failed to refresh Strava token:", error);
            await prisma.user.update({
              where: { id: userId },
              data: {
                stravaAccessToken: null,
                stravaRefreshToken: null,
                stravaTokenExpiresAt: null,
              },
            });
            return null;
          }
        } else {
          return null;
        }
      }

      return user.stravaAccessToken;
    }
  }

  return null;
};

export default { getUserId, getStravaToken };
