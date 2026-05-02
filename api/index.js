/**
 * Vercel serverless function entry point
 * Simplified backend API for Vercel deployment
 */

import express from "express";
import cors from "cors";

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));

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
