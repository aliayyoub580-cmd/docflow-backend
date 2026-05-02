/**
 * Queue service for job management.
 * Uses BullMQ when Redis is available and a local JSON fallback otherwise.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Queue } from "bullmq";
import Redis from "ioredis";

const redisOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localStoragePath = path.join(__dirname, "../../storage/local-db.json");

const ensureLocalStore = () => {
  const storeDir = path.dirname(localStoragePath);
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
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

let conversionQueue = null;

const ensureRedisQueue = async () => {
  if (conversionQueue) {
    return conversionQueue;
  }

  try {
    const probe = new Redis({
      host: redisOptions.host,
      port: redisOptions.port,
      password: redisOptions.password,
      connectTimeout: 1000,
      maxRetriesPerRequest: 1
    });

    await probe.ping();
    probe.disconnect();

    conversionQueue = new Queue("conversions", {
      connection: redisOptions
    });

    return conversionQueue;
  } catch (error) {
    console.warn("BullMQ queue unavailable, using local fallback:", error.message);
    conversionQueue = null;
    return null;
  }
};

/**
 * Add conversion job to queue
 */
export const addConversionJob = async (jobData) => {
  try {
    const queue = await ensureRedisQueue();

    if (!queue) {
      const store = readLocalStore();
      const record = store.conversion_jobs[jobData.jobId];
      if (record) {
        record.status = "queued";
        record.updated_at = new Date().toISOString();
        store.conversion_jobs[jobData.jobId] = record;
        writeLocalStore(store);
      }

      return {
        id: jobData.jobId,
        data: jobData,
        progress: 0,
        getState: async () => "queued"
      };
    }

    const job = await queue.add("convert", jobData, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000
      },
      removeOnComplete: true,
      removeOnFail: false,
      timeout: 10 * 60 * 1000 // 10 minute timeout
    });

    console.log(`Job added to queue: ${job.id}`);
    return job;
  } catch (error) {
    console.error("Error adding job to queue:", error);
    throw error;
  }
};

/**
 * Get job from queue
 */
export const getJob = async (jobId) => {
  try {
    const queue = await ensureRedisQueue();

    if (!queue) {
      const store = readLocalStore();
      const record = store.conversion_jobs[jobId];
      if (!record) return null;
      return {
        id: jobId,
        data: record,
        progress: async () => (record.status === "completed" ? 100 : 0),
        getState: async () => record.status,
        attemptsMade: record.attempts_made || 0,
        failedReason: record.error_message || null
      };
    }

    return await queue.getJob(jobId);
  } catch (error) {
    console.error("Error getting job:", error);
    throw error;
  }
};

/**
 * Get job status
 */
export const getJobStatus = async (jobId) => {
  try {
    const job = await getJob(jobId);
    if (!job) return null;

    const state = typeof job.getState === "function" ? await job.getState() : job.status || "unknown";
    const progress = typeof job.progress === "function" ? await job.progress() : job.progress || 0;

    return {
      id: job.id,
      status: state,
      progress: progress || 0,
      attempts: job.attemptsMade,
      failedReason: job.failedReason,
      data: job.data
    };
  } catch (error) {
    console.error("Error getting job status:", error);
    throw error;
  }
};

/**
 * Update job progress
 */
export const updateJobProgress = async (jobId, progress) => {
  try {
    const queue = await ensureRedisQueue();

    if (!queue) {
      const store = readLocalStore();
      const record = store.conversion_jobs[jobId];
      if (record) {
        record.progress = progress;
        record.updated_at = new Date().toISOString();
        store.conversion_jobs[jobId] = record;
        writeLocalStore(store);
      }
      return;
    }

    const job = await getJob(jobId);
    if (job) {
      await job.updateProgress(progress);
    }
  } catch (error) {
    console.error("Error updating job progress:", error);
  }
};

/**
 * Remove job
 */
export const removeJob = async (jobId) => {
  try {
    const queue = await ensureRedisQueue();

    if (!queue) {
      const store = readLocalStore();
      delete store.conversion_jobs[jobId];
      writeLocalStore(store);
      return;
    }

    const job = await getJob(jobId);
    if (job) {
      await job.remove();
    }
  } catch (error) {
    console.error("Error removing job:", error);
  }
};

/**
 * Get queue stats
 */
export const getQueueStats = async () => {
  try {
    const queue = await ensureRedisQueue();

    if (!queue) {
      const store = readLocalStore();
      const records = Object.values(store.conversion_jobs);
      const counts = records.reduce((acc, record) => {
        acc[record.status] = (acc[record.status] || 0) + 1;
        return acc;
      }, {});
      return {
        active: counts.processing || 0,
        delayed: 0,
        failed: counts.failed || 0,
        completed: counts.completed || 0,
        waiting: counts.queued || 0
      };
    }

    const counts = await queue.getJobCounts();
    return {
      active: counts.active || 0,
      delayed: counts.delayed || 0,
      failed: counts.failed || 0,
      completed: counts.completed || 0,
      waiting: counts.waiting || 0
    };
  } catch (error) {
    console.error("Error getting queue stats:", error);
    return {};
  }
};

export default {
  conversionQueue,
  addConversionJob,
  getJob,
  getJobStatus,
  updateJobProgress,
  removeJob,
  getQueueStats
};
