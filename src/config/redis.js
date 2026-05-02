/**
 * Redis configuration
 */

import redis from "redis";
import { Queue } from "bullmq";

const client = redis.createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
});

client.on("error", (err) => {
  console.error("Redis client error:", err);
});

client.on("connect", () => {
  console.log("Connected to Redis");
});

/**
 * Create conversion queue
 */
const conversionQueue = new Queue("conversions", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

/**
 * Add job to queue
 */
export const addConversionJob = async (jobData) => {
  try {
    const job = await conversionQueue.add("convert", jobData, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000
      },
      removeOnComplete: false,
      removeOnFail: false
    });
    return job;
  } catch (error) {
    console.error("Error adding job to queue:", error);
    throw error;
  }
};

/**
 * Get job status
 */
export const getJobStatus = async (jobId) => {
  try {
    const job = await conversionQueue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      data: job.data,
      status: await job.getState(),
      progress: job.progress(),
      attempts: job.attemptsMade,
      failedReason: job.failedReason
    };
  } catch (error) {
    console.error("Error getting job status:", error);
    throw error;
  }
};

export default {
  client,
  conversionQueue,
  addConversionJob,
  getJobStatus
};
