/**
 * Vercel serverless function entry point
 * This exports the Express app for Vercel to run as a function
 */

import app from "../src/app.js";
import toolsRoutes from "../src/routes/tools.routes.js";
import convertRoutes from "../src/routes/convert.routes.js";
import jobsRoutes from "../src/routes/jobs.routes.js";
import downloadRoutes from "../src/routes/download.routes.js";
import healthRoutes from "../src/routes/health.routes.js";
import errorMiddleware from "../src/middleware/error.middleware.js";

// Routes
app.use("/api/tools", toolsRoutes);
app.use("/api/convert", convertRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/download", downloadRoutes);
app.use("/api/health", healthRoutes);

// Error handling middleware
app.use(errorMiddleware);

// Root endpoint
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

// Export app for Vercel - NO app.listen() for serverless
export default app;
