/**
 * Health check routes
 */

import express from "express";
import * as healthController from "../controllers/health.controller.js";

const router = express.Router();

/**
 * GET /api/health
 * Health check
 */
router.get("/", healthController.healthCheck);

export default router;
