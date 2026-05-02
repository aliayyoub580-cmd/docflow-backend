/**
 * Tools routes - GET all available tools
 */

import express from "express";
import { TOOLS } from "../config/tools.config.js";

const router = express.Router();

/**
 * GET /api/tools
 * Get all available tools
 */
router.get("/", (req, res) => {
  res.json({
    tools: TOOLS,
    count: TOOLS.length
  });
});

/**
 * GET /api/tools/:id
 * Get specific tool by ID
 */
router.get("/:id", (req, res) => {
  const tool = TOOLS.find((t) => t.id === req.params.id);

  if (!tool) {
    return res.status(404).json({
      error: "Tool not found"
    });
  }

  res.json(tool);
});

export default router;
