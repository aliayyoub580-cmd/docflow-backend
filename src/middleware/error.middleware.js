/**
 * Global error handling middleware
 */

const errorMiddleware = (err, req, res, next) => {
  console.error("Error:", err);

  // Multer errors
  if (err.name === "MulterError") {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(400).json({
        error: "File is too large. Maximum size is 50 MB."
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Too many files uploaded"
      });
    }
    return res.status(400).json({
      error: "File upload error: " + err.message
    });
  }

  // Validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: err.message
    });
  }

  // Database errors
  if (err.code === "PGRST") {
    return res.status(500).json({
      error: "Database error"
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || "Something went wrong"
  });
};

export default errorMiddleware;
