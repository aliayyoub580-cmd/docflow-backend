/**
 * Conversion routes - Handle file upload and job creation
 */

import express from "express";
import upload from "../middleware/upload.middleware.js";
import { rateLimitMiddleware } from "../middleware/rateLimit.middleware.js";
import * as convertController from "../controllers/convert.controller.js";

const router = express.Router();

/**
 * POST /api/convert
 * Upload file and create conversion job
 */
router.post(
  "/",
  rateLimitMiddleware,
  upload.single("file"),
  convertController.createConversionJob
);

export default router;
