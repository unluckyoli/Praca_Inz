import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import activitiesRoutes from "./routes/activities.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import dataRoutes from "./routes/data.routes.js";
import trainingPlanRoutes from "./routes/trainingPlan.routes.js";
import goalsRoutes from "./routes/goals.routes.js";

BigInt.prototype.toJSON = function () {
  return Number(this);
};

const app = express();
const PORT = process.env.PORT;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/training-plan", trainingPlanRoutes);

app.use("/api/goals", goalsRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
