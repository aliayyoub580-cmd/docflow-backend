/**
 * Download routes - Handle file download
 */

import express from "express";
import * as downloadController from "../controllers/download.controller.js";

const router = express.Router();

/**
 * GET /api/download/:jobId
 * Download converted file
 */
router.get("/:jobId", downloadController.downloadFile);

export default router;
