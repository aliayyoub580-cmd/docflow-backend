/**
 * File validation service
 */

import { TOOLS } from "../config/tools.config.js";

/**
 * Validate file for conversion
 */
export const validateFile = (file, toolId) => {
  const errors = [];

  if (!file) {
    errors.push("No file provided");
    return errors;
  }

  const tool = TOOLS.find((t) => t.id === toolId);
  if (!tool) {
    errors.push("Invalid tool");
    return errors;
  }

  // Check file extension
  const fileExt = "." + file.originalname.split(".").pop().toLowerCase();
  if (!tool.inputFormats.includes(fileExt)) {
    errors.push(
      `Invalid file type. Allowed formats: ${tool.inputFormats.join(", ")}`
    );
  }

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > tool.maxFileSizeMB) {
    errors.push(
      `File is too large. Maximum: ${tool.maxFileSizeMB}MB (Your file: ${fileSizeMB.toFixed(2)}MB)`
    );
  }

  // Serverless uploads use in-memory buffers instead of a local path.
  if (!file.buffer && !file.path) {
    errors.push("File upload failed");
  }

  return errors;
};

/**
 * Get tool configuration
 */
export const getToolConfig = (toolId) => {
  return TOOLS.find((t) => t.id === toolId);
};

/**
 * Validate tool ID
 */
export const isValidTool = (toolId) => {
  return TOOLS.some((t) => t.id === toolId);
};

export default {
  validateFile,
  getToolConfig,
  isValidTool
};
