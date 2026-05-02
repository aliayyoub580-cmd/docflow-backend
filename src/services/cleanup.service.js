/**
 * Cleanup service - periodically removes expired files and marks jobs expired.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as supabaseService from "../config/supabase.js";
import * as storageService from "./storage.service.js";

const DEFAULT_EXPIRY_HOURS = Number.parseInt(process.env.FILE_EXPIRY_HOURS || "1", 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localStorePath = path.join(__dirname, "../../storage/local-db.json");

const readLocalStore = () => {
  if (!fs.existsSync(localStorePath)) {
    return { conversion_jobs: {}, usage_logs: [] };
  }

  return JSON.parse(fs.readFileSync(localStorePath, "utf-8"));
};

const writeLocalStore = (store) => {
  const storeDir = path.dirname(localStorePath);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  fs.writeFileSync(localStorePath, JSON.stringify(store, null, 2));
};

const cleanupJobFiles = (job) => {
  if (job.stored_input_path && storageService.fileExists(job.stored_input_path)) {
    storageService.deleteFile(job.stored_input_path);
  }

  if (job.stored_output_path && storageService.fileExists(job.stored_output_path)) {
    storageService.deleteFile(job.stored_output_path);
  }
};

const cleanupLocalExpiredJobs = () => {
  const now = new Date();
  const store = readLocalStore();

  for (const [jobId, job] of Object.entries(store.conversion_jobs)) {
    if (!job.expires_at || new Date(job.expires_at) > now) {
      continue;
    }

    try {
      cleanupJobFiles(job);
      store.conversion_jobs[jobId] = {
        ...job,
        status: "expired",
        updated_at: new Date().toISOString()
      };
    } catch (err) {
      console.error(`Cleanup: error removing files for job ${jobId}:`, err);
    }
  }

  writeLocalStore(store);
};

const cleanupSupabaseExpiredJobs = async () => {
  const now = new Date().toISOString();
  const { data: expiredJobs, error } = await supabaseService.supabase
    .from("conversion_jobs")
    .select("id, stored_input_path, stored_output_path, status, expires_at")
    .lte("expires_at", now)
    .in("status", ["pending", "queued", "processing", "completed"]);

  if (error) {
    console.error("Cleanup: error querying expired jobs:", error);
    return;
  }

  for (const job of expiredJobs || []) {
    try {
      cleanupJobFiles(job);
      await supabaseService.updateJobStatus(job.id, "expired");
    } catch (err) {
      console.error(`Cleanup: error removing files for job ${job.id}:`, err);
    }
  }
};

export const cleanupExpiredJobs = async (maxAgeHours = DEFAULT_EXPIRY_HOURS) => {
  try {
    if (!supabaseService.supabase) {
      cleanupLocalExpiredJobs();
      return;
    }

    await cleanupSupabaseExpiredJobs();
  } catch (err) {
    console.error("Cleanup service error:", err);
  }
};

export default {
  cleanupExpiredJobs
};
