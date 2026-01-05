import express from "express";
import {
  register,
  login,
  logout,
  refresh,
  getCurrentUser,
  updateProfile,
  stravaAuth,
  stravaCallback,
  unlinkStrava,
  requestPasswordReset,
  resetPassword,
  googleAuth,
  googleCallback,
  unlinkGoogle,
} from "../controllers/auth.controller.js";
import {
  authenticateJWT,
  optionalAuthenticateJWT,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.get("/me", authenticateJWT, getCurrentUser);
router.patch("/me", authenticateJWT, updateProfile);

router.get("/strava", optionalAuthenticateJWT, stravaAuth);
router.get("/strava/callback", optionalAuthenticateJWT, stravaCallback);
router.post("/strava/unlink", authenticateJWT, unlinkStrava);

router.get("/google", authenticateJWT, googleAuth);
router.get("/google/callback", optionalAuthenticateJWT, googleCallback);
router.post("/google/unlink", authenticateJWT, unlinkGoogle);

router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);


export default router;
