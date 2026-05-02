/**
 * Storage service for file management
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../../storage/uploads");
const convertedDir = path.join(__dirname, "../../storage/converted");

/**
 * Get uploaded file path
 */
export const getUploadPath = (filename) => {
  return path.join(uploadDir, filename);
};

/**
 * Get converted file path
 */
export const getConvertedPath = (filename) => {
  return path.join(convertedDir, filename);
};

/**
 * Save converted file
 */
export const saveConvertedFile = (filename, data) => {
  const filepath = getConvertedPath(filename);

  if (!fs.existsSync(convertedDir)) {
    fs.mkdirSync(convertedDir, { recursive: true });
  }

  if (data instanceof Buffer) {
    fs.writeFileSync(filepath, data);
  } else {
    fs.writeFileSync(filepath, data);
  }

  return filepath;
};

/**
 * Read file
 */
export const readFile = (filepath) => {
  if (!fs.existsSync(filepath)) {
    throw new Error("File not found");
  }
  return fs.readFileSync(filepath);
};

/**
 * File exists
 */
export const fileExists = (filepath) => {
  return fs.existsSync(filepath);
};

/**
 * Delete file
 */
export const deleteFile = (filepath) => {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
};

/**
 * Clean up old files
 */
export const cleanupOldFiles = (maxAgeHours = 1) => {
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();

  // Clean upload directory
  if (fs.existsSync(uploadDir)) {
    fs.readdirSync(uploadDir).forEach((file) => {
      const filepath = path.join(uploadDir, file);
      const stat = fs.statSync(filepath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filepath);
      }
    });
  }

  // Clean converted directory
  if (fs.existsSync(convertedDir)) {
    fs.readdirSync(convertedDir).forEach((file) => {
      const filepath = path.join(convertedDir, file);
      const stat = fs.statSync(filepath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filepath);
      }
    });
  }
};

export default {
  getUploadPath,
  getConvertedPath,
  saveConvertedFile,
  readFile,
  fileExists,
  deleteFile,
  cleanupOldFiles
};
