/**
 * Jobs routes - Get job status
 */

import express from "express";
import * as jobsController from "../controllers/jobs.controller.js";

const router = express.Router();

/**
 * GET /api/jobs/:jobId
 * Get job status
 */
router.get("/:jobId", jobsController.getJobStatus);

export default router;
