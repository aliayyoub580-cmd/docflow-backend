/**
 * Vercel serverless function entry point
 * Conversion API for the frontend app.
 */

import express from "express";
import multer from "multer";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";

import * as supabaseService from "../src/config/supabase.js";
import * as queueService from "../src/services/queue.service.js";
import * as validationService from "../src/services/validation.service.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    console.log("[DEBUG] Multer received file:", { originalname: file.originalname, mimetype: file.mimetype });
    cb(null, true);
  }
});

const inputBucket = (process.env.SUPABASE_INPUT_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || "docflow-inputs").trim();

// Middleware to handle multer errors
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("[ERROR] Multer error:", err.code, err.message);
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(413).json({
        error: "File too large",
        message: "Maximum file size is 50MB"
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Too many files",
        message: "Only one file allowed per request"
      });
    }
    return res.status(400).json({
      error: "File upload error",
      message: err.message
    });
  }
  next(err);
};

const parseSupabasePath = (storedPath) => {
  if (!storedPath) return null;
  
  // Handle Supabase cloud storage paths
  if (storedPath.startsWith("supabase://")) {
    const remainder = storedPath.slice("supabase://".length);
    const slashIndex = remainder.indexOf("/");
    if (slashIndex === -1) return null;
    return {
      type: "supabase",
      bucket: remainder.slice(0, slashIndex),
      objectPath: remainder.slice(slashIndex + 1)
    };
  }
  
  // Handle local base64 encoded paths: local://path/to/file|base64data
  if (storedPath.startsWith("local://")) {
    const remainder = storedPath.slice("local://".length);
    const pipeIndex = remainder.indexOf("|");
    if (pipeIndex === -1) return null;
    return {
      type: "local",
      objectPath: remainder.slice(0, pipeIndex),
      b64Content: remainder.slice(pipeIndex + 1)
    };
  }
  
  return null;
};

const getDownloadName = (job) => {
  const extension = job?.output_format || path.extname(job?.stored_output_path || "") || "";
  const baseName = (job?.original_file_name || "download").replace(/\.[^.]*$/, "");
  return `${baseName}${extension}`;
};

const uploadToSupabaseStorage = async (bucket, objectPath, file) => {
  // If Supabase is configured, use cloud storage
  if (supabaseService.supabase) {
    const { error } = await supabaseService.supabase.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype || "application/octet-stream",
      upsert: true
    });
    if (error) throw error;
    return `supabase://${bucket}/${objectPath}`;
  }

  // Otherwise, store file reference locally with base64 encoding for small files
  const isSmallFile = file.size < 5 * 1024 * 1024; // 5MB threshold
  if (isSmallFile) {
    const b64Content = file.buffer.toString("base64");
    return `local://${objectPath}|${b64Content}`;
  }

  // For larger files without Supabase, throw informative error
  throw new Error(
    `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB) for local-only conversion. ` +
    `Please configure Supabase for file storage: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.`
  );
};

