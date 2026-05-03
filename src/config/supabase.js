/**
 * Supabase configuration with a local JSON fallback for offline smoke tests.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const usingSupabase = Boolean(supabaseUrl && supabaseKey);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localStoragePath = path.join(__dirname, "../../storage/local-db.json");

const ensureLocalStore = () => {
  const storeDir = path.dirname(localStoragePath);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }
  if (!fs.existsSync(localStoragePath)) {
    fs.writeFileSync(localStoragePath, JSON.stringify({ conversion_jobs: {}, usage_logs: [] }, null, 2));
  }
};

const readLocalStore = () => {
  ensureLocalStore();
  return JSON.parse(fs.readFileSync(localStoragePath, "utf-8"));
};

const writeLocalStore = (store) => {
  ensureLocalStore();
  fs.writeFileSync(localStoragePath, JSON.stringify(store, null, 2));
};

let supabase = null;
if (usingSupabase) {
  try {
    console.log("[INFO] Initializing Supabase client with URL:", supabaseUrl);
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("[INFO] ✓ Supabase client initialized successfully");
  } catch (error) {
    console.error("[ERROR] Failed to initialize Supabase client:", error.message);
    console.error("[DEBUG] Stack:", error.stack);
    supabase = null;
  }
} else {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push("SUPABASE_URL");
  if (!supabaseKey) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");
  console.warn("[WARN] Supabase not configured. Using local JSON fallback. Missing:", missingVars.join(", "));
}

/**
 * Create conversion job record
 */
export const createJobRecord = async (jobData) => {
  try {
    if (!supabase) {
      const store = readLocalStore();
      const record = {
        id: jobData.jobId,
        tool: jobData.tool,
        input_format: jobData.inputFormat,
        output_format: jobData.outputFormat,
        original_file_name: jobData.originalFileName,
        stored_input_path: jobData.inputPath,
        status: "pending",
        file_size: jobData.fileSize,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      };
      store.conversion_jobs[record.id] = record;
      writeLocalStore(store);
      return [record];
    }

    const { data, error } = await supabase
      .from("conversion_jobs")
      .insert({
        id: jobData.jobId,
        tool: jobData.tool,
        input_format: jobData.inputFormat,
        output_format: jobData.outputFormat,
        original_file_name: jobData.originalFileName,
        stored_input_path: jobData.inputPath,
        status: "pending",
        file_size: jobData.fileSize,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      })
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error creating job record:", error);
    throw error;
  }
};

/**
 * Update job status
 */
export const updateJobStatus = async (jobId, status, data = {}) => {
  try {
    if (!supabase) {
      const store = readLocalStore();
      const record = store.conversion_jobs[jobId];
      if (!record) return null;

      record.status = status;
      record.updated_at = new Date().toISOString();
      if (status === "processing") {
        record.started_at = new Date().toISOString();
      } else if (status === "completed") {
        record.completed_at = new Date().toISOString();
        record.stored_output_path = data.outputPath;
      } else if (status === "failed") {
        record.error_message = data.errorMessage;
      }

      store.conversion_jobs[jobId] = record;
      writeLocalStore(store);
      return [record];
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === "processing") {
      updateData.started_at = new Date().toISOString();
    } else if (status === "completed") {
      updateData.completed_at = new Date().toISOString();
      updateData.stored_output_path = data.outputPath;
    } else if (status === "failed") {
      updateData.error_message = data.errorMessage;
    }

    const { data: result, error } = await supabase
      .from("conversion_jobs")
      .update(updateData)
      .eq("id", jobId)
      .select();

    if (error) throw error;
    return result;
  } catch (error) {
    console.error("Error updating job status:", error);
    throw error;
  }
};

/**
 * Get job record
 */
export const getJobRecord = async (jobId) => {
  try {
    if (!supabase) {
      const store = readLocalStore();
      return store.conversion_jobs[jobId] || null;
    }

    const { data, error } = await supabase
      .from("conversion_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error getting job record:", error);
    throw error;
  }
};

/**
 * Log usage
 */
export const logUsage = async (ipAddress, tool, fileSize, status) => {
  try {
    if (!supabase) {
      const store = readLocalStore();
      store.usage_logs.push({
        ip_address: ipAddress,
        tool,
        file_size: fileSize,
        status,
        created_at: new Date().toISOString()
      });
      writeLocalStore(store);
      return;
    }

    const { error } = await supabase.from("usage_logs").insert({
      ip_address: ipAddress,
      tool,
      file_size: fileSize,
      status,
      created_at: new Date().toISOString()
    });

    if (error) throw error;
  } catch (error) {
    console.error("Error logging usage:", error);
  }
};

export default {
  supabase,
  usingSupabase,
  createJobRecord,
  updateJobStatus,
  getJobRecord,
  logUsage
};
