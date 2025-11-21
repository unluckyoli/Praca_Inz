import passport from "../config/passport.js";
import bcrypt from "bcryptjs";
import prisma from "../config/database.js";
import { stravaService } from "../services/strava.service.js";
import { jwtService } from "../services/jwt.service.js";
import { emailService } from "../services/email.service.js";


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
        isEmailVerified: false,
        userStats: { create: {} }
      },
    });


    try {
      await emailService.sendWelcomeEmail(email, firstName);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

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

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.json({
        message: "If the email exists, a password reset link has been sent",
      });
    }

    const resetToken = jwtService.generatePasswordResetToken();
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); 

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    try {
      await emailService.sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
    }

    res.json({
      message: "If the email exists, a password reset link has been sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process password reset request" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ error: "Token and new password are required" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters long" });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    await jwtService.revokeAllUserTokens(user.id);

    res.json({
      message:
        "Password reset successful. Please log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Password reset failed" });
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

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        hasStravaData: !!user.stravaId,
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

  let userId = null;

  if (mode === "connect" && req.user?.userId) {
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


    // 1)pinned to account

    if (mode === "connect") {
      const userId = stateData.userId;

      if (!userId) {
        return res.redirect(
          `${process.env.CLIENT_URL}/account?error=not_logged_in`
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

      return res.redirect(`${process.env.CLIENT_URL}/account?strava=linked`);
    }


    // 2)logging through strava

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





    // tokens
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
