/**
 * Jobs controller - Get job status
 */

import * as queueService from "../services/queue.service.js";
import * as supabaseService from "../config/supabase.js";

/**
 * Get job status
 */
export const getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    // Get job from database
    const dbRecord = await supabaseService.getJobRecord(jobId);

    if (!dbRecord) {
      return res.status(404).json({
        error: "Job not found"
      });
    }

    // Get progress from DB record first (local store or Supabase tracking)
    let progress = dbRecord.progress || 0;
    
    // If not in DB, try to get from queue
    if (!progress || progress === 0) {
      const queueStatus = await queueService.getJobStatus(jobId);
      progress = queueStatus?.progress || progress;
    }

    // If completed, force progress to 100
    if (dbRecord.status === "completed") {
      progress = 100;
    }

    // Build response
    const response = {
      jobId,
      status: dbRecord.status,
      progress,
      createdAt: dbRecord.created_at,
      startedAt: dbRecord.started_at,
      completedAt: dbRecord.completed_at
    };

    // If completed, provide download URL
    if (dbRecord.status === "completed") {
      response.downloadUrl = `/api/download/${jobId}`;
    }

    // If failed, provide error message
    if (dbRecord.status === "failed") {
      response.message = dbRecord.error_message || "Conversion failed";
    }

    res.json(response);
  } catch (error) {
    console.error("Jobs controller error:", error);
    next(error);
  }
};

export default {
  getJobStatus
};
