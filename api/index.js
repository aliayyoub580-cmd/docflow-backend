/**
 * Vercel serverless function entry point
 * Simplified backend API for Vercel deployment
 */

import express from "express";
import cors from "cors";

const app = express();

const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || "").split(",")
]
  .map((origin) => (origin || "").trim())
  .filter(Boolean);

const corsOptionsDelegate = (req, callback) => {
  const requestOrigin = req.header("Origin");

  if (configuredOrigins.length === 0) {
    // Keep backend reachable if env vars are missing (safe default for non-credentialed requests).
    callback(null, { origin: true, credentials: false });
    return;
  }

  const isAllowed = Boolean(requestOrigin) && configuredOrigins.includes(requestOrigin);

  callback(null, {
    origin: isAllowed,
    credentials: isAllowed,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
};

// Middleware
app.use(cors(corsOptionsDelegate));
app.options("*", cors(corsOptionsDelegate));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "DocFlow Pro API",
    version: "1.0.0",
    status: "ok",
    environment: process.env.NODE_ENV || "development"
  });
});

// Health endpoint
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong"
  });
});

// Export app for Vercel
export default app;
