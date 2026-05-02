/**
 * Health controller - System health checks
 */

import * as queueService from "../services/queue.service.js";

/**
 * Health check endpoint
 */
export const healthCheck = async (req, res, next) => {
  try {
    const queueStats = await queueService.getQueueStats();

    res.json({
      status: "ok",
      api: "healthy",
      queue: {
        active: queueStats.active || 0,
        waiting: queueStats.waiting || 0,
        failed: queueStats.failed || 0,
        completed: queueStats.completed || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
};

export default {
  healthCheck
};