const downloadSupabaseFile = async (bucket, objectPath) => {
  if (!supabaseService.supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabaseService.supabase.storage.from(bucket).download(objectPath);
  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("File not found in storage");
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return buffer;
};

const downloadLocalFile = (b64Content) => {
  // Decode base64 content back to binary buffer
  return Buffer.from(b64Content, "base64");
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const requestOrigin = req.header("Origin");

  if (requestOrigin) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "false");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers") || "Content-Type");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.get("/", (req, res) => {
  res.json({
    message: "DocFlow Pro API",
    version: "1.0.0",
    status: "ok",
    environment: process.env.NODE_ENV || "development"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/setup", async (req, res) => {
  try {
    const supabaseConfigured = Boolean(supabaseService.supabase);
    const config = {
      supabase_configured: supabaseConfigured,
      supabase_url: process.env.SUPABASE_URL ? "✓ Set" : "✗ Missing",
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ Set" : "✗ Missing",
      input_bucket: process.env.SUPABASE_INPUT_BUCKET || "docflow-inputs",
      output_bucket: process.env.SUPABASE_OUTPUT_BUCKET || "docflow-outputs"
    };

    if (supabaseService.supabase) {
      try {
        const { data, error } = await supabaseService.supabase
          .from("conversion_jobs")
          .select("COUNT(*)", { count: "exact", head: true });
        config.database_connection = error ? "✗ " + error.message : "✓ Connected";
      } catch (dbError) {
        config.database_connection = "✗ " + dbError.message;
      }

      try {
        const { data, error } = await supabaseService.supabase.storage.listBuckets();
        if (error) {
          config.storage_connection = "✗ " + error.message;
        } else {
          const buckets = data?.map(b => b.name) || [];
          config.storage_connection = "✓ Connected";
          config.available_buckets = buckets;
        }
      } catch (storageError) {
        config.storage_connection = "✗ " + storageError.message;
      }
    }

    return res.json({
      status: supabaseConfigured ? "configured" : "not_configured",
      configuration: config
    });
  } catch (error) {
    res.status(500).json({
      error: "Setup verification failed",
      message: error.message
    });
  }
});

app.post("/api/convert", upload.single("file"), multerErrorHandler, async (req, res, next) => {
  try {
    const tool = req.body?.tool;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        error: "No file provided"
      });
    }

    if (!tool) {
      return res.status(400).json({
        error: "No tool specified"
      });
    }

    const validationErrors = validationService.validateFile(file, tool);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: validationErrors.join("; ")
      });
    }

    // Supabase is optional - we have a local fallback for development/testing
    const supabaseConfigured = Boolean(supabaseService.supabase);
    if (!supabaseConfigured) {
      console.warn(
        "[WARN] Supabase not configured. Using local fallback for file storage. " +
        "For production, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
      );
    }

    const jobId = uuidv4();
    const toolConfig = validationService.getToolConfig(tool);
    const inputFormat = path.extname(file.originalname).toLowerCase();
    const outputFormat = toolConfig?.outputFormat || ".out";
    const safeFileName = file.originalname.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
    const inputObjectPath = `inputs/${jobId}/${safeFileName}`;
    
    console.log("[DEBUG] Uploading file:", { jobId, tool, fileName: safeFileName, fileSize: file.size });
    const storedInputPath = await uploadToSupabaseStorage(inputBucket, inputObjectPath, file);
    console.log("[DEBUG] File uploaded:", { storedInputPath: storedInputPath.substring(0, 50) + "..." });

    await supabaseService.createJobRecord({
      jobId,
      tool,
      inputFormat,
      outputFormat,
      originalFileName: file.originalname,
      inputPath: storedInputPath,
      fileSize: file.size
    });
    console.log("[DEBUG] Job record created:", jobId);

    await queueService.addConversionJob({
      jobId,
      tool,
      inputPath: storedInputPath,
      outputFormat,
      originalFileName: file.originalname
    });
    console.log("[DEBUG] Job queued:", jobId);

    await supabaseService.logUsage(req.ip || req.connection.remoteAddress, tool, file.size, "queued");
    console.log("[DEBUG] Usage logged");

    return res.status(201).json({
      jobId,
      status: "queued",
      message: "Your file is queued for conversion"
    });
  } catch (error) {
    console.error("[ERROR] POST /api/convert failed:", error);
    next(error);
  }
});

app.get("/api/jobs/:jobId", async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const dbRecord = await supabaseService.getJobRecord(jobId);

    if (!dbRecord) {
      return res.status(404).json({
        error: "Job not found"
      });
    }

    let progress = dbRecord.progress || 0;
    if (!progress || progress === 0) {
      const queueStatus = await queueService.getJobStatus(jobId);
      progress = queueStatus?.progress || progress;
    }

    if (dbRecord.status === "completed") {
      progress = 100;
    }

    const response = {
      jobId,
      status: dbRecord.status,
      progress,
      createdAt: dbRecord.created_at,
      startedAt: dbRecord.started_at,
      completedAt: dbRecord.completed_at
    };

    if (dbRecord.status === "completed") {
      response.downloadUrl = `/api/download/${jobId}`;
    }

    if (dbRecord.status === "failed") {
      response.message = dbRecord.error_message || "Conversion failed";
    }

    return res.json(response);
  } catch (error) {
    next(error);
  }
});

app.get("/api/download/:jobId", async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await supabaseService.getJobRecord(jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found"
      });
    }

    if (job.status !== "completed") {
      return res.status(400).json({
        error: "File is not ready for download"
      });
    }

    if (job.expires_at && new Date(job.expires_at) < new Date()) {
      return res.status(410).json({
        error: "File has expired"
      });
    }

    const remotePath = parseSupabasePath(job.stored_output_path);
    const downloadName = getDownloadName(job);

    if (remotePath) {
      let buffer;
      if (remotePath.type === "supabase") {
        buffer = await downloadSupabaseFile(remotePath.bucket, remotePath.objectPath);
      } else if (remotePath.type === "local") {
        buffer = downloadLocalFile(remotePath.b64Content);
      }
      
      if (buffer) {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
        return res.send(buffer);
      }
    }

    return res.status(404).json({
      error: "Converted file not available"
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path
  });
});

app.use((err, req, res, next) => {
  const errorMessage = err?.message || "Unknown error";
  const errorStack = err?.stack || "No stack available";
  
  console.error("[ERROR] Internal server error:", {
    message: errorMessage,
    stack: errorStack,
    url: req.url,
    method: req.method,
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
  
  // Provide diagnostic information for common configuration issues
  let diagnostics = null;
  if (errorMessage && (typeof errorMessage === "string") && errorMessage.includes("Supabase")) {
    diagnostics = {
      supabase_configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      supabase_url_set: Boolean(process.env.SUPABASE_URL),
      supabase_key_set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hint: "Set environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for cloud file storage"
    };
  }
  
  const statusCode = err?.status || err?.statusCode || 500;
  res.status(statusCode).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? errorMessage : "Something went wrong",
    diagnostics: process.env.NODE_ENV === "development" ? diagnostics : undefined
  });
});

export default app;
