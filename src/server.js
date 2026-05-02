/**
 * Backend server entry point
 */

import app from "./app.js";
import toolsRoutes from "./routes/tools.routes.js";
import convertRoutes from "./routes/convert.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import downloadRoutes from "./routes/download.routes.js";
import healthRoutes from "./routes/health.routes.js";
import errorMiddleware from "./middleware/error.middleware.js";
import cleanupService from "./services/cleanup.service.js";

const PORT = process.env.API_PORT || 5000;

// Routes
app.use("/api/tools", toolsRoutes);
app.use("/api/convert", convertRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/download", downloadRoutes);
app.use("/api/health", healthRoutes);

// Error handling middleware
app.use(errorMiddleware);

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "DocFlow Pro API",
    version: "1.0.0",
    status: "ok"
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`DocFlow Pro API running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  // Start periodic cleanup (run every 15 minutes)
  const cleanupIntervalMs = (process.env.CLEANUP_INTERVAL_MINUTES ? parseInt(process.env.CLEANUP_INTERVAL_MINUTES, 10) : 15) * 60 * 1000;
  setInterval(() => {
    cleanupService.cleanupExpiredJobs().catch((err) => console.error("Periodic cleanup error:", err));
  }, cleanupIntervalMs);
});

export default app;
