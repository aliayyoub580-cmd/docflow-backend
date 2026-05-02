/**
 * Convert controller - handle file upload and create conversion job.
 */

import fs from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";

import * as queueService from "../services/queue.service.js";
import * as supabaseService from "../config/supabase.js";
import * as validationService from "../services/validation.service.js";

export const createConversionJob = async (req, res, next) => {
  try {
    const tool = req.body?.tool;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!tool || !validationService.isValidTool(tool)) {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(400).json({ error: "Invalid conversion tool" });
    }

    const errors = validationService.validateFile(file, tool);
    if (errors?.length > 0) {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(400).json({ error: errors.join("; ") });
    }

    const jobId = uuidv4();
    const toolConfig = validationService.getToolConfig(tool);
    const inputFormat = path.extname(file.originalname).toLowerCase();
    const outputFormat = toolConfig?.outputFormat || ".out";

    await supabaseService.createJobRecord({
      jobId,
      tool,
      inputFormat,
      outputFormat,
      originalFileName: file.originalname,
      inputPath: file.path,
      fileSize: file.size
    });

    await queueService.addConversionJob({
      jobId,
      tool,
      inputPath: file.path,
      outputFormat,
      originalFileName: file.originalname
    });

    await supabaseService.logUsage(req.ip || req.connection.remoteAddress, tool, file.size, "queued");

    return res.status(201).json({
      jobId,
      status: "queued",
      message: "Your file is queued for conversion"
    });
  } catch (error) {
    console.error("Convert error:", error);
    next(error);
  }
};

export default {
  createConversionJob
};