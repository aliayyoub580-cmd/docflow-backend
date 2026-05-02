/**
 * Download controller - Handle file downloads
 */

import * as supabaseService from "../config/supabase.js";
import * as storageService from "../services/storage.service.js";

/**
 * Download converted file
 */
export const downloadFile = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    // Get job record
    const job = await supabaseService.getJobRecord(jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found"
      });
    }

    // Check status
    if (job.status !== "completed") {
      return res.status(400).json({
        error: "File is not ready for download"
      });
    }

    // Check expiry
    if (new Date(job.expires_at) < new Date()) {
      return res.status(410).json({
        error: "File has expired"
      });
    }

    // Get file
    const outputPath = job.stored_output_path;
    if (!storageService.fileExists(outputPath)) {
      return res.status(404).json({
        error: "File not found on server"
      });
    }

    // Send file
    res.download(outputPath, job.original_file_name.replace(/\.[^.]*$/, job.output_format));
  } catch (error) {
    console.error("Download error:", error);
    next(error);
  }
};

export default {
  downloadFile
};
